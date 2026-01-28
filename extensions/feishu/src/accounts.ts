import type { ClawdbotConfig } from "clawdbot/plugin-sdk";
import { DEFAULT_ACCOUNT_ID } from "clawdbot/plugin-sdk";

export type FeishuChannelConfig = {
  name?: string;
  enabled?: boolean;
  appId?: string;
  appSecret?: string;
  app_id?: string;
  app_secret?: string;
  verificationToken?: string;
  verification_token?: string;
  encryptKey?: string;
  encrypt_key?: string;
  eventMode?: "webhook" | "long-connection";
  webhookPath?: string;
  webhookUrl?: string;
  allowBots?: boolean;
  requireMention?: boolean;
  dmPolicy?: "open" | "pairing" | "disabled";
  allowFrom?: Array<string | number>;
  groupPolicy?: "open" | "allowlist" | "disabled";
  groupAllowFrom?: Array<string | number>;
  textChunkLimit?: number;
  chunkMode?: "length" | "newline";
  blockStreaming?: boolean;
  blockStreamingCoalesce?: { minChars?: number; idleMs?: number };
  markdown?: Record<string, unknown>;
};

export type ResolvedFeishuAccount = {
  accountId: string;
  enabled: boolean;
  configured: boolean;
  name?: string;
  appId?: string;
  appSecret?: string;
  verificationToken?: string;
  encryptKey?: string;
  config: FeishuChannelConfig;
  credentialSource: "config" | "none";
};

function normalizeConfig(raw: FeishuChannelConfig | undefined): FeishuChannelConfig {
  return raw ?? {};
}

export function resolveFeishuAccount(params: {
  cfg: ClawdbotConfig;
  accountId?: string | null;
}): ResolvedFeishuAccount {
  const cfg = params.cfg;
  const raw = (cfg.channels?.["feishu"] ?? {}) as FeishuChannelConfig;
  const config = normalizeConfig(raw);
  const appId = config.appId?.trim() || config.app_id?.trim() || undefined;
  const appSecret = config.appSecret?.trim() || config.app_secret?.trim() || undefined;
  const verificationToken =
    config.verificationToken?.trim() || config.verification_token?.trim() || undefined;
  const encryptKey = config.encryptKey?.trim() || config.encrypt_key?.trim() || undefined;
  const enabled = config.enabled !== false;
  const configured = Boolean(appId && appSecret);
  return {
    accountId: params.accountId?.trim() || DEFAULT_ACCOUNT_ID,
    enabled,
    configured,
    name: config.name?.trim() || undefined,
    appId,
    appSecret,
    verificationToken,
    encryptKey,
    config,
    credentialSource: configured ? "config" : "none",
  };
}

export function resolveDefaultFeishuAccountId(): string {
  return DEFAULT_ACCOUNT_ID;
}
