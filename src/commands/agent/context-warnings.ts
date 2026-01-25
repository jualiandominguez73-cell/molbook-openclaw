/**
 * Context usage warnings - alerts users when approaching context limits.
 *
 * Default thresholds:
 * - 75%: Soft warning - "consider managing context soon"
 * - 90%: Urgent warning - "compact now or system will auto-compact"
 */

/** Default threshold for soft warning (percentage). */
export const DEFAULT_CONTEXT_WARNING_THRESHOLD_SOFT = 75;

/** Default threshold for urgent warning (percentage). */
export const DEFAULT_CONTEXT_WARNING_THRESHOLD_URGENT = 90;

export type ContextWarningLevel = "none" | "soft" | "urgent";

export interface ContextWarningResult {
  level: ContextWarningLevel;
  percentUsed: number;
  message: string | null;
}

export interface ContextWarningThresholds {
  soft: number;
  urgent: number;
}

/**
 * Check if a context usage warning should be shown.
 * Returns the warning level and message if applicable.
 */
export function checkContextWarning(params: {
  totalTokens: number | undefined;
  contextTokens: number | undefined;
  previousWarningLevel?: ContextWarningLevel;
  thresholds?: ContextWarningThresholds;
}): ContextWarningResult {
  const { totalTokens, contextTokens, previousWarningLevel } = params;
  const thresholds = params.thresholds ?? {
    soft: DEFAULT_CONTEXT_WARNING_THRESHOLD_SOFT,
    urgent: DEFAULT_CONTEXT_WARNING_THRESHOLD_URGENT,
  };

  if (!totalTokens || !contextTokens || contextTokens <= 0) {
    return { level: "none", percentUsed: 0, message: null };
  }

  const percentUsed = Math.round((totalTokens / contextTokens) * 100);

  // Determine current warning level
  let level: ContextWarningLevel = "none";
  if (percentUsed >= thresholds.urgent) {
    level = "urgent";
  } else if (percentUsed >= thresholds.soft) {
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
 * Uses plain text with emoji for cross-channel compatibility.
 */
export function formatContextWarning(level: ContextWarningLevel, percentUsed: number): string {
  switch (level) {
    case "soft":
      return `📊 ${percentUsed}% context used — consider /compact or /new soon`;
    case "urgent":
      return `⚠️ ${percentUsed}% context used — use /compact now or system will auto-compact at limit`;
    default:
      return "";
  }
}
