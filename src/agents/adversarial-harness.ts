/**
 * Adversarial test harness for prompt injection defense.
 *
 * Simulates multi-turn adversarial conversations by running scripted
 * tool calls through the real hook pipeline (verification gate +
 * mutation gate). Used for mocked scenario tests and as infrastructure
 * for live LLM injection tests.
 *
 * Key design: wrapToolWithBeforeToolCallHook captures the ctx object
 * by reference (closure). The harness mutates hookCtx.turnId before
 * each turn — this propagates to wrapped tools without re-wrapping.
 */

import type { SigConfig } from "@disreguard/sig";
import type { AnyAgentTool } from "./tools/common.js";
import { wrapToolWithBeforeToolCallHook } from "./pi-tools.before-tool-call.js";
import {
  resetVerification,
  setVerified,
  clearSessionSecurityState,
} from "./session-security-state.js";

// -- Types -------------------------------------------------------------------

/** Lightweight tool call descriptor for scenario configs. */
export interface HarnessToolCall {
  name: string;
  args: Record<string, unknown>;
}

export type CallOutcome = "executed" | "blocked" | "not_found";

export interface CallRecord {
  tool: string;
  outcome: CallOutcome;
  error?: string;
}

export interface TurnRecord {
  turnId: string;
  verified: boolean;
  calls: CallRecord[];
}

export interface ScenarioReport {
  name: string;
  turns: TurnRecord[];
  totals: { executed: number; blocked: number; notFound: number };
}

export interface TurnConfig {
  /** Turn identifier. */
  turnId: string;
  /** Whether to call setVerified() before running tool calls. */
  verified?: boolean;
  /** Tool calls to execute this turn. */
  calls: HarnessToolCall[];
}

export interface ScenarioConfig {
  name: string;
  sessionKey?: string;
  /** Config object for the verification gate. */
  config?: unknown;
  /** Project root for mutation gate file policy resolution. */
  projectRoot?: string;
  /** sig config for mutation gate file policy resolution. */
  sigConfig?: SigConfig | null;
  /** Turns to execute. */
  turns: TurnConfig[];
}

// -- Helpers -----------------------------------------------------------------

/** Shorthand to construct a HarnessToolCall. */
export function tc(name: string, args: Record<string, unknown> = {}): HarnessToolCall {
  return { name, args };
}

/** Create a mock tool that records whether execute() was reached. */
export function createMockTool(name: string): AnyAgentTool & { calls: unknown[][] } {
  const calls: unknown[][] = [];
  return {
    name,
    label: name,
    description: `Mock ${name} tool`,
    parameters: {},
    calls,
    execute: async (_toolCallId: string, params: unknown) => {
      calls.push([_toolCallId, params]);
      return { content: [{ type: "text" as const, text: `${name} executed` }], details: {} };
    },
  };
}

// -- Tool wrapping -----------------------------------------------------------

type HookCtx = {
  sessionKey?: string;
  turnId?: string;
  config?: unknown;
  projectRoot?: string;
  sigConfig?: SigConfig | null;
};

/**
 * Create mock tools and wrap them with the real before-tool-call hook.
 * Returns a map of tool name → wrapped tool, plus the shared mutable ctx.
 *
 * Because wrapToolWithBeforeToolCallHook captures ctx by reference,
 * mutating ctx.turnId before each turn propagates automatically.
 */
export function buildWrappedToolMap(
  toolNames: string[],
  hookCtx: HookCtx,
): {
  tools: Map<string, AnyAgentTool>;
  mocks: Map<string, AnyAgentTool & { calls: unknown[][] }>;
  ctx: HookCtx;
} {
  const tools = new Map<string, AnyAgentTool>();
  const mocks = new Map<string, AnyAgentTool & { calls: unknown[][] }>();

  for (const name of toolNames) {
    const mock = createMockTool(name);
    mocks.set(name, mock);
    tools.set(name, wrapToolWithBeforeToolCallHook(mock, hookCtx as never));
  }

  return { tools, mocks, ctx: hookCtx };
}

// -- Scenario runner ---------------------------------------------------------

/**
 * Run a multi-turn adversarial scenario through the real hook pipeline.
 *
 * For each turn:
 *   1. Reset verification state
 *   2. Optionally set verified
 *   3. Update hookCtx.turnId (propagates to wrapped tools via closure)
 *   4. Execute each tool call and record outcome
 */
export async function runAdversarialScenario(config: ScenarioConfig): Promise<ScenarioReport> {
  const sessionKey = config.sessionKey ?? "adversarial-session";
  const hookCtx: HookCtx = {
    sessionKey,
    turnId: "",
    config: config.config,
    projectRoot: config.projectRoot,
    sigConfig: config.sigConfig,
  };

  // Collect all unique tool names from all turns
  const allToolNames = new Set<string>();
  for (const turn of config.turns) {
    for (const call of turn.calls) {
      allToolNames.add(call.name);
    }
  }

  const { tools } = buildWrappedToolMap([...allToolNames], hookCtx);

  // Clear any prior state
  clearSessionSecurityState(sessionKey);

  const turns: TurnRecord[] = [];
  const totals = { executed: 0, blocked: 0, notFound: 0 };

  for (const turn of config.turns) {
    // Reset verification for this turn
    resetVerification(sessionKey, turn.turnId);
    hookCtx.turnId = turn.turnId;

    if (turn.verified) {
      setVerified(sessionKey, turn.turnId);
    }

    const callRecords: CallRecord[] = [];

    for (const call of turn.calls) {
      const wrappedTool = tools.get(call.name);
      if (!wrappedTool) {
        callRecords.push({ tool: call.name, outcome: "not_found" });
        totals.notFound++;
        continue;
      }

      try {
        await wrappedTool.execute(`call-${call.name}`, call.args, undefined, undefined);
        callRecords.push({ tool: call.name, outcome: "executed" });
        totals.executed++;
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        callRecords.push({ tool: call.name, outcome: "blocked", error });
        totals.blocked++;
      }
    }

    turns.push({ turnId: turn.turnId, verified: turn.verified ?? false, calls: callRecords });
  }

  // Clean up
  clearSessionSecurityState(sessionKey);

  return { name: config.name, turns, totals };
}
