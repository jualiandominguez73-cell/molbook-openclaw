import crypto from "node:crypto";

import type { ResolvedDingTalkAccount } from "./accounts.js";
import type {
  DingTalkApiResponse,
  DingTalkOutboundMessage,
  DingTalkTextMessage,
  DingTalkMarkdownMessage,
} from "./types.js";

const DINGTALK_ROBOT_SEND_URL = "https://oapi.dingtalk.com/robot/send";

/**
 * Generate HMAC-SHA256 signature for DingTalk webhook authentication.
 * Format: timestamp + "\n" + secret, then HMAC-SHA256, base64, URL encode
 * @deprecated Legacy webhook mode - use Stream mode instead
 */
export function generateSignature(timestamp: number, secret: string): string {
  const stringToSign = `${timestamp}\n${secret}`;
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(stringToSign, "utf8");
  const digest = hmac.digest("base64");
  return encodeURIComponent(digest);
}

/**
 * Verify incoming webhook signature from DingTalk.
 * The signature is in request headers: timestamp and sign.
 * @deprecated Legacy webhook mode - use Stream mode instead
 */
export function verifySignature(params: {
  timestamp: string;
  sign: string;
  secret: string;
}): { ok: boolean; error?: string } {
  const { timestamp, sign, secret } = params;

  // Check timestamp is within 1 hour
  const ts = Number.parseInt(timestamp, 10);
  if (!Number.isFinite(ts)) {
    return { ok: false, error: "invalid timestamp" };
  }
  const now = Date.now();
  if (Math.abs(now - ts) > 60 * 60 * 1000) {
    return { ok: false, error: "timestamp expired" };
  }

  // Verify signature
  const expected = generateSignature(ts, secret);
  // URL decode the incoming sign for comparison
  const decodedSign = decodeURIComponent(sign);
  const decodedExpected = decodeURIComponent(expected);

  if (decodedSign !== decodedExpected) {
    return { ok: false, error: "signature mismatch" };
  }

  return { ok: true };
}

/**
 * Build the full webhook URL with authentication parameters.
 * @deprecated Legacy webhook mode - use Stream mode instead
 */
export function buildWebhookUrl(params: {
  accessToken: string;
  secret?: string;
}): string {
  const { accessToken, secret } = params;
  const url = new URL(DINGTALK_ROBOT_SEND_URL);
  url.searchParams.set("access_token", accessToken);

  if (secret) {
    const timestamp = Date.now();
    const sign = generateSignature(timestamp, secret);
    url.searchParams.set("timestamp", String(timestamp));
    url.searchParams.set("sign", sign);
  }

  return url.toString();
}

/**
 * Send a message to DingTalk robot webhook.
 */
export async function sendDingTalkMessage(params: {
  accessToken: string;
  secret?: string;
  message: DingTalkOutboundMessage;
}): Promise<{ ok: boolean; response?: DingTalkApiResponse; error?: string }> {
  const { accessToken, secret, message } = params;

  const url = buildWebhookUrl({ accessToken, secret });

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });

    const data = (await response.json()) as DingTalkApiResponse;

    if (data.errcode !== 0) {
      return {
        ok: false,
        response: data,
        error: `DingTalk API error: ${data.errmsg} (code: ${data.errcode})`,
      };
    }

    return { ok: true, response: data };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Send a text message to DingTalk.
 */
export async function sendTextMessage(params: {
  accessToken: string;
  secret?: string;
  content: string;
  atUserIds?: string[];
  atMobiles?: string[];
  isAtAll?: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  const { accessToken, secret, content, atUserIds, atMobiles, isAtAll } = params;

  const message: DingTalkTextMessage = {
    msgtype: "text",
    text: {
      content,
    },
  };

  if (atUserIds?.length || atMobiles?.length || isAtAll) {
    message.at = {
      atUserIds,
      atMobiles,
      isAtAll,
    };
  }

  return sendDingTalkMessage({ accessToken, secret, message });
}

/**
 * Send a markdown message to DingTalk.
 */
export async function sendMarkdownMessage(params: {
  accessToken: string;
  secret?: string;
  title: string;
  text: string;
  atUserIds?: string[];
  atMobiles?: string[];
  isAtAll?: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  const { accessToken, secret, title, text, atUserIds, atMobiles, isAtAll } = params;

  const message: DingTalkMarkdownMessage = {
    msgtype: "markdown",
    markdown: {
      title,
      text,
    },
  };

  if (atUserIds?.length || atMobiles?.length || isAtAll) {
    message.at = {
      atUserIds,
      atMobiles,
      isAtAll,
    };
  }

  return sendDingTalkMessage({ accessToken, secret, message });
}

/**
 * Reply to a message using the session webhook.
 * This is the preferred method when replying to incoming messages.
 */
export async function replyWithSessionWebhook(params: {
  sessionWebhook: string;
  message: DingTalkOutboundMessage;
}): Promise<{ ok: boolean; response?: DingTalkApiResponse; error?: string }> {
  const { sessionWebhook, message } = params;

  try {
    const response = await fetch(sessionWebhook, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });

    const data = (await response.json()) as DingTalkApiResponse;

    if (data.errcode !== 0) {
      return {
        ok: false,
        response: data,
        error: `DingTalk API error: ${data.errmsg} (code: ${data.errcode})`,
      };
    }

    return { ok: true, response: data };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Probe DingTalk connection.
 * For Stream mode, we validate clientId and clientSecret are configured.
 */
export async function probeDingTalk(account: ResolvedDingTalkAccount): Promise<{
  ok: boolean;
  error?: string;
  configured: boolean;
  mode: "stream" | "none";
}> {
  // Check Stream mode credentials
  if (account.clientId?.trim() && account.clientSecret?.trim()) {
    return {
      ok: true,
      configured: true,
      mode: "stream",
    };
  }

  return {
    ok: false,
    configured: false,
    mode: "none",
    error: "DingTalk credentials not configured. Set clientId and clientSecret for Stream mode.",
  };
}
