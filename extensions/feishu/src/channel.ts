import type { ChannelPlugin, ClawdbotConfig } from "clawdbot/plugin-sdk";
import {
  buildChannelConfigSchema,
  DEFAULT_ACCOUNT_ID,
  formatPairingApproveHint,
  missingTargetError,
  PAIRING_APPROVED_MESSAGE,
} from "clawdbot/plugin-sdk";

import { FeishuConfigSchema } from "./config-schema.js";
import {
  resolveFeishuAccount,
  resolveDefaultFeishuAccountId,
  type ResolvedFeishuAccount,
} from "./accounts.js";
import { probeFeishu, sendFeishuMessage } from "./api.js";
import { getFeishuRuntime } from "./runtime.js";
import { resolveFeishuWebhookPath, startFeishuLongConnection, startFeishuMonitor } from "./monitor.js";

const meta = {
  id: "feishu",
  label: "Feishu",
  selectionLabel: "Feishu (App Bot)",
  detailLabel: "Feishu Bot",
  docsPath: "/channels/feishu",
  docsLabel: "feishu",
  blurb: "Feishu/Lark app bot via event subscription.",
  aliases: ["lark"],
  order: 66,
  systemImage: "bubble.left.and.bubble.right",
  quickstartAllowFrom: true,
} as const;

function normalizeAllowEntry(entry: string): string {
  return entry
    .trim()
    .replace(/^(feishu|lark):/i, "")
    .replace(/^(user_id|open_id|union_id):/i, "")
    .replace(/^user:/i, "")
    .toLowerCase();
}

function resolveRecipientFromId(raw: string): { type: "user_id" | "open_id"; id: string } | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(/^(feishu|lark):/i, "");
  if (/^open_id:/i.test(normalized)) {
    const id = normalized.replace(/^open_id:/i, "").trim();
    return id ? { type: "open_id", id } : null;
  }
  if (/^user_id:/i.test(normalized)) {
    const id = normalized.replace(/^user_id:/i, "").trim();
    return id ? { type: "user_id", id } : null;
  }
  if (/^user:/i.test(normalized)) {
    const id = normalized.replace(/^user:/i, "").trim();
    return id ? { type: "user_id", id } : null;
  }
  return { type: "user_id", id: normalized };
}

function resolveOutboundTarget(raw?: string | null): { type: "chat_id" | "user_id" | "open_id"; id: string } | null {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) return null;
  const normalized = trimmed.replace(/^(feishu|lark):/i, "");
  if (/^(chat_id|chat):/i.test(normalized)) {
    const id = normalized.replace(/^(chat_id|chat):/i, "").trim();
    return id ? { type: "chat_id", id } : null;
  }
  if (/^open_id:/i.test(normalized)) {
    const id = normalized.replace(/^open_id:/i, "").trim();
    return id ? { type: "open_id", id } : null;
  }
  if (/^(user_id|user):/i.test(normalized)) {
    const id = normalized.replace(/^(user_id|user):/i, "").trim();
    return id ? { type: "user_id", id } : null;
  }
  return { type: "chat_id", id: normalized };
}

