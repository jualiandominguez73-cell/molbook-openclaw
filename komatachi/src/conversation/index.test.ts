import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createStorage, type Storage } from "../storage/index.js";
import {
  createConversationStore,
  ConversationNotLoadedError,
  ConversationAlreadyExistsError,
  type ConversationStore,
  type Message,
} from "./index.js";

// -----------------------------------------------------------------------------
// Test helpers
// -----------------------------------------------------------------------------

let testDir: string;
let storage: Storage;

beforeEach(async () => {
  testDir = await mkdtemp(join(tmpdir(), "komatachi-conversation-test-"));
  storage = createStorage(testDir);
});

afterEach(async () => {
  await rm(testDir, { recursive: true, force: true });
});

function userMessage(text: string): Message {
  return { role: "user", content: text };
}

function assistantMessage(text: string): Message {
  return { role: "assistant", content: text };
}

async function initAndLoad(
  store: ConversationStore,
  model?: string
): Promise<void> {
  await store.initialize(model);
  await store.load();
}

// Read raw file content from test directory
async function readRaw(path: string): Promise<string> {
  return readFile(join(testDir, path), "utf-8");
}

// -----------------------------------------------------------------------------
// Initialization
// -----------------------------------------------------------------------------

describe("initialize", () => {
  it("creates metadata and empty transcript", async () => {
    const store = createConversationStore(storage, "agent");

    await store.initialize();

    const metaRaw = await readRaw("agent/metadata.json");
    const meta = JSON.parse(metaRaw);
    expect(meta.createdAt).toBeTypeOf("number");
    expect(meta.updatedAt).toBeTypeOf("number");
    expect(meta.compactionCount).toBe(0);
    expect(meta.model).toBeNull();

    const transcriptRaw = await readRaw("agent/transcript.jsonl");
    expect(transcriptRaw).toBe("");
  });

  it("creates metadata with model when provided", async () => {
    const store = createConversationStore(storage, "agent");

    await store.initialize("claude-sonnet-4-20250514");

    const meta = await storage.readJson<{ model: string }>(
      "agent/metadata.json"
    );
    expect(meta.model).toBe("claude-sonnet-4-20250514");
  });

  it("throws ConversationAlreadyExistsError if conversation exists", async () => {
    const store = createConversationStore(storage, "agent");
    await store.initialize();

    await expect(store.initialize()).rejects.toThrow(
      ConversationAlreadyExistsError
    );
  });

  it("sets in-memory state after initialization", async () => {
    const store = createConversationStore(storage, "agent");
    await store.initialize();

    // After initialize, state is loaded -- getMessages/getMetadata should work
    expect(store.getMessages()).toEqual([]);
    expect(store.getMetadata().compactionCount).toBe(0);
  });
});

// -----------------------------------------------------------------------------
// Loading
// -----------------------------------------------------------------------------

describe("load", () => {
  it("loads metadata and transcript from disk", async () => {
    const store = createConversationStore(storage, "agent");
    await store.initialize();

    // Append some messages
    await store.appendMessage(userMessage("Hello"));
    await store.appendMessage(assistantMessage("Hi there"));

    // Create a fresh store and load
    const freshStore = createConversationStore(storage, "agent");
    const state = await freshStore.load();

    expect(state.metadata.compactionCount).toBe(0);
    expect(state.messages).toHaveLength(2);
    expect(state.messages[0]).toEqual(userMessage("Hello"));
    expect(state.messages[1]).toEqual(assistantMessage("Hi there"));
  });

  it("returns the loaded state", async () => {
    const store = createConversationStore(storage, "agent");
    await store.initialize("claude-sonnet-4-20250514");

    const freshStore = createConversationStore(storage, "agent");
    const state = await freshStore.load();

    expect(state.metadata.model).toBe("claude-sonnet-4-20250514");
    expect(state.messages).toEqual([]);
  });

  it("throws when metadata file is missing", async () => {
    const store = createConversationStore(storage, "nonexistent");

    await expect(store.load()).rejects.toThrow();
  });
});

// -----------------------------------------------------------------------------
// State access before load
// -----------------------------------------------------------------------------

