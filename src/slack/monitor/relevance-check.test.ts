import { describe, it, expect, vi } from "vitest";
import { checkMessageRelevance, resolveRelevanceModel } from "./relevance-check.js";

describe("resolveRelevanceModel", () => {
  it("returns haiku for anthropic provider", () => {
    const result = resolveRelevanceModel({
      relevanceModelConfig: "auto",
      mainProvider: "anthropic",
      mainModel: "claude-sonnet-4-20250514",
    });
    expect(result.provider).toBe("anthropic");
    expect(result.model).toMatch(/haiku/i);
  });

  it("returns gpt-4o-mini for openai provider", () => {
    const result = resolveRelevanceModel({
      relevanceModelConfig: "auto",
      mainProvider: "openai",
      mainModel: "gpt-4o",
    });
    expect(result.provider).toBe("openai");
    expect(result.model).toBe("gpt-4o-mini");
  });

  it("parses explicit model string", () => {
    const result = resolveRelevanceModel({
      relevanceModelConfig: "google/gemini-2.0-flash",
      mainProvider: "anthropic",
      mainModel: "claude-sonnet-4",
    });
    expect(result.provider).toBe("google");
    expect(result.model).toBe("gemini-2.0-flash");
  });

  it("falls back to main model for unknown provider", () => {
    const result = resolveRelevanceModel({
      relevanceModelConfig: "auto",
      mainProvider: "custom-provider",
      mainModel: "custom-model",
    });
    expect(result.provider).toBe("custom-provider");
    expect(result.model).toBe("custom-model");
  });
});

describe("checkMessageRelevance", () => {
  it("returns shouldRespond=true for RESPOND prefix", async () => {
    const mockRunner = vi.fn().mockResolvedValue({
      text: "RESPOND: User is asking a direct question about deployments",
    });

    const result = await checkMessageRelevance({
      message: "Hey, can someone help me with the deployment?",
      channelContext: "Engineering team discussion",
      agentPersona: "DevOps assistant",
      runner: mockRunner,
    });

    expect(result.shouldRespond).toBe(true);
    expect(result.reason).toContain("question");
  });

  it("returns shouldRespond=false for SKIP prefix", async () => {
    const mockRunner = vi.fn().mockResolvedValue({
      text: "SKIP: General social conversation, not addressed to assistant",
    });

    const result = await checkMessageRelevance({
      message: "lol that meeting was wild",
      channelContext: "Engineering team discussion",
      agentPersona: "DevOps assistant",
      runner: mockRunner,
    });

    expect(result.shouldRespond).toBe(false);
    expect(result.reason).toContain("social");
  });

  it("returns shouldRespond=false for unclear response", async () => {
    const mockRunner = vi.fn().mockResolvedValue({
      text: "Maybe the assistant could help here",
    });

    const result = await checkMessageRelevance({
      message: "test message",
      channelContext: "test",
      agentPersona: "test",
      runner: mockRunner,
    });

    expect(result.shouldRespond).toBe(false);
    expect(result.reason).toContain("Unclear");
  });

  it("returns shouldRespond=true on runner error (fail-open)", async () => {
    const mockRunner = vi.fn().mockRejectedValue(new Error("API error"));

    const result = await checkMessageRelevance({
      message: "test message",
      channelContext: "test",
      agentPersona: "test",
      runner: mockRunner,
    });

    expect(result.shouldRespond).toBe(true);
    expect(result.reason).toContain("failed");
  });
});
