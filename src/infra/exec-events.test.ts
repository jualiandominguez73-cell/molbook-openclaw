import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createThrottledExecOutputBuffer,
  matchExecCommandAgainstWhitelist,
  resolveExecEventsConfig,
} from "./exec-events.js";

afterEach(() => {
  vi.useRealTimers();
});

describe("exec event whitelist matching", () => {
  it("matches a direct command", () => {
    const cfg = resolveExecEventsConfig();
    const result = matchExecCommandAgainstWhitelist("codex run", cfg);
    expect(result).toEqual({ matched: true, commandName: "codex" });
  });

  it("matches wrapped commands", () => {
    const cfg = resolveExecEventsConfig();
    const result = matchExecCommandAgainstWhitelist("npx playwright test", cfg);
    expect(result).toEqual({ matched: true, commandName: "playwright" });
  });

  it("matches commands with env prefixes", () => {
    const cfg = resolveExecEventsConfig();
    const result = matchExecCommandAgainstWhitelist("FOO=1 codex run", cfg);
    expect(result).toEqual({ matched: true, commandName: "codex" });
  });
});

describe("exec output throttling", () => {
  it("emits at most once per throttle window", () => {
    vi.useFakeTimers();
    const flushes: string[] = [];
    const buffer = createThrottledExecOutputBuffer({
      throttleMs: 100,
      maxChunkBytes: 1024,
      maxBufferBytes: 4096,
      onFlush: (chunks) => {
        const combined = chunks.map((chunk) => chunk.output).join("");
        flushes.push(combined);
      },
    });

    buffer.append("stdout", "a");
    buffer.append("stdout", "b");
    buffer.append("stdout", "c");

    expect(flushes).toHaveLength(0);
    vi.advanceTimersByTime(100);
    expect(flushes).toHaveLength(1);
    expect(flushes[0]).toBe("abc");

    buffer.append("stdout", "d");
    vi.advanceTimersByTime(99);
    expect(flushes).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(flushes).toHaveLength(2);
    expect(flushes[1]).toBe("d");

    buffer.dispose();
  });

  it("caps chunks to the configured max bytes", () => {
    const outputs: string[] = [];
    const buffer = createThrottledExecOutputBuffer({
      throttleMs: 0,
      maxChunkBytes: 4,
      maxBufferBytes: 1024,
      onFlush: (chunks) => {
        for (const chunk of chunks) outputs.push(chunk.output);
      },
    });

    const payload = "abcdefghijklmnopqrstuvwxyz";
    buffer.append("stdout", payload);
    buffer.flushAll();

    expect(outputs.length).toBeGreaterThan(1);
    for (const chunk of outputs) {
      expect(chunk.length).toBeLessThanOrEqual(4);
    }
    expect(outputs.join("")).toBe(payload);

    buffer.dispose();
  });
});