describe("pre-load access", () => {
  it("throws ConversationNotLoadedError for getMessages before load", () => {
    const store = createConversationStore(storage, "agent");

    expect(() => store.getMessages()).toThrow(ConversationNotLoadedError);
  });

  it("throws ConversationNotLoadedError for getMetadata before load", () => {
    const store = createConversationStore(storage, "agent");

    expect(() => store.getMetadata()).toThrow(ConversationNotLoadedError);
  });

  it("throws ConversationNotLoadedError for appendMessage before load", async () => {
    const store = createConversationStore(storage, "agent");

    await expect(
      store.appendMessage(userMessage("test"))
    ).rejects.toThrow(ConversationNotLoadedError);
  });

  it("throws ConversationNotLoadedError for replaceTranscript before load", async () => {
    const store = createConversationStore(storage, "agent");

    await expect(store.replaceTranscript([])).rejects.toThrow(
      ConversationNotLoadedError
    );
  });

  it("throws ConversationNotLoadedError for updateMetadata before load", async () => {
    const store = createConversationStore(storage, "agent");

    await expect(
      store.updateMetadata({ compactionCount: 1 })
    ).rejects.toThrow(ConversationNotLoadedError);
  });
});

// -----------------------------------------------------------------------------
// Appending messages
// -----------------------------------------------------------------------------

describe("appendMessage", () => {
  it("appends a user message to memory and disk", async () => {
    const store = createConversationStore(storage, "agent");
    await initAndLoad(store);

    await store.appendMessage(userMessage("Hello"));

    // In-memory
    expect(store.getMessages()).toHaveLength(1);
    expect(store.getMessages()[0]).toEqual(userMessage("Hello"));

    // On disk
    const entries = await storage.readAllJsonl<Message>(
      "agent/transcript.jsonl"
    );
    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual(userMessage("Hello"));
  });

  it("appends an assistant message", async () => {
    const store = createConversationStore(storage, "agent");
    await initAndLoad(store);

    await store.appendMessage(assistantMessage("Hi there"));

    expect(store.getMessages()).toEqual([assistantMessage("Hi there")]);
  });

  it("preserves message order across multiple appends", async () => {
    const store = createConversationStore(storage, "agent");
    await initAndLoad(store);

    await store.appendMessage(userMessage("First"));
    await store.appendMessage(assistantMessage("Second"));
    await store.appendMessage(userMessage("Third"));

    const messages = store.getMessages();
    expect(messages).toHaveLength(3);
    expect(messages[0].content).toBe("First");
    expect(messages[1].content).toBe("Second");
    expect(messages[2].content).toBe("Third");
  });

  it("updates metadata timestamp on append", async () => {
    const store = createConversationStore(storage, "agent");
    await initAndLoad(store);

    const beforeAppend = store.getMetadata().updatedAt;

    // Small delay to ensure timestamp difference
    await new Promise((resolve) => setTimeout(resolve, 10));
    await store.appendMessage(userMessage("Hello"));

    expect(store.getMetadata().updatedAt).toBeGreaterThanOrEqual(
      beforeAppend
    );
  });

  it("handles messages with content block arrays", async () => {
    const store = createConversationStore(storage, "agent");
    await initAndLoad(store);

    const toolUseMessage: Message = {
      role: "assistant",
      content: [
        { type: "text", text: "Let me check." },
        {
          type: "tool_use",
          id: "toolu_123",
          name: "get_time",
          input: {},
        },
      ],
    };

    await store.appendMessage(toolUseMessage);

    expect(store.getMessages()[0]).toEqual(toolUseMessage);

    // Verify round-trip through disk
    const freshStore = createConversationStore(storage, "agent");
    const state = await freshStore.load();
    expect(state.messages[0]).toEqual(toolUseMessage);
  });

  it("handles tool result messages", async () => {
    const store = createConversationStore(storage, "agent");
    await initAndLoad(store);

    const toolResultMessage: Message = {
      role: "user",
      content: [
        {
          type: "tool_result",
          tool_use_id: "toolu_123",
          content: "2026-02-05T14:30:00Z",
        },
      ],
    };

    await store.appendMessage(toolResultMessage);

    expect(store.getMessages()[0]).toEqual(toolResultMessage);
  });
});

