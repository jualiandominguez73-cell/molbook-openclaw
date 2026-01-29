import {
  applyAccountNameToChannelSection,
  DEFAULT_ACCOUNT_ID,
  deleteAccountFromConfigSection,
  emptyPluginConfigSchema,
  formatPairingApproveHint,
  getChatChannelMeta,
  migrateBaseNameToDefaultAccount,
  normalizeAccountId,
  setAccountEnabledInConfigSection,
  type ChannelDock,
  type ChannelPlugin,
  type MoltbotConfig,
} from "clawdbot/plugin-sdk";

import {
  listDingTalkAccountIds,
  resolveDefaultDingTalkAccountId,
  resolveDingTalkAccount,
  type ResolvedDingTalkAccount,
} from "./accounts.js";
import { probeDingTalk } from "./api.js";
import { dingtalkOnboardingAdapter } from "./onboarding.js";
import { getDingTalkRuntime } from "./runtime.js";
import { startDingTalkMonitor } from "./monitor.js";

const meta = getChatChannelMeta("dingtalk");

const formatAllowFromEntry = (entry: string) =>
  entry
    .trim()
    .replace(/^(dingtalk|dingding|ding):/i, "")
    .toLowerCase();

export const dingtalkDock: ChannelDock = {
  id: "dingtalk",
  capabilities: {
    chatTypes: ["direct", "group"],
    reactions: false,
    media: false, // DingTalk robot API has limited media support
    threads: false,
    blockStreaming: true,
  },
  outbound: { textChunkLimit: 4000 },
  config: {
    resolveAllowFrom: ({ cfg, accountId }) =>
      (
        resolveDingTalkAccount({ cfg: cfg as MoltbotConfig, accountId }).config.dm?.allowFrom ?? []
      ).map((entry) => String(entry)),
    formatAllowFrom: ({ allowFrom }) =>
      allowFrom
        .map((entry) => String(entry))
        .filter(Boolean)
        .map(formatAllowFromEntry),
  },
  groups: {
    resolveRequireMention: ({ cfg, accountId }) => {
      const account = resolveDingTalkAccount({ cfg: cfg as MoltbotConfig, accountId });
      return account.config.requireMention ?? true;
    },
  },
  threading: {
    resolveReplyToMode: ({ cfg }) => cfg.channels?.["dingtalk"]?.replyToMode ?? "off",
    buildToolContext: ({ context, hasRepliedRef }) => ({
      currentChannelId: context.To?.trim() || undefined,
      hasRepliedRef,
    }),
  },
};

