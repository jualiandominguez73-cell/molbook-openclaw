/**
 * Deterministic verification gate for sig-enforced tool access.
 *
 * Checks that the `verify` tool was called in the current turn before
 * allowing access to sensitive tools. Runs as a first-class orchestrator
 * check in the before-tool-call hook, before any plugin hooks.
 */

import type { OpenClawConfig } from "../config/config.js";
import { isVerified } from "./session-security-state.js";

/**
 * Tools that require verification before use when enforcement is enabled.
 */
export const SIG_GATED_TOOLS = new Set<string>([
  "exec",
  "write",
  "edit",
  "apply_patch",
  "message",
  "gateway",
  "sessions_spawn",
  "sessions_send",
  "update_and_sign",
]);

export type GateResult = { blocked: false } | { blocked: true; reason: string };

/**
 * Check whether a tool call should be blocked by the verification gate.
 *
 * Returns `{ blocked: false }` if the tool is allowed, or
 * `{ blocked: true, reason }` with an actionable message if blocked.
 */
export function checkVerificationGate(
  toolName: string,
  sessionKey: string | undefined,
  turnId: string | undefined,
  config: OpenClawConfig | undefined,
): GateResult {
  // Check if enforcement is enabled in config
  const sigConfig = (config as Record<string, unknown>)?.agents as
    | Record<string, unknown>
    | undefined;
  const defaults = sigConfig?.defaults as Record<string, unknown> | undefined;
  const sig = defaults?.sig as { enforceVerification?: boolean; gatedTools?: string[] } | undefined;

  if (!sig?.enforceVerification) {
    return { blocked: false };
  }

  // Resolve gated tool set (config override or default)
  const gatedTools = sig.gatedTools
    ? new Set(sig.gatedTools.map((t) => t.trim().toLowerCase()))
    : SIG_GATED_TOOLS;

  const normalized = toolName.trim().toLowerCase();
  if (!gatedTools.has(normalized)) {
    return { blocked: false };
  }

  // Gate requires session context
  if (!sessionKey || !turnId) {
    return {
      blocked: true,
      reason:
        "This tool requires instruction verification. Call the `verify` tool first to authenticate your instructions, then retry.",
    };
  }

  if (isVerified(sessionKey, turnId)) {
    return { blocked: false };
  }

  return {
    blocked: true,
    reason:
      "This tool requires instruction verification. Call the `verify` tool first to authenticate your instructions, then retry.",
  };
}
