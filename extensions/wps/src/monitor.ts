import type { Request, Response } from "express";
import type { ClawdbotConfig, RuntimeEnv } from "clawdbot/plugin-sdk";
import * as crypto from "crypto";
import { resolveWpsCredentials } from "./token.js";
import type { WpsConfig } from "./types.js";
import { getWpsRuntime } from "./runtime.js";
import { createWpsSimpleDispatcher, createWpsReplyDispatcher } from "./reply-dispatcher.js";

export type MonitorWpsOpts = {
  cfg: ClawdbotConfig;
  runtime?: RuntimeEnv;
  abortSignal?: AbortSignal;
};

export type MonitorWpsResult = {
  app: unknown;
  shutdown: () => Promise<void>;
};

/**
 * WPS encrypted event structure
 * Reference: https://open.wps.cn/documents/app-integration-dev/wps365/server/event-subscription/security-verification
 */
type WpsEncryptedEvent = {
  topic: string;           // 消息主题
  operation: string;       // 消息变更动作
  time: number;            // 时间戳（秒）
  nonce: string;           // IV 向量
  signature: string;       // 消息签名
  encrypted_data: string;  // 加密数据
};

/**
 * WPS decrypted event payload structure (actual format from webhook)
 * Reference: https://open.wps.cn/documents/app-integration-dev/wps365/server/im/event/receive-msg
 */
type WpsEventPayload = {
  chat?: {
    id?: string;
    type?: string; // "p2p" for DM, "group" for group chat
  };
  message?: {
    id?: string;
    type?: string; // "text", etc.
    content?: {
      text?: string | { content?: string };
    };
  };
  sender?: {
    id?: string;
    type?: string; // "user"
    name?: string;
  };
  send_time?: number;
  company_id?: string;
};

/**
 * Verify WPS event signature using HMAC-SHA256
 * content = "appId:topic:nonce:time:encrypted_data"
 * signature = base64url_no_padding(HMAC-SHA256(appSecret, content))
 */
function verifySignature(params: {
  appId: string;
  appSecret: string;
  topic: string;
  nonce: string;
  time: number;
  encryptedData: string;
  signature: string;
}): boolean {
  const content = `${params.appId}:${params.topic}:${params.nonce}:${params.time}:${params.encryptedData}`;
  const hmac = crypto.createHmac("sha256", params.appSecret);
  hmac.update(content);
  // URL-safe base64 without padding
  const expected = hmac.digest("base64url").replace(/=+$/, "");
  return expected === params.signature;
}

/**
 * Decrypt WPS event data using AES-256-CBC
 * cipher = MD5(appSecret) hex string -> 32 bytes (used as AES-256 key)
 * iv = nonce (UTF-8, first 16 bytes)
 * PKCS7 padding is handled by Node.js crypto
 */
function decryptEventData(encryptedData: string, appSecret: string, nonce: string): string {
  // cipher = MD5(appSecret) as hex string (32 chars = 32 bytes for AES-256)
  const cipherHex = crypto.createHash("md5").update(appSecret).digest("hex");
  const key = Buffer.from(cipherHex, "utf-8");
  // iv = nonce as UTF-8, take first 16 bytes (AES block size)
  const iv = Buffer.from(nonce, "utf-8").subarray(0, 16);
  const encrypted = Buffer.from(encryptedData, "base64");

  // AES-256-CBC because key is 32 bytes (MD5 hex string)
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString("utf-8");
}

function normalizeAllowEntry(entry: string): string {
  // WPS IDs are case-sensitive, do not convert to lowercase
  return entry.trim().replace(/^wps:/i, "");
}

function isAllowed(senderId: string, allowFrom: string[], dmPolicy: string): boolean {
  if (dmPolicy === "open") return true;
  if (!allowFrom || allowFrom.length === 0) return dmPolicy !== "allowlist";

  const normalizedSender = normalizeAllowEntry(senderId);
  return allowFrom.some((entry) => {
    if (entry === "*") return true;
    return normalizeAllowEntry(entry) === normalizedSender;
  });
}

/**
 * Check if the request body is an encrypted WPS event
 */
function isEncryptedEvent(body: unknown): body is WpsEncryptedEvent {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.encrypted_data === "string" &&
    typeof b.nonce === "string" &&
    typeof b.signature === "string" &&
    typeof b.topic === "string" &&
    typeof b.time === "number"
  );
}

