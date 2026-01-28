import type { IncomingMessage, ServerResponse } from "node:http";
import { createDecipheriv, createHash } from "node:crypto";

import * as Lark from "@larksuiteoapi/node-sdk";

import type { ClawdbotConfig } from "clawdbot/plugin-sdk";
import { resolveMentionGatingWithBypass } from "clawdbot/plugin-sdk";

import type { ResolvedFeishuAccount } from "./accounts.js";
import { sendFeishuMessage } from "./api.js";
import { getFeishuRuntime } from "./runtime.js";
import type { FeishuWebhookPayload, FeishuMessage, FeishuSender } from "./types.js";

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
  webhookUrl?: string;
  statusSink?: (patch: { lastInboundAt?: number; lastOutboundAt?: number }) => void;
};

type FeishuCoreRuntime = ReturnType<typeof getFeishuRuntime>;

type WebhookTarget = {
  account: ResolvedFeishuAccount;
  config: ClawdbotConfig;
  runtime: FeishuRuntimeEnv;
  core: FeishuCoreRuntime;
  path: string;
  statusSink?: (patch: { lastInboundAt?: number; lastOutboundAt?: number }) => void;
};

const webhookTargets = new Map<string, WebhookTarget[]>();

type FeishuLongConnectionEvent = {
  message?: FeishuMessage;
  sender?: FeishuSender;
};

function logVerbose(core: FeishuCoreRuntime, runtime: FeishuRuntimeEnv, message: string) {
  if (core.logging.shouldLogVerbose()) {
    runtime.log?.(`[feishu] ${message}`);
  }
}

function normalizeWebhookPath(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "/";
  const withSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  if (withSlash.length > 1 && withSlash.endsWith("/")) {
    return withSlash.slice(0, -1);
  }
  return withSlash;
}

function resolveWebhookPath(webhookPath?: string, webhookUrl?: string): string | null {
  const trimmedPath = webhookPath?.trim();
  if (trimmedPath) return normalizeWebhookPath(trimmedPath);
  if (webhookUrl?.trim()) {
    try {
      const parsed = new URL(webhookUrl);
      return normalizeWebhookPath(parsed.pathname || "/");
    } catch {
      return null;
    }
  }
  return "/feishu";
}

async function readJsonBody(req: IncomingMessage, maxBytes: number) {
  const chunks: Buffer[] = [];
  let total = 0;
  return await new Promise<{ ok: boolean; value?: unknown; error?: string }>((resolve) => {
    let resolved = false;
    const doResolve = (value: { ok: boolean; value?: unknown; error?: string }) => {
      if (resolved) return;
      resolved = true;
      req.removeAllListeners();
      resolve(value);
    };
    req.on("data", (chunk: Buffer) => {
      total += chunk.length;
      if (total > maxBytes) {
        doResolve({ ok: false, error: "payload too large" });
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        if (!raw.trim()) {
          doResolve({ ok: false, error: "empty payload" });
          return;
        }
        doResolve({ ok: true, value: JSON.parse(raw) as unknown });
      } catch (err) {
        doResolve({ ok: false, error: err instanceof Error ? err.message : String(err) });
      }
    });
    req.on("error", (err) => {
      doResolve({ ok: false, error: err instanceof Error ? err.message : String(err) });
    });
  });
}

function deriveEncryptKey(raw: string): Buffer {
  const buf = Buffer.from(raw, "utf8");
  if (buf.length === 32) return buf;
  return createHash("sha256").update(buf).digest();
}

function decryptFeishuPayload(encrypt: string, encryptKey: string): string {
  const key = deriveEncryptKey(encryptKey);
  const iv = key.subarray(0, 16);
  const payload = Buffer.from(encrypt, "base64");
  const decipher = createDecipheriv("aes-256-cbc", key, iv);
  const decrypted = Buffer.concat([decipher.update(payload), decipher.final()]);
  return decrypted.toString("utf8");
}

function resolveTokenFromPayload(payload: FeishuWebhookPayload): string | undefined {
  const token = payload.header?.token ?? payload.token;
  return token?.trim() || undefined;
}

function resolveAppIdFromPayload(payload: FeishuWebhookPayload): string | undefined {
  return payload.header?.app_id?.trim() || payload.app_id?.trim() || undefined;
}

