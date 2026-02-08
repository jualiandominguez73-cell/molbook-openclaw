import type { AgentMessage } from "@mariozechner/pi-agent-core";
import { describe, expect, it, vi } from "vitest";
import {
  chunkMessagesByMaxTokens,
  estimateMessagesTokens,
  isOversizedForSummary,
  pruneHistoryForContextShare,
  splitMessagesByTokenShare,
  summarizeWithFallback,
} from "./compaction.js";

function makeMessage(id: number, size: number): AgentMessage {
  return {
    role: "user",
    content: "x".repeat(size),
    timestamp: id,
  };
}

describe("splitMessagesByTokenShare", () => {
  it("splits messages into two non-empty parts", () => {
    const messages: AgentMessage[] = [
      makeMessage(1, 4000),
      makeMessage(2, 4000),
      makeMessage(3, 4000),
      makeMessage(4, 4000),
    ];

    const parts = splitMessagesByTokenShare(messages, 2);
    expect(parts.length).toBeGreaterThanOrEqual(2);
    expect(parts[0]?.length).toBeGreaterThan(0);
    expect(parts[1]?.length).toBeGreaterThan(0);
    expect(parts.flat().length).toBe(messages.length);
  });

  it("preserves message order across parts", () => {
    const messages: AgentMessage[] = [
      makeMessage(1, 4000),
      makeMessage(2, 4000),
      makeMessage(3, 4000),
      makeMessage(4, 4000),
      makeMessage(5, 4000),
      makeMessage(6, 4000),
    ];

    const parts = splitMessagesByTokenShare(messages, 3);
    expect(parts.flat().map((msg) => msg.timestamp)).toEqual(messages.map((msg) => msg.timestamp));
  });
});