// -----------------------------------------------------------------------------
// Replace transcript (compaction)
// -----------------------------------------------------------------------------

describe("replaceTranscript", () => {
  it("replaces the entire transcript in memory and on disk", async () => {
    const store = createConversationStore(storage, "agent");
    await initAndLoad(store);

    // Build up a conversation
    await store.appendMessage(userMessage("msg 1"));
    await store.appendMessage(assistantMessage("msg 2"));
    await store.appendMessage(userMessage("msg 3"));
    await store.appendMessage(assistantMessage("msg 4"));

    expect(store.getMessages()).toHaveLength(4);

    // Replace with compacted version
    const compacted = [
      userMessage("[Summary of previous conversation]"),
      userMessage("msg 3"),
      assistantMessage("msg 4"),
    ];

    await store.replaceTranscript(compacted);

    // In-memory
    expect(store.getMessages()).toHaveLength(3);
    expect(store.getMessages()[0].content).toBe(
      "[Summary of previous conversation]"
    );

    // On disk
    const entries = await storage.readAllJsonl<Message>(
      "agent/transcript.jsonl"
    );
    expect(entries).toHaveLength(3);
  });

  it("can replace with empty transcript", async () => {
    const store = createConversationStore(storage, "agent");
    await initAndLoad(store);

    await store.appendMessage(userMessage("Hello"));
    await store.replaceTranscript([]);

    expect(store.getMessages()).toHaveLength(0);
  });

  it("updates metadata timestamp", async () => {
    const store = createConversationStore(storage, "agent");
    await initAndLoad(store);

    await store.appendMessage(userMessage("Hello"));
    const before = store.getMetadata().updatedAt;

    await new Promise((resolve) => setTimeout(resolve, 10));
    await store.replaceTranscript([userMessage("Summary")]);

    expect(store.getMetadata().updatedAt).toBeGreaterThanOrEqual(before);
  });

  it("replaced transcript persists across reload", async () => {
    const store = createConversationStore(storage, "agent");
    await initAndLoad(store);

    await store.appendMessage(userMessage("old 1"));
    await store.appendMessage(userMessage("old 2"));
    await store.replaceTranscript([userMessage("compacted")]);

    // Reload from disk
    const freshStore = createConversationStore(storage, "agent");
    const state = await freshStore.load();

    expect(state.messages).toHaveLength(1);
    expect(state.messages[0].content).toBe("compacted");
  });
});

// -----------------------------------------------------------------------------
// Update metadata
// -----------------------------------------------------------------------------

describe("updateMetadata", () => {
  it("updates compaction count", async () => {
    const store = createConversationStore(storage, "agent");
    await initAndLoad(store);

    await store.updateMetadata({ compactionCount: 1 });

    expect(store.getMetadata().compactionCount).toBe(1);
  });

  it("updates model", async () => {
    const store = createConversationStore(storage, "agent");
    await initAndLoad(store);

    await store.updateMetadata({ model: "claude-opus-4-20250514" });

    expect(store.getMetadata().model).toBe("claude-opus-4-20250514");
  });

  it("preserves other fields when updating a single field", async () => {
    const store = createConversationStore(storage, "agent");
    await store.initialize("claude-sonnet-4-20250514");
    await store.load();

    const originalCreatedAt = store.getMetadata().createdAt;

    await store.updateMetadata({ compactionCount: 5 });

    expect(store.getMetadata().createdAt).toBe(originalCreatedAt);
    expect(store.getMetadata().model).toBe("claude-sonnet-4-20250514");
    expect(store.getMetadata().compactionCount).toBe(5);
  });

  it("persists to disk", async () => {
    const store = createConversationStore(storage, "agent");
    await initAndLoad(store);

    await store.updateMetadata({ compactionCount: 3 });

    const freshStore = createConversationStore(storage, "agent");
    const state = await freshStore.load();

    expect(state.metadata.compactionCount).toBe(3);
  });

  it("updates timestamp", async () => {
    const store = createConversationStore(storage, "agent");
    await initAndLoad(store);

    const before = store.getMetadata().updatedAt;

    await new Promise((resolve) => setTimeout(resolve, 10));
    await store.updateMetadata({ compactionCount: 1 });

    expect(store.getMetadata().updatedAt).toBeGreaterThanOrEqual(before);
  });
});

