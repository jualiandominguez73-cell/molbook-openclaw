import { describe, expect, it } from "vitest";
import { resolveImplicitProviders } from "./models-config.providers.js";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("Ollama provider", () => {
  it("should include ollama in implicit providers by default", async () => {
    const agentDir = mkdtempSync(join(tmpdir(), "clawd-test-"));
    const providers = await resolveImplicitProviders({ agentDir });

    expect(providers).toBeDefined();
    expect(providers?.ollama).toBeDefined();
    expect(providers?.ollama?.baseUrl).toBe("http://127.0.0.1:11434/v1");
    expect(providers?.ollama?.api).toBe("openai-completions");
    expect(providers?.ollama?.apiKey).toBe("ollama-local");
  });

  it("should discover models from local ollama instance", async () => {
    const agentDir = mkdtempSync(join(tmpdir(), "clawd-test-"));
    const providers = await resolveImplicitProviders({ agentDir });

    const ollamaProvider = providers?.ollama;
    expect(ollamaProvider).toBeDefined();
    expect(ollamaProvider?.models).toBeDefined();
    // Models array could be empty if Ollama is not running or has no models
    expect(Array.isArray(ollamaProvider?.models)).toBe(true);
  });

  it("should mark r1 models as reasoning models", async () => {
    const agentDir = mkdtempSync(join(tmpdir(), "clawd-test-"));
    const providers = await resolveImplicitProviders({ agentDir });

    const ollamaProvider = providers?.ollama;
    const r1Models = ollamaProvider?.models.filter((m) => m.id.toLowerCase().includes("r1"));

    if (r1Models && r1Models.length > 0) {
      r1Models.forEach((model) => {
        expect(model.reasoning).toBe(true);
      });
    }
  });

  it("should set zero cost for ollama models", async () => {
    const agentDir = mkdtempSync(join(tmpdir(), "clawd-test-"));
    const providers = await resolveImplicitProviders({ agentDir });

    const ollamaProvider = providers?.ollama;

    if (ollamaProvider?.models && ollamaProvider.models.length > 0) {
      const firstModel = ollamaProvider.models[0];
      expect(firstModel.cost).toEqual({
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
      });
    }
  });

  it("should handle ollama discovery failures gracefully", async () => {
    const agentDir = mkdtempSync(join(tmpdir(), "clawd-test-"));
    const providers = await resolveImplicitProviders({ agentDir });

    const ollamaProvider = providers?.ollama;
    expect(ollamaProvider).toBeDefined();
    // Should still create provider even if discovery fails
    expect(ollamaProvider?.models).toBeDefined();
  });
});
