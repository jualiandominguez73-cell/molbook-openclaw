# Where the gateway token/password is stored and read

There are two sides: **gateway (server)** and **Control UI (client)**. They must use the same secret.

**Original OpenClaw (upstream) – THE place:**

- **Server:** One function resolves the expected token/password: **`src/gateway/auth.ts`** → **`resolveGatewayAuth()`**. It reads **config** (`gateway.auth.token`, `gateway.auth.password`) and **env** (`OPENCLAW_GATEWAY_TOKEN`, `OPENCLAW_GATEWAY_PASSWORD`, then `CLAWDBOT_GATEWAY_*` fallbacks). That return value is the single source the gateway uses to validate connections.
- **Dashboard:** **`src/commands/dashboard.ts`** builds the tokenized URL from the same sources: `cfg.gateway?.auth?.token ?? process.env.OPENCLAW_GATEWAY_TOKEN` (token only; no password in URL in upstream).
- **UI:** Token is stored in **localStorage** under key **`openclaw.control.settings.v1`** (see **`ui/src/ui/storage.ts`**). Field **`token`** in that JSON object. Password is not stored (in-memory only).

---

## Gateway (server) – expected token/password

**THE place the gateway gets the secret it validates against:**

1. **Config file** – `gateway.auth.token` and `gateway.auth.password`  
   - File: config path from `resolveConfigPath()` (e.g. `~/.clawdbot/config.json` or `~/.clawdbot-dev/...` when `CLAWDBOT_PROFILE=dev`).  
   - Code: `loadConfig()` → `cfg.gateway?.auth`; then passed into `resolveGatewayAuth()`.

2. **Environment** – `CLAWDBOT_GATEWAY_TOKEN`, `CLAWDBOT_GATEWAY_PASSWORD`  
   - Override or supply values when not in config.

3. **Resolution** – **`src/gateway/auth.ts`** `resolveGatewayAuth()` (lines 167–185):
   - `token = authConfig.token ?? env.CLAWDBOT_GATEWAY_TOKEN`
   - `password = authConfig.password ?? env.CLAWDBOT_GATEWAY_PASSWORD`
   - That `ResolvedGatewayAuth` is what the gateway uses to accept or reject connections.

So the server’s single source of truth is: **config `gateway.auth` + env**, merged in `resolveGatewayAuth()`.

---

## Control UI (client) – token/password it sends

**THE place the UI gets the secret it sends in `connect`:**

1. **Token**
   - **Stored:** `localStorage` key **`moltbot.control.settings.v1`** (JSON object), field **`token`**.
   - **Code:** `ui/src/ui/storage.ts` – `loadSettings()` reads it, `saveSettings()` writes it (via `applySettings()`).
   - **Set when:** User pastes in “Gateway Token” field, or opens a URL with `?token=...` (then `app-settings.ts` `applySettingsFromUrl()` → `applySettings()` → `saveSettings()`).

2. **Password**
   - **Not stored.** In-memory only: **`host.password`**.
   - **Set when:** User opens URL with `?password=...` (e.g. dev redirect to `?password=dev`), or types in “Password (not stored)”.
   - **Code:** `app-settings.ts` `applySettingsFromUrl()` sets `host.password`; overview input calls `onPasswordChange(v)`.

3. **When connecting** – **`ui/src/ui/app-gateway.ts`** `connectGateway()` (lines 121–124):
   - `token = host.settings.token` (from localStorage/settings).
   - `password = host.password ?? token` (in-memory password, or fallback to token).
   - Those are passed to `GatewayBrowserClient` and sent in `connect` params as `auth.token` and `auth.password`.

So the client’s sources are: **localStorage (`moltbot.control.settings.v1`.token)** for token, and **in-memory (`host.password`)** or **URL (`?password=`) ** for password.

---

## Summary

| Side   | What it uses                         | Where it lives / is resolved                    |
|--------|--------------------------------------|-------------------------------------------------|
| Gateway| Expected token/password              | Config `gateway.auth` + env → `auth.ts` `resolveGatewayAuth()` |
| UI     | Token sent in connect                | localStorage `moltbot.control.settings.v1` → `settings.token` |
| UI     | Password sent in connect             | In-memory `host.password` or URL `?password=` (or fallback `token`) |

For auto-connect: when no gateway auth is configured on startup, the gateway generates a token, writes `gateway.auth: { mode: "token", token: "<generated>" }` to config, and the Control UI is redirected to `/?token=<generated>` when you open the root URL so the UI receives the token and connects without manual paste.
