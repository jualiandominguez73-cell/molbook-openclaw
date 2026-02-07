import type { SigConfig } from "@disreguard/sig";
import type { AnyAgentTool } from "./tools/common.js";
import { createSubsystemLogger } from "../logging/subsystem.js";
import { getGlobalHookRunner } from "../plugins/hook-runner-global.js";
import { logGateEvent } from "./sig-gate-audit.js";
import { checkMutationGate } from "./sig-mutation-gate.js";
import { checkVerificationGate, SIG_GATED_TOOLS } from "./sig-verification-gate.js";
import { normalizeToolName } from "./tool-policy.js";

type HookContext = {
  agentId?: string;
  sessionKey?: string;
  /** Current turn ID for sig verification gate. */
  turnId?: string;
  /** Config reference for sig verification gate. */
  config?: import("../config/config.js").OpenClawConfig;
  /** sig project root for mutation gate file policy resolution. */
  projectRoot?: string;
  /** Loaded sig config for mutation gate file policy resolution. */
  sigConfig?: SigConfig | null;
};

type HookOutcome = { blocked: true; reason: string } | { blocked: false; params: unknown };

const log = createSubsystemLogger("agents/tools");

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Check if sig enforcement is enabled in config (same logic as checkVerificationGate). */
function isEnforcementEnabled(config: unknown): boolean {
  const agents = (config as Record<string, unknown>)?.agents as Record<string, unknown> | undefined;
  const defaults = agents?.defaults as Record<string, unknown> | undefined;
  const sig = defaults?.sig as { enforceVerification?: boolean } | undefined;
  return !!sig?.enforceVerification;
}

export async function runBeforeToolCallHook(args: {
  toolName: string;
  params: unknown;
  toolCallId?: string;
  ctx?: HookContext;
}): Promise<HookOutcome> {
  // sig verification gate: deterministic check before plugin hooks.
  // This runs first so injected text cannot bypass it.
  const gateResult = checkVerificationGate(
    args.toolName,
    args.ctx?.sessionKey,
    args.ctx?.turnId,
    args.ctx?.config,
  );
  if (gateResult.blocked) {
    if (args.ctx?.projectRoot) {
      logGateEvent(args.ctx.projectRoot, {
        event: "gate_blocked",
        gate: "verification",
        tool: args.toolName,
        session: args.ctx.sessionKey,
        turn: args.ctx.turnId,
        reason: gateResult.reason,
      }).catch(() => {});
    }
    return gateResult;
  }

  // sig mutation gate: blocks write/edit to protected mutable files.
  // Runs after the verification gate, before plugin hooks.
  const mutationResult = checkMutationGate(
    args.toolName,
    args.params,
    args.ctx?.projectRoot,
    args.ctx?.sigConfig,
  );
  if (mutationResult.blocked) {
    if (args.ctx?.projectRoot) {
      logGateEvent(args.ctx.projectRoot, {
        event: "gate_blocked",
        gate: "mutation",
        tool: args.toolName,
        session: args.ctx.sessionKey,
        turn: args.ctx.turnId,
        reason: mutationResult.reason,
      }).catch(() => {});
    }
    return mutationResult;
  }

  // Audit: log gated tools that pass both gates (verified execution).
  // Only log when enforcement is active — otherwise the gate wasn't involved.
  if (
    args.ctx?.projectRoot &&
    isEnforcementEnabled(args.ctx.config) &&
    SIG_GATED_TOOLS.has(args.toolName.trim().toLowerCase())
  ) {
    logGateEvent(args.ctx.projectRoot, {
      event: "gate_allowed",
      gate: "verification",
      tool: args.toolName,
      session: args.ctx.sessionKey,
      turn: args.ctx.turnId,
    }).catch(() => {});
  }

  const hookRunner = getGlobalHookRunner();
  if (!hookRunner?.hasHooks("before_tool_call")) {
    return { blocked: false, params: args.params };
  }

  const toolName = normalizeToolName(args.toolName || "tool");
  const params = args.params;
  try {
    const normalizedParams = isPlainObject(params) ? params : {};
    const hookResult = await hookRunner.runBeforeToolCall(
      {
        toolName,
        params: normalizedParams,
      },
      {
        toolName,
        agentId: args.ctx?.agentId,
        sessionKey: args.ctx?.sessionKey,
      },
    );

    if (hookResult?.block) {
      return {
        blocked: true,
        reason: hookResult.blockReason || "Tool call blocked by plugin hook",
      };
    }

    if (hookResult?.params && isPlainObject(hookResult.params)) {
      if (isPlainObject(params)) {
        return { blocked: false, params: { ...params, ...hookResult.params } };
      }
      return { blocked: false, params: hookResult.params };
    }
  } catch (err) {
    const toolCallId = args.toolCallId ? ` toolCallId=${args.toolCallId}` : "";
    log.warn(`before_tool_call hook failed: tool=${toolName}${toolCallId} error=${String(err)}`);
  }

  return { blocked: false, params };
}

export function wrapToolWithBeforeToolCallHook(
  tool: AnyAgentTool,
  ctx?: HookContext,
): AnyAgentTool {
  const execute = tool.execute;
  if (!execute) {
    return tool;
  }
  const toolName = tool.name || "tool";
  return {
    ...tool,
    execute: async (toolCallId, params, signal, onUpdate) => {
      const outcome = await runBeforeToolCallHook({
        toolName,
        params,
        toolCallId,
        ctx,
      });
      if (outcome.blocked) {
        throw new Error(outcome.reason);
      }
      return await execute(toolCallId, outcome.params, signal, onUpdate);
    },
  };
}

export const __testing = {
  runBeforeToolCallHook,
  isPlainObject,
};
