/**
 * Checkpoint system for long-running agent tasks.
 *
 * Allows agents to save progress that survives crashes.
 * Checkpoints are stored in the state directory and can be
 * loaded on restart to resume interrupted work.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { CONFIG_DIR } from "../utils.js";

const CHECKPOINT_DIR = path.join(CONFIG_DIR, "state", "checkpoints");

export type Checkpoint = {
  sessionId: string;
  sessionKey: string;
  task: string;
  progress: number; // 0-100
  state: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
};

/**
 * Save a checkpoint for an agent session.
 */
export async function saveCheckpoint(checkpoint: Checkpoint): Promise<void> {
  await fs.mkdir(CHECKPOINT_DIR, { recursive: true });
  const filePath = path.join(CHECKPOINT_DIR, `${checkpoint.sessionId}.json`);
  const tmp = `${filePath}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(checkpoint, null, 2), "utf-8");
  await fs.rename(tmp, filePath);
}

/**
 * Load a checkpoint by session ID.
 */
export async function loadCheckpoint(sessionId: string): Promise<Checkpoint | null> {
  try {
    const filePath = path.join(CHECKPOINT_DIR, `${sessionId}.json`);
    const content = await fs.readFile(filePath, "utf-8");
    return JSON.parse(content) as Checkpoint;
  } catch {
    return null;
  }
}

/**
 * Clear a checkpoint (call when work is complete).
 */
export async function clearCheckpoint(sessionId: string): Promise<void> {
  try {
    const filePath = path.join(CHECKPOINT_DIR, `${sessionId}.json`);
    await fs.unlink(filePath);
  } catch {
    // Ignore if already deleted
  }
}

/**
 * List all active checkpoints.
 */
export async function listActiveCheckpoints(): Promise<Checkpoint[]> {
  try {
    await fs.mkdir(CHECKPOINT_DIR, { recursive: true });
    const files = await fs.readdir(CHECKPOINT_DIR);
    const checkpoints: Checkpoint[] = [];

    for (const file of files) {
      if (!file.endsWith(".json") || file.endsWith(".tmp")) continue;
      const sessionId = file.replace(".json", "");
      const checkpoint = await loadCheckpoint(sessionId);
      if (checkpoint) checkpoints.push(checkpoint);
    }

    return checkpoints;
  } catch {
    return [];
  }
}

/**
 * Create or update a checkpoint for the current session.
 */
export async function updateCheckpoint(params: {
  sessionId: string;
  sessionKey: string;
  task: string;
  progress: number;
  state?: Record<string, unknown>;
}): Promise<void> {
  const existing = await loadCheckpoint(params.sessionId);
  const now = Date.now();

  await saveCheckpoint({
    sessionId: params.sessionId,
    sessionKey: params.sessionKey,
    task: params.task,
    progress: params.progress,
    state: params.state ?? existing?.state ?? {},
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });
}

/**
 * Find checkpoints that might need attention (incomplete work).
 */
export async function findStaleCheckpoints(
  maxAgeMs: number = 24 * 60 * 60 * 1000,
): Promise<Checkpoint[]> {
  const checkpoints = await listActiveCheckpoints();
  const now = Date.now();

  return checkpoints.filter((cp) => {
    // Checkpoint is stale if:
    // 1. Not at 100% progress
    // 2. Last updated more than maxAgeMs ago
    return cp.progress < 100 && now - cp.updatedAt > maxAgeMs;
  });
}
