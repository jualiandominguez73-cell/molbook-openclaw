/**
 * Context usage warnings - alerts users when approaching context limits.
 *
 * Thresholds:
 * - 75%: Soft warning - "consider managing context soon"
 * - 90%: Urgent warning - "compact now or system will auto-compact"
 */

import type { SessionEntry } from "../../config/sessions.js";

export const CONTEXT_WARNING_THRESHOLD_SOFT = 75;
export const CONTEXT_WARNING_THRESHOLD_URGENT = 90;

export type ContextWarningLevel = "none" | "soft" | "urgent";

export interface ContextWarningResult {
  level: ContextWarningLevel;
  percentUsed: number;
  message: string | null;
}

/**
 * Check if a context usage warning should be shown.
 * Returns the warning level and message if applicable.
 */
export function checkContextWarning(params: {
  totalTokens: number | undefined;
  contextTokens: number | undefined;
  previousWarningLevel?: ContextWarningLevel;
}): ContextWarningResult {
  const { totalTokens, contextTokens, previousWarningLevel } = params;

  if (!totalTokens || !contextTokens || contextTokens <= 0) {
    return { level: "none", percentUsed: 0, message: null };
  }

  const percentUsed = Math.round((totalTokens / contextTokens) * 100);

  // Determine current warning level
  let level: ContextWarningLevel = "none";
  if (percentUsed >= CONTEXT_WARNING_THRESHOLD_URGENT) {
    level = "urgent";
  } else if (percentUsed >= CONTEXT_WARNING_THRESHOLD_SOFT) {
    level = "soft";
  }

  // Only show warning if we've crossed into a new threshold
  // (avoid spamming the same warning on every message)
  if (level === "none") {
    return { level: "none", percentUsed, message: null };
  }

  // If we're at the same level as before, don't repeat the warning
  if (previousWarningLevel === level) {
    return { level, percentUsed, message: null };
  }

  // Generate appropriate warning message
  const message = formatContextWarning(level, percentUsed);
  return { level, percentUsed, message };
}

/**
 * Format the warning message based on level.
 */
export function formatContextWarning(level: ContextWarningLevel, percentUsed: number): string {
  switch (level) {
    case "soft":
      return `📊 **${percentUsed}% context used** — consider \`/compact\` or \`/new\` soon`;
    case "urgent":
      return `⚠️ **${percentUsed}% context used** — use \`/compact\` now or system will auto-compact at limit`;
    default:
      return "";
  }
}

/**
 * Get the warning level to store in the session entry.
 */
export function getWarningLevelFromSession(entry: SessionEntry | undefined): ContextWarningLevel {
  const stored = entry?.contextWarningLevel;
  if (stored === "soft" || stored === "urgent") return stored;
  return "none";
}

/**
 * Check if we should append a context warning to the response.
 */
export function shouldShowContextWarning(params: {
  entry: SessionEntry | undefined;
  totalTokens: number | undefined;
  contextTokens: number | undefined;
}): ContextWarningResult {
  const { entry, totalTokens, contextTokens } = params;
  const previousLevel = getWarningLevelFromSession(entry);

  return checkContextWarning({
    totalTokens,
    contextTokens,
    previousWarningLevel: previousLevel,
  });
}
