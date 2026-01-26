import type { IncomingMessage, ServerResponse } from "node:http";

import type { ClawdbotConfig, MarkdownTableMode } from "clawdbot/plugin-sdk";

import type {
  FeishuMessageEvent,
  FeishuReceiveIdType,
  FeishuWebhookPayload,
  ResolvedFeishuAccount,
} from "./types.js";
import {
  buildChallengeResponse,
  parseWebhookPayload,
  sendMessage,
  verifyWebhookToken,
} from "./api.js";
import { getFeishuRuntime } from "./runtime.js";

export type FeishuRuntimeEnv = {
  log?: (message: string) => void;
  error?: (message: string) => void;
};

export type FeishuMonitorOptions = {
  account: ResolvedFeishuAccount;
  config: ClawdbotConfig;
  runtime: FeishuRuntimeEnv;
  abortSignal: AbortSignal;
  webhookPath?: string;
  statusSink?: (patch: { lastInboundAt?: number; lastOutboundAt?: number }) => void;
};

export type FeishuMonitorResult = {
  stop: () => void;
};

const FEISHU_TEXT_LIMIT = 4000;
const DEFAULT_MEDIA_MAX_MB = 20;
const DEFAULT_WEBHOOK_PATH = "/feishu/callback";

type FeishuCoreRuntime = ReturnType<typeof getFeishuRuntime>;

function logVerbose(core: FeishuCoreRuntime, runtime: FeishuRuntimeEnv, message: string): void {
  if (core.logging.shouldLogVerbose()) {
    runtime.log?.(`[feishu] ${message}`);
  }
}

function logWebhookEvent(message: string): void {
  // Use console to ensure visibility even when runtime isn't available.
  console.warn(`[feishu] ${message}`);
}

type FeishuReplyTarget = {
  id: string;
  type: FeishuReceiveIdType;
};

function resolveSenderTarget(event: FeishuMessageEvent): FeishuReplyTarget | null {
  const senderId = event.sender.sender_id;
  if (senderId.open_id) return { id: senderId.open_id, type: "open_id" };
  if (senderId.user_id) return { id: senderId.user_id, type: "user_id" };
  if (senderId.union_id) return { id: senderId.union_id, type: "union_id" };
  return null;
}

function isSenderAllowed(senderId: string, allowFrom: string[]): boolean {
  if (allowFrom.includes("*")) return true;
  const normalizedSenderId = senderId.toLowerCase();
  return allowFrom.some((entry) => {
    const normalized = entry.toLowerCase().replace(/^(feishu|lark|fs):/i, "");
    return normalized === normalizedSenderId;
  });
}

async function readJsonBody(req: IncomingMessage, maxBytes: number) {
  const chunks: Buffer[] = [];
  let total = 0;
  return await new Promise<{ ok: boolean; value?: string; error?: string }>((resolve) => {
    req.on("data", (chunk: Buffer) => {
      total += chunk.length;
      if (total > maxBytes) {
        resolve({ ok: false, error: "payload too large" });
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        if (!raw.trim()) {
          resolve({ ok: false, error: "empty payload" });
          return;
        }
        resolve({ ok: true, value: raw });
      } catch (err) {
        resolve({ ok: false, error: err instanceof Error ? err.message : String(err) });
      }
    });
    req.on("error", (err) => {
      resolve({ ok: false, error: err instanceof Error ? err.message : String(err) });
    });
  });
}

type WebhookTarget = {
  account: ResolvedFeishuAccount;
  config: ClawdbotConfig;
  runtime: FeishuRuntimeEnv;
  core: FeishuCoreRuntime;
  path: string;
  encryptKey: string;
  verificationToken: string;
  mediaMaxMb: number;
  statusSink?: (patch: { lastInboundAt?: number; lastOutboundAt?: number }) => void;
};

const webhookTargets = new Map<string, WebhookTarget[]>();

