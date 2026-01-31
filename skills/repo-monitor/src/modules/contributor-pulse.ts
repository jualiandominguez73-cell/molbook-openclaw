/**
 * Contributor Pulse Module
 * Track who's active, newcomers, returned contributors
 */

import type { ContributorPulse, ContributorInfo, MonitorState } from "../types.js";
import { searchItems, getEvents } from "../fetcher.js";

export async function getContributorPulse(
  repo: string,
  since: string,
  prevState: MonitorState
): Promise<ContributorPulse> {
  // Get recent activity in parallel
  const [recentItems, events] = await Promise.all([
    searchItems(`repo:${repo} updated:>=${since}`, 100),
    getEvents(repo, 100),
  ]);
  
  // Count activity per user
  const activityMap = new Map<string, number>();
  const prAuthors = new Set<string>();
  
  for (const item of recentItems) {
    const login = item.user.login;
    activityMap.set(login, (activityMap.get(login) ?? 0) + 1);
    if (item.pull_request) {
      prAuthors.add(login);
    }
  }
  
  // Also count from events
  for (const event of events) {
    const login = event.actor.login;
    if (!login.includes("[bot]") && !login.endsWith("-bot")) {
      activityMap.set(login, (activityMap.get(login) ?? 0) + 1);
    }
  }
  
  const knownSet = new Set(prevState.knownContributors);
  
  // Categorize contributors
  const top: ContributorInfo[] = [];
  const newcomers: ContributorInfo[] = [];
  const returned: ContributorInfo[] = [];
  
  // Sort by activity
  const sorted = [...activityMap.entries()].sort((a, b) => b[1] - a[1]);
  
  for (const [login, activity] of sorted) {
    if (login.includes("[bot]") || login.endsWith("-bot")) continue;
    
    const info: ContributorInfo = {
      login,
      activity,
      type: "active",
      firstPR: !knownSet.has(login) && prAuthors.has(login),
    };
    
    if (!knownSet.has(login)) {
      info.type = "newcomer";
      if (newcomers.length < 3) {
        newcomers.push(info);
      }
    } else if (top.length < 5) {
      info.type = "top";
      top.push(info);
    }
  }
  
  // Find who went quiet (known but not active recently)
  const goneQuiet = prevState.knownContributors
    .filter(login => !activityMap.has(login))
    .slice(0, 3);
  
  return {
    top,
    newcomers,
    returned,
    goneQuiet,
  };
}

/**
 * Get updated known contributors list
 */
export function updateKnownContributors(
  prevKnown: string[],
  pulse: ContributorPulse
): string[] {
  const set = new Set(prevKnown);
  for (const c of [...pulse.top, ...pulse.newcomers, ...pulse.returned]) {
    set.add(c.login);
  }
  return [...set];
}
