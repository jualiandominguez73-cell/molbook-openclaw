import type { DingTalkAccountConfig, MoltbotConfig } from "clawdbot/plugin-sdk";
import { DEFAULT_ACCOUNT_ID, normalizeAccountId } from "clawdbot/plugin-sdk";

import type { DingTalkConfig } from "./types.js";

export type DingTalkCredentialSource = "config" | "env" | "none";

export type ResolvedDingTalkAccount = {
  accountId: string;
  name?: string;
  enabled: boolean;
  config: DingTalkAccountConfig;
  credentialSource: DingTalkCredentialSource;
  /** Stream mode: Client ID (AppKey) */
  clientId?: string;
  /** Stream mode: Client Secret (AppSecret) */
  clientSecret?: string;
};

// Stream mode environment variables
const ENV_CLIENT_ID = "DINGTALK_CLIENT_ID";
const ENV_CLIENT_SECRET = "DINGTALK_CLIENT_SECRET";

function listConfiguredAccountIds(cfg: MoltbotConfig): string[] {
  const accounts = (cfg.channels?.dingtalk as DingTalkConfig | undefined)?.accounts;
  if (!accounts || typeof accounts !== "object") return [];
  return Object.keys(accounts).filter(Boolean);
}

export function listDingTalkAccountIds(cfg: MoltbotConfig): string[] {
  const ids = listConfiguredAccountIds(cfg);
  if (ids.length === 0) return [DEFAULT_ACCOUNT_ID];
  return ids.sort((a, b) => a.localeCompare(b));
}

export function resolveDefaultDingTalkAccountId(cfg: MoltbotConfig): string {
  const channel = cfg.channels?.dingtalk as DingTalkConfig | undefined;
  if (channel?.defaultAccount?.trim()) return channel.defaultAccount.trim();
  const ids = listDingTalkAccountIds(cfg);
  if (ids.includes(DEFAULT_ACCOUNT_ID)) return DEFAULT_ACCOUNT_ID;
  return ids[0] ?? DEFAULT_ACCOUNT_ID;
}

function resolveAccountConfig(
  cfg: MoltbotConfig,
  accountId: string,
): DingTalkAccountConfig | undefined {
  const accounts = (cfg.channels?.dingtalk as DingTalkConfig | undefined)?.accounts;
  if (!accounts || typeof accounts !== "object") return undefined;
  return accounts[accountId] as DingTalkAccountConfig | undefined;
}

function mergeDingTalkAccountConfig(
  cfg: MoltbotConfig,
  accountId: string,
): DingTalkAccountConfig {
  const raw = (cfg.channels?.dingtalk ?? {}) as DingTalkConfig;
  const { accounts: _ignored, ...base } = raw;
  const account = resolveAccountConfig(cfg, accountId) ?? {};
  return { ...base, ...account } as DingTalkAccountConfig;
}

function resolveCredentialsFromConfig(params: {
  accountId: string;
  account: DingTalkAccountConfig;
}): {
  clientId?: string;
  clientSecret?: string;
  source: DingTalkCredentialSource;
} {
  const { account, accountId } = params;

  // Check Stream mode credentials from config
  if (account.clientId?.trim() && account.clientSecret?.trim()) {
    return {
      clientId: account.clientId.trim(),
      clientSecret: account.clientSecret.trim(),
      source: "config",
    };
  }

  // Check environment variables for default account
  if (accountId === DEFAULT_ACCOUNT_ID) {
    const envClientId = process.env[ENV_CLIENT_ID]?.trim();
    const envClientSecret = process.env[ENV_CLIENT_SECRET]?.trim();
    if (envClientId && envClientSecret) {
      return {
        clientId: envClientId,
        clientSecret: envClientSecret,
        source: "env",
      };
    }
  }

  return { source: "none" };
}

export function resolveDingTalkAccount(params: {
  cfg: MoltbotConfig;
  accountId?: string | null;
}): ResolvedDingTalkAccount {
  const accountId = normalizeAccountId(params.accountId);
  const baseEnabled =
    (params.cfg.channels?.dingtalk as DingTalkConfig | undefined)?.enabled !== false;
  const merged = mergeDingTalkAccountConfig(params.cfg, accountId);
  const accountEnabled = merged.enabled !== false;
  const enabled = baseEnabled && accountEnabled;
  const credentials = resolveCredentialsFromConfig({ accountId, account: merged });

  return {
    accountId,
    name: merged.name?.trim() || undefined,
    enabled,
    config: merged,
    credentialSource: credentials.source,
    clientId: credentials.clientId,
    clientSecret: credentials.clientSecret,
  };
}

export function listEnabledDingTalkAccounts(cfg: MoltbotConfig): ResolvedDingTalkAccount[] {
  return listDingTalkAccountIds(cfg)
    .map((accountId) => resolveDingTalkAccount({ cfg, accountId }))
    .filter((account) => account.enabled);
}
