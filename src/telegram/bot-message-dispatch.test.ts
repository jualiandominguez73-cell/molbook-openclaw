import type { Bot } from "grammy";
import { beforeEach, describe, expect, it, vi } from "vitest";

const createTelegramDraftStream = vi.hoisted(() => vi.fn());
const dispatchReplyWithBufferedBlockDispatcher = vi.hoisted(() => vi.fn());
const deliverReplies = vi.hoisted(() => vi.fn());

vi.mock("./draft-stream.js", () => ({
  createTelegramDraftStream,
}));

vi.mock("../auto-reply/reply/provider-dispatcher.js", () => ({
  dispatchReplyWithBufferedBlockDispatcher,
}));

vi.mock("./bot/delivery.js", () => ({
  deliverReplies,
}));

vi.mock("./sticker-cache.js", () => ({
  cacheSticker: vi.fn(),
  describeStickerImage: vi.fn(),
}));

import { dispatchTelegramMessage } from "./bot-message-dispatch.js";

describe("dispatchTelegramMessage draft streaming", () => {
  beforeEach(() => {
    createTelegramDraftStream.mockReset();
    dispatchReplyWithBufferedBlockDispatcher.mockReset();
    deliverReplies.mockReset();
  });

  it("streams drafts in private threads and forwards thread id", async () => {
    const draftStream = {
      update: vi.fn(),
      flush: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn(),
    };
    createTelegramDraftStream.mockReturnValue(draftStream);
    dispatchReplyWithBufferedBlockDispatcher.mockImplementation(
      async ({ dispatcherOptions, replyOptions }) => {
        await replyOptions?.onPartialReply?.({ text: "Hello" });
        await dispatcherOptions.deliver({ text: "Hello" }, { kind: "final" });
        return { queuedFinal: true };
      },
    );
    deliverReplies.mockResolvedValue({ delivered: true });

    const resolveBotTopicsEnabled = vi.fn().mockResolvedValue(true);
    const context = {
      ctxPayload: {},
      primaryCtx: { message: { chat: { id: 123, type: "private" } } },
      msg: {
        chat: { id: 123, type: "private" },
        message_id: 456,
        message_thread_id: 777,
      },
      chatId: 123,
      isGroup: false,
      resolvedThreadId: undefined,
      replyThreadId: 777,
      threadSpec: { id: 777, scope: "dm" },
      historyKey: undefined,
      historyLimit: 0,
      groupHistories: new Map(),
      route: { agentId: "default", accountId: "default" },
      skillFilter: undefined,
      sendTyping: vi.fn(),
      sendRecordVoice: vi.fn(),
      ackReactionPromise: null,
      reactionApi: null,
      removeAckAfterReply: false,
    };

    const bot = { api: { sendMessageDraft: vi.fn() } } as unknown as Bot;
    const runtime = {
      log: vi.fn(),
      error: vi.fn(),
      exit: () => {
        throw new Error("exit");
      },
    };

    await dispatchTelegramMessage({
      context,
      bot,
      cfg: {},
      runtime,
      replyToMode: "first",
      streamMode: "partial",
      textLimit: 4096,
      telegramCfg: {},
      opts: { token: "token" },
      resolveBotTopicsEnabled,
    });

    expect(resolveBotTopicsEnabled).toHaveBeenCalledWith(context.primaryCtx);
    expect(createTelegramDraftStream).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: 123,
        thread: { id: 777, scope: "dm" },
      }),
    );
    expect(draftStream.update).toHaveBeenCalledWith("Hello");
    expect(deliverReplies).toHaveBeenCalledWith(
      expect.objectContaining({
        thread: { id: 777, scope: "dm" },
      }),
    );
  });
});

describe("Issue: Telegram silent error handling (petter-b/clawdbot-dev#21)", () => {
  beforeEach(() => {
    createTelegramDraftStream.mockReset();
    dispatchReplyWithBufferedBlockDispatcher.mockReset();
    deliverReplies.mockReset();
  });

  const createContext = () => ({
    ctxPayload: {},
    primaryCtx: { message: { chat: { id: 123, type: "private" as const } } },
    msg: { chat: { id: 123, type: "private" as const }, message_id: 456 },
    chatId: 123,
    isGroup: false,
    threadSpec: { id: undefined, scope: "dm" as const },
    historyKey: undefined,
    historyLimit: 0,
    groupHistories: new Map(),
    route: { agentId: "default", accountId: "default" },
    skillFilter: undefined,
    sendTyping: vi.fn(),
    sendRecordVoice: vi.fn(),
    ackReactionPromise: null,
    reactionApi: null,
    removeAckAfterReply: false,
  });

  it("errors logged to runtime.error when available", async () => {
    const testError = new Error("delivery failed");

    dispatchReplyWithBufferedBlockDispatcher.mockImplementation(async ({ dispatcherOptions }) => {
      await dispatcherOptions.onError(testError, { kind: "final" });
      return { queuedFinal: false };
    });

    deliverReplies.mockResolvedValue({ delivered: false });

    const runtimeWithError = {
      log: vi.fn(),
      error: vi.fn(),
      exit: () => {
        throw new Error("exit");
      },
    };

    const resolveBotTopicsEnabled = vi.fn().mockResolvedValue(false);
    const bot = { api: {} } as unknown as Bot;

    await dispatchTelegramMessage({
      context: createContext(),
      bot,
      cfg: {},
      runtime: runtimeWithError,
      replyToMode: "first",
      streamMode: "off",
      textLimit: 4096,
      telegramCfg: {},
      opts: { token: "test-token" },
      resolveBotTopicsEnabled,
    });

    // Should use runtime.error when available
    expect(runtimeWithError.error).toHaveBeenCalled();
    const errorMsg = String(runtimeWithError.error.mock.calls[0]?.[0] || "");
    expect(errorMsg).toContain("telegram final reply failed");
  });

  it("errors logged to console.error when runtime.error is undefined", async () => {
    const testError = new Error("delivery failed");
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    dispatchReplyWithBufferedBlockDispatcher.mockImplementation(async ({ dispatcherOptions }) => {
      await dispatcherOptions.onError(testError, { kind: "intermediate" });
      return { queuedFinal: false };
    });

    deliverReplies.mockResolvedValue({ delivered: false });

    const runtimeWithoutError = {
      log: vi.fn(),
      error: undefined as unknown,
      exit: () => {
        throw new Error("exit");
      },
    };

    const resolveBotTopicsEnabled = vi.fn().mockResolvedValue(false);
    const bot = { api: {} } as unknown as Bot;

    await dispatchTelegramMessage({
      context: createContext(),
      bot,
      cfg: {},
      runtime: runtimeWithoutError,
      replyToMode: "first",
      streamMode: "off",
      textLimit: 4096,
      telegramCfg: {},
      opts: { token: "test-token" },
      resolveBotTopicsEnabled,
    });

    // After fix: console.error should be called as fallback
    expect(consoleErrorSpy).toHaveBeenCalled();
    const errorMsg = String(consoleErrorSpy.mock.calls[0]?.[0] || "");
    expect(errorMsg).toContain("telegram intermediate reply failed");

    consoleErrorSpy.mockRestore();
  });
});