function normalizeWebhookPath(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "/feishu/callback";
  const withSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  if (withSlash.length > 1 && withSlash.endsWith("/")) {
    return withSlash.slice(0, -1);
  }
  return withSlash;
}

export function registerFeishuWebhookTarget(target: WebhookTarget): () => void {
  const key = normalizeWebhookPath(target.path);
  const normalizedTarget = { ...target, path: key };
  const existing = webhookTargets.get(key) ?? [];
  const next = [...existing, normalizedTarget];
  webhookTargets.set(key, next);
  return () => {
    const updated = (webhookTargets.get(key) ?? []).filter(
      (entry) => entry !== normalizedTarget,
    );
    if (updated.length > 0) {
      webhookTargets.set(key, updated);
    } else {
      webhookTargets.delete(key);
    }
  };
}

/**
 * Handle incoming Feishu webhook requests.
 */
export async function handleFeishuWebhookRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  const url = new URL(req.url ?? "/", "http://localhost");
  const path = normalizeWebhookPath(url.pathname);
  const targets = webhookTargets.get(path);
  if (!targets || targets.length === 0) {
    if (path === DEFAULT_WEBHOOK_PATH || path.startsWith("/feishu/")) {
      logWebhookEvent(
        `webhook request received for ${path}, but no active Feishu accounts are registered`,
      );
    }
    return false;
  }

  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Allow", "POST");
    res.end("Method Not Allowed");
    return true;
  }

  const body = await readJsonBody(req, 1024 * 1024);
  if (!body.ok || !body.value) {
    res.statusCode = body.error === "payload too large" ? 413 : 400;
    res.end(body.error ?? "invalid payload");
    return true;
  }

  let rawPayload: FeishuWebhookPayload | null = null;
  try {
    rawPayload = JSON.parse(body.value) as FeishuWebhookPayload;
  } catch {
    rawPayload = null;
  }
  const isEncryptedRequest = Boolean(rawPayload?.encrypt);
  const rawEventType = rawPayload?.header?.event_type ?? rawPayload?.type ?? "unknown";
  logWebhookEvent(
    `webhook hit: path=${path} method=${req.method} targets=${targets.length} encrypted=${isEncryptedRequest} event=${rawEventType}`,
  );

  let sawTokenMismatch = false;
  let sawEncryptedWithoutKey = false;
  let sawDecryptFailure = false;

  // Try each target to find one that can handle this request
  for (const target of targets) {
    const payload = parseWebhookPayload(body.value, target.encryptKey);
    if (!payload) {
      if (isEncryptedRequest && target.encryptKey) {
        sawDecryptFailure = true;
        target.runtime.error?.(
          `[${target.account.accountId}] Feishu webhook decrypt failed. Check encryptKey.`,
        );
      }
      continue;
    }

    if (payload.encrypt && !target.encryptKey) {
      sawEncryptedWithoutKey = true;
      target.runtime.error?.(
        `[${target.account.accountId}] Feishu webhook is encrypted but encryptKey is not configured.`,
      );
      continue;
    }

    // Verify token if configured
    if (target.verificationToken && !verifyWebhookToken(payload, target.verificationToken)) {
      sawTokenMismatch = true;
      target.runtime.error?.(
        `[${target.account.accountId}] Feishu webhook token mismatch. Check verificationToken.`,
      );
      continue;
    }

    // Handle URL verification challenge
    if (payload.type === "url_verification" && payload.challenge) {
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(buildChallengeResponse(payload.challenge));
      return true;
    }

    // Handle message events
    if (payload.header?.event_type === "im.message.receive_v1" && payload.event) {
      target.statusSink?.({ lastInboundAt: Date.now() });
      processMessageEvent(
        payload.event as FeishuMessageEvent,
        target.account,
        target.config,
        target.runtime,
        target.core,
        target.mediaMaxMb,
        target.statusSink,
      ).catch((err) => {
        target.runtime.error?.(`[${target.account.accountId}] Feishu webhook failed: ${String(err)}`);
      });

      res.statusCode = 200;
      res.end("ok");
      return true;
    }

    // Other event types - acknowledge but don't process
    if (payload.header?.event_type) {
      target.runtime.log?.(`[feishu] ignoring event type: ${payload.header.event_type}`);
      res.statusCode = 200;
      res.end("ok");
      return true;
    }
  }

  // No target could handle the request
  if (sawEncryptedWithoutKey) {
    res.statusCode = 400;
    res.end("encrypt_key required");
    return true;
  }
  if (sawDecryptFailure) {
    res.statusCode = 400;
    res.end("decrypt failed");
    return true;
  }
  if (sawTokenMismatch) {
    res.statusCode = 401;
    res.end("unauthorized");
    return true;
  }
  res.statusCode = 401;
  res.end("unauthorized");
  return true;
}

