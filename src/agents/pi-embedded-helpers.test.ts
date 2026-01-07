import { describe, it, expect } from "vitest";
import type { AgentMessage } from "@mariozechner/pi-agent-core";
import { validateGeminiTurns } from "./pi-embedded-helpers.js";

describe("validateGeminiTurns", () => {
  it("should return empty array unchanged", () => {
    const result = validateGeminiTurns([]);
    expect(result).toEqual([]);
  });

  it("should return single message unchanged", () => {
    const msgs: AgentMessage[] = [
      {
        role: "user",
        content: "Hello",
      },
    ];
    const result = validateGeminiTurns(msgs);
    expect(result).toEqual(msgs);
  });

  it("should leave alternating user/assistant unchanged", () => {
    const msgs: AgentMessage[] = [
      { role: "user", content: "Hello" },
      { role: "assistant", content: [{ type: "text", text: "Hi" }] },
      { role: "user", content: "How are you?" },
      { role: "assistant", content: [{ type: "text", text: "Good!" }] },
    ];
    const result = validateGeminiTurns(msgs);
    expect(result).toHaveLength(4);
    expect(result).toEqual(msgs);
  });

  it("should merge consecutive assistant messages", () => {
    const msgs: AgentMessage[] = [
      { role: "user", content: "Hello" },
      {
        role: "assistant",
        content: [{ type: "text", text: "Part 1" }],
        stopReason: "end_turn",
      },
      {
        role: "assistant",
        content: [{ type: "text", text: "Part 2" }],
        stopReason: "end_turn",
      },
      { role: "user", content: "How are you?" },
    ];

    const result = validateGeminiTurns(msgs);

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ role: "user", content: "Hello" });
    expect(result[1].role).toBe("assistant");
    expect(result[1].content).toHaveLength(2);
    expect(result[2]).toEqual({ role: "user", content: "How are you?" });
  });

  it("should preserve metadata from later message when merging", () => {
    const msgs: AgentMessage[] = [
      {
        role: "assistant",
        content: [{ type: "text", text: "Part 1" }],
        usage: { input: 10, output: 5 },
      },
      {
        role: "assistant",
        content: [{ type: "text", text: "Part 2" }],
        usage: { input: 10, output: 10 },
        stopReason: "end_turn",
      },
    ];

    const result = validateGeminiTurns(msgs);

    expect(result).toHaveLength(1);
    const merged = result[0] as Extract<AgentMessage, { role: "assistant" }>;
    expect(merged.usage).toEqual({ input: 10, output: 10 });
    expect(merged.stopReason).toBe("end_turn");
    expect(merged.content).toHaveLength(2);
  });

  it("should handle toolResult messages without merging", () => {
    const msgs: AgentMessage[] = [
      { role: "user", content: "Use tool" },
      {
        role: "assistant",
        content: [{ type: "toolUse", id: "tool-1", name: "test", input: {} }],
      },
      {
        role: "toolResult",
        toolUseId: "tool-1",
        content: [{ type: "text", text: "Result" }],
      },
      { role: "user", content: "Next request" },
    ];

    const result = validateGeminiTurns(msgs);

    expect(result).toHaveLength(4);
    expect(result).toEqual(msgs);
  });

  it("should handle real-world corrupted sequence", () => {
    // This is the pattern that causes Gemini errors:
    // user → assistant → assistant (consecutive, wrong!)
    const msgs: AgentMessage[] = [
      { role: "user", content: "Request 1" },
      {
        role: "assistant",
        content: [{ type: "text", text: "Response A" }],
      },
      {
        role: "assistant",
        content: [{ type: "toolUse", id: "t1", name: "search", input: {} }],
      },
      {
        role: "toolResult",
        toolUseId: "t1",
        content: [{ type: "text", text: "Found data" }],
      },
      {
        role: "assistant",
        content: [{ type: "text", text: "Here's the answer" }],
      },
      {
        role: "assistant",
        content: [{ type: "text", text: "Extra thoughts" }],
      },
      { role: "user", content: "Request 2" },
    ];

    const result = validateGeminiTurns(msgs);

    // Should merge the consecutive assistants
    expect(result[0].role).toBe("user");
    expect(result[1].role).toBe("assistant");
    expect(result[2].role).toBe("toolResult");
    expect(result[3].role).toBe("assistant");
    expect(result[4].role).toBe("user");
  });
});