export const feishuPlugin: ChannelPlugin<ResolvedFeishuAccount> = {
  id: "feishu",
  meta: {
    ...meta,
  },
  pairing: {
    idLabel: "feishuUserId",
    normalizeAllowEntry: (entry) => normalizeAllowEntry(entry),
    notifyApproval: async ({ cfg, id }) => {
      const account = resolveFeishuAccount({ cfg: cfg as ClawdbotConfig });
      if (!account.configured) return;
      const recipient = resolveRecipientFromId(id);
      if (!recipient) return;
      await sendFeishuMessage({
        account,
        receiveIdType: recipient.type,
        receiveId: recipient.id,
        text: PAIRING_APPROVED_MESSAGE,
      });
    },
  },
  capabilities: {
    chatTypes: ["direct", "group"],
    reactions: false,
    media: false,
    threads: false,
    nativeCommands: false,
    blockStreaming: true,
  },
  streaming: {
    blockStreamingCoalesceDefaults: { minChars: 1500, idleMs: 1000 },
  },
  reload: { configPrefixes: ["channels.feishu"] },
  configSchema: {
    ...buildChannelConfigSchema(FeishuConfigSchema),
    uiHints: {
      appId: { label: "App ID" },
      appSecret: { label: "App Secret", sensitive: true },
      verificationToken: { label: "Verification Token", sensitive: true },
      encryptKey: { label: "Encrypt Key", sensitive: true, advanced: true },
      eventMode: { label: "Event Delivery", help: 'Use "long-connection" for app bot DMs.' },
      webhookPath: { label: "Webhook Path", placeholder: "/feishu" },
      webhookUrl: { label: "Webhook URL", advanced: true },
      dmPolicy: { label: "DM Policy" },
      allowFrom: { label: "DM Allowlist", itemTemplate: "user_id:..." },
      groupAllowFrom: { label: "Group Allowlist", itemTemplate: "chat_id:..." },
    },
  },
  config: {
    listAccountIds: () => [DEFAULT_ACCOUNT_ID],
    resolveAccount: (cfg, accountId) => resolveFeishuAccount({ cfg: cfg as ClawdbotConfig, accountId }),
    defaultAccountId: () => resolveDefaultFeishuAccountId(),
    setAccountEnabled: ({ cfg, enabled }) => ({
      ...cfg,
      channels: {
        ...cfg.channels,
        feishu: {
          ...(cfg.channels?.feishu ?? {}),
          enabled,
        },
      },
    }),
    deleteAccount: ({ cfg }) => {
      const next = { ...cfg } as ClawdbotConfig;
      const nextChannels = { ...cfg.channels };
      delete nextChannels.feishu;
      if (Object.keys(nextChannels).length > 0) {
        next.channels = nextChannels;
      } else {
        delete next.channels;
      }
      return next;
    },
    isConfigured: (account) => account.configured,
    describeAccount: (account) => ({
      accountId: account.accountId,
      name: account.name,
      enabled: account.enabled,
      configured: account.configured,
      appId: account.appId,
      eventMode: account.config.eventMode ?? "webhook",
      webhookPath: account.config.webhookPath,
      webhookUrl: account.config.webhookUrl,
    }),
    resolveAllowFrom: ({ cfg }) => (cfg.channels?.feishu?.allowFrom ?? []).map((entry) => String(entry)),
    formatAllowFrom: ({ allowFrom }) =>
      allowFrom
        .map((entry) => normalizeAllowEntry(String(entry)))
        .filter(Boolean),
  },
  security: {
    resolveDmPolicy: ({ cfg, account }) => {
      const basePath = "channels.feishu.";
      return {
        policy: account.config.dmPolicy ?? "pairing",
        allowFrom: account.config.allowFrom ?? [],
        policyPath: `${basePath}dmPolicy`,
        allowFromPath: `${basePath}allowFrom`,
        approveHint: formatPairingApproveHint("feishu"),
        normalizeEntry: (raw) => normalizeAllowEntry(raw),
      };
    },
    collectWarnings: ({ account, cfg }) => {
      const defaultGroupPolicy = cfg.channels?.defaults?.groupPolicy;
      const groupPolicy = account.config.groupPolicy ?? defaultGroupPolicy ?? "allowlist";
      if (groupPolicy !== "open") return [];
      return [
        `- Feishu groups: groupPolicy="open" allows any member to trigger (mention-gated). Set channels.feishu.groupPolicy="allowlist" + channels.feishu.groupAllowFrom to restrict senders.`,
      ];
    },
  },
  groups: {
    resolveRequireMention: ({ cfg }) => cfg.channels?.feishu?.requireMention ?? false,
  },
  outbound: {
    deliveryMode: "direct",
    chunker: (text, limit) => getFeishuRuntime().channel.text.chunkText(text, limit),
    chunkerMode: "text",
    textChunkLimit: 4000,
    resolveTarget: ({ to, allowFrom, mode }) => {
      const trimmed = to?.trim() ?? "";
      if (trimmed) {
        const target = resolveOutboundTarget(trimmed);
        if (target) return { ok: true, to: `${target.type}:${target.id}` };
      }
      const allowListRaw = (allowFrom ?? [])
        .map((entry) => String(entry).trim())
        .filter((entry) => entry && entry !== "*");
      const allowTarget = allowListRaw[0];
      if (allowTarget) {
        const target =
          resolveOutboundTarget(allowTarget) ?? resolveOutboundTarget(`user_id:${allowTarget}`);
        if (target) return { ok: true, to: `${target.type}:${target.id}` };
      }
      if (mode === "implicit" || mode === "heartbeat") {
        return {
          ok: false,
          error: missingTargetError(
            "Feishu",
            "<chat_id:ID|user_id:ID|open_id:ID> or channels.feishu.allowFrom[0]",
          ),
        };
      }
      return {
        ok: false,
        error: missingTargetError(
          "Feishu",
          "<chat_id:ID|user_id:ID|open_id:ID> or channels.feishu.allowFrom[0]",
        ),
      };
    },
    sendText: async ({ cfg, to, text }) => {
      const account = resolveFeishuAccount({ cfg: cfg as ClawdbotConfig });
      const target = resolveOutboundTarget(to);
      if (!target) {
        throw new Error("Feishu target missing");
      }
      const result = await sendFeishuMessage({
        account,
        receiveIdType: target.type,
        receiveId: target.id,
        text,
      });
      return {
        channel: "feishu",
        messageId: result?.messageId ?? "",
        chatId: target.id,
      };
    },
  },
  status: {
    probeAccount: async ({ account }) => probeFeishu(account),
    buildAccountSnapshot: ({ account, runtime, probe }) => ({
      accountId: account.accountId,
      name: account.name,
      enabled: account.enabled,
      configured: account.configured,
      appId: account.appId,
      webhookPath: account.config.webhookPath,
      webhookUrl: account.config.webhookUrl,
      running: runtime?.running ?? false,
      lastStartAt: runtime?.lastStartAt ?? null,
      lastStopAt: runtime?.lastStopAt ?? null,
      lastError: runtime?.lastError ?? null,
      lastInboundAt: runtime?.lastInboundAt ?? null,
      lastOutboundAt: runtime?.lastOutboundAt ?? null,
      probe,
    }),
  },
  gateway: {
    startAccount: async (ctx) => {
      const account = ctx.account;
      const eventMode = account.config.eventMode ?? "webhook";
      ctx.log?.info(`[${account.accountId}] starting Feishu ${eventMode}`);
      ctx.setStatus({
        accountId: account.accountId,
        running: true,
        lastStartAt: Date.now(),
        eventMode,
        webhookPath: eventMode === "webhook" ? resolveFeishuWebhookPath({ account }) : undefined,
      });
      const unregister =
        eventMode === "long-connection"
          ? await startFeishuLongConnection({
              account,
              config: ctx.cfg as ClawdbotConfig,
              runtime: ctx.runtime,
              abortSignal: ctx.abortSignal,
              webhookPath: account.config.webhookPath,
              webhookUrl: account.config.webhookUrl,
              statusSink: (patch) => ctx.setStatus({ accountId: account.accountId, ...patch }),
            })
          : await startFeishuMonitor({
              account,
              config: ctx.cfg as ClawdbotConfig,
              runtime: ctx.runtime,
              abortSignal: ctx.abortSignal,
              webhookPath: account.config.webhookPath,
              webhookUrl: account.config.webhookUrl,
              statusSink: (patch) => ctx.setStatus({ accountId: account.accountId, ...patch }),
            });
      return () => {
        unregister?.();
        ctx.setStatus({
          accountId: account.accountId,
          running: false,
          lastStopAt: Date.now(),
        });
      };
    },
  },
};
