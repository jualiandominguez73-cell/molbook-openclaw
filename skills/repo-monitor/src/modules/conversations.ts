/**
 * Conversations Module
 * Detect intervention opportunities in issues and PRs
 * 
 * Perspective: CONTRIBUTOR (not maintainer)
 * - We look for issues we can help with
 * - PRs we can code review
 * - Discussions we can participate in
 */

import type { InterventionOpportunity } from "../types.js";
import { searchItems, getPRs } from "../fetcher.js";
import { daysSince, formatAge, getDateDaysAgo, truncate, THRESHOLDS } from "../utils.js";

export async function getInterventionOpportunities(
  repo: string
): Promise<InterventionOpportunity[]> {
  const opportunities: InterventionOpportunity[] = [];
  
  // Run all searches in parallel for better performance
  const [needsHelp, activeDiscussions, prs, hasSolution] = await Promise.all([
    // 1. Issues that could use help (0 comments, 48h+ old) - opportunity to contribute
    searchItems(
      `repo:${repo} is:issue is:open comments:0 created:<${getDateDaysAgo(THRESHOLDS.ISSUE_NEEDS_RESPONSE_DAYS)}`,
      20
    ),
    // 2. Active discussions (many recent comments) - opportunity to join conversation
    searchItems(
      `repo:${repo} is:issue is:open comments:>${THRESHOLDS.ENGAGED_ISSUE_COMMENTS} updated:>${getDateDaysAgo(3)}`,
      10
    ),
    // 3. PRs (will filter for needing review) - opportunity to code review
    getPRs(repo, { state: "open", per_page: 50 }),
    // 4. Issues with proposed solution but no PR - opportunity to implement
    searchItems(
      `repo:${repo} is:issue is:open "solution" OR "fix:" OR "workaround" in:body`,
      20
    ),
  ]);
  
  // Process: Issues that could use help (first comment, reproduction, clarification)
  for (const issue of needsHelp.slice(0, 5)) {
    const days = daysSince(issue.created_at);
    opportunities.push({
      type: "needs-response",
      number: issue.number,
      title: truncate(issue.title, 50),
      url: issue.html_url,
      reason: `${days}d without comments`,
      age: formatAge(days),
      priority: days > 7 ? "high" : "medium",
      suggestedAction: "Help with reproduction or workaround",
    });
  }
  
  // Process: Active discussions worth joining
  for (const issue of activeDiscussions.slice(0, 3)) {
    if (issue.comments >= THRESHOLDS.ACTIVE_DISCUSSION_COMMENTS) {
      opportunities.push({
        type: "active-discussion",
        number: issue.number,
        title: truncate(issue.title, 50),
        url: issue.html_url,
        reason: `${issue.comments} comments, active discussion`,
        age: formatAge(daysSince(issue.created_at)),
        priority: issue.comments > THRESHOLDS.HEATED_DISCUSSION_COMMENTS ? "high" : "medium",
        suggestedAction: "Join discussion or share insights",
      });
    }
  }
  
  // Process: PRs needing code review (open 72h+, not draft, no reviewers)
  for (const pr of prs) {
    const days = daysSince(pr.created_at);
    const hasNoReviewers = pr.requested_reviewers.length === 0;
    
    if (days >= THRESHOLDS.PR_AWAITING_REVIEW_DAYS && !pr.draft && hasNoReviewers) {
      opportunities.push({
        type: "awaiting-review",
        number: pr.number,
        title: truncate(pr.title, 50),
        url: pr.html_url,
        reason: `${days}d waiting for review`,
        age: formatAge(days),
        priority: days > 7 ? "high" : "medium",
        suggestedAction: "Code review to help merge",
      });
    }
  }
  
  // Process: Issues with proposed solution - opportunity to implement
  for (const issue of hasSolution.slice(0, 5)) {
    const body = issue.body?.toLowerCase() ?? "";
    if (
      (body.includes("solution") || body.includes("fix:") || body.includes("workaround")) &&
      !body.includes("pr #")
    ) {
      opportunities.push({
        type: "has-solution",
        number: issue.number,
        title: truncate(issue.title, 50),
        url: issue.html_url,
        reason: "Has proposed solution, needs implementation",
        age: formatAge(daysSince(issue.created_at)),
        priority: "medium",
        suggestedAction: "Submit PR with the fix",
      });
    }
  }
  
  // Sort by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  opportunities.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  
  return opportunities.slice(0, 10);
}
