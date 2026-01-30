import { callGateway } from "./call.js";
import {
  type HookRunRecord,
  loadHookRunRegistryFromDisk,
  saveHookRunRegistryToDisk,
} from "./hook-run-registry.store.js";

const hookRuns = new Map<string, HookRunRecord>();
let sweeper: NodeJS.Timeout | null = null;
let restoreAttempted = false;

function persistHookRuns() {
  try {
    saveHookRunRegistryToDisk(hookRuns);
  } catch {
    // Ignore persistence failures
  }
}

function restoreHookRunsOnce() {
  if (restoreAttempted) return;
  restoreAttempted = true;
  try {
    const restored = loadHookRunRegistryFromDisk();
    for (const [runId, entry] of restored.entries()) {
      if (!hookRuns.has(runId)) {
        hookRuns.set(runId, entry);
      }
    }
    if (hookRuns.size > 0) startSweeper();
  } catch {
    // Ignore restore failures
  }
}

function startSweeper() {
  if (sweeper) return;
  sweeper = setInterval(() => {
    void sweepHookRuns();
  }, 60_000);
  sweeper.unref?.();
}

function stopSweeper() {
  if (!sweeper) return;
  clearInterval(sweeper);
  sweeper = null;
}

async function sweepHookRuns() {
  const now = Date.now();
  let mutated = false;
  for (const [runId, entry] of hookRuns.entries()) {
    // Skip if not ready for cleanup
    if (!entry.cleanupAtMs || entry.cleanupAtMs > now) continue;
    // Skip if cleanup not yet marked (endedAt hasn't been set)
    if (!entry.cleanupHandled) continue;

    try {
      await callGateway({
        method: "sessions.delete",
        params: { key: entry.sessionKey, deleteTranscript: true },
        timeoutMs: 10_000,
      });
      // Only delete from registry after successful RPC
      hookRuns.delete(runId);
      mutated = true;
    } catch {
      // Log and retry on next sweep (entry stays in registry)
    }
  }
  if (mutated) persistHookRuns();
  if (hookRuns.size === 0) stopSweeper();
}

export function registerHookRun(params: {
  runId: string;
  sessionKey: string;
  jobName: string;
  cleanup: "delete" | "keep" | undefined;
  cleanupDelayMinutes: number | undefined;
}) {
  restoreHookRunsOnce();

  // Only track runs that need cleanup
  if (params.cleanup !== "delete") return;

  const now = Date.now();
  hookRuns.set(params.runId, {
    runId: params.runId,
    sessionKey: params.sessionKey,
    jobName: params.jobName,
    cleanup: "delete",
    cleanupDelayMinutes: params.cleanupDelayMinutes ?? 0,
    createdAt: now,
    cleanupHandled: false,
  });
  persistHookRuns();
  startSweeper();
}

export function markHookRunComplete(runId: string) {
  const entry = hookRuns.get(runId);
  if (!entry) return;

  const now = Date.now();
  entry.endedAt = now;
  entry.cleanupAtMs = now + entry.cleanupDelayMinutes * 60 * 1000;
  entry.cleanupHandled = true;
  persistHookRuns();
}

export function getHookRun(runId: string): HookRunRecord | undefined {
  return hookRuns.get(runId);
}

/** Initialize registry on gateway startup - restores pending cleanups */
export function initHookRunRegistry() {
  restoreHookRunsOnce();
}

/** For testing only */
export function clearHookRuns() {
  hookRuns.clear();
  stopSweeper();
  restoreAttempted = false;
}
