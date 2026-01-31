/**
 * Attention Needed Module
 * Detect stale PRs, issues, and stuck items
 */

import type { AttentionItem } from "../types.js";
import { searchItems, getPRs } from "../fetcher.js";
import { daysSince, getDateDaysAgo, truncate, THRESHOLDS } from "../utils.js";

export async function getAttentionItems(
  repo: string
): Promise<AttentionItem[]> {
  const items: AttentionItem[] = [];
  
  // Run searches in parallel
  const [stalePRs, staleIssues, oldPRs] = await Promise.all([
    // 1. Stale PRs (open > 14d, no activity in 7d)
    searchItems(
      `repo:${repo} is:pr is:open created:<${getDateDaysAgo(THRESHOLDS.STALE_PR_DAYS)} updated:<${getDateDaysAgo(THRESHOLDS.STALE_PR_INACTIVE_DAYS)}`,
      10
    ),
    // 2. Stale issues (open > 30d, no activity in 14d, assigned)
    searchItems(
      `repo:${repo} is:issue is:open created:<${getDateDaysAgo(THRESHOLDS.STALE_ISSUE_DAYS)} updated:<${getDateDaysAgo(THRESHOLDS.STALE_ISSUE_INACTIVE_DAYS)}`,
      10
    ),
    // 3. Old open PRs (for conflict/stuck detection)
    getPRs(repo, { state: "open", per_page: 50 }),
  ]);
  
  // Process: Stale PRs
  for (const pr of stalePRs.slice(0, 5)) {
    const staleDays = daysSince(pr.updated_at);
    items.push({
      type: "stale-pr",
      number: pr.number,
      title: truncate(pr.title, 50),
      url: pr.html_url,
      reason: `${staleDays}d without activity`,
      staleDays,
      author: pr.user.login,
    });
  }
  
  // Process: Stale issues (only if assigned)
  for (const issue of staleIssues.slice(0, 5)) {
    if (issue.assignee || issue.assignees.length > 0) {
      const staleDays = daysSince(issue.updated_at);
      items.push({
        type: "stale-issue",
        number: issue.number,
        title: truncate(issue.title, 50),
        url: issue.html_url,
        reason: `Assigned, ${staleDays}d without activity`,
        staleDays,
        author: issue.user.login,
      });
    }
  }
  
  // Process: Old PRs (21+ days)
  for (const pr of oldPRs) {
    const days = daysSince(pr.created_at);
    if (days > THRESHOLDS.OLD_PR_DAYS && !pr.draft) {
      // Check if already added from stale search
      if (!items.some(i => i.number === pr.number)) {
        items.push({
          type: "stale-pr",
          number: pr.number,
          title: truncate(pr.title, 50),
          url: pr.html_url,
          reason: `${days}d open`,
          staleDays: days,
          author: pr.user.login,
        });
      }
    }
  }
  
  // Sort by stale days
  items.sort((a, b) => b.staleDays - a.staleDays);
  
  return items.slice(0, 8);
}
