import { describe, expect, it } from "vitest";
import type { HookMappingConfig } from "./types.hooks.js";

describe("HookMappingConfig", () => {
  it("accepts cleanup option with delete value", () => {
    const config: HookMappingConfig = {
      id: "test",
      match: { path: "test" },
      action: "agent",
      cleanup: "delete",
    };
    expect(config.cleanup).toBe("delete");
  });

  it("accepts cleanup option with keep value", () => {
    const config: HookMappingConfig = {
      id: "test",
      match: { path: "test" },
      action: "agent",
      cleanup: "keep",
    };
    expect(config.cleanup).toBe("keep");
  });

  it("accepts cleanupDelayMinutes option", () => {
    const config: HookMappingConfig = {
      id: "test",
      match: { path: "test" },
      action: "agent",
      cleanup: "delete",
      cleanupDelayMinutes: 5,
    };
    expect(config.cleanupDelayMinutes).toBe(5);
  });

  it("allows cleanup fields to be omitted", () => {
    const config: HookMappingConfig = {
      id: "test",
      match: { path: "test" },
      action: "agent",
    };
    expect(config.cleanup).toBeUndefined();
    expect(config.cleanupDelayMinutes).toBeUndefined();
  });
});
