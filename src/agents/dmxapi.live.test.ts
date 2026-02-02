import { completeSimple, type Model } from "@mariozechner/pi-ai";
import { describe, expect, it } from "vitest";
import { isTruthyEnvValue } from "../infra/env.js";

const DMXAPI_KEY = process.env.DMXAPI_API_KEY ?? "";
const DMXAPI_BASE_URL = process.env.DMXAPI_BASE_URL?.trim() || "https://www.dmxapi.cn/v1";
const DMXAPI_MODEL = process.env.DMXAPI_MODEL?.trim() || "claude-sonnet-4-20250514";
const LIVE = isTruthyEnvValue(process.env.DMXAPI_LIVE_TEST) || isTruthyEnvValue(process.env.LIVE);

const describeLive = LIVE && DMXAPI_KEY ? describe : describe.skip;

describeLive("dmxapi live", () => {
  it("returns assistant text", async () => {
    const model: Model<"openai-completions"> = {
      id: DMXAPI_MODEL,
      name: "Claude Sonnet 4 (DMXAPI)",
      api: "openai-completions",
      provider: "dmxapi",
      baseUrl: DMXAPI_BASE_URL,
      reasoning: false,
      input: ["text"],
      cost: { input: 3.0, output: 15.0, cacheRead: 0.3, cacheWrite: 1.5 },
      contextWindow: 200000,
      maxTokens: 8192,
    };
    const res = await completeSimple(
      model,
      {
        messages: [
          {
            role: "user",
            content: "Reply with the word ok.",
            timestamp: Date.now(),
          },
        ],
      },
      { apiKey: DMXAPI_KEY, maxTokens: 64 },
    );
    const text = res.content
      .filter((block) => block.type === "text")
      .map((block) => block.text.trim())
      .join(" ");
    expect(text.length).toBeGreaterThan(0);
    expect(text.toLowerCase()).toContain("ok");
  }, 20000);

  it("handles multi-turn conversation", async () => {
    const model: Model<"openai-completions"> = {
      id: DMXAPI_MODEL,
      name: "Claude Sonnet 4 (DMXAPI)",
      api: "openai-completions",
      provider: "dmxapi",
      baseUrl: DMXAPI_BASE_URL,
      reasoning: false,
      input: ["text"],
      cost: { input: 3.0, output: 15.0, cacheRead: 0.3, cacheWrite: 1.5 },
      contextWindow: 200000,
      maxTokens: 8192,
    };
    const res = await completeSimple(
      model,
      {
        messages: [
          {
            role: "user",
            content: "My name is Alice.",
            timestamp: Date.now(),
          },
          {
            role: "assistant",
            content: "Hello Alice! Nice to meet you.",
            timestamp: Date.now(),
          },
          {
            role: "user",
            content: "What is my name?",
            timestamp: Date.now(),
          },
        ],
      },
      { apiKey: DMXAPI_KEY, maxTokens: 64 },
    );
    const text = res.content
      .filter((block) => block.type === "text")
      .map((block) => block.text.trim())
      .join(" ");
    expect(text.toLowerCase()).toContain("alice");
  }, 20000);
});