describe("pruneHistoryForContextShare", () => {
  it("drops older chunks until the history budget is met", () => {
    const messages: AgentMessage[] = [
      makeMessage(1, 4000),
      makeMessage(2, 4000),
      makeMessage(3, 4000),
      makeMessage(4, 4000),
    ];
    const maxContextTokens = 2000; // budget is 1000 tokens (50%)
    const pruned = pruneHistoryForContextShare({
      messages,
      maxContextTokens,
      maxHistoryShare: 0.5,
      parts: 2,
    });

    expect(pruned.droppedChunks).toBeGreaterThan(0);
    expect(pruned.keptTokens).toBeLessThanOrEqual(Math.floor(maxContextTokens * 0.5));
    expect(pruned.messages.length).toBeGreaterThan(0);
  });

  it("keeps the newest messages when pruning", () => {
    const messages: AgentMessage[] = [
      makeMessage(1, 4000),
      makeMessage(2, 4000),
      makeMessage(3, 4000),
      makeMessage(4, 4000),
      makeMessage(5, 4000),
      makeMessage(6, 4000),
    ];
    const totalTokens = estimateMessagesTokens(messages);
    const maxContextTokens = Math.max(1, Math.floor(totalTokens * 0.5)); // budget = 25%
    const pruned = pruneHistoryForContextShare({
      messages,
      maxContextTokens,
      maxHistoryShare: 0.5,
      parts: 2,
    });

    const keptIds = pruned.messages.map((msg) => msg.timestamp);
    const expectedSuffix = messages.slice(-keptIds.length).map((msg) => msg.timestamp);
    expect(keptIds).toEqual(expectedSuffix);
  });

  it("keeps history when already within budget", () => {
    const messages: AgentMessage[] = [makeMessage(1, 1000)];
    const maxContextTokens = 2000;
    const pruned = pruneHistoryForContextShare({
      messages,
      maxContextTokens,
      maxHistoryShare: 0.5,
      parts: 2,
    });

    expect(pruned.droppedChunks).toBe(0);
    expect(pruned.messages.length).toBe(messages.length);
    expect(pruned.keptTokens).toBe(estimateMessagesTokens(messages));
    expect(pruned.droppedMessagesList).toEqual([]);
  });

  it("returns droppedMessagesList containing dropped messages", () => {
    // Note: This test uses simple user messages with no tool calls.
    // When orphaned tool_results exist, droppedMessages may exceed
    // droppedMessagesList.length since orphans are counted but not
    // added to the list (they lack context for summarization).
    const messages: AgentMessage[] = [
      makeMessage(1, 4000),
      makeMessage(2, 4000),
      makeMessage(3, 4000),
      makeMessage(4, 4000),
    ];
    const maxContextTokens = 2000; // budget is 1000 tokens (50%)
    const pruned = pruneHistoryForContextShare({
      messages,
      maxContextTokens,
      maxHistoryShare: 0.5,
      parts: 2,
    });

    expect(pruned.droppedChunks).toBeGreaterThan(0);
    // Without orphaned tool_results, counts match exactly
    expect(pruned.droppedMessagesList.length).toBe(pruned.droppedMessages);

    // All messages accounted for: kept + dropped = original
    const allIds = [
      ...pruned.droppedMessagesList.map((m) => m.timestamp),
      ...pruned.messages.map((m) => m.timestamp),
    ].toSorted((a, b) => a - b);
    const originalIds = messages.map((m) => m.timestamp).toSorted((a, b) => a - b);
    expect(allIds).toEqual(originalIds);
  });

  it("returns empty droppedMessagesList when no pruning needed", () => {
    const messages: AgentMessage[] = [makeMessage(1, 100)];
    const pruned = pruneHistoryForContextShare({
      messages,
      maxContextTokens: 100_000,
      maxHistoryShare: 0.5,
      parts: 2,
    });

    expect(pruned.droppedChunks).toBe(0);
    expect(pruned.droppedMessagesList).toEqual([]);
    expect(pruned.messages.length).toBe(1);
  });

  it("removes orphaned tool_result messages when tool_use is dropped", () => {
    // Scenario: assistant with tool_use is in chunk 1 (dropped),
    // tool_result is in chunk 2 (kept) - orphaned tool_result should be removed
    // to prevent "unexpected tool_use_id" errors from Anthropic's API
    const messages: AgentMessage[] = [
      // Chunk 1 (will be dropped) - contains tool_use
      {
        role: "assistant",
        content: [
          { type: "text", text: "x".repeat(4000) },
          { type: "toolUse", id: "call_123", name: "test_tool", input: {} },
        ],
        timestamp: 1,
      },
      // Chunk 2 (will be kept) - contains orphaned tool_result
      {
        role: "toolResult",
        toolCallId: "call_123",
        toolName: "test_tool",
        content: [{ type: "text", text: "result".repeat(500) }],
        timestamp: 2,
      } as AgentMessage,
      {
        role: "user",
        content: "x".repeat(500),
        timestamp: 3,
      },
    ];

    const pruned = pruneHistoryForContextShare({
      messages,
      maxContextTokens: 2000,
      maxHistoryShare: 0.5,
      parts: 2,
    });

    // The orphaned tool_result should NOT be in kept messages
    // (this is the critical invariant that prevents API errors)
    const keptRoles = pruned.messages.map((m) => m.role);
    expect(keptRoles).not.toContain("toolResult");

    // The orphan count should be reflected in droppedMessages
    // (orphaned tool_results are dropped but not added to droppedMessagesList
    // since they lack context for summarization)
    expect(pruned.droppedMessages).toBeGreaterThan(pruned.droppedMessagesList.length);
  });

  it("keeps tool_result when its tool_use is also kept", () => {
    // Scenario: both tool_use and tool_result are in the kept portion
    const messages: AgentMessage[] = [
      // Chunk 1 (will be dropped) - just user content
      {
        role: "user",
        content: "x".repeat(4000),
        timestamp: 1,
      },
      // Chunk 2 (will be kept) - contains both tool_use and tool_result
      {
        role: "assistant",
        content: [
          { type: "text", text: "y".repeat(500) },
          { type: "toolUse", id: "call_456", name: "kept_tool", input: {} },
        ],
        timestamp: 2,
      },
      {
        role: "toolResult",
        toolCallId: "call_456",
        toolName: "kept_tool",
        content: [{ type: "text", text: "result" }],
        timestamp: 3,
      } as AgentMessage,
    ];

    const pruned = pruneHistoryForContextShare({
      messages,
      maxContextTokens: 2000,
      maxHistoryShare: 0.5,
      parts: 2,
    });

    // Both assistant and toolResult should be in kept messages
    const keptRoles = pruned.messages.map((m) => m.role);
    expect(keptRoles).toContain("assistant");
    expect(keptRoles).toContain("toolResult");
  });

  it("removes multiple orphaned tool_results from the same dropped tool_use", () => {
    // Scenario: assistant with multiple tool_use blocks is dropped,
    // all corresponding tool_results should be removed from kept messages
    const messages: AgentMessage[] = [
      // Chunk 1 (will be dropped) - contains multiple tool_use blocks
      {
        role: "assistant",
        content: [
          { type: "text", text: "x".repeat(4000) },
          { type: "toolUse", id: "call_a", name: "tool_a", input: {} },
          { type: "toolUse", id: "call_b", name: "tool_b", input: {} },
        ],
        timestamp: 1,
      },
      // Chunk 2 (will be kept) - contains orphaned tool_results
      {
        role: "toolResult",
        toolCallId: "call_a",
        toolName: "tool_a",
        content: [{ type: "text", text: "result_a" }],
        timestamp: 2,
      } as AgentMessage,
      {
        role: "toolResult",
        toolCallId: "call_b",
        toolName: "tool_b",
        content: [{ type: "text", text: "result_b" }],
        timestamp: 3,
      } as AgentMessage,
      {
        role: "user",
        content: "x".repeat(500),
        timestamp: 4,
      },
    ];

    const pruned = pruneHistoryForContextShare({
      messages,
      maxContextTokens: 2000,
      maxHistoryShare: 0.5,
      parts: 2,
    });

    // No orphaned tool_results should be in kept messages
    const keptToolResults = pruned.messages.filter((m) => m.role === "toolResult");
    expect(keptToolResults).toHaveLength(0);

    // The orphan count should reflect both dropped tool_results
    // droppedMessages = 1 (assistant) + 2 (orphaned tool_results) = 3
    // droppedMessagesList only has the assistant message
    expect(pruned.droppedMessages).toBe(pruned.droppedMessagesList.length + 2);
  });
});

