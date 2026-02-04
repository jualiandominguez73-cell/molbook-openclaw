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

  // Billing/quota checks must only fire on error-prefixed text, not normal content
  it("does not rewrite normal content that mentions billing", () => {
    const text = "You can manage your billing and credits in the dashboard.";
    expect(sanitizeUserFacingText(text)).toBe(text);
  });

  it("does not rewrite normal content that mentions quota", () => {
    const text = "Your current quota allows up to 100 requests per minute.";
    expect(sanitizeUserFacingText(text)).toBe(text);
  });

  // Billing errors behind ERROR_PREFIX_RE
  it("sanitizes billing error with error prefix", () => {
    const result = sanitizeUserFacingText("Error: 402 Payment Required");
    expect(result).toContain("API credits exhausted");
    expect(result).toContain("billing");
  });

  it("sanitizes billing error for insufficient credits with error prefix", () => {
    const result = sanitizeUserFacingText("API error: insufficient credits");
    expect(result).toContain("API credits exhausted");
  });

  // Quota errors behind ERROR_PREFIX_RE (checked before rate-limit)
  it("sanitizes quota-exceeded error with error prefix", () => {
    const result = sanitizeUserFacingText("Error: You exceeded your current quota");
    expect(result).toContain("API quota exceeded");
    expect(result).toContain("spending limits");
  });

  it("sanitizes spending limit error with error prefix", () => {
    const result = sanitizeUserFacingText("Error: spending limit reached");
    expect(result).toContain("API quota exceeded");
  });

  it("sanitizes 429 quota error with error prefix as quota, not rate-limit", () => {
    const result = sanitizeUserFacingText("Error: 429 You exceeded your current quota");
    expect(result).toContain("API quota exceeded");
    expect(result).toContain("spending limits");
  });
});