/**
 * Process a message event from Feishu webhook.
 */
async function processMessageEvent(
  event: FeishuMessageEvent,
  account: ResolvedFeishuAccount,
  config: ClawdbotConfig,
  runtime: FeishuRuntimeEnv,
  core: FeishuCoreRuntime,
  mediaMaxMb: number,
  statusSink?: (patch: { lastInboundAt?: number; lastOutboundAt?: number }) => void,
): Promise<void> {
  const { sender, message } = event;

  // Parse message content
  let textContent = "";
  try {
    const content = JSON.parse(message.content);
    textContent = content.text ?? "";
  } catch {
    // Ignore parse errors
  }

  if (!textContent.trim()) return;

  const isGroup = message.chat_type === "group";
  const chatId = message.chat_id;
  const senderTarget = resolveSenderTarget(event);
  if (!senderTarget) {
    logVerbose(core, runtime, "unable to resolve sender id for feishu message");
    return;
  }
  const senderId = senderTarget.id;
  const senderName = sender.sender_type === "user" ? "User" : sender.sender_type;
  const messageId = message.message_id;
  const replyTarget: FeishuReplyTarget = isGroup
    ? { id: chatId, type: "chat_id" }
    : senderTarget;
  runtime.log?.(
    `[feishu] inbound message id=${messageId} chat=${message.chat_type} sender=${senderId}`,
  );

  // Check DM policy
  const dmPolicy = account.config.dmPolicy ?? "pairing";
  const configAllowFrom = account.config.allowFrom ?? [];
  const rawBody = textContent.trim();
  const shouldComputeAuth = core.channel.commands.shouldComputeCommandAuthorized(rawBody, config);
  const storeAllowFrom =
    !isGroup && (dmPolicy !== "open" || shouldComputeAuth)
      ? await core.channel.pairing.readAllowFromStore("feishu").catch(() => [])
      : [];
  const effectiveAllowFrom = [...configAllowFrom, ...storeAllowFrom];
  const useAccessGroups = config.commands?.useAccessGroups !== false;
  const senderAllowedForCommands = isSenderAllowed(senderId, effectiveAllowFrom);
  const commandAuthorized = shouldComputeAuth
    ? core.channel.commands.resolveCommandAuthorizedFromAuthorizers({
        useAccessGroups,
        authorizers: [{ configured: effectiveAllowFrom.length > 0, allowed: senderAllowedForCommands }],
      })
    : undefined;

  if (!isGroup) {
    if (dmPolicy === "disabled") {
      logVerbose(core, runtime, `Blocked feishu DM from ${senderId} (dmPolicy=disabled)`);
      return;
    }

    if (dmPolicy !== "open") {
      const allowed = senderAllowedForCommands;

      if (!allowed) {
        if (dmPolicy === "pairing") {
          const { code, created } = await core.channel.pairing.upsertPairingRequest({
            channel: "feishu",
            id: senderId,
            meta: { name: senderName ?? undefined },
          });

          if (created) {
            logVerbose(core, runtime, `feishu pairing request sender=${senderId}`);
            try {
              const pairingReply = core.channel.pairing.buildPairingReply({
                channel: "feishu",
                idLine: `Your Feishu user id: ${senderId}`,
                code,
              });
              await sendMessage(
                account.appId,
                account.appSecret,
                {
                  receive_id: senderId,
                  msg_type: "text",
                  content: JSON.stringify({ text: pairingReply }),
                },
                senderTarget.type,
              );
              statusSink?.({ lastOutboundAt: Date.now() });
            } catch (err) {
              logVerbose(
                core,
                runtime,
                `feishu pairing reply failed for ${senderId}: ${String(err)}`,
              );
            }
          }
        } else {
          logVerbose(
            core,
            runtime,
            `Blocked unauthorized feishu sender ${senderId} (dmPolicy=${dmPolicy})`,
          );
        }
        return;
      }
    }
  }

  // Check group policy
  if (isGroup) {
    const groupPolicy = account.config.groupPolicy ?? "allowlist";
    const groupAllowFrom = account.config.groupAllowFrom ?? [];
    const groupConfig = account.config.groups?.[chatId];

    if (groupPolicy === "allowlist") {
      const groupAllowed = groupAllowFrom.includes("*") || groupAllowFrom.includes(chatId);
      const groupEnabled = groupConfig?.enabled !== false;
      if (!groupAllowed && !groupEnabled) {
        logVerbose(core, runtime, `Blocked feishu group ${chatId} (not in allowlist)`);
        return;
      }
    }

    // Check if mention is required
    const requireMention = groupConfig?.requireMention !== false;
    if (requireMention) {
      const hasMention = message.mentions?.some(
        (m) => m.id.open_id === account.appId || m.name === "@_all",
      );
      if (!hasMention) {
        logVerbose(core, runtime, `Ignored feishu group message (no mention)`);
        return;
      }
    }
  }

  const route = core.channel.routing.resolveAgentRoute({
    cfg: config,
    channel: "feishu",
    accountId: account.accountId,
    peer: {
      kind: isGroup ? "group" : "dm",
      id: chatId,
    },
  });

  if (
    isGroup &&
    core.channel.commands.isControlCommandMessage(rawBody, config) &&
    commandAuthorized !== true
  ) {
    logVerbose(core, runtime, `feishu: drop control command from unauthorized sender ${senderId}`);
    return;
  }

  const fromLabel = isGroup ? `group:${chatId}` : senderName || `user:${senderId}`;
  const storePath = core.channel.session.resolveStorePath(config.session?.store, {
    agentId: route.agentId,
  });
  const envelopeOptions = core.channel.reply.resolveEnvelopeFormatOptions(config);
  const previousTimestamp = core.channel.session.readSessionUpdatedAt({
    storePath,
    sessionKey: route.sessionKey,
  });
  const body = core.channel.reply.formatAgentEnvelope({
    channel: "Feishu",
    from: fromLabel,
    timestamp: message.create_time ? parseInt(message.create_time, 10) : undefined,
    previousTimestamp,
    envelope: envelopeOptions,
    body: rawBody,
  });

  const ctxPayload = core.channel.reply.finalizeInboundContext({
    Body: body,
    RawBody: rawBody,
    CommandBody: rawBody,
    From: isGroup ? `feishu:group:${chatId}` : `feishu:${senderId}`,
    To: `feishu:${chatId}`,
    SessionKey: route.sessionKey,
    AccountId: route.accountId,
    ChatType: isGroup ? "group" : "direct",
    ConversationLabel: fromLabel,
    SenderName: senderName || undefined,
    SenderId: senderId,
    CommandAuthorized: commandAuthorized,
    Provider: "feishu",
    Surface: "feishu",
    MessageSid: messageId,
    OriginatingChannel: "feishu",
    OriginatingTo: `feishu:${chatId}`,
  });

  await core.channel.session.recordInboundSession({
    storePath,
    sessionKey: ctxPayload.SessionKey ?? route.sessionKey,
    ctx: ctxPayload,
    onRecordError: (err) => {
      runtime.error?.(`feishu: failed updating session meta: ${String(err)}`);
    },
  });

  const tableMode = core.channel.text.resolveMarkdownTableMode({
    cfg: config,
    channel: "feishu",
    accountId: account.accountId,
  });

  await core.channel.reply.dispatchReplyWithBufferedBlockDispatcher({
    ctx: ctxPayload,
    cfg: config,
    dispatcherOptions: {
      deliver: async (payload) => {
        await deliverFeishuReply({
          payload,
          account,
          receiveId: replyTarget.id,
          receiveIdType: replyTarget.type,
          runtime,
          core,
          config,
          statusSink,
          tableMode,
        });
      },
      onError: (err, info) => {
        runtime.error?.(`[${account.accountId}] Feishu ${info.kind} reply failed: ${String(err)}`);
      },
    },
  });
}