export const dingtalkPlugin: ChannelPlugin<ResolvedDingTalkAccount> = {
  id: "dingtalk",
  meta: { ...meta },
  onboarding: dingtalkOnboardingAdapter,
  pairing: {
    idLabel: "dingtalkUserId",
    normalizeAllowEntry: (entry) => formatAllowFromEntry(entry),
    notifyApproval: async ({ cfg, id }) => {
      const account = resolveDingTalkAccount({ cfg: cfg as MoltbotConfig });
      if (account.credentialSource === "none" || !account.clientId) return;
      // Note: DingTalk doesn't support sending DMs directly via robot API
      // The user will need to @mention the robot first to establish a session
      // This is a limitation of the DingTalk platform
    },
  },
  capabilities: {
    chatTypes: ["direct", "group"],
    reactions: false,
    threads: false,
    media: false,
    nativeCommands: false,
    blockStreaming: true,
  },
  streaming: {
    blockStreamingCoalesceDefaults: { minChars: 1500, idleMs: 1000 },
  },
  reload: { configPrefixes: ["channels.dingtalk"] },
  configSchema: emptyPluginConfigSchema(),
  config: {
    listAccountIds: (cfg) => listDingTalkAccountIds(cfg as MoltbotConfig),
    resolveAccount: (cfg, accountId) =>
      resolveDingTalkAccount({ cfg: cfg as MoltbotConfig, accountId }),
    defaultAccountId: (cfg) => resolveDefaultDingTalkAccountId(cfg as MoltbotConfig),
    setAccountEnabled: ({ cfg, accountId, enabled }) =>
      setAccountEnabledInConfigSection({
        cfg: cfg as MoltbotConfig,
        sectionKey: "dingtalk",
        accountId,
        enabled,
        allowTopLevel: true,
      }),
    deleteAccount: ({ cfg, accountId }) =>
      deleteAccountFromConfigSection({
        cfg: cfg as MoltbotConfig,
        sectionKey: "dingtalk",
        accountId,
        clearBaseFields: ["accessToken", "accessTokenFile", "secret", "secretFile", "webhookPath", "webhookUrl", "name"],
      }),
    isConfigured: (account) => account.credentialSource !== "none",
    describeAccount: (account) => ({
      accountId: account.accountId,
      name: account.name,
      enabled: account.enabled,
      configured: account.credentialSource !== "none",
      credentialSource: account.credentialSource,
    }),
    resolveAllowFrom: ({ cfg, accountId }) =>
      (
        resolveDingTalkAccount({
          cfg: cfg as MoltbotConfig,
          accountId,
        }).config.dm?.allowFrom ?? []
      ).map((entry) => String(entry)),
    formatAllowFrom: ({ allowFrom }) =>
      allowFrom
        .map((entry) => String(entry))
        .filter(Boolean)
        .map(formatAllowFromEntry),
  },
  security: {
    resolveDmPolicy: ({ cfg, accountId, account }) => {
      const resolvedAccountId = accountId ?? account.accountId ?? DEFAULT_ACCOUNT_ID;
      const useAccountPath = Boolean(
        (cfg as MoltbotConfig).channels?.["dingtalk"]?.accounts?.[resolvedAccountId],
      );
      const allowFromPath = useAccountPath
        ? `channels.dingtalk.accounts.${resolvedAccountId}.dm.`
        : "channels.dingtalk.dm.";
      return {
        policy: account.config.dm?.policy ?? "pairing",
        allowFrom: account.config.dm?.allowFrom ?? [],
        allowFromPath,
        approveHint: formatPairingApproveHint("dingtalk"),
        normalizeEntry: (raw) => formatAllowFromEntry(raw),
      };
    },
    collectWarnings: ({ account, cfg }) => {
      const warnings: string[] = [];
      const defaultGroupPolicy = cfg.channels?.defaults?.groupPolicy;
      const groupPolicy = account.config.groupPolicy ?? defaultGroupPolicy ?? "allowlist";
      if (groupPolicy === "open") {
        warnings.push(
          `- DingTalk groups: groupPolicy="open" allows any group to trigger (mention-gated). Set channels.dingtalk.groupPolicy="allowlist" and configure channels.dingtalk.groups.`,
        );
      }
      if (account.config.dm?.policy === "open") {
        warnings.push(
          `- DingTalk DMs are open to anyone. Set channels.dingtalk.dm.policy="pairing" or "allowlist".`,
        );
      }
      return warnings;
    },
  },
  groups: {
    resolveRequireMention: ({ cfg, accountId }) => {
      const account = resolveDingTalkAccount({ cfg: cfg as MoltbotConfig, accountId });
      return account.config.requireMention ?? true;
    },
  },
  threading: {
    resolveReplyToMode: ({ cfg }) => cfg.channels?.["dingtalk"]?.replyToMode ?? "off",
  },
  messaging: {
    normalizeTarget: (raw) => {
      const trimmed = raw?.trim();
      if (!trimmed) return null;
      return trimmed.replace(/^(dingtalk|dingding|ding):/i, "");
    },
    targetResolver: {
      looksLikeId: (raw, normalized) => {
        const value = normalized ?? raw.trim();
        return Boolean(value);
      },
      hint: "<conversationId>",
    },
  },
  directory: {
    self: async () => null,
    listPeers: async ({ cfg, accountId, query, limit }) => {
      const account = resolveDingTalkAccount({
        cfg: cfg as MoltbotConfig,
        accountId,
      });
      const q = query?.trim().toLowerCase() || "";
      const allowFrom = account.config.dm?.allowFrom ?? [];
      const peers = Array.from(
        new Set(
          allowFrom
            .map((entry) => String(entry).trim())
            .filter((entry) => Boolean(entry) && entry !== "*"),
        ),
      )
        .filter((id) => (q ? id.toLowerCase().includes(q) : true))
        .slice(0, limit && limit > 0 ? limit : undefined)
        .map((id) => ({ kind: "user", id }) as const);
      return peers;
    },
    listGroups: async ({ cfg, accountId, query, limit }) => {
      const account = resolveDingTalkAccount({
        cfg: cfg as MoltbotConfig,
        accountId,
      });
      const groups = account.config.groups ?? {};
      const q = query?.trim().toLowerCase() || "";
      const entries = Object.keys(groups)
        .filter((key) => key && key !== "*")
        .filter((key) => (q ? key.toLowerCase().includes(q) : true))
        .slice(0, limit && limit > 0 ? limit : undefined)
        .map((id) => ({ kind: "group", id }) as const);
      return entries;
    },
  },
  setup: {
    resolveAccountId: ({ accountId }) => normalizeAccountId(accountId),
    applyAccountName: ({ cfg, accountId, name }) =>
      applyAccountNameToChannelSection({
        cfg: cfg as MoltbotConfig,
        channelKey: "dingtalk",
        accountId,
        name,
      }),
    validateInput: ({ accountId, input }) => {
      if (input.useEnv && accountId !== DEFAULT_ACCOUNT_ID) {
        return "DINGTALK_ACCESS_TOKEN env var can only be used for the default account.";
      }
      if (!input.useEnv && !input.token && !input.tokenFile) {
        return "DingTalk requires access token or --token-file (or --use-env).";
      }
      return null;
    },
    applyAccountConfig: ({ cfg, accountId, input }) => {
      const namedConfig = applyAccountNameToChannelSection({
        cfg: cfg as MoltbotConfig,
        channelKey: "dingtalk",
        accountId,
        name: input.name,
      });
      const next =
        accountId !== DEFAULT_ACCOUNT_ID
          ? migrateBaseNameToDefaultAccount({
              cfg: namedConfig as MoltbotConfig,
              channelKey: "dingtalk",
            })
          : namedConfig;
      const patch = input.useEnv
        ? {}
        : input.tokenFile
          ? { accessTokenFile: input.tokenFile }
          : input.token
            ? { accessToken: input.token }
            : {};
      const webhookPath = input.webhookPath?.trim();
      const webhookUrl = input.webhookUrl?.trim();
      const configPatch = {
        ...patch,
        ...(webhookPath ? { webhookPath } : {}),
        ...(webhookUrl ? { webhookUrl } : {}),
      };
      if (accountId === DEFAULT_ACCOUNT_ID) {
        return {
          ...next,
          channels: {
            ...next.channels,
            dingtalk: {
              ...(next.channels?.["dingtalk"] ?? {}),
              enabled: true,
              ...configPatch,
            },
          },
        } as MoltbotConfig;
      }
      return {
        ...next,
        channels: {
          ...next.channels,
          dingtalk: {
            ...(next.channels?.["dingtalk"] ?? {}),
            enabled: true,
            accounts: {
              ...(next.channels?.["dingtalk"]?.accounts ?? {}),
              [accountId]: {
                ...(next.channels?.["dingtalk"]?.accounts?.[accountId] ?? {}),
                enabled: true,
                ...configPatch,
              },
            },
          },
        },
      } as MoltbotConfig;
    },
  },
  outbound: {
    deliveryMode: "direct",
    chunker: (text: string, limit: number) =>
      getDingTalkRuntime().channel.text.chunkMarkdownText(text, limit),
    chunkerMode: "markdown",
    textChunkLimit: 4000,
    sendText: async ({ cfg, to, text, accountId }) => {
      const account = resolveDingTalkAccount({
        cfg: cfg as MoltbotConfig,
        accountId,
      });
      // Stream mode doesn't support outbound messages via accessToken
      // Messages are sent via sessionWebhook in response to inbound messages
      if (!account.clientId) {
        throw new Error("DingTalk clientId not configured");
      }
      // For outbound messages, we need to use a different API
      // This is a limitation of DingTalk's robot API
      throw new Error(
        "DingTalk Stream mode does not support proactive outbound messages. Messages can only be sent in response to user messages.",
      );
    },
    sendMedia: async () => {
      // DingTalk robot API has very limited media support
      // Media messages typically require different API endpoints
      throw new Error("DingTalk robot API does not support media attachments");
    },
  },
  status: {
    defaultRuntime: {
      accountId: DEFAULT_ACCOUNT_ID,
      running: false,
      lastStartAt: null,
      lastStopAt: null,
      lastError: null,
    },
    collectStatusIssues: (accounts: Array<{ accountId?: string; enabled?: boolean; configured?: boolean; clientId?: string }>) =>
      accounts.flatMap((entry) => {
        const accountId = String(entry.accountId ?? DEFAULT_ACCOUNT_ID);
        const enabled = entry.enabled !== false;
        const configured = entry.configured === true;
        if (!enabled || !configured) return [];
        const issues: Array<{ channel: string; accountId: string; kind: string; message: string; fix: string }> = [];
        if (!entry.clientId) {
          issues.push({
            channel: "dingtalk",
            accountId,
            kind: "config",
            message: "DingTalk clientId (AppKey) is missing.",
            fix: "Set channels.dingtalk.clientId.",
          });
        }
        return issues;
      }),
    buildChannelSummary: ({ snapshot }) => ({
      configured: snapshot.configured ?? false,
      credentialSource: snapshot.credentialSource ?? "none",
      mode: "stream",
      running: snapshot.running ?? false,
      lastStartAt: snapshot.lastStartAt ?? null,
      lastStopAt: snapshot.lastStopAt ?? null,
      lastError: snapshot.lastError ?? null,
      probe: snapshot.probe,
      lastProbeAt: snapshot.lastProbeAt ?? null,
    }),
    probeAccount: async ({ account }) => probeDingTalk(account),
    buildAccountSnapshot: ({ account, runtime, probe }) => ({
      accountId: account.accountId,
      name: account.name,
      enabled: account.enabled,
      configured: account.credentialSource !== "none",
      credentialSource: account.credentialSource,
      mode: "stream",
      clientId: account.clientId,
      running: runtime?.running ?? false,
      lastStartAt: runtime?.lastStartAt ?? null,
      lastStopAt: runtime?.lastStopAt ?? null,
      lastError: runtime?.lastError ?? null,
      lastInboundAt: runtime?.lastInboundAt ?? null,
      lastOutboundAt: runtime?.lastOutboundAt ?? null,
      dmPolicy: account.config.dm?.policy ?? "pairing",
      probe,
    }),
  },
  gateway: {
    startAccount: async (ctx: {
      account: ResolvedDingTalkAccount;
      cfg: unknown;
      runtime: { log?: (msg: string) => void; error?: (msg: string) => void };
      abortSignal: AbortSignal;
      log?: { info: (msg: string) => void };
      setStatus: (patch: Record<string, unknown>) => void;
    }) => {
      const account = ctx.account;
      ctx.log?.info(`[${account.accountId}] starting DingTalk Stream mode`);
      ctx.setStatus({
        accountId: account.accountId,
        running: true,
        lastStartAt: Date.now(),
        mode: "stream",
      });
      const unregister = await startDingTalkMonitor({
        account,
        config: ctx.cfg as MoltbotConfig,
        runtime: ctx.runtime,
        abortSignal: ctx.abortSignal,
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
