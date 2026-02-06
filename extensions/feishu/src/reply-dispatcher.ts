import {
  createReplyPrefixContext,
  createTypingCallbacks,
  logTypingFailure,
  type ClawdbotConfig,
  type RuntimeEnv,
  type ReplyPayload,
} from "openclaw/plugin-sdk";
import type { MentionTarget } from "./mention.js";
import { resolveFeishuAccount } from "./accounts.js";
import { createFeishuClient } from "./client.js";
import { buildMentionedCardContent } from "./mention.js";
import { getFeishuRuntime } from "./runtime.js";
import { sendMessageFeishu, sendMarkdownCardFeishu } from "./send.js";
import { FeishuStreamingSession } from "./streaming-card.js";
import { resolveReceiveIdType } from "./targets.js";
import { addTypingIndicator, removeTypingIndicator, type TypingIndicatorState } from "./typing.js";

/** Detect if text contains markdown elements that benefit from card rendering */
function shouldUseCard(text: string): boolean {
  return /```[\s\S]*?```/.test(text) || /\|.+\|[\r\n]+\|[-:| ]+\|/.test(text);
}

export type CreateFeishuReplyDispatcherParams = {
  cfg: ClawdbotConfig;
  agentId: string;
  runtime: RuntimeEnv;
  chatId: string;
  replyToMessageId?: string;
  mentionTargets?: MentionTarget[];
  accountId?: string;
};

export function createFeishuReplyDispatcher(params: CreateFeishuReplyDispatcherParams) {
  const core = getFeishuRuntime();
  const { cfg, agentId, chatId, replyToMessageId, mentionTargets, accountId } = params;
  const account = resolveFeishuAccount({ cfg, accountId });
  const prefixContext = createReplyPrefixContext({ cfg, agentId });

  // Typing indicator state
  let typingState: TypingIndicatorState | null = null;
  const typingCallbacks = createTypingCallbacks({
    start: async () => {
      if (!replyToMessageId) {
        return;
      }
      typingState = await addTypingIndicator({ cfg, messageId: replyToMessageId, accountId });
    },
    stop: async () => {
      if (!typingState) {
        return;
      }
      await removeTypingIndicator({ cfg, state: typingState, accountId });
      typingState = null;
    },
    onStartError: (err) =>
      logTypingFailure({
        log: (m) => params.runtime.log?.(m),
        channel: "feishu",
        action: "start",
        error: err,
      }),
    onStopError: (err) =>
      logTypingFailure({
        log: (m) => params.runtime.log?.(m),
        channel: "feishu",
        action: "stop",
        error: err,
      }),
  });

  // Config
  const textChunkLimit = core.channel.text.resolveTextChunkLimit({
    cfg,
    channel: "feishu",
    defaultLimit: 4000,
  });
  const chunkMode = core.channel.text.resolveChunkMode(cfg, "feishu");
  const tableMode = core.channel.text.resolveMarkdownTableMode({ cfg, channel: "feishu" });
  const renderMode = account.config?.renderMode ?? "auto";
  const streamingEnabled =
    account.config?.streaming !== false && (renderMode === "card" || renderMode === "auto");

  // Streaming state
  let streaming: FeishuStreamingSession | null = null;
  let streamingStartPromise: Promise<void> | null = null;
  let streamText = "";
  let lastPartial = "";
  let partialUpdateQueue: Promise<void> = Promise.resolve();

  const startStreaming = async () => {
    if (streaming || !streamingEnabled) {
      return;
    }
    const creds =
      account.appId && account.appSecret
        ? { appId: account.appId, appSecret: account.appSecret, domain: account.domain }
        : null;
    if (!creds) {
      return;
    }
    streaming = new FeishuStreamingSession(createFeishuClient(account), creds, (m) =>
      params.runtime.log?.(`feishu[${account.accountId}] ${m}`),
    );
    try {
      await streaming.start(chatId, resolveReceiveIdType(chatId));
    } catch (e) {
      params.runtime.error?.(`feishu: streaming start failed: ${String(e)}`);
      streaming = null;
    }
  };

  const closeStreaming = async () => {
    await partialUpdateQueue;
    if (streaming?.isActive()) {
      let text = streamText;
      if (mentionTargets?.length) {
        text = buildMentionedCardContent(mentionTargets, text);
      }
      await streaming.close(text);
    }
    streaming = null;
    streamingStartPromise = null;
    streamText = "";
  };

  const { dispatcher, replyOptions, markDispatchIdle } =
    core.channel.reply.createReplyDispatcherWithTyping({
      responsePrefix: prefixContext.responsePrefix,
      responsePrefixContextProvider: prefixContext.responsePrefixContextProvider,
      humanDelay: core.channel.reply.resolveHumanDelayConfig(cfg, agentId),
      onReplyStart: typingCallbacks.onReplyStart,
      deliver: async (payload: ReplyPayload, info) => {
        const text = payload.text ?? "";
        if (!text.trim()) {
          return;
        }

        // Streaming: ensure session started before processing block/final
        if ((info?.kind === "block" || info?.kind === "final") && streamingEnabled) {
          if (!streamingStartPromise && !streaming) {
            streamingStartPromise = startStreaming();
          }
          if (streamingStartPromise) {
            await streamingStartPromise;
          }
        }

        // Streaming active: onPartialReply handles updates, deliver(final) closes
        if (streaming?.isActive()) {
          if (info?.kind === "final") {
            streamText = text;
            await closeStreaming();
          }
          return;
        }

        // Non-streaming path
        const useCard = renderMode === "card" || (renderMode === "auto" && shouldUseCard(text));
        let first = true;

        if (useCard) {
          for (const chunk of core.channel.text.chunkTextWithMode(
            text,
            textChunkLimit,
            chunkMode,
          )) {
            await sendMarkdownCardFeishu({
              cfg,
              to: chatId,
              text: chunk,
              replyToMessageId,
              mentions: first ? mentionTargets : undefined,
              accountId,
            });
            first = false;
          }
        } else {
          const converted = core.channel.text.convertMarkdownTables(text, tableMode);
          for (const chunk of core.channel.text.chunkTextWithMode(
            converted,
            textChunkLimit,
            chunkMode,
          )) {
            await sendMessageFeishu({
              cfg,
              to: chatId,
              text: chunk,
              replyToMessageId,
              mentions: first ? mentionTargets : undefined,
              accountId,
            });
            first = false;
          }
        }
      },
      onError: async (err, info) => {
        params.runtime.error?.(
          `feishu[${account.accountId}] ${info.kind} reply failed: ${String(err)}`,
        );
        await closeStreaming();
        typingCallbacks.onIdle?.();
      },
      onIdle: async () => {
        await closeStreaming();
        typingCallbacks.onIdle?.();
      },
    });

  return {
    dispatcher,
    replyOptions: {
      ...replyOptions,
      onModelSelected: prefixContext.onModelSelected,
      onReplyStart: async () => {
        await replyOptions.onReplyStart?.();
        if (streamingEnabled && !streaming && !streamingStartPromise) {
          streamingStartPromise = startStreaming();
          await streamingStartPromise;
        }
      },
      onPartialReply: streamingEnabled
        ? (payload: ReplyPayload) => {
            if (!streaming?.isActive() || !payload.text || payload.text === lastPartial) {
              return;
            }
            lastPartial = payload.text;
            streamText = payload.text;
            partialUpdateQueue = partialUpdateQueue.then(() => streaming?.update(payload.text));
          }
        : undefined,
    },
    markDispatchIdle,
  };
}
