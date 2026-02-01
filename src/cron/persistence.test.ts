import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  persistCronRunState,
  restoreCronRunState,
  cleanupOldPersistenceFiles,
} from "./persistence.js";
import type { CronJob } from "./types.js";

describe("CronPersistence", () => {
  let tempDir: string;
  let storePath: string;

  beforeEach(async () => {
    // Create temporary directory for tests
    tempDir = path.join(os.tmpdir(), `cron-test-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
    storePath = path.join(tempDir, "cron-store.json");
  });

  afterEach(async () => {
    // Cleanup temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe("persistCronRunState", () => {
    it("should persist empty job list", async () => {
      await persistCronRunState(storePath, []);
      // File should be created
      const content = await fs.readFile(
        path.join(tempDir, "cron-store-persistence.json"),
        "utf-8"
      );
      const data = JSON.parse(content);
      expect(data.version).toBe(1);
      expect(data.jobs).toEqual({});
    });

    it("should persist single job with state", async () => {
      const jobs: Partial<CronJob>[] = [
        {
          id: "job-1",
          name: "Test Job",
          enabled: true,
          state: {
            lastRunAtMs: 1234567890,
            lastStatus: "ok",
            lastDurationMs: 100,
            nextRunAtMs: 1234567990,
          },
        } as CronJob,
      ];

      await persistCronRunState(storePath, jobs as CronJob[]);

      const content = await fs.readFile(
        path.join(tempDir, "cron-store-persistence.json"),
        "utf-8"
      );
      const data = JSON.parse(content);
      expect(data.jobs["job-1"]).toEqual({
        jobId: "job-1",
        lastRunAtMs: 1234567890,
        lastStatus: "ok",
        lastDurationMs: 100,
        nextRunAtMs: 1234567990,
      });
    });

    it("should persist multiple jobs", async () => {
      const jobs: Partial<CronJob>[] = [
        {
          id: "job-1",
          state: {
            lastRunAtMs: 1000,
            lastStatus: "ok",
          },
        } as CronJob,
        {
          id: "job-2",
          state: {
            lastRunAtMs: 2000,
            lastStatus: "error",
            lastError: "Connection timeout",
          },
        } as CronJob,
      ];

      await persistCronRunState(storePath, jobs as CronJob[]);

      const content = await fs.readFile(
        path.join(tempDir, "cron-store-persistence.json"),
        "utf-8"
      );
      const data = JSON.parse(content);
      expect(Object.keys(data.jobs)).toHaveLength(2);
      expect(data.jobs["job-1"].lastStatus).toBe("ok");
      expect(data.jobs["job-2"].lastStatus).toBe("error");
    });

    it("should handle jobs with missing state gracefully", async () => {
      const jobs: Partial<CronJob>[] = [
        {
          id: "job-1",
          state: undefined,
        } as any as CronJob,
      ];

      await persistCronRunState(storePath, jobs as CronJob[]);

      const content = await fs.readFile(
        path.join(tempDir, "cron-store-persistence.json"),
        "utf-8"
      );
      const data = JSON.parse(content);
      expect(data.jobs).toEqual({});
    });

    it("should handle empty storePath gracefully", async () => {
      await persistCronRunState("", []);
      // Should not throw
    });

    it("should set correct timestamp", async () => {
      const before = Date.now();
      await persistCronRunState(storePath, []);
      const after = Date.now();

      const content = await fs.readFile(
        path.join(tempDir, "cron-store-persistence.json"),
        "utf-8"
      );
      const data = JSON.parse(content);
      expect(data.savedAtMs).toBeGreaterThanOrEqual(before);
      expect(data.savedAtMs).toBeLessThanOrEqual(after);
    });
  });

  describe("restoreCronRunState", () => {
    it("should return empty map when no persistence file exists", async () => {
      const result = await restoreCronRunState(storePath, []);
      expect(result).toEqual(new Map());
    });

    it("should restore single job state", async () => {
      // Create persistence file
      const persistencePath = path.join(tempDir, "cron-store-persistence.json");
      const data = {
        version: 1,
        storePath,
        savedAtMs: Date.now(),
        jobs: {
          "job-1": {
            jobId: "job-1",
            lastRunAtMs: 1234567890,
            lastStatus: "ok",
            lastDurationMs: 100,
          },
        },
      };
      await fs.writeFile(persistencePath, JSON.stringify(data));

      const result = await restoreCronRunState(storePath, []);

      expect(result.has("job-1")).toBe(true);
      const restored = result.get("job-1");
      expect(restored?.lastRunAtMs).toBe(1234567890);
      expect(restored?.lastStatus).toBe("ok");
      expect(restored?.lastDurationMs).toBe(100);
    });

    it("should restore multiple job states", async () => {
      const persistencePath = path.join(tempDir, "cron-store-persistence.json");
      const data = {
        version: 1,
        storePath,
        savedAtMs: Date.now(),
        jobs: {
          "job-1": {
            jobId: "job-1",
            lastStatus: "ok",
          },
          "job-2": {
            jobId: "job-2",
            lastStatus: "error",
            failureCount: 3,
          },
        },
      };
      await fs.writeFile(persistencePath, JSON.stringify(data));

      const result = await restoreCronRunState(storePath, []);

      expect(result.size).toBe(2);
      expect(result.get("job-1")?.lastStatus).toBe("ok");
      expect(result.get("job-2")?.failureCount).toBe(3);
    });

    it("should reject persistence file with wrong version", async () => {
      const persistencePath = path.join(tempDir, "cron-store-persistence.json");
      const data = {
        version: 2, // Wrong version
        storePath,
        jobs: {},
      };
      await fs.writeFile(persistencePath, JSON.stringify(data));

      const result = await restoreCronRunState(storePath, []);

      expect(result.size).toBe(0);
    });

    it("should reject persistence file with mismatched storePath", async () => {
      const persistencePath = path.join(tempDir, "cron-store-persistence.json");
      const data = {
        version: 1,
        storePath: "/different/path",
        jobs: { "job-1": {} },
      };
      await fs.writeFile(persistencePath, JSON.stringify(data));

      const result = await restoreCronRunState(storePath, []);

      expect(result.size).toBe(0);
    });

    it("should handle corrupted JSON gracefully", async () => {
      const persistencePath = path.join(tempDir, "cron-store-persistence.json");
      await fs.writeFile(persistencePath, "invalid json {");

      const result = await restoreCronRunState(storePath, []);

      expect(result).toEqual(new Map());
    });

    it("should handle empty storePath gracefully", async () => {
      const result = await restoreCronRunState("", []);
      expect(result).toEqual(new Map());
    });
  });

  describe("persistence round-trip", () => {
    it("should persist and restore job state correctly", async () => {
      const originalJobs: Partial<CronJob>[] = [
        {
          id: "job-1",
          name: "Test Job",
          enabled: true,
          state: {
            lastRunAtMs: 1234567890,
            lastStatus: "ok",
            lastError: undefined,
            lastDurationMs: 150,
            nextRunAtMs: 1234567990,
            failureCount: 0,
          },
        } as CronJob,
      ];

      // Persist
      await persistCronRunState(storePath, originalJobs as CronJob[]);

      // Restore
      const restored = await restoreCronRunState(storePath, []);

      // Verify
      expect(restored.has("job-1")).toBe(true);
      const state = restored.get("job-1");
      ex
