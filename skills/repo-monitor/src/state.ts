/**
 * Repo Monitor V2 - State Persistence
 */

import type { MonitorState } from "./types.js";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname } from "path";

const DEFAULT_STATE: MonitorState = {
  lastRunAt: null,
  lastOpenPRs: null,
  lastOpenIssues: null,
  totalLinksPosted: 0,
  knownContributors: [],
  lastHighlights: [],
};

export function loadState(stateFile: string): MonitorState {
  try {
    if (existsSync(stateFile)) {
      const raw = readFileSync(stateFile, "utf-8");
      return { ...DEFAULT_STATE, ...JSON.parse(raw) };
    }
  } catch {
    // Return default on error
  }
  return { ...DEFAULT_STATE };
}

export function saveState(stateFile: string, state: MonitorState): void {
  try {
    mkdirSync(dirname(stateFile), { recursive: true });
    writeFileSync(stateFile, JSON.stringify(state, null, 2));
  } catch (err) {
    console.error(`Failed to save state: ${err}`);
  }
}
