import { describe, expect, it } from "vitest";
import { extractMiniMaxResponseText, isMiniMaxResponse } from "./minimax-response-handler.js";

describe("isMiniMaxResponse", () => {
  it("detects minimax provider", () => {
    expect(isMiniMaxResponse({ provider: "minimax" })).toBe(true);
    expect(isMiniMaxResponse({ provider: "MiniMax" })).toBe(true);
    expect(isMiniMaxResponse({ provider: "MINIMAX" })).toBe(true);
  });

  it("detects minimax in model name", () => {
    expect(isMiniMaxResponse({ model: "minimax-m2.1" })).toBe(true);
    expect(isMiniMaxResponse({ model: "MiniMax-M2.1" })).toBe(true);
    expect(isMiniMaxResponse({ model: "m2.1" })).toBe(true);
  });

  it("returns false for non-minimax", () => {
    expect(isMiniMaxResponse({ provider: "openai", model: "gpt-4" })).toBe(false);
    expect(isMiniMaxResponse()).toBe(false);
  });
});

describe("extractMiniMaxResponseText", () => {
  it("returns final text when available", () => {
    const result = extractMiniMaxResponseText({
      finalText: "Hello world",
      streamedText: "",
    });
    
    expect(result.text).toBe("Hello world");
    expect(result.isEmpty).toBe(false);
  });

  it("falls back to streamed text", () => {
    const result = extractMiniMaxResponseText({
      finalText: "",
      streamedText: "Streamed response",
    });
    
    expect(result.text).toBe("Streamed response");
    expect(result.isEmpty).toBe(false);
  });

  it("handles empty inputs", () => {
    const result = extractMiniMaxResponseText({
      finalText: "",
      streamedText: "",
    });
    
    expect(result.isEmpty).toBe(true);
    expect(result.text).toBe("");
  });

  it("handles null/undefined inputs", () => {
    const result = extractMiniMaxResponseText({});
    
    expect(result.isEmpty).toBe(true);
  });

  it("extracts content from nested message object", () => {
    const result = extractMiniMaxResponseText({
      finalText: "",
      streamedText: "",
      assistantMessage: {
        content: "Nested content",
      },
    });
    
    expect(result.text).toBe("Nested content");
    expect(result.isEmpty).toBe(false);
  });

  it("extracts text from content array", () => {
    const result = extractMiniMaxResponseText({
      finalText: "",
      streamedText: "",
      assistantMessage: {
        content: [
          { type: "text", text: "Text block content" },
        ],
      },
    });
    
    expect(result.text).toBe("Text block content");
    expect(result.isEmpty).toBe(false);
  });

  it("finds text block in array without type field", () => {
    const result = extractMiniMaxResponseText({
      finalText: "",
      streamedText: "",
      assistantMessage: {
        content: [
          { text: "Implicit text block" },
        ],
      },
    });
    
    expect(result.text).toBe("Implicit text block");
    expect(result.isEmpty).toBe(false);
  });

  it("checks multiple candidate fields in order", () => {
    const result = extractMiniMaxResponseText({
      finalText: "",
      streamedText: "",
      assistantMessage: {
        message: "Message field content",
        text: "Text field content",
      },
    });
    
    // Should find one of them
    expect(result.isEmpty).toBe(false);
    expect(result.text).toBeTruthy();
  });

  it("ignores whitespace-only content", () => {
    const result = extractMiniMaxResponseText({
      finalText: "   ",
      streamedText: "\n\t",
      assistantMessage: {
        content: "  \n  ",
      },
    });
    
    expect(result.isEmpty).toBe(true);
  });

  it("sets debug info when extracting from nested source", () => {
    const result = extractMiniMaxResponseText({
      finalText: "",
      streamedText: "",
      assistantMessage: {
        content: "Extracted content",
      },
    });
    
    expect(result.debugInfo).toBeDefined();
    expect(result.debugInfo).toContain("assistantMessage");
  });

  it("handles real-world minimax response structure", () => {
    const minimaxResponse = {
      finalText: "",
      streamedText: "",
      assistantMessage: {
        role: "assistant",
        content: [
          {
            type: "text",
            text: "This is the actual MiniMax response that should display",
          },
        ],
      },
      provider: "minimax",
      model: "MiniMax-M2.1",
    };

    const result = extractMiniMaxResponseText(minimaxResponse);
    
    expect(result.text).toBe("This is the actual MiniMax response that should display");
    expect(result.isEmpty).toBe(false);
  });
});