export function registerFeishuWebhookTarget(target: WebhookTarget): () => void {
  const key = normalizeWebhookPath(target.path);
  const normalizedTarget = { ...target, path: key };
  const existing = webhookTargets.get(key) ?? [];
  const next = [...existing, normalizedTarget];
  webhookTargets.set(key, next);
  return () => {
    const updated = (webhookTargets.get(key) ?? []).filter((entry) => entry !== normalizedTarget);
    if (updated.length > 0) {
      webhookTargets.set(key, updated);
    } else {
      webhookTargets.delete(key);
    }
  };
}

function matchesTarget(payload: FeishuWebhookPayload, target: WebhookTarget): boolean {
  const account = target.account;
  const appId = resolveAppIdFromPayload(payload);
  if (account.appId && appId && account.appId !== appId) return false;
  const token = resolveTokenFromPayload(payload);
  if (account.verificationToken && token && account.verificationToken !== token) return false;
  return true;
}

function normalizeAllowEntry(entry: string): string {
  return entry
    .trim()
    .replace(/^(feishu|lark):/i, "")
    .replace(/^(user_id|open_id|union_id):/i, "")
    .replace(/^user:/i, "")
    .toLowerCase();
}

function resolveSenderIds(sender?: FeishuSender): {
  primary?: string;
  ids: string[];
  rawUserId?: string;
  rawOpenId?: string;
} {
  const userId = sender?.sender_id?.user_id?.trim() || "";
  const openId = sender?.sender_id?.open_id?.trim() || "";
  const unionId = sender?.sender_id?.union_id?.trim() || "";
  const ids = [userId, openId, unionId].filter(Boolean);
  return {
    primary: ids[0],
    ids,
    rawUserId: userId || undefined,
    rawOpenId: openId || undefined,
  };
}

function isSenderAllowed(allowFrom: Array<string | number>, senderIds: string[]): boolean {
  if (allowFrom.includes("*")) return true;
  const normalizedAllow = allowFrom
    .map((entry) => normalizeAllowEntry(String(entry)))
    .filter(Boolean);
  const normalizedSender = senderIds.map((id) => normalizeAllowEntry(id)).filter(Boolean);
  return normalizedAllow.some((entry) => normalizedSender.includes(entry));
}

function normalizeGroupAllowEntry(entry: string): string {
  return entry
    .trim()
    .replace(/^(feishu|lark):/i, "")
    .replace(/^(chat_id|chat):/i, "")
    .toLowerCase();
}

function isGroupAllowed(allowFrom: Array<string | number>, chatId: string): boolean {
  if (allowFrom.includes("*")) return true;
  const normalized = allowFrom
    .map((entry) => normalizeGroupAllowEntry(String(entry)))
    .filter(Boolean);
  return normalized.includes(normalizeGroupAllowEntry(chatId));
}

function buildPairingId(params: { userId?: string; openId?: string; fallback?: string }): string {
  if (params.userId) return `user_id:${params.userId}`;
  if (params.openId) return `open_id:${params.openId}`;
  return params.fallback ?? "";
}

function parseFeishuText(message: FeishuMessage): string {
  const content = message.content?.trim();
  if (!content) return "";
  try {
    const payload = JSON.parse(content) as {
      text?: string;
      title?: string;
      content?: Array<Array<{ tag?: string; text?: string }>>;
    };
    if (payload.text?.trim()) return payload.text.trim();
    if (message.message_type === "post" && Array.isArray(payload.content)) {
      const parts: string[] = [];
      for (const row of payload.content) {
        if (!Array.isArray(row)) continue;
        for (const cell of row) {
          if (cell?.tag === "text" && cell.text?.trim()) {
            parts.push(cell.text.trim());
          }
        }
      }
      const joined = parts.join(" ").trim();
      if (joined) return joined;
      if (payload.title?.trim()) return payload.title.trim();
    }
    return "";
  } catch {
    return "";
  }
}

