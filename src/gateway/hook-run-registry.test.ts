import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./hook-run-registry.store.js", () => ({
  loadHookRunRegistryFromDisk: vi.fn(() => new Map()),
  saveHookRunRegistryToDisk: vi.fn(),
}));

vi.mock("./call.js", () => ({
  callGateway: vi.fn(),
}));

describe("hook-run-registry", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetAllMocks();
  });

  describe("registerHookRun", () => {
    it("registers a new hook run with cleanup=delete", async () => {
      const { registerHookRun, getHookRun, clearHookRuns } = await import("./hook-run-registry.js");
      clearHookRuns();

      registerHookRun({
        runId: "run-1",
        sessionKey: "hook:test:1",
        jobName: "Test Hook",
        cleanup: "delete",
        cleanupDelayMinutes: 0,
      });

      const run = getHookRun("run-1");
      expect(run).toBeDefined();
      expect(run?.sessionKey).toBe("hook:test:1");
      expect(run?.cleanup).toBe("delete");
      expect(run?.cleanupHandled).toBe(false);

      clearHookRuns();
    });

    it("does not register runs with cleanup=keep", async () => {
      const { registerHookRun, getHookRun, clearHookRuns } = await import("./hook-run-registry.js");
      clearHookRuns();

      registerHookRun({
        runId: "run-1",
        sessionKey: "hook:test:1",
        jobName: "Test Hook",
        cleanup: "keep",
        cleanupDelayMinutes: 0,
      });

      const run = getHookRun("run-1");
      expect(run).toBeUndefined();

      clearHookRuns();
    });

    it("does not register runs with cleanup=undefined", async () => {
      const { registerHookRun, getHookRun, clearHookRuns } = await import("./hook-run-registry.js");
      clearHookRuns();

      registerHookRun({
        runId: "run-1",
        sessionKey: "hook:test:1",
        jobName: "Test Hook",
        cleanup: undefined,
        cleanupDelayMinutes: undefined,
      });

      const run = getHookRun("run-1");
      expect(run).toBeUndefined();

      clearHookRuns();
    });
  });

  describe("markHookRunComplete", () => {
    it("sets endedAt, cleanupAtMs, and cleanupHandled", async () => {
      const { registerHookRun, markHookRunComplete, getHookRun, clearHookRuns } =
        await import("./hook-run-registry.js");
      clearHookRuns();

      registerHookRun({
        runId: "run-1",
        sessionKey: "hook:test:1",
        jobName: "Test Hook",
        cleanup: "delete",
        cleanupDelayMinutes: 5,
      });

      const now = Date.now();
      vi.setSystemTime(now);
      markHookRunComplete("run-1");

      const run = getHookRun("run-1");
      expect(run?.endedAt).toBe(now);
      expect(run?.cleanupAtMs).toBe(now + 5 * 60 * 1000);
      expect(run?.cleanupHandled).toBe(true);

      clearHookRuns();
    });

    it("handles immediate cleanup (cleanupDelayMinutes=0)", async () => {
      const { registerHookRun, markHookRunComplete, getHookRun, clearHookRuns } =
        await import("./hook-run-registry.js");
      clearHookRuns();

      registerHookRun({
        runId: "run-1",
        sessionKey: "hook:test:1",
        jobName: "Test Hook",
        cleanup: "delete",
        cleanupDelayMinutes: 0,
      });

      const now = Date.now();
      vi.setSystemTime(now);
      markHookRunComplete("run-1");

      const run = getHookRun("run-1");
      expect(run?.cleanupAtMs).toBe(now);

      clearHookRuns();
    });
  });

  describe("initHookRunRegistry", () => {
    it("restores runs from disk on init", async () => {
      const { loadHookRunRegistryFromDisk } = await import("./hook-run-registry.store.js");
      const existingRun = {
        runId: "restored-run",
        sessionKey: "hook:restored:1",
        jobName: "Restored",
        cleanup: "delete" as const,
        cleanupDelayMinutes: 0,
        createdAt: Date.now(),
        cleanupHandled: true,
        cleanupAtMs: Date.now(),
      };
      vi.mocked(loadHookRunRegistryFromDisk).mockReturnValue(
        new Map([["restored-run", existingRun]]),
      );

      const { initHookRunRegistry, getHookRun, clearHookRuns } =
        await import("./hook-run-registry.js");
      clearHookRuns();
      initHookRunRegistry();

      const run = getHookRun("restored-run");
      expect(run).toBeDefined();
      expect(run?.sessionKey).toBe("hook:restored:1");

      clearHookRuns();
    });
  });
});
