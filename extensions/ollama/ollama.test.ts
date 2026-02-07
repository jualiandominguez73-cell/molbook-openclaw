import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock fetch for testing
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("Ollama Provider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("probeOllamaModels", () => {
    it("returns model names when Ollama is running", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          models: [
            { name: "mistral:latest", size: 4_000_000_000 },
            { name: "llama3.2:latest", size: 2_000_000_000 },
          ],
        }),
      });

      // Import after mocking
      const { probeOllamaModels } = await import("./index.js");
      const models = await probeOllamaModels("http://localhost:11434");

      expect(models).toEqual(["mistral:latest", "llama3.2:latest"]);
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:11434/api/tags",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("returns empty array when Ollama is not running", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Connection refused"));

      const { probeOllamaModels } = await import("./index.js");
      const models = await probeOllamaModels("http://localhost:11434");

      expect(models).toEqual([]);
    });

    it("returns empty array when response is not ok", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const { probeOllamaModels } = await import("./index.js");
      const models = await probeOllamaModels("http://localhost:11434");

      expect(models).toEqual([]);
    });
  });

  describe("isOllamaRunning", () => {
    it("returns true when Ollama responds", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ models: [] }),
      });

      const { isOllamaRunning } = await import("./index.js");
      const running = await isOllamaRunning("http://localhost:11434");

      expect(running).toBe(true);
    });

    it("returns false when connection fails", async () => {
      mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));

      const { isOllamaRunning } = await import("./index.js");
      const running = await isOllamaRunning("http://localhost:11434");

      expect(running).toBe(false);
    });
  });

  describe("normalizeBaseUrl", () => {
    it("removes trailing slashes", async () => {
      const { normalizeBaseUrl } = await import("./index.js");

      expect(normalizeBaseUrl("http://localhost:11434/")).toBe("http://localhost:11434");
      expect(normalizeBaseUrl("http://localhost:11434///")).toBe("http://localhost:11434");
    });

    it("returns default for empty input", async () => {
      const { normalizeBaseUrl } = await import("./index.js");

      expect(normalizeBaseUrl("")).toBe("http://localhost:11434");
      expect(normalizeBaseUrl("   ")).toBe("http://localhost:11434");
    });
  });

  describe("validateBaseUrl", () => {
    it("returns undefined for valid URLs", async () => {
      const { validateBaseUrl } = await import("./index.js");

      expect(validateBaseUrl("http://localhost:11434")).toBeUndefined();
      expect(validateBaseUrl("http://192.168.1.100:11434")).toBeUndefined();
    });

    it("returns error for invalid URLs", async () => {
      const { validateBaseUrl } = await import("./index.js");

      expect(validateBaseUrl("not-a-url")).toBe("Enter a valid URL (e.g., http://localhost:11434)");
    });
  });

  describe("buildModelDefinition", () => {
    it("uses known context window for recognized models", async () => {
      const { buildModelDefinition } = await import("./index.js");

      const mistral = buildModelDefinition("mistral:latest");
      expect(mistral.contextWindow).toBe(32_768);

      const llama = buildModelDefinition("llama3.2:latest");
      expect(llama.contextWindow).toBe(128_000);
    });

    it("uses default context for unknown models", async () => {
      const { buildModelDefinition } = await import("./index.js");

      const unknown = buildModelDefinition("custom-model:v1");
      expect(unknown.contextWindow).toBe(32_768); // DEFAULT_CONTEXT_WINDOW
    });

    it("marks reasoning models correctly", async () => {
      const { buildModelDefinition } = await import("./index.js");

      const deepseek = buildModelDefinition("deepseek-r1:7b");
      expect(deepseek.reasoning).toBe(true);

      const mistral = buildModelDefinition("mistral:latest");
      expect(mistral.reasoning).toBe(false);
    });

    it("sets zero cost for all models", async () => {
      const { buildModelDefinition } = await import("./index.js");

      const model = buildModelDefinition("mistral:latest");
      expect(model.cost).toEqual({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0 });
    });
  });

  describe("parseModelIds", () => {
    it("splits comma-separated models", async () => {
      const { parseModelIds } = await import("./index.js");

      expect(parseModelIds("mistral:latest, llama3.2:latest")).toEqual([
        "mistral:latest",
        "llama3.2:latest",
      ]);
    });

    it("handles newline-separated models", async () => {
      const { parseModelIds } = await import("./index.js");

      expect(parseModelIds("mistral:latest\nllama3.2:latest")).toEqual([
        "mistral:latest",
        "llama3.2:latest",
      ]);
    });

    it("filters empty entries", async () => {
      const { parseModelIds } = await import("./index.js");

      expect(parseModelIds("mistral:latest,  , llama3.2:latest")).toEqual([
        "mistral:latest",
        "llama3.2:latest",
      ]);
    });
  });
});
