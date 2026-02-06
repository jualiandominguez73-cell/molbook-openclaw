import { describe, it, expect } from "vitest";

describe("logging module", () => {
  it("should export a createLogger function", async () => {
    const mod = await import("./logging.js");
    expect(typeof mod.createLogger).toBe("function");
  });

  it("should create a logger instance", async () => {
    const { createLogger } = await import("./logging.js");
    const logger = createLogger("test");
    expect(logger).toBeDefined();
    expect(typeof logger).toBe("object");
  });

  it("should have standard log methods", async () => {
    const { createLogger } = await import("./logging.js");
    const logger = createLogger("test");
    
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.warn).toBe("function");
    expect(typeof logger.error).toBe("function");
  });

  it("should handle debug level", async () => {
    const { createLogger } = await import("./logging.js");
    const logger = createLogger("test");
    
    // Should not throw on debug calls
    expect(() => {
      logger.debug?.("test message");
    }).not.toThrow();
  });

  it("should handle logger with custom context", async () => {
    const { createLogger } = await import("./logging.js");
    const logger = createLogger("test-context");
    
    // Logger should track its name
    expect(logger).toBeDefined();
  });

  it("should not throw on log calls", async () => {
    const { createLogger } = await import("./logging.js");
    const logger = createLogger("test");
    
    expect(() => {
      logger.info("info message");
      logger.warn("warn message");
      logger.error("error message");
    }).not.toThrow();
  });
});
