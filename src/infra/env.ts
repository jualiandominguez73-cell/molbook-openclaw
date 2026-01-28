import { ProxyAgent, setGlobalDispatcher } from "undici";
import { createSubsystemLogger } from "../logging/subsystem.js";
import { parseBooleanValue } from "../utils/boolean.js";

const log = createSubsystemLogger("env");
const loggedEnv = new Set<string>();

type AcceptedEnvOption = {
  key: string;
  description: string;
  value?: string;
  redact?: boolean;
};

function formatEnvValue(value: string, redact?: boolean): string {
  if (redact) return "<redacted>";
  const singleLine = value.replace(/\s+/g, " ").trim();
  if (singleLine.length <= 160) return singleLine;
  return `${singleLine.slice(0, 160)}…`;
}

export function logAcceptedEnvOption(option: AcceptedEnvOption): void {
  if (process.env.VITEST || process.env.NODE_ENV === "test") return;
  if (loggedEnv.has(option.key)) return;
  const rawValue = option.value ?? process.env[option.key];
  if (!rawValue || !rawValue.trim()) return;
  loggedEnv.add(option.key);
  log.info(`env: ${option.key}=${formatEnvValue(rawValue, option.redact)} (${option.description})`);
}

export function normalizeZaiEnv(): void {
  if (!process.env.ZAI_API_KEY?.trim() && process.env.Z_AI_API_KEY?.trim()) {
    process.env.ZAI_API_KEY = process.env.Z_AI_API_KEY;
  }
}

function normalizeProxyEnvValue(raw: string): string {
  const value = raw.trim();
  if (!value) return value;
  if (/^[a-z]+:\/\//i.test(value)) return value;
  return `http://${value}`;
}

function normalizeProxyEnv(): string | undefined {
  const keys = ["HTTPS_PROXY", "https_proxy", "HTTP_PROXY", "http_proxy", "ALL_PROXY", "all_proxy"];
  for (const key of keys) {
    const raw = process.env[key];
    if (!raw?.trim()) continue;
    const normalized = normalizeProxyEnvValue(raw);
    if (normalized !== raw) process.env[key] = normalized;
    return normalized;
  }
  return undefined;
}

function applyGlobalProxyFromEnv(): void {
  if (process.env.VITEST || process.env.NODE_ENV === "test") return;
  const proxyUrl = normalizeProxyEnv();
  if (!proxyUrl) return;
  try {
    setGlobalDispatcher(new ProxyAgent(proxyUrl));
    log.info(`env: proxy enabled via ${proxyUrl}`);
  } catch (err) {
    log.warn(`env: proxy setup failed: ${String(err)}`);
  }
}

export function isTruthyEnvValue(value?: string): boolean {
  return parseBooleanValue(value) === true;
}

export function normalizeEnv(): void {
  normalizeZaiEnv();
  applyGlobalProxyFromEnv();
}
