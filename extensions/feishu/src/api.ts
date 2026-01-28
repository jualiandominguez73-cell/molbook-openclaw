import type { FeishuChannelConfig, ResolvedFeishuAccount } from "./accounts.js";

const FEISHU_API_BASE = "https://open.feishu.cn/open-apis";

type TokenCacheEntry = {
  token: string;
  expiresAt: number;
};

const tokenCache = new Map<string, TokenCacheEntry>();

function cacheKey(appId: string, appSecret: string): string {
  return `${appId}:${appSecret}`;
}

function shouldRefreshToken(entry: TokenCacheEntry): boolean {
  return Date.now() + 30_000 >= entry.expiresAt;
}

async function fetchTenantToken(params: {
  appId: string;
  appSecret: string;
}): Promise<{ token: string; expiresAt: number }> {
  const res = await fetch(`${FEISHU_API_BASE}/auth/v3/tenant_access_token/internal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      app_id: params.appId,
      app_secret: params.appSecret,
    }),
  });
  if (!res.ok) {
    throw new Error(`Feishu token request failed: HTTP ${res.status}`);
  }
  const payload = (await res.json()) as {
    code?: number;
    msg?: string;
    tenant_access_token?: string;
    expire?: number;
  };
  if (payload.code !== 0 || !payload.tenant_access_token) {
    throw new Error(`Feishu token error: ${payload.msg ?? "unknown error"}`);
  }
  const expiresIn = Math.max(60, Number(payload.expire ?? 3600));
  return {
    token: payload.tenant_access_token,
    expiresAt: Date.now() + expiresIn * 1000,
  };
}

export async function resolveFeishuTenantToken(params: {
  config: FeishuChannelConfig;
}): Promise<string> {
  const appId = params.config.appId?.trim() || params.config.app_id?.trim();
  const appSecret = params.config.appSecret?.trim() || params.config.app_secret?.trim();
  if (!appId || !appSecret) {
    throw new Error("Feishu appId/appSecret not configured");
  }
  const key = cacheKey(appId, appSecret);
  const cached = tokenCache.get(key);
  if (cached && !shouldRefreshToken(cached)) {
    return cached.token;
  }
  const fetched = await fetchTenantToken({ appId, appSecret });
  tokenCache.set(key, fetched);
  return fetched.token;
}

export async function sendFeishuMessage(params: {
  account: ResolvedFeishuAccount;
  receiveIdType: "chat_id" | "user_id" | "open_id";
  receiveId: string;
  text: string;
}): Promise<{ messageId?: string }> {
  const token = await resolveFeishuTenantToken({ config: params.account.config });
  const res = await fetch(
    `${FEISHU_API_BASE}/im/v1/messages?receive_id_type=${params.receiveIdType}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        receive_id: params.receiveId,
        msg_type: "text",
        content: JSON.stringify({ text: params.text }),
      }),
    },
  );
  if (!res.ok) {
    throw new Error(`Feishu send failed: HTTP ${res.status}`);
  }
  const payload = (await res.json()) as {
    code?: number;
    msg?: string;
    data?: { message_id?: string };
  };
  if (payload.code !== 0) {
    throw new Error(`Feishu send error: ${payload.msg ?? "unknown error"}`);
  }
  return { messageId: payload.data?.message_id };
}

export async function probeFeishu(account: ResolvedFeishuAccount): Promise<{
  ok: boolean;
  reason?: string;
}> {
  try {
    if (!account.appId || !account.appSecret) {
      return { ok: false, reason: "missing appId/appSecret" };
    }
    await resolveFeishuTenantToken({ config: account.config });
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
}
