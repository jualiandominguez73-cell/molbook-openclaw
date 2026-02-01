import { describe, expect, it } from "vitest";
import {
  buildAzureOpenAIProvider,
  buildAzureOpenAILiteLLMProvider,
  generateAzureLiteLLMConfig,
} from "./models-config.providers.js";

describe("Azure OpenAI provider helpers", () => {
  describe("buildAzureOpenAIProvider (native)", () => {
    it("generates native Azure provider config", () => {
      const provider = buildAzureOpenAIProvider({
        endpoint: "https://my-resource.openai.azure.com",
        apiKey: "test-key",
        deployments: {
          "gpt-4o-mini": "my-gpt4o-deployment",
          "gpt-5.2-codex": "my-gpt5-deployment",
        },
      });

      expect(provider.baseUrl).toBe("https://my-resource.openai.azure.com/openai/v1");
      expect(provider.apiKey).toBe("test-key");
      expect(provider.api).toBe("azure-openai-responses");
      expect(provider.models).toHaveLength(2);

      // Model ID should be the deployment name for Azure
      const gpt4Model = provider.models.find((m) => m.id === "my-gpt4o-deployment");
      expect(gpt4Model).toBeDefined();
      expect(gpt4Model?.name).toBe("gpt-4o-mini");

      const gpt5Model = provider.models.find((m) => m.id === "my-gpt5-deployment");
      expect(gpt5Model).toBeDefined();
      expect(gpt5Model?.contextWindow).toBe(200000);
    });

    it("strips trailing slash from endpoint", () => {
      const provider = buildAzureOpenAIProvider({
        endpoint: "https://my-resource.openai.azure.com/",
        deployments: { "gpt-4o": "deploy" },
      });

      expect(provider.baseUrl).toBe("https://my-resource.openai.azure.com/openai/v1");
    });

    it("detects reasoning models (o1, o3)", () => {
      const provider = buildAzureOpenAIProvider({
        endpoint: "https://test.openai.azure.com",
        deployments: {
          "o1-preview": "o1-deploy",
          "o3-mini": "o3-deploy",
          "gpt-4o": "gpt4-deploy",
        },
      });

      const o1Model = provider.models.find((m) => m.id === "o1-deploy");
      expect(o1Model?.reasoning).toBe(true);

      const o3Model = provider.models.find((m) => m.id === "o3-deploy");
      expect(o3Model?.reasoning).toBe(true);

      const gptModel = provider.models.find((m) => m.id === "gpt4-deploy");
      expect(gptModel?.reasoning).toBe(false);
    });
  });

  describe("buildAzureOpenAILiteLLMProvider (legacy)", () => {
    it("generates provider config for LiteLLM proxy", () => {
      const provider = buildAzureOpenAILiteLLMProvider({
        litellmBaseUrl: "http://localhost:4000/v1",
        litellmApiKey: "test-key",
        deployments: {
          "gpt-4o-mini": "my-gpt4o-deployment",
        },
      });

      expect(provider.baseUrl).toBe("http://localhost:4000/v1");
      expect(provider.api).toBe("openai-completions");
    });
  });

  describe("generateAzureLiteLLMConfig", () => {
    it("generates valid LiteLLM config YAML", () => {
      const yaml = generateAzureLiteLLMConfig({
        endpoint: "https://my-resource.openai.azure.com",
        apiVersion: "2024-10-21",
        deployments: {
          "gpt-4o-mini": "my-gpt4o-mini-deployment",
        },
      });

      expect(yaml).toContain("model_list:");
      expect(yaml).toContain("model_name: gpt-4o-mini");
      expect(yaml).toContain("model: azure/my-gpt4o-mini-deployment");
      expect(yaml).toContain("drop_params: true");
    });
  });
});