export async function handleFeishuWebhookRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  const url = new URL(req.url ?? "/", "http://localhost");
  const path = normalizeWebhookPath(url.pathname);
  const targets = webhookTargets.get(path);
  if (!targets || targets.length === 0) return false;

  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Allow", "POST");
    res.end("Method Not Allowed");
    return true;
  }

  const body = await readJsonBody(req, 1024 * 1024);
  if (!body.ok) {
    res.statusCode = body.error === "payload too large" ? 413 : 400;
    res.end(body.error ?? "invalid payload");
    return true;
  }

  let rawPayload = body.value;
  if (!rawPayload || typeof rawPayload !== "object" || Array.isArray(rawPayload)) {
    res.statusCode = 400;
    res.end("invalid payload");
    return true;
  }

  const candidate = rawPayload as FeishuWebhookPayload;

  let selected: WebhookTarget | undefined;
  let payload: FeishuWebhookPayload | undefined;

  if (candidate.encrypt) {
    for (const target of targets) {
      const encryptKey = target.account.encryptKey;
      if (!encryptKey) continue;
      try {
        const decrypted = decryptFeishuPayload(candidate.encrypt, encryptKey);
        const decoded = JSON.parse(decrypted) as FeishuWebhookPayload;
        if (!matchesTarget(decoded, target)) continue;
        selected = target;
        payload = decoded;
        break;
      } catch {
        continue;
      }
    }
    if (!selected || !payload) {
      res.statusCode = 401;
      res.end("unauthorized");
      return true;
    }
  } else {
    for (const target of targets) {
      if (!matchesTarget(candidate, target)) continue;
      selected = target;
      payload = candidate;
      break;
    }
    if (!selected || !payload) {
      res.statusCode = 401;
      res.end("unauthorized");
      return true;
    }
  }

  if (payload.type === "url_verification") {
    const token = resolveTokenFromPayload(payload);
    if (selected.account.verificationToken && token !== selected.account.verificationToken) {
      res.statusCode = 401;
      res.end("unauthorized");
      return true;
    }
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ challenge: payload.challenge ?? "" }));
    return true;
  }

  selected.statusSink?.({ lastInboundAt: Date.now() });
  processFeishuEvent(payload, selected).catch((err) => {
    selected?.runtime.error?.(
      `[${selected.account.accountId}] Feishu webhook failed: ${String(err)}`,
    );
  });

  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  res.end("{}");
  return true;
}

async function processFeishuEvent(payload: FeishuWebhookPayload, target: WebhookTarget) {
  const eventType = payload.header?.event_type;
  if (eventType !== "im.message.receive_v1") return;
  const event = payload.event;
  if (!event?.message || !event.sender) return;
  await processMessageWithPipeline({
    message: event.message,
    sender: event.sender,
    account: target.account,
    config: target.config,
    runtime: target.runtime,
    core: target.core,
    statusSink: target.statusSink,
  });
}

