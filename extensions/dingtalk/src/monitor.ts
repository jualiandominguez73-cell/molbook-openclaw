import type { DingTalkAccountConfig, MoltbotConfig } from "clawdbot/plugin-sdk";

import type { ResolvedDingTalkAccount } from "./accounts.js";
import { replyWithSessionWebhook } from "./api.js";
import { getDingTalkRuntime } from "./runtime.js";
import type {
  DingTalkStreamMessage,
  DingTalkMarkdownMessage,
  DingTalkGroupConfig,
} from "./types.js";

export type DingTalkRuntimeEnv = {
  log?: (message: string) => void;
  error?: (message: string) => void;
};

export type DingTalkMonitorOptions = {
  account: ResolvedDingTalkAccount;
  config: MoltbotConfig;
  runtime: DingTalkRuntimeEnv;
  abortSignal: AbortSignal;
  statusSink?: (patch: { lastInboundAt?: number; lastOutboundAt?: number }) => void;
};

type DingTalkCoreRuntime = ReturnType<typeof getDingTalkRuntime>;

function logVerbose(core: DingTalkCoreRuntime, runtime: DingTalkRuntimeEnv, message: string) {
  if (core.logging.shouldLogVerbose()) {
    runtime.log?.(`[dingtalk] ${message}`);
  }
}

/**
 * Resolve group entry from config for allowlist checking
 */
function resolveGroupEntry(
  config: DingTalkAccountConfig,
  conversationId: string,
): {
  entry: DingTalkGroupConfig | undefined;
  wildcard: DingTalkGroupConfig | undefined;
  allowlistConfigured: boolean;
} {
  const groups = config.groups ?? {};
  const entry = groups[conversationId];
  const wildcard = groups["*"];
  const allowlistConfigured = Object.keys(groups).length > 0;
  return { entry, wildcard, allowlistConfigured };
}

/**
 * Start DingTalk Stream mode monitor using dingtalk-stream SDK.
 * Stream mode uses WebSocket connection, no public URL needed.
 */
export async function startDingTalkMonitor(params: DingTalkMonitorOptions): Promise<() => void> {
  const { account, config, runtime, abortSignal, statusSink } = params;
  const core = getDingTalkRuntime();

  // Validate Stream mode credentials
  if (!account.clientId || !account.clientSecret) {
    runtime.error?.(
      `[${account.accountId}] DingTalk Stream mode requires clientId and clientSecret`,
    );
    return () => {};
  }

  runtime.log?.(`[${account.accountId}] Starting DingTalk Stream mode connection...`);

  let client: DingTalkStreamClient | null = null;
  let isConnected = false;

  try {
    // Dynamic import of dingtalk-stream SDK
    const { DWClient, EventAck } = await import("dingtalk-stream");

    // Create DingTalk Stream client
    client = new DWClient({
      clientId: account.clientId,
      clientSecret: account.clientSecret,
    }) as DingTalkStreamClient;

    // Register robot message callback listener
    // The callback path for robot messages is '/v1.0/im/bot/messages/get'
    client.registerCallbackListener(
      "/v1.0/im/bot/messages/get",
      async (res: DingTalkStreamResponse) => {
        try {
          statusSink?.({ lastInboundAt: Date.now() });

          const message = JSON.parse(res.data) as DingTalkStreamMessage;
          logVerbose(core, runtime, `received stream message: ${JSON.stringify(message)}`);

          await processStreamMessage({
            message,
            account,
            config,
            runtime,
            core,
            statusSink,
          });

          // Acknowledge the message was processed
          client?.socketCallBackResponse(res.headers.messageId, EventAck.SUCCESS);
        } catch (err) {
          runtime.error?.(`[${account.accountId}] Stream message processing error: ${String(err)}`);
          // Still acknowledge to prevent redelivery
          client?.socketCallBackResponse(res.headers.messageId, EventAck.SUCCESS);
        }
      },
    );

    // Connect to DingTalk Stream
    await client.connect();
    isConnected = true;
    runtime.log?.(`[${account.accountId}] DingTalk Stream mode connected successfully`);

    // Handle abort signal
    const handleAbort = () => {
      if (client && isConnected) {
        runtime.log?.(`[${account.accountId}] Disconnecting DingTalk Stream...`);
        try {
          client.disconnect?.();
        } catch {
          // Ignore disconnect errors
        }
        isConnected = false;
      }
    };

    abortSignal.addEventListener("abort", handleAbort);

    return () => {
      abortSignal.removeEventListener("abort", handleAbort);
      handleAbort();
    };
  } catch (err) {
    runtime.error?.(`[${account.accountId}] DingTalk Stream connection failed: ${String(err)}`);
    return () => {};
  }
}

