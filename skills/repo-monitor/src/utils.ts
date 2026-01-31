/**
 * Repo Monitor V2 - Shared Utilities
 */

// ============================================================================
// Constants / Thresholds
// ============================================================================

export const THRESHOLDS = {
  // Time-based
  PR_AWAITING_REVIEW_DAYS: 3,
  ISSUE_NEEDS_RESPONSE_DAYS: 2,
  STALE_PR_DAYS: 14,
  STALE_PR_INACTIVE_DAYS: 7,
  STALE_ISSUE_DAYS: 30,
  STALE_ISSUE_INACTIVE_DAYS: 14,
  OLD_PR_DAYS: 21,
  
  // Activity-based
  ACTIVE_DISCUSSION_COMMENTS: 10,
  HEATED_DISCUSSION_COMMENTS: 15,
  ENGAGED_ISSUE_COMMENTS: 5,
  
  // Health metrics
  CRITICAL_MERGE_RATE: 10,
  WARNING_MERGE_RATE: 20,
  CRITICAL_NET_DELTA: 50,
  WARNING_NET_DELTA: 30,
  
  // Reactions
  HIGH_REACTIONS: 10,
  MEDIUM_REACTIONS: 5,
  
  // Contributor activity
  HIGH_ACTIVITY: 5,
} as const;

// ============================================================================
// Rate Limiting
// ============================================================================

let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL_MS = 100; // 100ms between requests (safe for 30/min limit)

/**
 * Wait if needed to respect rate limits
 */
export async function rateLimitDelay(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  
  if (elapsed < MIN_REQUEST_INTERVAL_MS) {
    await new Promise(r => setTimeout(r, MIN_REQUEST_INTERVAL_MS - elapsed));
  }
  
  lastRequestTime = Date.now();
}

// ============================================================================
// Date Utilities
// ============================================================================

/**
 * Calculate days since a date string
 */
export function daysSince(dateStr: string): number {
  const then = new Date(dateStr).getTime();
  const now = Date.now();
  return Math.floor((now - then) / (1000 * 60 * 60 * 24));
}

/**
 * Format age in human-readable form
 */
export function formatAge(days: number): string {
  if (days < 1) return "<1d";
  if (days === 1) return "1d";
  if (days < 7) return `${days}d`;
  if (days < 30) return `${Math.floor(days / 7)}w`;
  return `${Math.floor(days / 30)}mo`;
}

/**
 * Get ISO date string for N days ago
 */
export function getDateDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split("T")[0];
}

/**
 * Get ISO date string for N hours ago
 */
export function getDateHoursAgo(hours: number): string {
  const date = new Date();
  date.setHours(date.getHours() - hours);
  return date.toISOString();
}

// ============================================================================
// String Utilities
// ============================================================================

/**
 * Truncate string with ellipsis
 */
export function truncate(str: string, len: number): string {
  if (str.length <= len) return str;
  return str.slice(0, len - 3) + "...";
}

// ============================================================================
// Timeout Utility
// ============================================================================

/**
 * Create a promise that rejects after timeout
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, message = "Operation timed out"): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error(message)), ms)
    ),
  ]);
}