describe("chunkMessagesByMaxTokens", () => {
  it("splits messages into chunks that fit within token limit", () => {
    const messages: AgentMessage[] = [
      makeMessage(1, 4000),
      makeMessage(2, 4000),
      makeMessage(3, 4000),
      makeMessage(4, 4000),
    ];

    const chunks = chunkMessagesByMaxTokens(messages, 8000);
    expect(chunks.length).toBeGreaterThan(1);

    for (const chunk of chunks) {
      const tokens = estimateMessagesTokens(chunk);
      // Allow some wiggle room for estimation
      expect(tokens).toBeLessThanOrEqual(12000);
    }

    expect(chunks.flat().length).toBe(messages.length);
  });

  it("handles oversized messages by splitting them into separate chunks", () => {
    const messages: AgentMessage[] = [
      makeMessage(1, 1000),
      makeMessage(2, 20000), // Oversized
      makeMessage(3, 1000),
    ];

    const chunks = chunkMessagesByMaxTokens(messages, 5000);
    expect(chunks.length).toBeGreaterThanOrEqual(3);

    // Verify all messages are accounted for
    expect(chunks.flat().length).toBe(messages.length);
  });

  it("returns single chunk when all messages fit", () => {
    const messages: AgentMessage[] = [makeMessage(1, 1000), makeMessage(2, 1000)];

    const chunks = chunkMessagesByMaxTokens(messages, 10000);
    expect(chunks.length).toBe(1);
    expect(chunks[0]?.length).toBe(2);
  });
});

describe("isOversizedForSummary", () => {
  it("identifies messages exceeding 50% of context window", () => {
    const largeMsg = makeMessage(1, 60000);
    const contextWindow = 100000;

    expect(isOversizedForSummary(largeMsg, contextWindow)).toBe(true);
  });

  it("allows messages under 50% of context window", () => {
    const smallMsg = makeMessage(1, 20000);
    const contextWindow = 100000;

    expect(isOversizedForSummary(smallMsg, contextWindow)).toBe(false);
  });
});

describe("summarizeWithFallback", () => {
  it("returns graceful fallback message when all summarization attempts fail", async () => {
    const messages: AgentMessage[] = [
      { role: "user", content: "x".repeat(100000), timestamp: 1 },
      { role: "assistant", content: "y".repeat(100000), timestamp: 2 },
    ];

    const mockModel = { contextWindow: 100000 };
    const mockGenerateSummary = vi.fn().mockRejectedValue(new Error("Context overflow"));

    // Mock the generateSummary function
    vi.mock("@mariozechner/pi-coding-agent", () => ({
      generateSummary: mockGenerateSummary,
      estimateTokens: (msg: AgentMessage) => {
        if (typeof msg.content === "string") {
          return msg.content.length / 4;
        }
        return 0;
      },
    }));

    const result = await summarizeWithFallback({
      messages,
      model: mockModel as any,
      apiKey: "test-key",
      signal: new AbortController().signal,
      reserveTokens: 4000,
      maxChunkTokens: 20000,
      contextWindow: 100000,
    });

    // Should provide informative fallback message instead of "Summary unavailable"
    expect(result).toContain("Session contained");
    expect(result).toContain("messages");
    expect(result).toContain("tokens");
    expect(result).not.toBe("Summary unavailable due to size limits.");
  });

  it("includes message counts in fallback message", async () => {
    const messages: AgentMessage[] = [
      { role: "user", content: "x".repeat(100000), timestamp: 1 },
      { role: "assistant", content: "y".repeat(100000), timestamp: 2 },
      { role: "user", content: "z".repeat(100000), timestamp: 3 },
    ];

    const mockModel = { contextWindow: 100000 };
    const mockGenerateSummary = vi.fn().mockRejectedValue(new Error("Context overflow"));

    vi.mock("@mariozechner/pi-coding-agent", () => ({
      generateSummary: mockGenerateSummary,
      estimateTokens: (msg: AgentMessage) => {
        if (typeof msg.content === "string") {
          return msg.content.length / 4;
        }
        return 0;
      },
    }));

    const result = await summarizeWithFallback({
      messages,
      model: mockModel as any,
      apiKey: "test-key",
      signal: new AbortController().signal,
      reserveTokens: 4000,
      maxChunkTokens: 20000,
      contextWindow: 100000,
    });

    expect(result).toContain("3 messages");
    expect(result).toContain("2 user");
    expect(result).toContain("1 assistant");
  });
});