async function deliverFeishuReply(params: {
  payload: { text?: string; mediaUrls?: string[]; mediaUrl?: string };
  account: ResolvedFeishuAccount;
  receiveId: string;
  receiveIdType: FeishuReceiveIdType;
  runtime: FeishuRuntimeEnv;
  core: FeishuCoreRuntime;
  config: ClawdbotConfig;
  statusSink?: (patch: { lastInboundAt?: number; lastOutboundAt?: number }) => void;
  tableMode?: MarkdownTableMode;
}): Promise<void> {
  const { payload, account, receiveId, receiveIdType, runtime, core, config, statusSink } = params;
  const tableMode = params.tableMode ?? "code";
  const text = core.channel.text.convertMarkdownTables(payload.text ?? "", tableMode);

  if (text) {
    const chunkMode = core.channel.text.resolveChunkMode(config, "feishu", account.accountId);
    const chunks = core.channel.text.chunkMarkdownTextWithMode(
      text,
      FEISHU_TEXT_LIMIT,
      chunkMode,
    );
    for (const chunk of chunks) {
      try {
        await sendMessage(
          account.appId,
          account.appSecret,
          {
            receive_id: receiveId,
            msg_type: "text",
            content: JSON.stringify({ text: chunk }),
          },
          receiveIdType,
        );
        statusSink?.({ lastOutboundAt: Date.now() });
      } catch (err) {
        runtime.error?.(`[feishu] message send failed: ${String(err)}`);
      }
    }
  }
}