// Type definitions for dingtalk-stream SDK
interface DingTalkStreamClient {
  registerCallbackListener: (
    path: string,
    callback: (res: DingTalkStreamResponse) => Promise<void>,
  ) => DingTalkStreamClient;
  connect: () => Promise<void>;
  disconnect?: () => void;
  socketCallBackResponse: (messageId: string, response: string) => void;
}

interface DingTalkStreamResponse {
  headers: {
    messageId: string;
    [key: string]: string;
  };
  data: string;
}

/**
 * Process incoming DingTalk Stream message
 */
async function processStreamMessage(params: {
  message: DingTalkStreamMessage;
  account: ResolvedDingTalkAccount;
  config: MoltbotConfig;
  runtime: DingTalkRuntimeEnv;
  core: DingTalkCoreRuntime;
  statusSink?: (patch: { lastInboundAt?: number; lastOutboundAt?: number }) => void;
}): Promise<void> {
  const { message, account, config, runtime, core, statusSink } = params;

  // Only handle text messages for now
  if (message.msgtype !== "text") {
    logVerbose(core, runtime, `skip non-text message (type=${message.msgtype})`);
    return;
  }

  const messageText = message.text?.content?.trim() ?? "";
  if (!messageText) {
    logVerbose(core, runtime, "skip empty message");
    return;
  }

  const isGroup = message.conversationType === "2";
  const senderId = message.senderStaffId;
  const senderName = message.senderNick ?? "";
  const conversationId = message.conversationId;
  const conversationTitle = message.conversationTitle ?? "";

  // Check if sender is allowed (simplified DM policy check)
  const dmPolicy = account.config.dm?.policy ?? "pairing";
  const configAllowFrom = (account.config.dm?.allowFrom ?? []).map((v) => String(v));

  if (!isGroup && dmPolicy !== "open") {
    const allowed = isSenderAllowed(senderId, configAllowFrom);
    if (!allowed) {
      if (dmPolicy === "pairing") {
        const { code, created } = await core.channel.pairing.upsertPairingRequest({
          channel: "dingtalk",
          id: senderId,
          meta: { name: senderName || undefined },
        });
        if (created) {
          logVerbose(core, runtime, `dingtalk pairing request sender=${senderId}`);
          try {
            await replyWithSessionWebhook({
              sessionWebhook: message.sessionWebhook,
              message: {
                msgtype: "text",
                text: {
                  content: core.channel.pairing.buildPairingReply({
                    channel: "dingtalk",
                    idLine: `Your DingTalk user ID: ${senderId}`,
                    code,
                  }),
                },
              },
            });
            statusSink?.({ lastOutboundAt: Date.now() });
          } catch (err) {
            logVerbose(core, runtime, `pairing reply failed for ${senderId}: ${String(err)}`);
          }
        }
      } else {
        logVerbose(core, runtime, `Blocked unauthorized DingTalk sender ${senderId}`);
      }
      return;
    }
  }

  // Group message handling
  if (isGroup) {
    const groupPolicy = account.config.groupPolicy ?? "allowlist";
    if (groupPolicy === "disabled") {
      logVerbose(core, runtime, `drop group message (groupPolicy=disabled)`);
      return;
    }

    const groupInfo = resolveGroupEntry(account.config, conversationId);
    const groupEntry = groupInfo.entry;

    // Allowlist check
    if (groupPolicy === "allowlist") {
      if (!groupInfo.allowlistConfigured) {
        logVerbose(
          core,
          runtime,
          `drop group message (allowlist empty, chat=${conversationId})`,
        );
        return;
      }
      const groupAllowed = Boolean(groupEntry) || Boolean(groupInfo.wildcard);
      if (!groupAllowed) {
        logVerbose(
          core,
          runtime,
          `drop group message (not allowlisted, chat=${conversationId})`,
        );
        return;
      }
    }

    // Check if group is disabled
    if (groupEntry?.enabled === false || groupEntry?.allow === false) {
      logVerbose(core, runtime, `drop group message (disabled, chat=${conversationId})`);
      return;
    }

    // Check group user allowlist
    if (groupEntry?.users && groupEntry.users.length > 0) {
      const ok = isSenderAllowed(
        senderId,
        groupEntry.users.map((v) => String(v)),
      );
      if (!ok) {
        logVerbose(core, runtime, `drop group message (sender not allowed, ${senderId})`);
        return;
      }
    }

    // @mention check
    const requireMention =
      groupEntry?.requireMention ?? account.config.requireMention ?? true;
    const wasMentioned = message.isInAtList === true;

    if (requireMention && !wasMentioned) {
      logVerbose(core, runtime, `drop group message (mention required)`);
      return;
    }
  }

  // Build route and session
  const route = core.channel.routing.resolveAgentRoute({
    cfg: config,
    channel: "dingtalk",
    accountId: account.accountId,
    peer: {
      kind: isGroup ? "group" : "dm",
      id: conversationId,
    },
  });

  const fromLabel = isGroup
    ? conversationTitle || `group:${conversationId}`
    : senderName || `user:${senderId}`;

  const storePath = core.channel.session.resolveStorePath(config.session?.store, {
    agentId: route.agentId,
  });

  const envelopeOptions = core.channel.reply.resolveEnvelopeFormatOptions(config);
  const previousTimestamp = core.channel.session.readSessionUpdatedAt({
    storePath,
    sessionKey: route.sessionKey,
  });

  const body = core.channel.reply.formatAgentEnvelope({
    channel: "DingTalk",
    from: fromLabel,
    timestamp: message.createAt ?? Date.now(),
    previousTimestamp,
    envelope: envelopeOptions,
    body: messageText,
  });

  const ctxPayload = core.channel.reply.finalizeInboundContext({
    Body: body,
    RawBody: messageText,
    CommandBody: messageText,
    From: `dingtalk:${senderId}`,
    To: `dingtalk:${conversationId}`,
    SessionKey: route.sessionKey,
    AccountId: route.accountId,
    ChatType: isGroup ? "channel" : "direct",
    ConversationLabel: fromLabel,
    SenderName: senderName || undefined,
    SenderId: senderId,
    WasMentioned: isGroup ? message.isInAtList : undefined,
    Provider: "dingtalk",
    Surface: "dingtalk",
    MessageSid: message.msgId,
    MessageSidFull: message.msgId,
    GroupSpace: isGroup ? conversationTitle ?? undefined : undefined,
    OriginatingChannel: "dingtalk",
    OriginatingTo: `dingtalk:${conversationId}`,
  });

  void core.channel.session
    .recordSessionMetaFromInbound({
      storePath,
      sessionKey: ctxPayload.SessionKey ?? route.sessionKey,
      ctx: ctxPayload,
    })
    .catch((err: unknown) => {
      runtime.error?.(`dingtalk: failed updating session meta: ${String(err)}`);
    });

  // Dispatch reply
  await core.channel.reply.dispatchReplyWithBufferedBlockDispatcher({
    ctx: ctxPayload,
    cfg: config,
    dispatcherOptions: {
      deliver: async (payload) => {
        await deliverDingTalkReply({
          payload,
          sessionWebhook: message.sessionWebhook,
          runtime,
          core,
          config,
          account,
          statusSink,
        });
      },
      onError: (err, info) => {
        runtime.error?.(
          `[${account.accountId}] DingTalk ${info.kind} reply failed: ${String(err)}`,
        );
      },
    },
  });
}

