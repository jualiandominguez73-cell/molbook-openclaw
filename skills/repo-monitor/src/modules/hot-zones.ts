/**
 * Hot Zones Module
 * Detect which areas/labels have most activity
 */

import type { HotZone } from "../types.js";
import { searchItems } from "../fetcher.js";

export async function getHotZones(
  repo: string,
  since: string,
  limit = 5
): Promise<HotZone[]> {
  // Get recent issues and PRs
  const items = await searchItems(`repo:${repo} updated:>=${since}`, 100);
  
  // Count labels
  const labelCounts = new Map<string, number>();
  
  for (const item of items) {
    for (const label of item.labels) {
      const name = label.name.toLowerCase();
      // Skip meta labels that don't indicate areas
      if (
        name.startsWith("status:") ||
        name.startsWith("priority:") ||
        name === "stale" ||
        name === "wontfix" ||
        name === "duplicate" ||
        name === "invalid"
      ) {
        continue;
      }
      labelCounts.set(name, (labelCounts.get(name) ?? 0) + 1);
    }
  }
  
  // Sort by count and take top N
  const sorted = [...labelCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
  
  return sorted.map(([label, count]) => ({
    label,
    count,
    delta: 0, // TODO: track deltas between runs by storing previous counts in state
    trend: "stable" as const,
  }));
}