async function processMessageWithPipeline(params: {
  message: FeishuMessage;
  sender: FeishuSender;
  account: ResolvedFeishuAccount;
  config: ClawdbotConfig;
  runtime: FeishuRuntimeEnv;
  core: FeishuCoreRuntime;
  statusSink?: (patch: { lastInboundAt?: number; lastOutboundAt?: number }) => void;
}) {
  const { message, sender, account, config, runtime, core, statusSink } = params;

  const chatId = message.chat_id?.trim() ?? "";
  if (!chatId) return;
  const chatType = (message.chat_type ?? "").toLowerCase();
  const isGroup = chatType !== "p2p";

  const senderIds = resolveSenderIds(sender);
  const senderId = senderIds.primary ?? "";
  if (!senderId) return;

  const allowBots = account.config.allowBots === true;
  if (!allowBots && sender.sender_type?.toLowerCase() === "bot") {
    logVerbose(core, runtime, `skip bot-authored message (${senderId})`);
    return;
  }

  const rawBody = parseFeishuText(message);
  if (!rawBody) return;

  const defaultGroupPolicy = config.channels?.defaults?.groupPolicy;
  const groupPolicy = account.config.groupPolicy ?? defaultGroupPolicy ?? "allowlist";
  const groupAllowFrom = (account.config.groupAllowFrom ?? []).map((v) => String(v));
  if (isGroup) {
    if (groupPolicy === "disabled") {
      logVerbose(core, runtime, `drop group message (groupPolicy=disabled, chat=${chatId})`);
      return;
    }
    if (groupPolicy === "allowlist") {
      if (groupAllowFrom.length === 0) {
        logVerbose(core, runtime, `drop group message (no group allowlist, chat=${chatId})`);
        return;
      }
      if (!isGroupAllowed(groupAllowFrom, chatId)) {
        logVerbose(core, runtime, `drop group message (not allowlisted, chat=${chatId})`);
        return;
      }
    }
  }

  const dmPolicy = account.config.dmPolicy ?? "pairing";
  const configAllowFrom = (account.config.allowFrom ?? []).map((v) => String(v));
  const shouldComputeAuth = core.channel.commands.shouldComputeCommandAuthorized(rawBody, config);
  const storeAllowFrom =
    !isGroup && (dmPolicy !== "open" || shouldComputeAuth)
      ? await core.channel.pairing.readAllowFromStore("feishu").catch(() => [])
      : [];
  const effectiveAllowFrom = [...configAllowFrom, ...storeAllowFrom];
  const senderAllowedForCommands = isSenderAllowed(effectiveAllowFrom, senderIds.ids);
  const commandAuthorized = shouldComputeAuth
    ? core.channel.commands.resolveCommandAuthorizedFromAuthorizers({
        useAccessGroups: config.commands?.useAccessGroups !== false,
        authorizers: [
          { configured: effectiveAllowFrom.length > 0, allowed: senderAllowedForCommands },
        ],
      })
    : undefined;

  let effectiveWasMentioned = false;
  if (isGroup) {
    const mentions = message.mentions ?? [];
    const hasAnyMention = mentions.length > 0;
    const wasMentioned = hasAnyMention;
    const requireMention = account.config.requireMention ?? false;
    const allowTextCommands = core.channel.commands.shouldHandleTextCommands({
      cfg: config,
      surface: "feishu",
    });
    const mentionGate = resolveMentionGatingWithBypass({
      isGroup: true,
      requireMention,
      canDetectMention: true,
      wasMentioned,
      implicitMention: false,
      hasAnyMention,
      allowTextCommands,
      hasControlCommand: core.channel.text.hasControlCommand(rawBody, config),
      commandAuthorized: commandAuthorized === true,
    });
    effectiveWasMentioned = mentionGate.effectiveWasMentioned;
    if (mentionGate.shouldSkip) {
      logVerbose(core, runtime, `drop group message (mention required, chat=${chatId})`);
      return;
    }
  }

  if (!isGroup) {
    if (dmPolicy === "disabled") {
      logVerbose(core, runtime, `blocked DM from ${senderId} (dmPolicy=disabled)`);
      return;
    }
    if (dmPolicy !== "open" && !senderAllowedForCommands) {
      if (dmPolicy === "pairing") {
        const pairingId = buildPairingId({
          userId: senderIds.rawUserId,
          openId: senderIds.rawOpenId,
          fallback: senderId,
        });
        const { code, created } = await core.channel.pairing.upsertPairingRequest({
          channel: "feishu",
          id: pairingId,
          meta: {},
        });
        if (created) {
          logVerbose(core, runtime, `feishu pairing request sender=${pairingId}`);
          try {
            await sendFeishuMessage({
              account,
              receiveIdType: "chat_id",
              receiveId: chatId,
              text: core.channel.pairing.buildPairingReply({
                channel: "feishu",
                idLine: `Your Feishu user id: ${pairingId}`,
                code,
              }),
            });
            statusSink?.({ lastOutboundAt: Date.now() });
          } catch (err) {
            logVerbose(core, runtime, `pairing reply failed for ${pairingId}: ${String(err)}`);
          }
        }
      }
      return;
    }
  }

  if (
    isGroup &&
    core.channel.commands.isControlCommandMessage(rawBody, config) &&
    commandAuthorized !== true
  ) {
    logVerbose(core, runtime, `feishu: drop control command from ${senderId}`);
    return;
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

  const fromLabel = isGroup ? `chat:${chatId}` : `user:${senderId}`;
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
    previousTimestamp,
    envelope: envelopeOptions,
    body: rawBody,
  });

  const ctxPayload = core.channel.reply.finalizeInboundContext({
    Body: body,
    RawBody: rawBody,
    CommandBody: rawBody,
    From: `feishu:${senderId}`,
    To: `feishu:${chatId}`,
    SessionKey: route.sessionKey,
    AccountId: route.accountId,
    ChatType: isGroup ? "channel" : "direct",
    ConversationLabel: fromLabel,
    SenderId: senderId,
    WasMentioned: isGroup ? effectiveWasMentioned : undefined,
    CommandAuthorized: commandAuthorized,
    Provider: "feishu",
    Surface: "feishu",
    MessageSid: message.message_id,
    MessageSidFull: message.message_id,
    ReplyToId: message.message_id,
    ReplyToIdFull: message.message_id,
    GroupSpace: isGroup ? chatId : undefined,
    OriginatingChannel: "feishu",
    OriginatingTo: `feishu:${chatId}`,
  });

  void core.channel.session
    .recordSessionMetaFromInbound({
      storePath,
      sessionKey: ctxPayload.SessionKey ?? route.sessionKey,
      ctx: ctxPayload,
    })
    .catch((err) => {
      runtime.error?.(`feishu: failed updating session meta: ${String(err)}`);
    });

  await core.channel.reply.dispatchReplyWithBufferedBlockDispatcher({
    ctx: ctxPayload,
    cfg: config,
    dispatcherOptions: {
      deliver: async (payload) => {
        await deliverFeishuReply({
          payload,
          account,
          chatId,
          runtime,
          statusSink,
        });
      },
      onError: (err, info) => {
        runtime.error?.(`[${account.accountId}] Feishu ${info.kind} reply failed: ${String(err)}`);
      },
    },
  });
}

