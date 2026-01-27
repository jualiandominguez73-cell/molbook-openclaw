import { describe, expect, it } from "vitest";
import { resolveImplicitProviders } from "./models-config.providers.js";
import { resolveEnvApiKey } from "./model-auth.js";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("Ollama provider", () => {
  it("should not include ollama when no API key is configured", async () => {
    const agentDir = mkdtempSync(join(tmpdir(), "clawd-test-"));
    const providers = await resolveImplicitProviders({ agentDir });

    // Ollama requires explicit configuration via OLLAMA_API_KEY env var or profile
    expect(providers?.ollama).toBeUndefined();
  });

  it("should resolve OLLAMA_API_KEY env var for ollama provider", () => {
    const prev = process.env.OLLAMA_API_KEY;
    try {
      process.env.OLLAMA_API_KEY = "ollama";
      const result = resolveEnvApiKey("ollama");
      expect(result).not.toBeNull();
      expect(result!.apiKey).toBe("ollama");
      expect(result!.source).toContain("OLLAMA_API_KEY");
    } finally {
      if (prev === undefined) delete process.env.OLLAMA_API_KEY;
      else process.env.OLLAMA_API_KEY = prev;
    }
  });
});
