import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  startAgentHookBridge,
  stopAgentHookBridge,
  type SessionMeta,
  type ToolHookEvent,
} from "./agent-hook-bridge.js";
import { emitAgentEvent } from "./agent-events.js";
import {
  clearInternalHooks,
  registerInternalHook,
  type InternalHookEvent,
} from "../hooks/internal-hooks.js";

describe("agent-hook-bridge", () => {
  beforeEach(() => {
    clearInternalHooks();
    stopAgentHookBridge();
  });

  afterEach(() => {
    clearInternalHooks();
    stopAgentHookBridge();
  });

  describe("startAgentHookBridge", () => {
    it("should emit tool:start events to hooks", async () => {
      const events: InternalHookEvent[] = [];
      registerInternalHook("tool:start", async (evt) => {
        events.push(evt);
      });

      startAgentHookBridge();

      emitAgentEvent({
        runId: "run-1",
        stream: "tool",
        sessionKey: "agent:main:discord:channel:123456",
        data: {
          phase: "start",
          name: "exec",
          toolCallId: "tool-1",
          args: { command: "npm test" },
        },
      });

      // Allow async hook to process
      await new Promise((r) => setTimeout(r, 10));

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe("tool");
      expect(events[0].action).toBe("start");
      expect(events[0].context).toMatchObject({
        runId: "run-1",
        toolName: "exec",
        toolCallId: "tool-1",
        args: { command: "npm test" },
      });
    });

    it("should emit tool:update events to hooks", async () => {
      const events: InternalHookEvent[] = [];
      registerInternalHook("tool:update", async (evt) => {
        events.push(evt);
      });

      startAgentHookBridge();

      emitAgentEvent({
        runId: "run-1",
        stream: "tool",
        sessionKey: "agent:main:telegram:dm:user123",
        data: {
          phase: "update",
          name: "exec",
          toolCallId: "tool-1",
          partialResult: "Building...",
        },
      });

      await new Promise((r) => setTimeout(r, 10));

      expect(events).toHaveLength(1);
      expect(events[0].action).toBe("update");
      expect(events[0].context).toMatchObject({
        toolName: "exec",
        partialResult: "Building...",
      });
    });

    it("should emit tool:result events to hooks", async () => {
      const events: InternalHookEvent[] = [];
      registerInternalHook("tool:result", async (evt) => {
        events.push(evt);
      });

      startAgentHookBridge();

      emitAgentEvent({
        runId: "run-1",
        stream: "tool",
        sessionKey: "agent:main:slack:channel:C123",
        data: {
          phase: "result",
          name: "read",
          toolCallId: "tool-2",
          result: { content: "file contents" },
          isError: false,
        },
      });

      await new Promise((r) => setTimeout(r, 10));

      expect(events).toHaveLength(1);
      expect(events[0].action).toBe("result");
      expect(events[0].context).toMatchObject({
        toolName: "read",
        result: { content: "file contents" },
        isError: false,
      });
    });

    it("should parse sessionMeta correctly", async () => {
      const events: InternalHookEvent[] = [];
      registerInternalHook("tool", async (evt) => {
        events.push(evt);
      });

      startAgentHookBridge();

      emitAgentEvent({
        runId: "run-1",
        stream: "tool",
        sessionKey: "agent:main:discord:channel:123456789",
        data: {
          phase: "start",
          name: "browser",
          toolCallId: "tool-3",
        },
      });

      await new Promise((r) => setTimeout(r, 10));

      const sessionMeta = (events[0].context as { sessionMeta: SessionMeta }).sessionMeta;
      expect(sessionMeta).toEqual({
        agentId: "main",
        platform: "discord",
        channelType: "channel",
        channelId: "123456789",
        raw: "discord:channel:123456789",
      });
    });

    it("should handle channelIds with colons (e.g., Matrix)", async () => {
      const events: InternalHookEvent[] = [];
      registerInternalHook("tool", async (evt) => {
        events.push(evt);
      });

      startAgentHookBridge();

      emitAgentEvent({
        runId: "run-1",
        stream: "tool",
        sessionKey: "agent:main:matrix:room:!abc:matrix.org",
        data: {
          phase: "start",
          name: "exec",
          toolCallId: "tool-4",
        },
      });

      await new Promise((r) => setTimeout(r, 10));

      const sessionMeta = (events[0].context as { sessionMeta: SessionMeta }).sessionMeta;
      expect(sessionMeta.channelId).toBe("!abc:matrix.org");
    });

    it("should not emit events for non-tool streams", async () => {
      const events: InternalHookEvent[] = [];
      registerInternalHook("tool", async (evt) => {
        events.push(evt);
      });

      startAgentHookBridge();

      emitAgentEvent({
        runId: "run-1",
        stream: "lifecycle",
        sessionKey: "agent:main:discord:channel:123",
        data: { phase: "start" },
      });

      emitAgentEvent({
        runId: "run-1",
        stream: "assistant",
        sessionKey: "agent:main:discord:channel:123",
        data: { text: "Hello" },
      });

      await new Promise((r) => setTimeout(r, 10));

      expect(events).toHaveLength(0);
    });

    it("should not emit events for unknown phases", async () => {
      const events: InternalHookEvent[] = [];
      registerInternalHook("tool", async (evt) => {
        events.push(evt);
      });

      startAgentHookBridge();

      emitAgentEvent({
        runId: "run-1",
        stream: "tool",
        sessionKey: "agent:main:discord:channel:123",
        data: {
          phase: "unknown",
          name: "exec",
          toolCallId: "tool-5",
        },
      });

      await new Promise((r) => setTimeout(r, 10));

      expect(events).toHaveLength(0);
    });

    it("should prevent double-subscription", () => {
      const unsub1 = startAgentHookBridge();
      const unsub2 = startAgentHookBridge();

      // Should return the same cleanup function
      expect(unsub1).toBe(unsub2);
    });

    it("should handle malformed session keys gracefully", async () => {
      const events: InternalHookEvent[] = [];
      registerInternalHook("tool", async (evt) => {
        events.push(evt);
      });

      startAgentHookBridge();

      // Missing parts
      emitAgentEvent({
        runId: "run-1",
        stream: "tool",
        sessionKey: "agent:main",
        data: {
          phase: "start",
          name: "exec",
          toolCallId: "tool-7",
        },
      });

      await new Promise((r) => setTimeout(r, 10));

      expect(events).toHaveLength(1);
      const sessionMeta = (events[0].context as { sessionMeta: SessionMeta }).sessionMeta;
      expect(sessionMeta.agentId).toBeNull();
      expect(sessionMeta.platform).toBeNull();
    });

    it("should handle empty session keys", async () => {
      const events: InternalHookEvent[] = [];
      registerInternalHook("tool", async (evt) => {
        events.push(evt);
      });

      startAgentHookBridge();

      emitAgentEvent({
        runId: "run-1",
        stream: "tool",
        sessionKey: "",
        data: {
          phase: "start",
          name: "exec",
          toolCallId: "tool-8",
        },
      });

      await new Promise((r) => setTimeout(r, 10));

      expect(events).toHaveLength(1);
      const sessionMeta = (events[0].context as { sessionMeta: SessionMeta }).sessionMeta;
      expect(sessionMeta).toEqual({
        agentId: null,
        platform: null,
        channelType: null,
        channelId: null,
        raw: null,
      });
    });

    it("should normalize empty channelId to null", async () => {
      const events: InternalHookEvent[] = [];
      registerInternalHook("tool", async (evt) => {
        events.push(evt);
      });

      startAgentHookBridge();

      // Trailing colon resulting in empty channelId
      emitAgentEvent({
        runId: "run-1",
        stream: "tool",
        sessionKey: "agent:main:discord:channel:",
        data: {
          phase: "start",
          name: "exec",
          toolCallId: "tool-9",
        },
      });

      await new Promise((r) => setTimeout(r, 10));

      expect(events).toHaveLength(1);
      const sessionMeta = (events[0].context as { sessionMeta: SessionMeta }).sessionMeta;
      expect(sessionMeta.channelId).toBeNull();
    });

    it("should ignore events with missing toolCallId", async () => {
      const events: InternalHookEvent[] = [];
      registerInternalHook("tool", async (evt) => {
        events.push(evt);
      });

      startAgentHookBridge();

      emitAgentEvent({
        runId: "run-1",
        stream: "tool",
        sessionKey: "agent:main:discord:channel:123",
        data: {
          phase: "start",
          name: "exec",
          // Missing toolCallId
        },
      });

      await new Promise((r) => setTimeout(r, 10));

      expect(events).toHaveLength(0);
    });

    it("should ignore events with missing name", async () => {
      const events: InternalHookEvent[] = [];
      registerInternalHook("tool", async (evt) => {
        events.push(evt);
      });

      startAgentHookBridge();

      emitAgentEvent({
        runId: "run-1",
        stream: "tool",
        sessionKey: "agent:main:discord:channel:123",
        data: {
          phase: "start",
          toolCallId: "tool-10",
          // Missing name
        },
      });

      await new Promise((r) => setTimeout(r, 10));

      expect(events).toHaveLength(0);
    });
  });

  describe("stopAgentHookBridge", () => {
    it("should stop emitting events after stop", async () => {
      const events: InternalHookEvent[] = [];
      registerInternalHook("tool", async (evt) => {
        events.push(evt);
      });

      startAgentHookBridge();
      stopAgentHookBridge();

      emitAgentEvent({
        runId: "run-1",
        stream: "tool",
        sessionKey: "agent:main:discord:channel:123",
        data: {
          phase: "start",
          name: "exec",
          toolCallId: "tool-6",
        },
      });

      await new Promise((r) => setTimeout(r, 10));

      expect(events).toHaveLength(0);
    });
  });
});
