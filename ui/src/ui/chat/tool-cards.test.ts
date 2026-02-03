import { describe, expect, it } from "vitest";
import { extractToolCards } from "./tool-cards";

describe("extractToolCards", () => {
  describe("tool calls", () => {
    it("extracts tool_use blocks from content", () => {
      const message = {
        role: "assistant",
        content: [{ type: "tool_use", name: "read", arguments: { path: "/test.txt" } }],
      };
      const cards = extractToolCards(message);
      expect(cards).toHaveLength(1);
      expect(cards[0].kind).toBe("call");
      expect(cards[0].name).toBe("read");
      expect(cards[0].args).toEqual({ path: "/test.txt" });
    });

    it("extracts multiple tool calls", () => {
      const message = {
        role: "assistant",
        content: [
          { type: "tool_use", name: "read", arguments: { path: "/a.txt" } },
          { type: "tool_use", name: "write", arguments: { path: "/b.txt" } },
        ],
      };
      const cards = extractToolCards(message);
      expect(cards).toHaveLength(2);
      expect(cards[0].name).toBe("read");
      expect(cards[1].name).toBe("write");
    });
  });

  describe("tool results", () => {
    it("extracts tool result from toolResult role", () => {
      const message = {
        role: "toolResult",
        toolName: "read",
        content: [{ type: "text", text: "file contents" }],
      };
      const cards = extractToolCards(message);
      expect(cards).toHaveLength(1);
      expect(cards[0].kind).toBe("result");
      expect(cards[0].name).toBe("read");
    });

    it("extracts images from tool result content", () => {
      const message = {
        role: "toolResult",
        toolName: "read",
        content: [
          { type: "text", text: "Read image file [image/png]" },
          { type: "image", data: "iVBORw0KGgo=", mimeType: "image/png" },
        ],
      };
      const cards = extractToolCards(message);
      expect(cards).toHaveLength(1);
      expect(cards[0].images).toBeDefined();
      expect(cards[0].images).toHaveLength(1);
      expect(cards[0].images![0].url).toContain("data:image/png;base64,");
    });

    it("extracts images in Anthropic source format", () => {
      const message = {
        role: "toolResult",
        toolName: "read",
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
      const cards = extractToolCards(message);
      expect(cards).toHaveLength(1);
      expect(cards[0].images).toHaveLength(1);
      expect(cards[0].images![0].url).toContain("data:image/png;base64,");
    });

    it("extracts images in OpenAI image_url format", () => {
      const message = {
        role: "toolResult",
        toolName: "screenshot",
        content: [
          {
            type: "image_url",
            image_url: { url: "https://example.com/image.png" },
          },
        ],
      };
      const cards = extractToolCards(message);
      expect(cards).toHaveLength(1);
      expect(cards[0].images).toHaveLength(1);
      expect(cards[0].images![0].url).toBe("https://example.com/image.png");
    });

    it("returns undefined images when no images present", () => {
      const message = {
        role: "toolResult",
        toolName: "exec",
        content: [{ type: "text", text: "command output" }],
      };
      const cards = extractToolCards(message);
      expect(cards).toHaveLength(1);
      expect(cards[0].images).toBeUndefined();
    });
  });

  describe("edge cases", () => {
    it("handles empty content array", () => {
      const message = { role: "assistant", content: [] };
      const cards = extractToolCards(message);
      expect(cards).toHaveLength(0);
    });

    it("handles non-array content", () => {
      const message = { role: "user", content: "plain string" };
      const cards = extractToolCards(message);
      expect(cards).toHaveLength(0);
    });

    it("handles missing content", () => {
      const message = { role: "assistant" };
      const cards = extractToolCards(message);
      expect(cards).toHaveLength(0);
    });
  });
});
