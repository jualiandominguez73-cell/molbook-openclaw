import { describe, expect, it } from "vitest";
import { sanitizeUserFacingText } from "./pi-embedded-helpers.js";

describe("sanitizeUserFacingText", () => {
  it("strips final tags", () => {
    expect(sanitizeUserFacingText("<final>Hello</final>")).toBe("Hello");
    expect(sanitizeUserFacingText("Hi <final>there</final>!")).toBe("Hi there!");
  });

  it("does not clobber normal numeric prefixes", () => {
    expect(sanitizeUserFacingText("202 results found")).toBe("202 results found");
    expect(sanitizeUserFacingText("400 days left")).toBe("400 days left");
  });

  it("sanitizes role ordering errors", () => {
    const result = sanitizeUserFacingText("400 Incorrect role information");
    expect(result).toContain("Message ordering conflict");
  });

  it("sanitizes HTTP status errors with error hints", () => {
    expect(sanitizeUserFacingText("500 Internal Server Error")).toBe(
      "HTTP 500: Internal Server Error",
    );
  });

  it("sanitizes raw API error payloads", () => {
    const raw = '{"type":"error","error":{"message":"Something exploded","type":"server_error"}}';
    expect(sanitizeUserFacingText(raw)).toBe("LLM error server_error: Something exploded");
  });

  it("collapses consecutive duplicate paragraphs", () => {
    const text = "Hello there!\n\nHello there!";
    expect(sanitizeUserFacingText(text)).toBe("Hello there!");
  });

  it("does not collapse distinct paragraphs", () => {
    const text = "Hello there!\n\nDifferent line.";
    expect(sanitizeUserFacingText(text)).toBe(text);
  });

  it("does not treat normal text mentioning 'context overflow' as an error", () => {
    // Issue #8847: Normal assistant responses containing "context overflow"
    // should not be replaced with error messages
    const normalResponses = [
      "Context overflow is a common issue in LLM applications.",
      "You asked about context overflow, here's what I know...",
      "The phrase 'context overflow' refers to when the prompt is too large.",
      "Let me explain what context overflow means in AI systems.",
    ];
    for (const text of normalResponses) {
      const result = sanitizeUserFacingText(text);
      expect(result).toBe(text);
      expect(result).not.toContain("Try again with less input");
    }
  });

  it("still sanitizes actual context overflow errors", () => {
    // Real error messages should still be sanitized
    const errorMessages = [
      "Error: context length exceeded",
      "API Error: request_too_large",
      '{"type":"error","error":{"message":"context length exceeded","type":"request_too_large"}}',
    ];
    for (const text of errorMessages) {
      const result = sanitizeUserFacingText(text);
      expect(result).toContain("Context overflow");
      expect(result).toContain("Try again with less input");
    }
  });
});
