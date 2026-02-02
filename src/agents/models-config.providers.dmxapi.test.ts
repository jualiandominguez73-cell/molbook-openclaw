import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveImplicitProviders } from "./models-config.providers.js";

describe("DMXAPI provider", () => {
  it("should not include dmxapi when no API key is configured", async () => {
    const agentDir = mkdtempSync(join(tmpdir(), "openclaw-test-"));

    // Temporarily clear DMXAPI_API_KEY for this test
    const originalEnv = process.env.DMXAPI_API_KEY;
    delete process.env.DMXAPI_API_KEY;

    try {
      const providers = await resolveImplicitProviders({ agentDir });

      // DMXAPI requires DMXAPI_API_KEY env var or auth profile
      expect(providers?.dmxapi).toBeUndefined();
    } finally {
      // Restore original environment
      if (originalEnv !== undefined) {
        process.env.DMXAPI_API_KEY = originalEnv;
      }
    }
  });

  it("should include dmxapi when DMXAPI_API_KEY env var is set", async () => {
    const agentDir = mkdtempSync(join(tmpdir(), "openclaw-test-"));
    const testKey = "dmxapi-test-key-12345";

    // Mock the environment variable
    const originalEnv = process.env.DMXAPI_API_KEY;
    process.env.DMXAPI_API_KEY = testKey;

    try {
      const providers = await resolveImplicitProviders({ agentDir });

      expect(providers?.dmxapi).toBeDefined();
      // The apiKey stores the env var name, not the actual value
      expect(providers?.dmxapi?.apiKey).toBe("DMXAPI_API_KEY");
      expect(providers?.dmxapi?.baseUrl).toBe("https://www.dmxapi.cn/v1");
      expect(providers?.dmxapi?.api).toBe("openai-completions");
      expect(providers?.dmxapi?.models).toHaveLength(1);
      expect(providers?.dmxapi?.models[0].id).toBe("claude-sonnet-4-20250514");
    } finally {
      // Restore original environment
      if (originalEnv !== undefined) {
        process.env.DMXAPI_API_KEY = originalEnv;
      } else {
        delete process.env.DMXAPI_API_KEY;
      }
    }
  });

  it("should have correct model configuration for DMXAPI Claude Sonnet 4", async () => {
    const agentDir = mkdtempSync(join(tmpdir(), "openclaw-test-"));
    const testKey = "dmxapi-test-key-12345";

    const originalEnv = process.env.DMXAPI_API_KEY;
    process.env.DMXAPI_API_KEY = testKey;

    try {
      const providers = await resolveImplicitProviders({ agentDir });
      const model = providers?.dmxapi?.models[0];

      expect(model).toBeDefined();
      expect(model?.id).toBe("claude-sonnet-4-20250514");
      expect(model?.name).toBe("Claude Sonnet 4 (DMXAPI)");
      expect(model?.reasoning).toBe(false);
      expect(model?.input).toEqual(["text"]);
      expect(model?.contextWindow).toBe(200000);
      expect(model?.maxTokens).toBe(8192);
      expect(model?.cost).toEqual({
        input: 3.0,
        output: 15.0,
        cacheRead: 0.3,
        cacheWrite: 1.5,
      });
    } finally {
      if (originalEnv !== undefined) {
        process.env.DMXAPI_API_KEY = originalEnv;
      } else {
        delete process.env.DMXAPI_API_KEY;
      }
    }
  });
});
