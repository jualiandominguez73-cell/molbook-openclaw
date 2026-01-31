/**
 * Highlights Module
 * Notable events, achievements, and milestones
 */

import type { Highlight, MonitorState, VitalSigns, ContributorPulse } from "../types.js";
import { THRESHOLDS } from "../utils.js";

export async function getHighlights(
  repo: string,
  vitalSigns: VitalSigns,
  contributorPulse: ContributorPulse,
  prevState: MonitorState
): Promise<Highlight[]> {
  const highlights: Highlight[] = [];
  
  // === ACHIEVEMENTS ===
  
  // First-time contributors
  for (const newcomer of contributorPulse.newcomers) {
    if (newcomer.firstPR) {
      highlights.push({
        type: "achievement",
        icon: "🎉",
        message: `@${newcomer.login} landed their first PR!`,
      });
    }
  }
  
  // === MILESTONES ===
  
  // PRs milestone crossings
  const prMilestones = [100, 250, 500, 750, 800, 850, 900, 950, 1000, 1500, 2000];
  const prevPRs = prevState.lastOpenPRs ?? 0;
  const nowPRs = vitalSigns.prs.openNow;
  
  for (const milestone of prMilestones) {
    if (prevPRs < milestone && nowPRs >= milestone) {
      highlights.push({
        type: "milestone",
        icon: "📊",
        message: `Open PRs crossed ${milestone}`,
      });
    }
  }
  
  // Issues milestone crossings
  const issueMilestones = [100, 250, 500, 750, 800, 850, 900, 950, 1000, 1500, 2000];
  const prevIssues = prevState.lastOpenIssues ?? 0;
  const nowIssues = vitalSigns.issues.openNow;
  
  for (const milestone of issueMilestones) {
    if (prevIssues < milestone && nowIssues >= milestone) {
      highlights.push({
        type: "milestone",
        icon: "📊",
        message: `Open issues crossed ${milestone}`,
      });
    }
  }
  
  // === NOTABLE ACTIVITY ===
  
  // Merges in this period
  if (vitalSigns.prs.merged > 0) {
    highlights.push({
      type: "notable",
      icon: "✅",
      message: `${vitalSigns.prs.merged} PRs merged this period`,
    });
  }
  
  // High activity contributors
  for (const top of contributorPulse.top.slice(0, 2)) {
    if (top.activity >= THRESHOLDS.HIGH_ACTIVITY) {
      highlights.push({
        type: "notable",
        icon: "⚡",
        message: `@${top.login} on fire (${top.activity} activities)`,
      });
    }
  }
  
  // Returned contributors
  for (const returned of contributorPulse.returned) {
    highlights.push({
      type: "notable",
      icon: "👋",
      message: `@${returned.login} returned after absence`,
    });
  }
  
  // === WARNINGS ===
  
  if (vitalSigns.health === "critical") {
    highlights.push({
      type: "warning",
      icon: "🚨",
      message: `Critical backlog: +${vitalSigns.prs.netDelta} PRs, merge rate ${vitalSigns.mergeRate}%`,
    });
  } else if (vitalSigns.health === "warning") {
    highlights.push({
      type: "warning",
      icon: "⚠️",
      message: `Backlog growing: +${vitalSigns.prs.netDelta} net PRs`,
    });
  }
  
  // Limit and dedupe
  const seen = new Set<string>();
  return highlights.filter(h => {
    const key = h.message;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 6);
}
