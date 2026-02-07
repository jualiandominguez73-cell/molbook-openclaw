import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

describe("OpenRouter Provider", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    vi.resetModules();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("validateApiKey", () => {
    it("returns undefined for valid keys", async () => {
      const { validateApiKey } = await import("./index.js");

      expect(validateApiKey("sk-or-v1-abc123def456")).toBeUndefined();
      expect(validateApiKey("sk-or-prod-longkeyvalue123456789")).toBeUndefined();
    });

    it("returns error for empty key", async () => {
      const { validateApiKey } = await import("./index.js");

      expect(validateApiKey("")).toBe("API key is required");
      expect(validateApiKey("   ")).toBe("API key is required");
    });

    it("returns error for wrong prefix", async () => {
      const { validateApiKey } = await import("./index.js");

      expect(validateApiKey("sk-ant-abc123")).toBe("OpenRouter keys start with 'sk-or-'");
      expect(validateApiKey("not-a-key")).toBe("OpenRouter keys start with 'sk-or-'");
    });

    it("returns error for too short key", async () => {
      const { validateApiKey } = await import("./index.js");

      expect(validateApiKey("sk-or-short")).toBe("API key appears too short");
    });
  });

  describe("parseModelIds", () => {
    it("parses comma-separated models", async () => {
      const { parseModelIds } = await import("./index.js");

      expect(parseModelIds("openrouter/auto, google/gemini:free")).toEqual([
        "openrouter/auto",
        "google/gemini:free",
      ]);
    });

    it("parses newline-separated models", async () => {
      const { parseModelIds } = await import("./index.js");

      expect(parseModelIds("openrouter/auto\ngoogle/gemini:free")).toEqual([
        "openrouter/auto",
        "google/gemini:free",
      ]);
    });

    it("filters empty entries", async () => {
      const { parseModelIds } = await import("./index.js");

      expect(parseModelIds("openrouter/auto,  ,  google/gemini:free")).toEqual([
        "openrouter/auto",
        "google/gemini:free",
      ]);
    });

    it("trims whitespace", async () => {
      const { parseModelIds } = await import("./index.js");

      expect(parseModelIds("  openrouter/auto  ,  google/gemini:free  ")).toEqual([
        "openrouter/auto",
        "google/gemini:free",
      ]);
    });
  });

  describe("buildModelDefinition", () => {
    it("builds definition for known free model", async () => {
      const { buildModelDefinition, FREE_MODELS } = await import("./index.js");

      const qwen = FREE_MODELS.find((m) => m.id.includes("qwen3-next"));
      const def = buildModelDefinition(qwen!);

      expect(def.id).toBe("qwen/qwen3-next-80b-a3b-instruct:free");
      expect(def.name).toBe("Qwen3 Next 80B");
      expect(def.contextWindow).toBe(262_144);
      expect(def.cost).toEqual({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0 });
    });

    it("builds definition for unknown model", async () => {
      const { buildModelDefinition } = await import("./index.js");

      const def = buildModelDefinition({ id: "custom/model:v1" });

      expect(def.id).toBe("custom/model:v1");
      expect(def.name).toBe("custom/model:v1");
      expect(def.contextWindow).toBe(128_000); // default
    });

    it("marks reasoning models correctly", async () => {
      const { buildModelDefinition, FREE_MODELS } = await import("./index.js");

      const deepseek = FREE_MODELS.find((m) => m.id.includes("deepseek-r1"));
      expect(buildModelDefinition(deepseek!).reasoning).toBe(true);

      const qwen = FREE_MODELS.find((m) => m.id.includes("qwen3-next"));
      expect(buildModelDefinition(qwen!).reasoning).toBe(false);
    });
  });

  describe("getApiKeyFromEnv", () => {
    it("returns key from OPENROUTER_API_KEY", async () => {
      process.env.OPENROUTER_API_KEY = "sk-or-test-key123";

      const { getApiKeyFromEnv } = await import("./index.js");
      expect(getApiKeyFromEnv()).toBe("sk-or-test-key123");
    });

    it("returns key from OPENCLAW_OPENROUTER_API_KEY", async () => {
      delete process.env.OPENROUTER_API_KEY;
      process.env.OPENCLAW_OPENROUTER_API_KEY = "sk-or-openclaw-key";

      const { getApiKeyFromEnv } = await import("./index.js");
      expect(getApiKeyFromEnv()).toBe("sk-or-openclaw-key");
    });

    it("returns undefined when no key found", async () => {
      delete process.env.OPENROUTER_API_KEY;
      delete process.env.OPENCLAW_OPENROUTER_API_KEY;

      const { getApiKeyFromEnv } = await import("./index.js");
      expect(getApiKeyFromEnv()).toBeUndefined();
    });

    it("ignores invalid keys", async () => {
      process.env.OPENROUTER_API_KEY = "not-a-valid-key";

      const { getApiKeyFromEnv } = await import("./index.js");
      expect(getApiKeyFromEnv()).toBeUndefined();
    });
  });

  describe("toModelRef", () => {
    it("preserves openrouter/ prefix", async () => {
      const { toModelRef } = await import("./index.js");

      expect(toModelRef("openrouter/auto")).toBe("openrouter/auto");
    });

    it("adds openrouter/ prefix and converts colon", async () => {
      const { toModelRef } = await import("./index.js");

      expect(toModelRef("google/gemini-2.0-flash-exp:free")).toBe(
        "openrouter/google/gemini-2.0-flash-exp/free",
      );
    });

    it("handles models without colon", async () => {
      const { toModelRef } = await import("./index.js");

      expect(toModelRef("meta-llama/llama-3")).toBe("openrouter/meta-llama/llama-3");
    });
  });

  describe("FREE_MODELS", () => {
    it("includes expected free models", async () => {
      const { FREE_MODELS } = await import("./index.js");

      expect(FREE_MODELS.length).toBeGreaterThan(5);
      expect(FREE_MODELS.some((m) => m.id === "openrouter/auto")).toBe(true);
      expect(FREE_MODELS.some((m) => m.id.includes("qwen"))).toBe(true);
      expect(FREE_MODELS.some((m) => m.id.includes("llama"))).toBe(true);
    });

    it("all models have context windows", async () => {
      const { FREE_MODELS } = await import("./index.js");

      for (const model of FREE_MODELS) {
        expect(model.context).toBeGreaterThan(0);
      }
    });

    it("all models have descriptions", async () => {
      const { FREE_MODELS } = await import("./index.js");

      for (const model of FREE_MODELS) {
        expect(model.description.length).toBeGreaterThan(0);
      }
    });
  });
});