export async function monitorWpsProvider(opts: MonitorWpsOpts): Promise<MonitorWpsResult> {
  const log = opts.runtime?.log ?? console.log;
  const errorLog = opts.runtime?.error ?? console.error;
  const cfg = opts.cfg;
  const wpsCfg = cfg.channels?.wps as WpsConfig | undefined;

  if (!wpsCfg?.enabled) {
    log("WPS provider disabled");
    return { app: null, shutdown: async () => {} };
  }

  const creds = resolveWpsCredentials(wpsCfg);
  if (!creds) {
    errorLog("WPS credentials not configured (appId, appSecret, and companyId required)");
    return { app: null, shutdown: async () => {} };
  }

  const express = await import("express");
  const app = express.default();
  app.use(express.json());

  const port = wpsCfg.webhook?.port ?? 3000;
  const path = wpsCfg.webhook?.path ?? "/wps/webhook";
  const dmPolicy = wpsCfg.dmPolicy ?? "pairing";
  const allowFrom = wpsCfg.allowFrom ?? [];
  const enableEncryption = wpsCfg.enableEncryption !== false; // Default to true

  app.post(path, async (req: Request, res: Response) => {
    try {
      // Handle challenge verification request (webhook URL validation)
      const body = req.body as Record<string, unknown>;
      if (typeof body.challenge === "string") {
        log("WPS webhook challenge verification");
        res.status(200).json({ challenge: body.challenge });
        return;
      }

      let eventPayload: WpsEventPayload;

      // Check if this is an encrypted event
      if (enableEncryption && isEncryptedEvent(req.body)) {
        const encryptedBody = req.body as WpsEncryptedEvent;

        // 1. Verify signature
        const isValid = verifySignature({
          appId: creds.appId,
          appSecret: creds.appSecret,
          topic: encryptedBody.topic,
          nonce: encryptedBody.nonce,
          time: encryptedBody.time,
          encryptedData: encryptedBody.encrypted_data,
          signature: encryptedBody.signature,
        });

        if (!isValid) {
          errorLog("WPS signature verification failed");
          res.status(403).json({ code: -1, msg: "Invalid signature" });
          return;
        }

        // 2. Decrypt data
        try {
          const decrypted = decryptEventData(
            encryptedBody.encrypted_data,
            creds.appSecret,
            encryptedBody.nonce
          );
          eventPayload = JSON.parse(decrypted) as WpsEventPayload;
          log(`WPS decrypted event: topic=${encryptedBody.topic}, operation=${encryptedBody.operation}`);
        } catch (err) {
          errorLog("WPS decryption failed:", err);
          res.status(400).json({ code: -1, msg: "Decryption failed" });
          return;
        }
      } else {
        // Non-encrypted event (or encryption disabled)
        eventPayload = req.body as WpsEventPayload;
      }
      // WPS event subscription callback - handle message payload directly
      const message = eventPayload.message;
      const sender = eventPayload.sender;
      const chat = eventPayload.chat;

      if (!message || !sender) {
        // Not a valid message payload, might be a health check or other event
        res.status(200).json({ code: 0, msg: "ok" });
        return;
      }

      // Extract text from message content (can be string or { content: string })
      const textContent = message.content?.text;
      const text = typeof textContent === "string"
        ? textContent
        : (textContent?.content ?? "");
      const fromId = sender.id ?? "";
      const chatId = chat?.id ?? "";
      const chatType = chat?.type;

      if (!fromId) {
        errorLog("Unable to identify sender");
        res.status(200).json({ code: 0, msg: "ok" });
        return;
      }

      const senderKey = fromId;
      // "p2p" for DM, "group" for group chat
      const isDirect = chatType === "single" || chatType === "p2p" || chatType === "direct";
      // Encode receiver type in channelId: "user:xxx" for DM, "chat:xxx" for group
      const channelId = isDirect ? `user:${fromId}` : `chat:${chatId}`;

      log(`WPS received message from ${senderKey}: ${text.substring(0, 50)}`);

      // Respond immediately to avoid webhook timeout, then process asynchronously
      res.status(200).json({ code: 0, msg: "ok" });

      // Process message asynchronously
      void (async () => {
        try {
          if (isDirect && !isAllowed(senderKey, allowFrom, dmPolicy)) {
            log(`Sender ${senderKey} not in allowFrom list (policy: ${dmPolicy})`);

            if (dmPolicy === "pairing") {
              const core = getWpsRuntime();
              const { code, created } = await core.channel.pairing.upsertPairingRequest({
                channel: "wps",
                id: senderKey,
              });

              if (code && created) {
                const pairingText = core.channel.pairing.buildPairingReply({
                  channel: "wps",
                  idLine: `Your WPS user id: ${senderKey}`,
                  code,
                });
                const simpleDispatcher = createWpsSimpleDispatcher({ cfg, channelId });
                await simpleDispatcher.dispatch({ body: pairingText });
              }
            }
            return;
          }

          const core = getWpsRuntime();
          const route = core.channel.routing.resolveAgentRoute({
            cfg,
            channel: "wps",
            peer: {
              kind: isDirect ? "dm" : "group",
              id: channelId,
            },
          });

          const ctxPayload = core.channel.reply.finalizeInboundContext({
            Body: text,
            RawBody: text,
            CommandBody: text,
            From: `wps:${senderKey}`,
            To: `wps:${creds.appId}`,
            SessionKey: route.sessionKey,
            AccountId: creds.appId,
            ChatType: isDirect ? "direct" : "group",
            SenderName: sender.name ?? "WPS User",
            SenderId: senderKey,
            Provider: "wps",
            Surface: "wps",
            Timestamp: eventPayload.send_time ?? Date.now(),
            OriginatingChannel: "wps",
            OriginatingTo: `wps:${creds.appId}`,
          });

          const { dispatcher, replyOptions, markDispatchIdle } = createWpsReplyDispatcher({
            cfg,
            agentId: route.agentId,
            runtime: opts.runtime,
            channelId,
          });

          await core.channel.reply.dispatchReplyFromConfig({
            ctx: ctxPayload,
            cfg,
            dispatcher,
            replyOptions,
          });

          markDispatchIdle();
        } catch (asyncErr) {
          errorLog("WPS async message processing error:", asyncErr);
        }
      })();
    } catch (err) {
      errorLog("WPS webhook error:", err);
      res.status(500).json({ code: -1, msg: "Internal Error" });
    }
  });

  let server: ReturnType<typeof app.listen> | null = null;

  const startServer = () => {
    server = app.listen(port, () => {
      log(`WPS provider listening on port ${port} at ${path}`);
    });
  };

  startServer();

  if (opts.abortSignal) {
    opts.abortSignal.addEventListener("abort", () => {
      if (server) {
        server.close();
        server = null;
      }
    });
  }

  return {
    app,
    shutdown: async () => {
      if (server) {
        server.close();
        server = null;
      }
    },
  };
}