// -----------------------------------------------------------------------------
// getMessages / getMetadata
// -----------------------------------------------------------------------------

describe("getMessages", () => {
  it("returns empty array for new conversation", async () => {
    const store = createConversationStore(storage, "agent");
    await initAndLoad(store);

    expect(store.getMessages()).toEqual([]);
  });

  it("returns messages without disk I/O", async () => {
    const store = createConversationStore(storage, "agent");
    await initAndLoad(store);

    await store.appendMessage(userMessage("Hello"));

    // getMessages is synchronous -- no disk I/O
    const messages = store.getMessages();
    expect(messages).toHaveLength(1);
  });

  it("returns readonly array", async () => {
    const store = createConversationStore(storage, "agent");
    await initAndLoad(store);

    await store.appendMessage(userMessage("Hello"));
    const messages = store.getMessages();

    // TypeScript enforces this at compile time; runtime check for safety
    expect(Array.isArray(messages)).toBe(true);
  });
});

describe("getMetadata", () => {
  it("returns initial metadata after initialization", async () => {
    const store = createConversationStore(storage, "agent");
    await initAndLoad(store);

    const meta = store.getMetadata();
    expect(meta.compactionCount).toBe(0);
    expect(meta.model).toBeNull();
    expect(meta.createdAt).toBeTypeOf("number");
    expect(meta.updatedAt).toBeTypeOf("number");
  });
});

// -----------------------------------------------------------------------------
// Full conversation lifecycle
// -----------------------------------------------------------------------------

describe("full lifecycle", () => {
  it("initialize -> load -> append -> reload preserves everything", async () => {
    // Initialize
    const store1 = createConversationStore(storage, "agent");
    await store1.initialize("claude-sonnet-4-20250514");
    await store1.load();

    // Append messages
    await store1.appendMessage(userMessage("Hello"));
    await store1.appendMessage(assistantMessage("Hi!"));
    await store1.appendMessage(userMessage("How are you?"));
    await store1.appendMessage(
      assistantMessage("I am doing well, thank you.")
    );

    // Update metadata
    await store1.updateMetadata({ compactionCount: 0 });

    // Reload from disk (new store instance)
    const store2 = createConversationStore(storage, "agent");
    const state = await store2.load();

    expect(state.messages).toHaveLength(4);
    expect(state.metadata.model).toBe("claude-sonnet-4-20250514");
    expect(state.metadata.compactionCount).toBe(0);
  });

  it("compaction lifecycle: append -> compact -> continue -> reload", async () => {
    const store = createConversationStore(storage, "agent");
    await initAndLoad(store);

    // Phase 1: Build up conversation
    for (let i = 0; i < 10; i++) {
      await store.appendMessage(userMessage(`Question ${i}`));
      await store.appendMessage(assistantMessage(`Answer ${i}`));
    }
    expect(store.getMessages()).toHaveLength(20);

    // Phase 2: Compact
    const summary = userMessage(
      "Summary: User asked 10 questions about various topics."
    );
    const kept = store.getMessages().slice(-4); // Keep last 4 messages
    await store.replaceTranscript([summary, ...kept]);
    await store.updateMetadata({ compactionCount: 1 });

    expect(store.getMessages()).toHaveLength(5); // summary + 4 kept

    // Phase 3: Continue conversation
    await store.appendMessage(userMessage("New question"));
    await store.appendMessage(assistantMessage("New answer"));

    expect(store.getMessages()).toHaveLength(7);

    // Phase 4: Reload and verify
    const freshStore = createConversationStore(storage, "agent");
    const state = await freshStore.load();

    expect(state.messages).toHaveLength(7);
    expect(state.messages[0].content).toContain("Summary:");
    expect(state.metadata.compactionCount).toBe(1);
  });

  it("multiple stores for different conversations are independent", async () => {
    const storeA = createConversationStore(storage, "agent-a");
    const storeB = createConversationStore(storage, "agent-b");

    await storeA.initialize("model-a");
    await storeB.initialize("model-b");
    await storeA.load();
    await storeB.load();

    await storeA.appendMessage(userMessage("Hello from A"));
    await storeB.appendMessage(userMessage("Hello from B"));
    await storeB.appendMessage(userMessage("Second from B"));

    expect(storeA.getMessages()).toHaveLength(1);
    expect(storeB.getMessages()).toHaveLength(2);

    expect(storeA.getMetadata().model).toBe("model-a");
    expect(storeB.getMetadata().model).toBe("model-b");
  });
});

