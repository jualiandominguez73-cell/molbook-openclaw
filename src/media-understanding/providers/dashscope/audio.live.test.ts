import { describe, expect, it } from "vitest";
import { isTruthyEnvValue } from "../../../infra/env.js";
import { transcribeDashscopeAudio } from "./audio.js";

const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY ?? "";
const DASHSCOPE_MODEL = process.env.DASHSCOPE_MODEL?.trim() || "qwen3-asr-flash";
const DASHSCOPE_BASE_URL = process.env.DASHSCOPE_BASE_URL?.trim();
const LIVE =
  isTruthyEnvValue(process.env.DASHSCOPE_LIVE_TEST) ||
  isTruthyEnvValue(process.env.LIVE) ||
  isTruthyEnvValue(process.env.OPENCLAW_LIVE_TEST);

const describeLive = LIVE && DASHSCOPE_API_KEY ? describe : describe.skip;

const PUBLIC_AUDIO_URL = "https://dashscope.oss-cn-beijing.aliyuncs.com/audios/welcome.mp3";

describeLive("dashscope live", () => {
  it("transcribes public audio file from URL", async () => {
    console.log(`\n=== Testing public URL: ${PUBLIC_AUDIO_URL} ===`);

    const response = await fetch(PUBLIC_AUDIO_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch audio file: HTTP ${response.status}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const mime = "audio/mpeg";

    console.log(`Downloaded ${buffer.byteLength} bytes`);

    const result = await transcribeDashscopeAudio({
      buffer,
      fileName: "welcome.mp3",
      mime,
      apiKey: DASHSCOPE_API_KEY,
      model: DASHSCOPE_MODEL,
      baseUrl: DASHSCOPE_BASE_URL,
      timeoutMs: 60000,
    });

    console.log(`Model: ${result.model}`);
    console.log(`Text: "${result.text}"`);

    expect(result.text.trim().length).toBeGreaterThan(0);
  }, 120000);
});
