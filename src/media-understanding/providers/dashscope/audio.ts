import type { AudioTranscriptionRequest, AudioTranscriptionResult } from "../../types.js";
import { fetchWithTimeoutGuarded, normalizeBaseUrl, readErrorResponse } from "../shared.js";

export const DEFAULT_DASHSCOPE_BASE_URL = "https://dashscope.aliyuncs.com/api/v1";
export const DEFAULT_DASHSCOPE_MODEL = "qwen3-asr-flash";

function resolveModel(model?: string): string {
  return model?.trim() || DEFAULT_DASHSCOPE_MODEL;
}

function mimeToDashscopeMime(mime?: string): string {
  switch (mime?.toLowerCase()) {
    case "audio/mpeg":
    case "audio/mp3":
      return "audio/mpeg";
    case "audio/wav":
    case "audio/wave":
      return "audio/wav";
    case "audio/ogg":
      return "audio/ogg";
    case "audio/m4a":
      return "audio/m4a";
    case "audio/aac":
      return "audio/aac";
    default:
      return "audio/ogg";
  }
}

type DashscopeTranscriptResponse = {
  output?: {
    choices?: Array<{
      message?: {
        content?: Array<{ text?: string }>;
      };
    }>;
  };
};

export async function transcribeDashscopeAudio(
  params: AudioTranscriptionRequest,
): Promise<AudioTranscriptionResult> {
  const fetchFn = params.fetchFn ?? fetch;
  const baseUrl = normalizeBaseUrl(params.baseUrl, DEFAULT_DASHSCOPE_BASE_URL);
  const allowPrivate = Boolean(params.baseUrl?.trim());
  const url = `${baseUrl}/services/aigc/multimodal-generation/generation`;

  const model = resolveModel(params.model);
  const fileName = params.fileName?.trim() || "audio.ogg";
  const mime = mimeToDashscopeMime(params.mime);

  const base64Audio = Buffer.from(params.buffer).toString("base64");
  const dataUrl = `data:${mime};base64,${base64Audio}`;

  const payload = {
    model,
    input: {
      messages: [
        {
          content: [{ text: "" }],
          role: "system",
        },
        {
          content: [{ audio: dataUrl }],
          role: "user",
        },
      ],
    },
    parameters: {
      asr_options: {
        enable_itn: false,
      },
      result_format: "message",
    },
  };

  const headers = new Headers(params.headers);
  if (!headers.has("authorization")) {
    headers.set("authorization", `Bearer ${params.apiKey}`);
  }
  headers.set("content-type", "application/json");

  console.info(
    `[dashscope] Starting transcription: model=${model}, file=${fileName}, size=${params.buffer.byteLength} bytes`,
  );

  const { response: res, release } = await fetchWithTimeoutGuarded(
    url,
    {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    },
    params.timeoutMs,
    fetchFn,
    allowPrivate ? { ssrfPolicy: { allowPrivateNetwork: true } } : undefined,
  );

  try {
    if (!res.ok) {
      const detail = await readErrorResponse(res);
      const suffix = detail ? `: ${detail}` : "";
      const errorMsg = `Dashscope transcription failed (HTTP ${res.status})${suffix}`;
      console.error(`[dashscope] ${errorMsg}`);
      throw new Error(errorMsg);
    }

    const responseData = (await res.json()) as DashscopeTranscriptResponse;

    const choices = responseData.output?.choices;
    const text = choices?.[0]?.message?.content?.[0]?.text?.trim() ?? "";

    if (!text) {
      console.warn(`[dashscope] Transcription returned empty text`);
      return { text: "", model };
    }

    console.info(
      `[dashscope] Transcription successful: "${text.substring(0, 100)}${text.length > 100 ? "..." : ""}"`,
    );
    return { text, model };
  } finally {
    await release();
  }
}
