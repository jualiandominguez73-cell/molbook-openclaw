import { describe, expect, it } from "vitest";
import { hasToolResultImages } from "./grouped-render";

describe("hasToolResultImages", () => {
  it("returns true for tool result with image data", () => {
    const message = {
      role: "toolResult",
      content: [
        { type: "text", text: "Read image file [image/png]" },
        { type: "image", data: "iVBORw0KGgo=", mimeType: "image/png" },
      ],
    };
    expect(hasToolResultImages(message)).toBe(true);
  });

  it("returns true for Anthropic source format", () => {
    const message = {
      role: "toolResult",
      content: [
        {
          type: "image",
          source: {
            type: "base64",
            data: "iVBORw0KGgo=",
            media_type: "image/png",
          },
        },
      ],
    };
    expect(hasToolResultImages(message)).toBe(true);
  });

  it("returns true for OpenAI image_url format", () => {
    const message = {
      role: "toolResult",
      content: [
        {
          type: "image_url",
          image_url: { url: "https://example.com/image.png" },
        },
      ],
    };
    expect(hasToolResultImages(message)).toBe(true);
  });

  it("returns false for text-only tool result", () => {
    const message = {
      role: "toolResult",
      content: [{ type: "text", text: "command output" }],
    };
    expect(hasToolResultImages(message)).toBe(false);
  });

  it("returns false for empty content", () => {
    const message = {
      role: "toolResult",
      content: [],
    };
    expect(hasToolResultImages(message)).toBe(false);
  });

  it("returns false for non-array content", () => {
    const message = {
      role: "user",
      content: "plain string",
    };
    expect(hasToolResultImages(message)).toBe(false);
  });

  it("returns false for missing content", () => {
    const message = { role: "assistant" };
    expect(hasToolResultImages(message)).toBe(false);
  });

  it("ignores empty image data", () => {
    const message = {
      role: "toolResult",
      content: [{ type: "image", data: "", mimeType: "image/png" }],
    };
    expect(hasToolResultImages(message)).toBe(false);
  });
});
