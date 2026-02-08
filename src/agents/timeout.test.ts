import { describe, expect, it } from "vitest";
import { resolveAgentTimeoutMs } from "./timeout.js";

describe("resolveAgentTimeoutMs", () => {
  it("returns default timeout when no overrides", () => {
    const ms = resolveAgentTimeoutMs({ cfg: undefined });
    expect(ms).toBe(600_000); // 600s default
  });

  it("uses overrideSeconds when provided", () => {
    const ms = resolveAgentTimeoutMs({ cfg: undefined, overrideSeconds: 120 });
    expect(ms).toBe(120_000);
  });

  it("uses overrideMs when provided", () => {
    const ms = resolveAgentTimeoutMs({ cfg: undefined, overrideMs: 5000 });
    expect(ms).toBe(5000);
  });

  it("returns NO_TIMEOUT_MS when overrideSeconds is 0", () => {
    const ms = resolveAgentTimeoutMs({ cfg: undefined, overrideSeconds: 0 });
    // Must be under 2^31-1 to avoid Node.js setTimeout overflow
    expect(ms).toBeLessThan(2_147_483_647);
    // Should be 24 days in ms
    expect(ms).toBe(24 * 24 * 60 * 60 * 1000);
  });

  it("returns NO_TIMEOUT_MS when overrideMs is 0", () => {
    const ms = resolveAgentTimeoutMs({ cfg: undefined, overrideMs: 0 });
    expect(ms).toBeLessThan(2_147_483_647);
  });

  it("NO_TIMEOUT_MS + 10s buffer still fits in 32-bit signed integer", () => {
    // subagent-registry adds 10_000ms buffer to the timeout
    const ms = resolveAgentTimeoutMs({ cfg: undefined, overrideSeconds: 0 });
    expect(ms + 10_000).toBeLessThan(2_147_483_647);
  });
});
