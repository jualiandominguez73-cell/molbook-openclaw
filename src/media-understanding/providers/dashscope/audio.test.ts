import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as ssrf from "../../../infra/net/ssrf.js";
import { transcribeDashscopeAudio } from "./audio.js";

const resolvePinnedHostname = ssrf.resolvePinnedHostname;
const resolvePinnedHostnameWithPolicy = ssrf.resolvePinnedHostnameWithPolicy;
const lookupMock = vi.fn();
let resolvePinnedHostnameSpy: ReturnType<typeof vi.spyOn> = null;
let resolvePinnedHostnameWithPolicySpy: ReturnType<typeof vi.spyOn> = null;

const resolveRequestUrl = (input: RequestInfo | URL) => {
  if (typeof input === "string") {
    return input;
  }
  if (input instanceof URL) {
    return input.toString();
  }
  return input.url;
};

describe("transcribeDashscopeAudio", () => {
  beforeEach(() => {
    lookupMock.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
    resolvePinnedHostnameSpy = vi
      .spyOn(ssrf, "resolvePinnedHostname")
      .mockImplementation((hostname) => resolvePinnedHostname(hostname, lookupMock));
    resolvePinnedHostnameWithPolicySpy = vi
      .spyOn(ssrf, "resolvePinnedHostnameWithPolicy")
      .mockImplementation((hostname, params) =>
        resolvePinnedHostnameWithPolicy(hostname, { ...params, lookupFn: lookupMock }),
      );
  });

  afterEach(() => {
    lookupMock.mockReset();
    resolvePinnedHostnameSpy?.mockRestore();
    resolvePinnedHostnameWithPolicySpy?.mockRestore();
    resolvePinnedHostnameSpy = null;
    resolvePinnedHostnameWithPolicySpy = null;
  });

  it("respects lowercase authorization header overrides", async () => {
    let seenAuth: string | null = null;
    const mockFetch = async (_input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      seenAuth = headers.get("authorization");
      return new Response(
        JSON.stringify({
          output: {
            choices: [{ message: { content: [{ text: "ok" }] } }],
          },
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    };

    const result = await transcribeDashscopeAudio({
      buffer: Buffer.from("audio"),
      fileName: "note.mp3",
      apiKey: "test-key",
      timeoutMs: 1000,
      headers: { authorization: "Bearer override" },
      fetchFn: mockFetch,
    });

    expect(seenAuth).toBe("Bearer override");
    expect(result.text).toBe("ok");
  });

  it("builds the expected request payload", async () => {
    let seenUrl: string | null = null;
    let seenInit: RequestInit | undefined;
    let seenBody: unknown = null;
    const mockFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      seenUrl = resolveRequestUrl(input);
      seenInit = init;
      seenBody = init?.body ? JSON.parse(init.body as string) : null;
      return new Response(
        JSON.stringify({
          output: {
            choices: [{ message: { content: [{ text: "hello" }] } }],
          },
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    };

    const result = await transcribeDashscopeAudio({
      buffer: Buffer.from("audio-bytes"),
      fileName: "voice.mp3",
      mime: "audio/mpeg",
      apiKey: "test-key",
      timeoutMs: 1234,
      baseUrl: "https://api.example.com/api/v1",
      model: "qwen3-asr-flash",
      headers: { "X-Custom": "1" },
      fetchFn: mockFetch,
    });

    expect(result.model).toBe("qwen3-asr-flash");
    expect(result.text).toBe("hello");
    expect(seenUrl).toBe(
      "https://api.example.com/api/v1/services/aigc/multimodal-generation/generation",
    );
    expect(seenInit?.method).toBe("POST");
    expect(seenInit?.signal).toBeInstanceOf(AbortSignal);

    const headers = new Headers(seenInit?.headers);
    expect(headers.get("authorization")).toBe("Bearer test-key");
    expect(headers.get("x-custom")).toBe("1");
    expect(headers.get("content-type")).toBe("application/json");

    expect(seenBody).toMatchObject({
      model: "qwen3-asr-flash",
      input: {
        messages: [
          { role: "system", content: [{ text: "" }] },
          { role: "user", content: [{ audio: "data:audio/mpeg;base64,YXVkaW8tYnl0ZXM=" }] },
        ],
      },
      parameters: {
        asr_options: { enable_itn: false },
        result_format: "message",
      },
    });
  });

  it("handles empty response text", async () => {
    const mockFetch = async (_input: RequestInfo | URL, _init?: RequestInit) => {
      return new Response(
        JSON.stringify({
          output: {
            choices: [{ message: { content: [{ text: "  " }] } }],
          },
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    };

    const result = await transcribeDashscopeAudio({
      buffer: Buffer.from("audio"),
      fileName: "empty.mp3",
      apiKey: "test-key",
      timeoutMs: 1000,
      fetchFn: mockFetch,
    });

    expect(result.text).toBe("");
  });
});
