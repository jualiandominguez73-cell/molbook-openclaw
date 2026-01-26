/**
 * Feishu Open Platform API client.
 * @see https://open.feishu.cn/document
 */

import { createHash, createDecipheriv } from "node:crypto";

import type {
  FeishuApiResponse,
  FeishuBotInfo,
  FeishuReceiveIdType,
  FeishuSendMessageParams,
  FeishuSendMessageResponse,
  FeishuTokenResponse,
  FeishuWebhookPayload,
} from "./types.js";

const FEISHU_API_BASE = "https://open.feishu.cn/open-apis";

export type FeishuFetch = (input: string, init?: RequestInit) => Promise<Response>;

export class FeishuApiError extends Error {
  constructor(
    message: string,
    public readonly code?: number,
    public readonly msg?: string,
  ) {
    super(message);
    this.name = "FeishuApiError";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Token Management
// ─────────────────────────────────────────────────────────────────────────────

type CachedToken = {
  token: string;
  expiresAt: number;
};

// Token cache per app_id
const tokenCache = new Map<string, CachedToken>();

/**
 * Get tenant access token (cached with expiry buffer).
 */
export async function getTenantAccessToken(
  appId: string,
  appSecret: string,
  options?: { timeoutMs?: number; fetch?: FeishuFetch },
): Promise<string> {
  const cacheKey = appId;
  const cached = tokenCache.get(cacheKey);
  const now = Date.now();

  // Return cached token if still valid (with 5 minute buffer)
  if (cached && cached.expiresAt > now + 5 * 60 * 1000) {
    return cached.token;
  }

  const url = `${FEISHU_API_BASE}/auth/v3/tenant_access_token/internal`;
  const controller = new AbortController();
  const timeoutId = options?.timeoutMs
    ? setTimeout(() => controller.abort(), options.timeoutMs)
    : undefined;
  const fetcher = options?.fetch ?? fetch;

  try {
    const response = await fetcher(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
      signal: controller.signal,
    });

    const data = (await response.json()) as FeishuApiResponse<FeishuTokenResponse> & FeishuTokenResponse;

    // Feishu returns token at top level, not in data
    const token = data.tenant_access_token;
    const expire = data.expire ?? 7200;

    if (!token) {
      throw new FeishuApiError(
        data.msg ?? "Failed to get tenant access token",
        data.code,
        data.msg,
      );
    }

    // Cache the token
    tokenCache.set(cacheKey, {
      token,
      expiresAt: now + expire * 1000,
    });

    return token;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

/**
 * Clear cached token for an app.
 */
export function clearTokenCache(appId: string): void {
  tokenCache.delete(appId);
}

// ─────────────────────────────────────────────────────────────────────────────
// API Calls
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Make an authenticated API call to Feishu.
 */
export async function callFeishuApi<T = unknown>(
  endpoint: string,
  token: string,
  options?: {
    method?: string;
    body?: Record<string, unknown>;
    query?: Record<string, string>;
    timeoutMs?: number;
    fetch?: FeishuFetch;
  },
): Promise<FeishuApiResponse<T>> {
  let url = `${FEISHU_API_BASE}${endpoint}`;
  if (options?.query) {
    const params = new URLSearchParams(options.query);
    url = `${url}?${params.toString()}`;
  }

  const controller = new AbortController();
  const timeoutId = options?.timeoutMs
    ? setTimeout(() => controller.abort(), options.timeoutMs)
    : undefined;
  const fetcher = options?.fetch ?? fetch;

  try {
    const response = await fetcher(url, {
      method: options?.method ?? "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: options?.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });

    const data = (await response.json()) as FeishuApiResponse<T>;

    if (data.code !== 0) {
      throw new FeishuApiError(data.msg ?? `Feishu API error: ${endpoint}`, data.code, data.msg);
    }

    return data;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

/**
 * Get bot info for validation.
 */
export async function getBotInfo(
  appId: string,
  appSecret: string,
  options?: { timeoutMs?: number; fetch?: FeishuFetch },
): Promise<FeishuApiResponse<FeishuBotInfo>> {
  const token = await getTenantAccessToken(appId, appSecret, options);
  return callFeishuApi<FeishuBotInfo>("/bot/v3/info", token, {
    method: "GET",
    timeoutMs: options?.timeoutMs,
    fetch: options?.fetch,
  });
}

/**
 * Send a message to a user or chat.
 */
export async function sendMessage(
  appId: string,
  appSecret: string,
  params: FeishuSendMessageParams,
  receiveIdType: FeishuReceiveIdType = "open_id",
  options?: { timeoutMs?: number; fetch?: FeishuFetch },
): Promise<FeishuApiResponse<FeishuSendMessageResponse>> {
  const token = await getTenantAccessToken(appId, appSecret, options);
  return callFeishuApi<FeishuSendMessageResponse>("/im/v1/messages", token, {
    method: "POST",
    query: { receive_id_type: receiveIdType },
    body: params as unknown as Record<string, unknown>,
    timeoutMs: options?.timeoutMs,
    fetch: options?.fetch,
  });
}

/**
 * Reply to a message.
 */
export async function replyMessage(
  appId: string,
  appSecret: string,
  messageId: string,
  params: Omit<FeishuSendMessageParams, "receive_id">,
  options?: { timeoutMs?: number; fetch?: FeishuFetch },
): Promise<FeishuApiResponse<FeishuSendMessageResponse>> {
  const token = await getTenantAccessToken(appId, appSecret, options);
  return callFeishuApi<FeishuSendMessageResponse>(`/im/v1/messages/${messageId}/reply`, token, {
    method: "POST",
    body: params as unknown as Record<string, unknown>,
    timeoutMs: options?.timeoutMs,
    fetch: options?.fetch,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Webhook Verification
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Decrypt an encrypted webhook payload using the encrypt key.
 * Feishu uses AES-256-CBC with the key derived from SHA256 of the encrypt key.
 */
export function decryptWebhookPayload(encrypted: string, encryptKey: string): string {
  // Derive key from encrypt key using SHA256
  const key = createHash("sha256").update(encryptKey).digest();

  // Decode base64
  const ciphertext = Buffer.from(encrypted, "base64");

  // First 16 bytes are the IV
  const iv = ciphertext.subarray(0, 16);
  const encryptedData = ciphertext.subarray(16);

  // Decrypt using AES-256-CBC
  const decipher = createDecipheriv("aes-256-cbc", key, iv);
  let decrypted = decipher.update(encryptedData);
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return decrypted.toString("utf8");
}

/**
 * Verify webhook signature using verification token.
 */
export function verifyWebhookToken(payload: FeishuWebhookPayload, verificationToken: string): boolean {
  // For challenge verification, token is at top level
  if (payload.token) {
    return payload.token === verificationToken;
  }
  // For events, token is in header
  if (payload.header?.token) {
    return payload.header.token === verificationToken;
  }
  return false;
}

/**
 * Parse webhook payload, decrypting if necessary.
 */
export function parseWebhookPayload(
  rawBody: string,
  encryptKey?: string,
): FeishuWebhookPayload | null {
  try {
    const parsed = JSON.parse(rawBody) as FeishuWebhookPayload;

    // If encrypted, decrypt first
    if (parsed.encrypt && encryptKey) {
      const decrypted = decryptWebhookPayload(parsed.encrypt, encryptKey);
      return JSON.parse(decrypted) as FeishuWebhookPayload;
    }

    return parsed;
  } catch {
    return null;
  }
}

/**
 * Build challenge response for URL verification.
 */
export function buildChallengeResponse(challenge: string): string {
  return JSON.stringify({ challenge });
}
