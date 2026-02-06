import { describe, it, expect } from "vitest";

describe("runtime module", () => {
  it("should have a runtime object exported", async () => {
    const mod = await import("./runtime.js");
    expect(mod.runtime).toBeDefined();
    expect(typeof mod.runtime).toBe("object");
  });

  it("should expose platform information", async () => {
    const { runtime } = await import("./runtime.js");
    expect(runtime.platform).toBeDefined();
    expect(["darwin", "linux", "win32"].includes(runtime.platform)).toBe(true);
  });

  it("should expose node version", async () => {
    const { runtime } = await import("./runtime.js");
    expect(runtime.nodeVersion).toBeDefined();
    expect(typeof runtime.nodeVersion).toBe("string");
  });

  it("should have consistent runtime information", async () => {
    const { runtime: runtime1 } = await import("./runtime.js");
    const { runtime: runtime2 } = await import("./runtime.js");
    
    expect(runtime1.platform).toBe(runtime2.platform);
    expect(runtime1.nodeVersion).toBe(runtime2.nodeVersion);
  });

  it("should expose arch information", async () => {
    const { runtime } = await import("./runtime.js");
    expect(runtime.arch).toBeDefined();
    expect(["x64", "arm64", "ia32", "arm"].includes(runtime.arch)).toBe(true);
  });

  it("should not have undefined runtime properties", async () => {
    const { runtime } = await import("./runtime.js");
    expect(Object.values(runtime).every((v) => v !== undefined)).toBe(true);
  });
});
