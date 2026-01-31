/**
 * Quick Wins Module
 * Heuristic-based detection of high-ROI issues
 */

import type { QuickWin, GitHubIssue } from "../types.js";
import { searchItems } from "../fetcher.js";
import { truncate, THRESHOLDS } from "../utils.js";

interface ScoringResult {
  score: number;
  signals: string[];
  level: "beginner" | "intermediate" | "advanced";
}

function scoreIssue(issue: GitHubIssue): ScoringResult {
  const signals: string[] = [];
  let score = 0;
  let difficulty = 5; // baseline
  
  const labels = issue.labels.map(l => l.name.toLowerCase());
  const title = issue.title.toLowerCase();
  const body = (issue.body ?? "").toLowerCase();
  
  // === LOW DIFFICULTY SIGNALS ===
  
  if (labels.includes("documentation") || labels.includes("docs")) {
    score += 3;
    difficulty -= 2;
    signals.push("📝 docs");
  }
  
  if (labels.includes("good first issue") || labels.includes("good-first-issue")) {
    score += 3;
    difficulty -= 2;
    signals.push("🌱 good first issue");
  }
  
  if (labels.includes("help wanted")) {
    score += 2;
    signals.push("🙋 help wanted");
  }
  
  if (title.includes("typo") || body.includes("typo")) {
    score += 3;
    difficulty -= 3;
    signals.push("✏️ typo");
  }
  
  if (body.includes("one-liner") || body.includes("simple fix") || body.includes("easy fix")) {
    score += 2;
    difficulty -= 2;
    signals.push("⚡ simple fix");
  }
  
  // Has proposed solution
  if (
    body.includes("solution:") ||
    body.includes("fix:") ||
    body.includes("workaround:") ||
    body.includes("proposed solution")
  ) {
    score += 2;
    difficulty -= 1;
    signals.push("💡 has solution");
  }
  
  // Mentions specific file
  if (body.match(/\.(ts|js|tsx|jsx|py|go|rs)\b/) || body.includes("file:")) {
    score += 1;
    signals.push("📁 specific file");
  }
  
  // === HIGH IMPORTANCE SIGNALS ===
  
  if (labels.includes("bug")) {
    score += 2;
    signals.push("🐛 bug");
  }
  
  if (labels.includes("critical") || labels.includes("priority: high")) {
    score += 3;
    signals.push("🔴 critical");
  }
  
  // Reactions indicate community interest
  const reactions = issue.reactions?.total_count ?? 0;
  if (reactions >= THRESHOLDS.HIGH_REACTIONS) {
    score += 3;
    signals.push(`👍 ${reactions} reactions`);
  } else if (reactions >= THRESHOLDS.MEDIUM_REACTIONS) {
    score += 2;
    signals.push(`👍 ${reactions} reactions`);
  }
  
  // Comments indicate engagement
  if (issue.comments >= THRESHOLDS.ENGAGED_ISSUE_COMMENTS) {
    score += 1;
    signals.push(`💬 ${issue.comments} comments`);
  }
  
  // Crash/error keywords
  if (
    body.includes("crash") ||
    body.includes("error") ||
    body.includes("exception") ||
    body.includes("broken")
  ) {
    score += 2;
    signals.push("💥 error/crash");
  }
  
  // === NEGATIVE SIGNALS ===
  
  if (labels.includes("wontfix") || labels.includes("invalid") || labels.includes("duplicate")) {
    score -= 10;
  }
  
  if (labels.includes("blocked") || labels.includes("waiting")) {
    score -= 3;
  }
  
  // Determine suggested level
  let level: ScoringResult["level"] = "intermediate";
  if (difficulty <= 3) level = "beginner";
  else if (difficulty >= 7) level = "advanced";
  
  return { score, signals, level };
}

export async function getQuickWins(
  repo: string,
  limit = 5
): Promise<QuickWin[]> {
  // Fetch issues likely to be quick wins
  const queries = [
    `repo:${repo} is:issue is:open label:"good first issue"`,
    `repo:${repo} is:issue is:open label:documentation`,
    `repo:${repo} is:issue is:open label:bug comments:>2`,
    `repo:${repo} is:issue is:open "typo" in:title,body`,
    `repo:${repo} is:issue is:open label:"help wanted"`,
  ];
  
  const allIssues: GitHubIssue[] = [];
  const seen = new Set<number>();
  
  // Run queries in parallel for better performance
  const results = await Promise.allSettled(
    queries.map(query => searchItems(query, 20))
  );
  
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === "fulfilled") {
      for (const item of result.value) {
        if (!seen.has(item.number)) {
          seen.add(item.number);
          allIssues.push(item);
        }
      }
    } else {
      // Log error but continue with other results
      console.error(`[quick-wins] Query ${i + 1} failed: ${result.reason}`);
    }
  }
  
  // Score and rank
  const scored = allIssues.map(issue => ({
    issue,
    ...scoreIssue(issue),
  }));
  
  scored.sort((a, b) => b.score - a.score);
  
  return scored.slice(0, limit).map(({ issue, score, signals, level }) => ({
    number: issue.number,
    title: truncate(issue.title, 60),
    url: issue.html_url,
    score,
    signals,
    suggestedLevel: level,
  }));
}