async function deliverFeishuReply(params: {
  payload: { text?: string; mediaUrls?: string[]; mediaUrl?: string; replyToId?: string };
  account: ResolvedFeishuAccount;
  chatId: string;
  runtime: FeishuRuntimeEnv;
  statusSink?: (patch: { lastInboundAt?: number; lastOutboundAt?: number }) => void;
}) {
  const { payload, account, chatId, runtime, statusSink } = params;
  const mediaList = payload.mediaUrls?.length
    ? payload.mediaUrls
    : payload.mediaUrl
      ? [payload.mediaUrl]
      : [];

  let text = payload.text?.trim() ?? "";
  if (!text && mediaList.length > 0) {
    text = mediaList.length === 1 ? `Attachment: ${mediaList[0]}` : mediaList.join("\n");
  }
  if (!text) return;

  await sendFeishuMessage({
    account,
    receiveIdType: "chat_id",
    receiveId: chatId,
    text,
  });
  statusSink?.({ lastOutboundAt: Date.now() });
  logVerbose(getFeishuRuntime(), runtime, `sent reply to chat ${chatId}`);
}

async function monitorFeishuProvider(options: FeishuMonitorOptions): Promise<() => void> {
  const core = getFeishuRuntime();
  const webhookPath = resolveWebhookPath(options.webhookPath, options.webhookUrl);
  if (!webhookPath) {
    options.runtime.error?.(`[${options.account.accountId}] invalid webhook path`);
    return () => {};
  }

  const unregister = registerFeishuWebhookTarget({
    account: options.account,
    config: options.config,
    runtime: options.runtime,
    core,
    path: webhookPath,
    statusSink: options.statusSink,
  });

  return unregister;
}

export async function startFeishuLongConnection(options: FeishuMonitorOptions): Promise<() => void> {
  const { account, config, runtime, statusSink, abortSignal } = options;
  const appId = account.appId;
  const appSecret = account.appSecret;
  if (!appId || !appSecret) {
    runtime.error?.(`[${account.accountId}] missing appId/appSecret for long connection`);
    return () => {};
  }

  const core = getFeishuRuntime();
  const dispatcher = new Lark.EventDispatcher({}).register({
    "im.message.receive_v1": async (data: FeishuLongConnectionEvent) => {
      if (!data?.message || !data?.sender) return;
      statusSink?.({ lastInboundAt: Date.now() });
      try {
        await processMessageWithPipeline({
          message: data.message,
          sender: data.sender,
          account,
          config,
          runtime,
          core,
          statusSink,
        });
      } catch (err) {
        runtime.error?.(`[${account.accountId}] Feishu long connection failed: ${String(err)}`);
      }
    },
  });

  const wsClient = new Lark.WSClient({
    appId,
    appSecret,
  });

  wsClient.start({ eventDispatcher: dispatcher });

  const stopClient = () => {
    const stop = (wsClient as { stop?: () => void }).stop;
    if (typeof stop === "function") stop();
    const close = (wsClient as { close?: () => void }).close;
    if (typeof close === "function") close();
  };

  const onAbort = () => stopClient();
  abortSignal.addEventListener("abort", onAbort, { once: true });

  return () => {
    abortSignal.removeEventListener("abort", onAbort);
    stopClient();
  };
}

export async function startFeishuMonitor(params: FeishuMonitorOptions): Promise<() => void> {
  return monitorFeishuProvider(params);
}

export function resolveFeishuWebhookPath(params: { account: ResolvedFeishuAccount }): string {
  return resolveWebhookPath(
    params.account.config.webhookPath,
    params.account.config.webhookUrl,
  ) ?? "/feishu";
}
