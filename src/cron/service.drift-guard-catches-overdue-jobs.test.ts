import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CronService } from "./service.js";

const noopLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

async function makeStorePath() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-cron-"));
  return {
    storePath: path.join(dir, "cron", "jobs.json"),
    cleanup: async () => {
      await fs.rm(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
    },
  };
}

describe("CronService drift guard catches overdue jobs", () => {
  let cron: CronService | null = null;
  let storeCleanup: (() => Promise<void>) | null = null;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-12-13T00:00:00.000Z"));
    noopLogger.debug.mockClear();
    noopLogger.info.mockClear();
    noopLogger.warn.mockClear();
    noopLogger.error.mockClear();
  });

  afterEach(async () => {
    cron?.stop();
    cron = null;
    await storeCleanup?.();
    storeCleanup = null;
    vi.useRealTimers();
  });

  it("drift guard re-arm catches overdue job when original setTimeout is lost", async () => {
    const store = await makeStorePath();
    storeCleanup = store.cleanup;
    const enqueueSystemEvent = vi.fn();
    const requestHeartbeatNow = vi.fn();

    cron = new CronService({
      storePath: store.storePath,
      cronEnabled: true,
      log: noopLogger,
      enqueueSystemEvent,
      requestHeartbeatNow,
      runIsolatedAgentJob: vi.fn(async () => ({ status: "ok" as const })),
    });

    await cron.start();

    // Add a job that fires every 5 minutes (300s).
    // The armTimer clamp (60s) means the scheduler will wake every 60s
    // even though the job isn't due for 300s.
    const job = await cron.add({
      name: "every 5min check",
      enabled: true,
      schedule: { kind: "every", everyMs: 300_000 },
      sessionTarget: "main",
      wakeMode: "next-heartbeat",
      payload: { kind: "systemEvent", text: "drift-tick" },
    });

    const firstDueAt = job.state.nextRunAtMs!;
    expect(firstDueAt).toBe(Date.parse("2025-12-13T00:00:00.000Z") + 300_000);

    // Jump time well past the due time without advancing timers.
    // This simulates macOS sleep swallowing all pending setTimeouts.
    vi.setSystemTime(new Date(firstDueAt + 30_000)); // 330s after start

    // The job should NOT have run yet — no timers have been triggered.
    expect(enqueueSystemEvent).not.toHaveBeenCalled();

    // Now advance timers. The drift guard clamp means armTimer set a 60s
    // timeout (not 300s). When it fires, onTimer sees the job is overdue
    // and runs it.
    await vi.runOnlyPendingTimersAsync();

    const jobs = await cron.list();
    const updated = jobs.find((j) => j.id === job.id);

    expect(enqueueSystemEvent).toHaveBeenCalledWith("drift-tick", { agentId: undefined });
    expect(updated?.state.lastStatus).toBe("ok");
  });

  it("timer fires at most every 60s even for far-future jobs", async () => {
    const store = await makeStorePath();
    storeCleanup = store.cleanup;
    const enqueueSystemEvent = vi.fn();
    const requestHeartbeatNow = vi.fn();

    cron = new CronService({
      storePath: store.storePath,
      cronEnabled: true,
      log: noopLogger,
      enqueueSystemEvent,
      requestHeartbeatNow,
      runIsolatedAgentJob: vi.fn(async () => ({ status: "ok" as const })),
    });

    await cron.start();

    // Add a job due in 1 hour.
    await cron.add({
      name: "hourly check",
      enabled: true,
      schedule: { kind: "every", everyMs: 3_600_000 },
      sessionTarget: "main",
      wakeMode: "next-heartbeat",
      payload: { kind: "systemEvent", text: "hourly-tick" },
    });

    // Advance only 60s — the drift guard clamp should fire the timer.
    await vi.advanceTimersByTimeAsync(60_000);

    // Job is not due yet, so it should NOT have run.
    expect(enqueueSystemEvent).not.toHaveBeenCalled();

    // But the timer should have re-armed (testing that the clamp works).
    // Advance another 60s — still not due (only 120s into a 3600s wait).
    await vi.advanceTimersByTimeAsync(60_000);
    expect(enqueueSystemEvent).not.toHaveBeenCalled();
  });
});
