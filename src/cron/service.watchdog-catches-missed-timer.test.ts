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
      await fs.rm(dir, { recursive: true, force: true });
    },
  };
}

describe("CronService watchdog catches missed timers", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-12-13T00:00:00.000Z"));
    noopLogger.debug.mockClear();
    noopLogger.info.mockClear();
    noopLogger.warn.mockClear();
    noopLogger.error.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("watchdog fires overdue job when primary timer silently fails", async () => {
    const store = await makeStorePath();
    const enqueueSystemEvent = vi.fn();
    const requestHeartbeatNow = vi.fn();

    const cron = new CronService({
      storePath: store.storePath,
      cronEnabled: true,
      log: noopLogger,
      enqueueSystemEvent,
      requestHeartbeatNow,
      runIsolatedAgentJob: vi.fn(async () => ({ status: "ok" })),
    });

    await cron.start();
    const job = await cron.add({
      name: "every 60s check",
      enabled: true,
      schedule: { kind: "every", everyMs: 60_000 },
      sessionTarget: "main",
      wakeMode: "next-heartbeat",
      payload: { kind: "systemEvent", text: "watchdog-test" },
    });

    const firstDueAt = job.state.nextRunAtMs!;
    expect(firstDueAt).toBe(Date.parse("2025-12-13T00:00:00.000Z") + 60_000);

    // Simulate the primary setTimeout being silently dropped by clearing it,
    // as reported in #10702.  Access private state to replicate the bug.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const internalState = (cron as any).state;
    if (internalState.timer) {
      clearTimeout(internalState.timer);
      internalState.timer = null;
    }

    // Advance past due time.
    vi.setSystemTime(new Date(firstDueAt + 5_000));

    // Advance enough for the 30s watchdog interval to fire.
    await vi.advanceTimersByTimeAsync(30_000);

    const jobs = await cron.list();
    const updated = jobs.find((j) => j.id === job.id);

    expect(enqueueSystemEvent).toHaveBeenCalledWith("watchdog-test", { agentId: undefined });
    expect(updated?.state.lastStatus).toBe("ok");
    expect(noopLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ overdueMs: expect.any(Number) }),
      "cron: watchdog detected missed timer, firing",
    );

    cron.stop();
    await store.cleanup();
  });
});
