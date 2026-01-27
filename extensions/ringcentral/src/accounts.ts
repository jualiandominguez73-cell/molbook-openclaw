import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { homedir } from "node:os";

import type { ClawdbotConfig } from "clawdbot/plugin-sdk";
import { DEFAULT_ACCOUNT_ID, normalizeAccountId } from "clawdbot/plugin-sdk";

import type { RingCentralAccountConfig, RingCentralConfig } from "./types.js";

export type RingCentralCredentialSource = "config" | "file" | "env" | "none";

export type ResolvedRingCentralAccount = {
  accountId: string;
  name?: string;
  enabled: boolean;
  config: RingCentralAccountConfig;
  credentialSource: RingCentralCredentialSource;
  clientId?: string;
  clientSecret?: string;
  jwt?: string;
  server: string;
};

const ENV_CLIENT_ID = "RINGCENTRAL_CLIENT_ID";
const ENV_CLIENT_SECRET = "RINGCENTRAL_CLIENT_SECRET";
const ENV_JWT = "RINGCENTRAL_JWT";
const ENV_SERVER = "RINGCENTRAL_SERVER";
const ENV_CREDENTIALS_FILE = "RINGCENTRAL_CREDENTIALS_FILE";

const DEFAULT_SERVER = "https://platform.ringcentral.com";

// Default credential file locations to check
const DEFAULT_CREDENTIALS_FILES = [
  "rc-credentials.json",
  ".clawdbot/rc-credentials.json",
];

type CredentialsFile = {
  clientId?: string;
  clientSecret?: string;
  jwt?: string;
  server?: string;
};

let cachedFileCredentials: { path: string; data: CredentialsFile } | null = null;

function findCredentialsFile(configFile?: string): { path: string; data: CredentialsFile } | null {
  // If explicitly specified, use that
  if (configFile?.trim()) {
    const filePath = resolve(configFile.trim());
    if (existsSync(filePath)) {
      try {
        const content = readFileSync(filePath, "utf8");
        return { path: filePath, data: JSON.parse(content) as CredentialsFile };
      } catch {
        return null;
      }
    }
    return null;
  }

  // Check env var for file path
  const envFile = process.env[ENV_CREDENTIALS_FILE]?.trim();
  if (envFile) {
    const filePath = resolve(envFile);
    if (existsSync(filePath)) {
      try {
        const content = readFileSync(filePath, "utf8");
        return { path: filePath, data: JSON.parse(content) as CredentialsFile };
      } catch {
        return null;
      }
    }
  }

  // Check default locations
  const searchPaths = [
    ...DEFAULT_CREDENTIALS_FILES.map((f) => resolve(process.cwd(), f)),
    ...DEFAULT_CREDENTIALS_FILES.map((f) => resolve(homedir(), f)),
  ];

  for (const filePath of searchPaths) {
    if (existsSync(filePath)) {
      try {
        const content = readFileSync(filePath, "utf8");
        return { path: filePath, data: JSON.parse(content) as CredentialsFile };
      } catch {
        continue;
      }
    }
  }

  return null;
}

function loadFileCredentials(configFile?: string): CredentialsFile | null {
  // Use cached if available and no specific file requested
  if (!configFile && cachedFileCredentials) {
    return cachedFileCredentials.data;
  }

  const result = findCredentialsFile(configFile);
  if (result) {
    if (!configFile) {
      cachedFileCredentials = result;
    }
    return result.data;
  }
  return null;
}

function listConfiguredAccountIds(cfg: ClawdbotConfig): string[] {
  const accounts = (cfg.channels?.ringcentral as RingCentralConfig | undefined)?.accounts;
  if (!accounts || typeof accounts !== "object") return [];
  return Object.keys(accounts).filter(Boolean);
}

export function listRingCentralAccountIds(cfg: ClawdbotConfig): string[] {
  const ids = listConfiguredAccountIds(cfg);
  if (ids.length === 0) return [DEFAULT_ACCOUNT_ID];
  return ids.sort((a, b) => a.localeCompare(b));
}

export function resolveDefaultRingCentralAccountId(cfg: ClawdbotConfig): string {
  const channel = cfg.channels?.ringcentral as RingCentralConfig | undefined;
  if (channel?.defaultAccount?.trim()) return channel.defaultAccount.trim();
  const ids = listRingCentralAccountIds(cfg);
  if (ids.includes(DEFAULT_ACCOUNT_ID)) return DEFAULT_ACCOUNT_ID;
  return ids[0] ?? DEFAULT_ACCOUNT_ID;
}