/**
 * Start monitoring Feishu webhook events.
 */
export async function monitorFeishuProvider(
  options: FeishuMonitorOptions,
): Promise<FeishuMonitorResult> {
  const { account, config, runtime, abortSignal, webhookPath, statusSink } = options;

  const core = getFeishuRuntime();
  const effectiveMediaMaxMb = account.config.mediaMaxMb ?? DEFAULT_MEDIA_MAX_MB;
  const path = normalizeWebhookPath(webhookPath ?? account.config.webhookPath ?? "/feishu/callback");

  const encryptKey = account.config.encryptKey ?? process.env.FEISHU_ENCRYPT_KEY ?? "";
  const verificationToken = account.config.verificationToken ?? process.env.FEISHU_VERIFICATION_TOKEN ?? "";

  let stopped = false;
  const stopHandlers: Array<() => void> = [];

  const stop = () => {
    stopped = true;
    for (const handler of stopHandlers) {
      handler();
    }
  };

  // Register webhook target
  const unregister = registerFeishuWebhookTarget({
    account,
    config,
    runtime,
    core,
    path,
    encryptKey,
    verificationToken,
    mediaMaxMb: effectiveMediaMaxMb,
    statusSink,
  });
  stopHandlers.push(unregister);

  runtime.log?.(
    `[feishu] webhook ready: path=${path} encrypted=${Boolean(encryptKey)} token=${Boolean(
      verificationToken,
    )}`,
  );

  abortSignal.addEventListener("abort", stop, { once: true });

  return { stop };
}
