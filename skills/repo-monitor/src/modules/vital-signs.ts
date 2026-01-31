/**
 * Vital Signs Module
 * Core metrics: PRs, Issues, Merge Rate, Health
 */

import type { VitalSigns, MonitorState } from "../types.js";
import { getCounts } from "../fetcher.js";
import { THRESHOLDS } from "../utils.js";

export async function getVitalSigns(
  repo: string,
  since: string,
  windowHours: number,
  windowSource: VitalSigns["windowSource"] = "configured",
  _prevState?: MonitorState // kept for API compatibility but no longer used for delta
): Promise<VitalSigns> {
  const counts = await getCounts(repo, since);
  
  // Calculate net deltas based on WINDOW activity (created - closed in the period)
  // This is more intuitive: if 259 PRs created and 86 closed → net +173
  // Previously this compared current open count to last run, which was confusing
  const prNetDelta = counts.createdPRs - counts.closedPRs;
  const issueNetDelta = counts.createdIssues - counts.closedIssues;
  
  // Merge rate (merged / created)
  const mergeRate = counts.createdPRs > 0
    ? Math.round((counts.mergedPRs / counts.createdPRs) * 100)
    : 0;
  
  // Health assessment using thresholds
  let health: VitalSigns["health"] = "healthy";
  if (mergeRate < THRESHOLDS.CRITICAL_MERGE_RATE && prNetDelta > THRESHOLDS.CRITICAL_NET_DELTA) {
    health = "critical";
  } else if (mergeRate < THRESHOLDS.WARNING_MERGE_RATE || prNetDelta > THRESHOLDS.WARNING_NET_DELTA) {
    health = "warning";
  }
  
  return {
    windowHours,
    windowSource,
    prs: {
      created: counts.createdPRs,
      closed: counts.closedPRs,
      merged: counts.mergedPRs,
      openNow: counts.openPRs,
      netDelta: prNetDelta,
    },
    issues: {
      created: counts.createdIssues,
      closed: counts.closedIssues,
      openNow: counts.openIssues,
      netDelta: issueNetDelta,
    },
    mergeRate,
    health,
  };
}
