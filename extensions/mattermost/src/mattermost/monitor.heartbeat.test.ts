import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Regression test for #11796: Mattermost WebSocket must have ping/pong
 * heartbeat to detect stale connections caused by silent network failures.
 *
 * The monitor's connectOnce function uses raw WebSocket APIs that are hard
 * to unit-test without a real server, so we verify the heartbeat mechanism
 * structurally to prevent accidental removal.
 */
describe("mattermost monitor websocket heartbeat (#11796)", () => {
  const monitorSource = fs.readFileSync(path.resolve(import.meta.dirname, "monitor.ts"), "utf-8");

  const connectOnceStart = monitorSource.indexOf("const connectOnce");
  const reconnectLoop = monitorSource.indexOf("while (!opts.abortSignal?.aborted)");
  const connectOnceBody = monitorSource.slice(connectOnceStart, reconnectLoop);

  it("sends periodic WebSocket pings", () => {
    expect(connectOnceBody).toMatch(/ws\.ping\s*\(/);
  });

  it("listens for pong events to track liveness", () => {
    expect(connectOnceBody).toMatch(/ws\.on\s*\(\s*["']pong["']/);
  });

  it("tracks last pong timestamp", () => {
    expect(connectOnceBody).toContain("lastPongAt");
  });

  it("terminates stale connections when no pong received", () => {
    expect(connectOnceBody).toMatch(/ws\.terminate\s*\(/);
  });

  it("cleans up heartbeat intervals on close", () => {
    const closeSection = connectOnceBody.slice(connectOnceBody.indexOf('ws.on("close"'));
    expect(closeSection).toContain("clearHeartbeat");
  });

  it("resets liveness on incoming messages", () => {
    const messageSection = connectOnceBody.slice(
      connectOnceBody.indexOf('ws.on("message"'),
      connectOnceBody.indexOf('ws.on("close"'),
    );
    expect(messageSection).toMatch(/lastPongAt\s*=\s*Date\.now\(\)/);
  });

  it("cleans up heartbeat intervals on error", () => {
    const errorSection = connectOnceBody.slice(connectOnceBody.indexOf('ws.on("error"'));
    expect(errorSection).toContain("clearHeartbeat");
  });
});
