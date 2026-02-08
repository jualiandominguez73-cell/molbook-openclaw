import type { OpenClawConfig } from "../config/config.js";

const DEFAULT_AGENT_TIMEOUT_SECONDS = 600;

/**
 * Maximum safe timeout for Node.js setTimeout.
 * Node.js uses a 32-bit signed integer internally, so the max is 2^31 - 1.
 * Values exceeding this cause TimeoutOverflowWarning and get silently set to 1ms.
 */
export const MAX_SAFE_TIMEOUT_MS = 2_147_483_647; // ~24.8 days

const normalizeNumber = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? Math.floor(value) : undefined;

/**
 * Clamps a timeout value to the maximum safe limit for setTimeout.
 */
export function clampTimeout(ms: number): number {
  return Math.min(Math.max(1, ms), MAX_SAFE_TIMEOUT_MS);
}

export function resolveAgentTimeoutSeconds(cfg?: OpenClawConfig): number {
  const raw = normalizeNumber(cfg?.agents?.defaults?.timeoutSeconds);
  const seconds = raw ?? DEFAULT_AGENT_TIMEOUT_SECONDS;
  return Math.max(seconds, 1);
}

export function resolveAgentTimeoutMs(opts: {
  cfg?: OpenClawConfig;
  overrideMs?: number | null;
  overrideSeconds?: number | null;
  minMs?: number;
}): number {
  const minMs = Math.max(normalizeNumber(opts.minMs) ?? 1, 1);
  const defaultMs = resolveAgentTimeoutSeconds(opts.cfg) * 1000;
  // Use a safe "no timeout" value that stays within setTimeout's 32-bit limit.
  // Previously 30 days (2.59B ms) which caused overflow; now ~24 days.
  const NO_TIMEOUT_MS = MAX_SAFE_TIMEOUT_MS - 10_000; // Leave buffer for added delays
  const overrideMs = normalizeNumber(opts.overrideMs);
  if (overrideMs !== undefined) {
    if (overrideMs === 0) {
      return NO_TIMEOUT_MS;
    }
    if (overrideMs < 0) {
      return clampTimeout(defaultMs);
    }
    return clampTimeout(Math.max(overrideMs, minMs));
  }
  const overrideSeconds = normalizeNumber(opts.overrideSeconds);
  if (overrideSeconds !== undefined) {
    if (overrideSeconds === 0) {
      return NO_TIMEOUT_MS;
    }
    if (overrideSeconds < 0) {
      return clampTimeout(defaultMs);
    }
    return clampTimeout(Math.max(overrideSeconds * 1000, minMs));
  }
  return clampTimeout(Math.max(defaultMs, minMs));
}