function isSenderAllowed(senderId: string, allowFrom: string[]): boolean {
  if (allowFrom.includes("*")) return true;
  const normalizedSenderId = senderId.toLowerCase();
  return allowFrom.some((entry) => {
    const normalized = String(entry).trim().toLowerCase();
    if (!normalized) return false;
    if (normalized === normalizedSenderId) return true;
    if (normalized.replace(/^dingtalk:/i, "") === normalizedSenderId) return true;
    return false;
  });
}

async function deliverDingTalkReply(params: {
  payload: { text?: string; mediaUrls?: string[]; mediaUrl?: string };
  sessionWebhook: string;
  runtime: DingTalkRuntimeEnv;
  core: DingTalkCoreRuntime;
  config: MoltbotConfig;
  account: ResolvedDingTalkAccount;
  statusSink?: (patch: { lastOutboundAt?: number }) => void;
}): Promise<void> {
  const { payload, sessionWebhook, runtime, core, config, account, statusSink } = params;

  // DingTalk doesn't support media attachments via session webhook in the same way
  // We'll send text messages and note media limitations
  if (payload.text) {
    const chunkLimit = account.config.textChunkLimit ?? 4000;
    const chunkMode = core.channel.text.resolveChunkMode(config, "dingtalk", account.accountId);
    const chunks = core.channel.text.chunkMarkdownTextWithMode(payload.text, chunkLimit, chunkMode);

    for (const chunk of chunks) {
      try {
        // Use markdown format for better formatting
        const message: DingTalkMarkdownMessage = {
          msgtype: "markdown",
          markdown: {
            title: "Reply",
            text: chunk,
          },
        };
        await replyWithSessionWebhook({ sessionWebhook, message });
        statusSink?.({ lastOutboundAt: Date.now() });
      } catch (err) {
        runtime.error?.(`DingTalk message send failed: ${String(err)}`);
      }
    }
  }

  // Note: Media handling would require additional API endpoints
  // DingTalk's robot API has limited media support compared to other platforms
}

// Legacy exports for backward compatibility
export function resolveDingTalkWebhookPath(_params: {
  account: ResolvedDingTalkAccount;
}): string {
  // Stream mode doesn't use webhooks, but return a placeholder for compatibility
  return "/dingtalk-stream";
}
