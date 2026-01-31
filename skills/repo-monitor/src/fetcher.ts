/**
 * Repo Monitor V2 - GitHub API Fetcher
 * Uses `gh` CLI for authentication
 */

import type { GitHubIssue, GitHubPR } from "./types.js";
import { rateLimitDelay, withTimeout } from "./utils.js";

interface SearchResult {
  total_count: number;
  items: GitHubIssue[];
}

const API_TIMEOUT_MS = 30000; // 30 seconds

/**
 * Execute gh api command and parse JSON response
 */
async function ghApi<T>(endpoint: string): Promise<T> {
  // Respect rate limits
  await rateLimitDelay();
  
  const proc = Bun.spawn(["gh", "api", endpoint], {
    stdout: "pipe",
    stderr: "pipe",
  });
  
  // Add timeout to prevent hanging
  const outputPromise = new Response(proc.stdout).text();
  const output = await withTimeout(
    outputPromise,
    API_TIMEOUT_MS,
    `gh api timed out after ${API_TIMEOUT_MS}ms: ${endpoint}`
  );
  
  const exitCode = await proc.exited;
  
  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    throw new Error(`gh api failed (exit ${exitCode}): ${stderr.slice(0, 500)}`);
  }
  
  // Safe JSON parsing
  try {
    return JSON.parse(output) as T;
  } catch (e) {
    throw new Error(`Invalid JSON from gh api ${endpoint}: ${output.slice(0, 200)}...`);
  }
}

/**
 * Search issues/PRs using GitHub search API
 */
export async function searchCount(query: string): Promise<number> {
  const encoded = encodeURIComponent(query);
  const result = await ghApi<{ total_count: number }>(`search/issues?q=${encoded}&per_page=1`);
  return result.total_count;
}

/**
 * Search and return items
 */
export async function searchItems(query: string, limit = 100): Promise<GitHubIssue[]> {
  const encoded = encodeURIComponent(query);
  const result = await ghApi<SearchResult>(`search/issues?q=${encoded}&per_page=${limit}&sort=updated&order=desc`);
  return result.items;
}

/**
 * Get issues for a repo
 */
export async function getIssues(repo: string, params: {
  state?: "open" | "closed" | "all";
  since?: string;
  labels?: string;
  per_page?: number;
  sort?: string;
} = {}): Promise<GitHubIssue[]> {
  const qs = new URLSearchParams();
  if (params.state) qs.set("state", params.state);
  if (params.since) qs.set("since", params.since);
  if (params.labels) qs.set("labels", params.labels);
  if (params.per_page) qs.set("per_page", String(params.per_page));
  if (params.sort) qs.set("sort", params.sort);
  
  const endpoint = `repos/${repo}/issues?${qs.toString()}`;
  return ghApi<GitHubIssue[]>(endpoint);
}

/**
 * Get PRs for a repo
 */
export async function getPRs(repo: string, params: {
  state?: "open" | "closed" | "all";
  per_page?: number;
  sort?: string;
} = {}): Promise<GitHubPR[]> {
  const qs = new URLSearchParams();
  if (params.state) qs.set("state", params.state);
  if (params.per_page) qs.set("per_page", String(params.per_page));
  if (params.sort) qs.set("sort", params.sort);
  
  const endpoint = `repos/${repo}/pulls?${qs.toString()}`;
  return ghApi<GitHubPR[]>(endpoint);
}

/**
 * Get repo events
 */
export async function getEvents(repo: string, per_page = 100): Promise<Array<{
  id: string;
  type: string;
  actor: { login: string };
  created_at: string;
  payload: Record<string, unknown>;
}>> {
  return ghApi(`repos/${repo}/events?per_page=${per_page}`);
}

/**
 * Count queries helper - runs all counts in parallel
 */
export async function getCounts(repo: string, since: string): Promise<{
  createdPRs: number;
  closedPRs: number;
  mergedPRs: number;
  openPRs: number;
  createdIssues: number;
  closedIssues: number;
  openIssues: number;
}> {
  const [
    createdPRs,
    closedPRs,
    mergedPRs,
    openPRs,
    createdIssues,
    closedIssues,
    openIssues,
  ] = await Promise.all([
    searchCount(`repo:${repo} is:pr created:>=${since}`),
    searchCount(`repo:${repo} is:pr closed:>=${since}`),
    searchCount(`repo:${repo} is:pr merged:>=${since}`),
    searchCount(`repo:${repo} is:pr is:open`),
    searchCount(`repo:${repo} is:issue created:>=${since}`),
    searchCount(`repo:${repo} is:issue closed:>=${since}`),
    searchCount(`repo:${repo} is:issue is:open`),
  ]);
  
  return {
    createdPRs,
    closedPRs,
    mergedPRs,
    openPRs,
    createdIssues,
    closedIssues,
    openIssues,
  };
}