// -----------------------------------------------------------------------------
// Error type properties
// -----------------------------------------------------------------------------

describe("error types", () => {
  it("ConversationNotLoadedError has correct name", () => {
    const error = new ConversationNotLoadedError();
    expect(error.name).toBe("ConversationNotLoadedError");
    expect(error.message).toContain("load()");
    expect(error).toBeInstanceOf(Error);
  });

  it("ConversationAlreadyExistsError has correct name and path", () => {
    const error = new ConversationAlreadyExistsError("agent/conversation");
    expect(error.name).toBe("ConversationAlreadyExistsError");
    expect(error.path).toBe("agent/conversation");
    expect(error).toBeInstanceOf(Error);
  });
});

// -----------------------------------------------------------------------------
// Edge cases
// -----------------------------------------------------------------------------

describe("edge cases", () => {
  it("handles messages with empty string content", async () => {
    const store = createConversationStore(storage, "agent");
    await initAndLoad(store);

    await store.appendMessage(userMessage(""));
    expect(store.getMessages()[0].content).toBe("");
  });

  it("handles messages with unicode content", async () => {
    const store = createConversationStore(storage, "agent");
    await initAndLoad(store);

    await store.appendMessage(userMessage("Hello \u{1F600} World \u6771\u4EAC"));
    const freshStore = createConversationStore(storage, "agent");
    const state = await freshStore.load();
    expect(state.messages[0].content).toBe("Hello \u{1F600} World \u6771\u4EAC");
  });

  it("handles messages with very long content", async () => {
    const store = createConversationStore(storage, "agent");
    await initAndLoad(store);

    const longContent = "x".repeat(100_000);
    await store.appendMessage(userMessage(longContent));

    const freshStore = createConversationStore(storage, "agent");
    const state = await freshStore.load();
    expect((state.messages[0].content as string).length).toBe(100_000);
  });

  it("handles complex tool use / tool result conversation", async () => {
    const store = createConversationStore(storage, "agent");
    await initAndLoad(store);

    // Full tool use cycle
    const messages: Message[] = [
      { role: "user", content: "What time is it?" },
      {
        role: "assistant",
        content: [
          { type: "text", text: "Let me check." },
          {
            type: "tool_use",
            id: "toolu_abc",
            name: "get_time",
            input: {},
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: "toolu_abc",
            content: "2026-02-05T14:30:00Z",
          },
        ],
      },
      {
        role: "assistant",
        content: [{ type: "text", text: "It is 2:30 PM UTC." }],
      },
    ];

    for (const msg of messages) {
      await store.appendMessage(msg);
    }

    // Verify round-trip
    const freshStore = createConversationStore(storage, "agent");
    const state = await freshStore.load();
    expect(state.messages).toEqual(messages);
  });

  it("handles tool result with is_error flag", async () => {
    const store = createConversationStore(storage, "agent");
    await initAndLoad(store);

    const errorResult: Message = {
      role: "user",
      content: [
        {
          type: "tool_result",
          tool_use_id: "toolu_err",
          content: "Command failed: exit code 1",
          is_error: true,
        },
      ],
    };

    await store.appendMessage(errorResult);

    const freshStore = createConversationStore(storage, "agent");
    const state = await freshStore.load();
    const block = (state.messages[0].content as ReadonlyArray<{ type: string; is_error?: boolean }>)[0];
    expect(block.is_error).toBe(true);
  });
});