function resolveAccountConfig(
  cfg: ClawdbotConfig,
  accountId: string,
): RingCentralAccountConfig | undefined {
  const accounts = (cfg.channels?.ringcentral as RingCentralConfig | undefined)?.accounts;
  if (!accounts || typeof accounts !== "object") return undefined;
  return accounts[accountId] as RingCentralAccountConfig | undefined;
}

function mergeRingCentralAccountConfig(
  cfg: ClawdbotConfig,
  accountId: string,
): RingCentralAccountConfig {
  const raw = (cfg.channels?.ringcentral ?? {}) as RingCentralConfig;
  const { accounts: _ignored, defaultAccount: _ignored2, ...base } = raw;
  const account = resolveAccountConfig(cfg, accountId) ?? {};
  return { ...base, ...account } as RingCentralAccountConfig;
}

function resolveCredentialsFromConfig(params: {
  accountId: string;
  account: RingCentralAccountConfig;
}): {
  clientId?: string;
  clientSecret?: string;
  jwt?: string;
  server: string;
  source: RingCentralCredentialSource;
} {
  const { account, accountId } = params;

  const configClientId = account.clientId?.trim();
  const configClientSecret = account.clientSecret?.trim();
  const configJwt = account.jwt?.trim();
  const configServer = account.server?.trim() || DEFAULT_SERVER;

  // 1. Check inline config first
  if (configClientId && configClientSecret && configJwt) {
    return {
      clientId: configClientId,
      clientSecret: configClientSecret,
      jwt: configJwt,
      server: configServer,
      source: "config",
    };
  }

  // 2. Check credentials file (rc-credentials.json)
  const fileCredentials = loadFileCredentials(
    (account as { credentialsFile?: string }).credentialsFile,
  );
  if (fileCredentials) {
    const fileClientId = fileCredentials.clientId?.trim();
    const fileClientSecret = fileCredentials.clientSecret?.trim();
    const fileJwt = fileCredentials.jwt?.trim();
    const fileServer = fileCredentials.server?.trim() || DEFAULT_SERVER;

    if (fileClientId && fileClientSecret && fileJwt) {
      return {
        clientId: fileClientId,
        clientSecret: fileClientSecret,
        jwt: fileJwt,
        server: fileServer,
        source: "file",
      };
    }
  }

  // 3. Check environment variables (default account only)
  if (accountId === DEFAULT_ACCOUNT_ID) {
    const envClientId = process.env[ENV_CLIENT_ID]?.trim();
    const envClientSecret = process.env[ENV_CLIENT_SECRET]?.trim();
    const envJwt = process.env[ENV_JWT]?.trim();
    const envServer = process.env[ENV_SERVER]?.trim() || DEFAULT_SERVER;

    if (envClientId && envClientSecret && envJwt) {
      return {
        clientId: envClientId,
        clientSecret: envClientSecret,
        jwt: envJwt,
        server: envServer,
        source: "env",
      };
    }

    // 4. Allow partial config + file + env fallback
    const finalClientId = configClientId || fileCredentials?.clientId?.trim() || envClientId;
    const finalClientSecret = configClientSecret || fileCredentials?.clientSecret?.trim() || envClientSecret;
    const finalJwt = configJwt || fileCredentials?.jwt?.trim() || envJwt;
    const finalServer = configServer !== DEFAULT_SERVER
      ? configServer
      : fileCredentials?.server?.trim() || envServer;

    if (finalClientId && finalClientSecret && finalJwt) {
      const source: RingCentralCredentialSource =
        configClientId || configClientSecret || configJwt
          ? "config"
          : fileCredentials?.clientId || fileCredentials?.clientSecret || fileCredentials?.jwt
            ? "file"
            : "env";
      return {
        clientId: finalClientId,
        clientSecret: finalClientSecret,
        jwt: finalJwt,
        server: finalServer,
        source,
      };
    }
  }

  return { server: configServer, source: "none" };
}

export function resolveRingCentralAccount(params: {
  cfg: ClawdbotConfig;
  accountId?: string | null;
}): ResolvedRingCentralAccount {
  const accountId = normalizeAccountId(params.accountId);
  const baseEnabled =
    (params.cfg.channels?.ringcentral as RingCentralConfig | undefined)?.enabled !== false;
  const merged = mergeRingCentralAccountConfig(params.cfg, accountId);
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
    jwt: credentials.jwt,
    server: credentials.server,
  };
}

export function listEnabledRingCentralAccounts(cfg: ClawdbotConfig): ResolvedRingCentralAccount[] {
  return listRingCentralAccountIds(cfg)
    .map((accountId) => resolveRingCentralAccount({ cfg, accountId }))
    .filter((account) => account.enabled);
}
