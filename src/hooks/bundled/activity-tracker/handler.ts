/**
 * Activity tracker hook handler
 *
 * Updates heartbeat-state.json when user messages are received.
 * This enables session-backup to know when user is active without polling.
 */

import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import type { ClawdbotConfig } from "../../../config/config.js";
import { resolveAgentWorkspaceDir } from "../../../agents/agent-scope.js";
import { resolveAgentIdFromSessionKey } from "../../../routing/session-key.js";
import type { HookHandler } from "../../hooks.js";

// ============================================
// Types
// ============================================

interface BackupState {
  lastBackup: number | null;
  lastDistill: number | null;
  lastSessionSummary: number | null;
  lastUserMessage: number | null;
  backupActive: boolean;
}

// ============================================
// State Management
// ============================================

async function readState(stateFile: string): Promise<BackupState> {
  try {
    const content = await fs.readFile(stateFile, "utf-8");
    return JSON.parse(content);
  } catch {
    return {
      lastBackup: null,
      lastDistill: null,
      lastSessionSummary: null,
      lastUserMessage: null,
      backupActive: false,
    };
  }
}

async function writeState(stateFile: string, state: BackupState): Promise<void> {
  await fs.writeFile(stateFile, JSON.stringify(state, null, 2), "utf-8");
}

// ============================================
// Main Hook Handler
// ============================================

const activityTrackerHandler: HookHandler = async (event) => {
  // Only trigger on message:received events
  if (event.type !== "message" || event.action !== "received") {
    return;
  }

  const context = event.context || {};
  const cfg = context.cfg as ClawdbotConfig | undefined;

  if (!cfg) {
    // Config not available, skip silently
    return;
  }

  try {
    const agentId = resolveAgentIdFromSessionKey(event.sessionKey);
    const workspaceDir = resolveAgentWorkspaceDir(cfg, agentId);
    const memoryDir = path.join(workspaceDir, "memory");
    const stateFile = path.join(memoryDir, "heartbeat-state.json");

    // Ensure directory exists
    await fs.mkdir(memoryDir, { recursive: true });

    // Read current state
    const state = await readState(stateFile);

    // Update activity
    const now = Math.floor(Date.now() / 1000);
    state.lastUserMessage = now;
    state.backupActive = true;

    // Write updated state
    await writeState(stateFile, state);

    console.log(`[activity-tracker] Updated: lastUserMessage=${now}, backupActive=true`);
  } catch (err) {
    // Log but don't throw - we don't want to affect message processing
    console.error(
      "[activity-tracker] Failed to update state:",
      err instanceof Error ? err.message : String(err)
    );
  }
};

export default activityTrackerHandler;
