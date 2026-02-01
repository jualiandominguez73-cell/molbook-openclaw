import type { AgentMessage } from "@mariozechner/pi-agent-core";
import { describe, expect, it } from "vitest";
import { sanitizeToolUseResultPairing } from "./session-transcript-repair.js";

describe("sanitizeToolUseResultPairing", () => {
  it("moves tool results directly after tool calls and inserts missing results", () => {
    const input = [
      {
        role: "assistant",
        content: [
          { type: "toolCall", id: "call_1", name: "read", arguments: {} },
          { type: "toolCall", id: "call_2", name: "exec", arguments: {} },
        ],
      },
      { role: "user", content: "user message that should come after tool use" },
      {
        role: "toolResult",
        toolCallId: "call_2",
        toolName: "exec",
        content: [{ type: "text", text: "ok" }],
        isError: false,
      },
    ] satisfies AgentMessage[];

    const out = sanitizeToolUseResultPairing(input);
    expect(out[0]?.role).toBe("assistant");
    expect(out[1]?.role).toBe("toolResult");
    expect((out[1] as { toolCallId?: string }).toolCallId).toBe("call_1");
    expect(out[2]?.role).toBe("toolResult");
    expect((out[2] as { toolCallId?: string }).toolCallId).toBe("call_2");
    expect(out[3]?.role).toBe("user");
  });

  it("drops duplicate tool results for the same id within a span", () => {
    const input = [
      {
        role: "assistant",
        content: [{ type: "toolCall", id: "call_1", name: "read", arguments: {} }],
      },
      {
        role: "toolResult",
        toolCallId: "call_1",
        toolName: "read",
        content: [{ type: "text", text: "first" }],
        isError: false,
      },
      {
        role: "toolResult",
        toolCallId: "call_1",
        toolName: "read",
        content: [{ type: "text", text: "second" }],
        isError: false,
      },
      { role: "user", content: "ok" },
    ] satisfies AgentMessage[];

    const out = sanitizeToolUseResultPairing(input);
    expect(out.filter((m) => m.role === "toolResult")).toHaveLength(1);
  });

  it("drops duplicate tool results for the same id across the transcript", () => {
    const input = [
      {
        role: "assistant",
        content: [{ type: "toolCall", id: "call_1", name: "read", arguments: {} }],
      },
      {
        role: "toolResult",
        toolCallId: "call_1",
        toolName: "read",
        content: [{ type: "text", text: "first" }],
        isError: false,
      },
      { role: "assistant", content: [{ type: "text", text: "ok" }] },
      {
        role: "toolResult",
        toolCallId: "call_1",
        toolName: "read",
        content: [{ type: "text", text: "second (duplicate)" }],
        isError: false,
      },
    ] satisfies AgentMessage[];

    const out = sanitizeToolUseResultPairing(input);
    const results = out.filter((m) => m.role === "toolResult") as Array<{
      toolCallId?: string;
    }>;
    expect(results).toHaveLength(1);
    expect(results[0]?.toolCallId).toBe("call_1");
  });

  it("drops orphan tool results that do not match any tool call", () => {
    const input = [
      { role: "user", content: "hello" },
      {
        role: "toolResult",
        toolCallId: "call_orphan",
        toolName: "read",
        content: [{ type: "text", text: "orphan" }],
        isError: false,
      },
      {
        role: "assistant",
        content: [{ type: "text", text: "ok" }],
      },
    ] satisfies AgentMessage[];

    const out = sanitizeToolUseResultPairing(input);
    expect(out.some((m) => m.role === "toolResult")).toBe(false);
    expect(out.map((m) => m.role)).toEqual(["user", "assistant"]);
  });

  it("does not create synthetic results for incomplete tool calls with partialJson", () => {
    // When streaming is aborted mid-tool-call, the tool call has partialJson
    // instead of complete arguments. These incomplete calls should be skipped
    // to avoid creating synthetic results for tool_use blocks that won't be
    // sent to the API (causing "unexpected tool_use_id" errors).
    const input = [
      {
        role: "assistant",
        stopReason: "aborted",
        content: [
          {
            type: "toolCall",
            id: "call_incomplete",
            name: "write",
            partialJson: '{"path": "/some/file", "content": "incomplete...',
            // Note: no "arguments" field - this is an incomplete streamed tool call
          },
        ],
      },
    ] satisfies AgentMessage[];

    const out = sanitizeToolUseResultPairing(input);

    // Should NOT create synthetic tool result for incomplete call
    expect(out.filter((m) => m.role === "toolResult")).toHaveLength(0);
    expect(out).toHaveLength(1);
    expect(out[0]?.role).toBe("assistant");
  });

  it("creates synthetic results for complete tool calls but not incomplete ones", () => {
    const input = [
      {
        role: "assistant",
        stopReason: "aborted",
        content: [
          // Complete tool call (has arguments)
          { type: "toolCall", id: "call_complete", name: "read", arguments: { path: "/file" } },
          // Incomplete tool call (has partialJson, no arguments)
          {
            type: "toolCall",
            id: "call_incomplete",
            name: "write",
            partialJson: '{"path": "/some/file"',
          },
        ],
      },
    ] satisfies AgentMessage[];

    const out = sanitizeToolUseResultPairing(input);

    // Should only create synthetic result for complete call
    const results = out.filter((m) => m.role === "toolResult") as Array<{ toolCallId?: string }>;
    expect(results).toHaveLength(1);
    expect(results[0]?.toolCallId).toBe("call_complete");
  });
});
