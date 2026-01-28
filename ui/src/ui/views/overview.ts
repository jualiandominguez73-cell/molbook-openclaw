import { html } from "lit";

import type { GatewayHelloOk } from "../gateway";
import { formatAgo, formatDurationMs } from "../format";
import { formatNextRun } from "../presenter";
import type { UiSettings } from "../storage";
import { t, type Locale } from "../i18n";

export type OverviewProps = {
  connected: boolean;
  hello: GatewayHelloOk | null;
  settings: UiSettings;
  password: string;
  lastError: string | null;
  presenceCount: number;
  sessionsCount: number | null;
  cronEnabled: boolean | null;
  cronNext: number | null;
  lastChannelsRefresh: number | null;
  onSettingsChange: (next: UiSettings) => void;
  onPasswordChange: (next: string) => void;
  onSessionKeyChange: (next: string) => void;
  onConnect: () => void;
  onRefresh: () => void;
};

export function renderOverview(props: OverviewProps) {
  const snapshot = props.hello?.snapshot as
    | { uptimeMs?: number; policy?: { tickIntervalMs?: number } }
    | undefined;
  const uptime = snapshot?.uptimeMs ? formatDurationMs(snapshot.uptimeMs) : t("common.na");
  const tick = snapshot?.policy?.tickIntervalMs
    ? `${snapshot.policy.tickIntervalMs}ms`
    : t("common.na");
  const authHint = (() => {
    if (props.connected || !props.lastError) return null;
    const lower = props.lastError.toLowerCase();
    const authFailed = lower.includes("unauthorized") || lower.includes("connect failed");
    if (!authFailed) return null;
    const hasToken = Boolean(props.settings.token.trim());
    const hasPassword = Boolean(props.password.trim());
    if (!hasToken && !hasPassword) {
      return html`
        <div class="muted" style="margin-top: 8px;">
          ${t("overview.auth.required")}
          <div style="margin-top: 6px;">
            <span class="mono">clawdbot dashboard --no-open</span> → ${t("overview.auth.tokenizedUrl")}<br />
            <span class="mono">clawdbot doctor --generate-gateway-token</span> → ${t("overview.auth.setToken")}
          </div>
          <div style="margin-top: 6px;">
            <a
              class="session-link"
              href="https://docs.clawd.bot/web/dashboard"
              target="_blank"
              rel="noreferrer"
              title=${t("overview.auth.docsTitle")}
              >${t("overview.auth.docsLabel")}</a
            >
          </div>
        </div>
      `;
    }
    return html`
      <div class="muted" style="margin-top: 8px;">
        ${t("overview.auth.failed")}
        <span class="mono">clawdbot dashboard --no-open</span>${t("overview.auth.failedAfterCommand")}
        <div style="margin-top: 6px;">
          <a
            class="session-link"
            href="https://docs.clawd.bot/web/dashboard"
            target="_blank"
            rel="noreferrer"
            title=${t("overview.auth.docsTitle")}
            >${t("overview.auth.docsLabel")}</a
          >
        </div>
      </div>
    `;
  })();
  const insecureContextHint = (() => {
    if (props.connected || !props.lastError) return null;
    const isSecureContext = typeof window !== "undefined" ? window.isSecureContext : true;
    if (isSecureContext !== false) return null;
    const lower = props.lastError.toLowerCase();
    if (!lower.includes("secure context") && !lower.includes("device identity required")) {
      return null;
    }
    return html`
      <div class="muted" style="margin-top: 8px;">
        ${t("overview.insecureHttp")}
        <span class="mono">http://127.0.0.1:18789</span>${t("overview.insecureHttpAfterUrl")}
        <div style="margin-top: 6px;">
          ${t("overview.insecureHttpOption")}
          <span class="mono">gateway.controlUi.allowInsecureAuth: true</span>${t("overview.insecureHttpOptionAfter")}
        </div>
        <div style="margin-top: 6px;">
          <a
            class="session-link"
            href="https://docs.clawd.bot/gateway/tailscale"
            target="_blank"
            rel="noreferrer"
            title=${t("overview.docs.opensNewTab")}
            >${t("overview.docs.tailscaleServe")}</a
          >
          <span class="muted"> · </span>
          <a
            class="session-link"
            href="https://docs.clawd.bot/web/control-ui#insecure-http"
            target="_blank"
            rel="noreferrer"
            title=${t("overview.docs.opensNewTab")}
            >${t("overview.docs.insecureHttp")}</a
          >
        </div>
      </div>
    `;
  })();

  return html`
    <section class="grid grid-cols-2">
      <div class="card">
        <div class="card-title">${t("overview.gatewayAccess.title")}</div>
        <div class="card-sub">${t("overview.gatewayAccess.subtitle")}</div>
        <div class="form-grid" style="margin-top: 16px;">
          <label class="field">
            <span>${t("settings.language")}</span>
            <select
              .value=${props.settings.locale}
              @change=${(e: Event) => {
                const v = (e.target as HTMLSelectElement).value as Locale;
                props.onSettingsChange({ ...props.settings, locale: v });
              }}
            >
              <option value="zh-CN">${t("settings.lang.zhCN")}</option>
              <option value="en">${t("settings.lang.en")}</option>
            </select>
          </label>
          <label class="field">
            <span>${t("overview.websocketUrl")}</span>
            <input
              .value=${props.settings.gatewayUrl}
              @input=${(e: Event) => {
                const v = (e.target as HTMLInputElement).value;
                props.onSettingsChange({ ...props.settings, gatewayUrl: v });
              }}
              placeholder="ws://100.x.y.z:18789"
            />
          </label>
          <label class="field">
            <span>${t("overview.gatewayToken")}</span>
            <input
              .value=${props.settings.token}
              @input=${(e: Event) => {
                const v = (e.target as HTMLInputElement).value;
                props.onSettingsChange({ ...props.settings, token: v });
              }}
              placeholder="CLAWDBOT_GATEWAY_TOKEN"
            />
          </label>
          <label class="field">
            <span>${t("overview.passwordNotStored")}</span>
            <input
              type="password"
              .value=${props.password}
              @input=${(e: Event) => {
                const v = (e.target as HTMLInputElement).value;
                props.onPasswordChange(v);
              }}
              placeholder=${t("overview.passwordPlaceholder")}
            />
          </label>
          <label class="field">
            <span>${t("overview.defaultSessionKey")}</span>
            <input
              .value=${props.settings.sessionKey}
              @input=${(e: Event) => {
                const v = (e.target as HTMLInputElement).value;
                props.onSessionKeyChange(v);
              }}
            />
          </label>
        </div>
        <div class="row" style="margin-top: 14px;">
          <button class="btn" @click=${() => props.onConnect()}>${t("overview.connect")}</button>
          <button class="btn" @click=${() => props.onRefresh()}>${t("overview.refresh")}</button>
          <span class="muted">${t("overview.connectHint")}</span>
        </div>
      </div>

      <div class="card">
        <div class="card-title">${t("overview.snapshot.title")}</div>
        <div class="card-sub">${t("overview.snapshot.subtitle")}</div>
        <div class="stat-grid" style="margin-top: 16px;">
          <div class="stat">
            <div class="stat-label">${t("overview.status")}</div>
            <div class="stat-value ${props.connected ? "ok" : "warn"}">
              ${props.connected ? t("overview.connected") : t("overview.disconnected")}
            </div>
          </div>
          <div class="stat">
            <div class="stat-label">${t("overview.uptime")}</div>
            <div class="stat-value">${uptime}</div>
          </div>
          <div class="stat">
            <div class="stat-label">${t("overview.tickInterval")}</div>
            <div class="stat-value">${tick}</div>
          </div>
          <div class="stat">
            <div class="stat-label">${t("overview.lastChannelsRefresh")}</div>
            <div class="stat-value">
              ${props.lastChannelsRefresh
                ? formatAgo(props.lastChannelsRefresh)
                : t("common.na")}
            </div>
          </div>
        </div>
        ${props.lastError
          ? html`<div class="callout danger" style="margin-top: 14px;">
              <div>${props.lastError}</div>
              ${authHint ?? ""}
              ${insecureContextHint ?? ""}
            </div>`
          : html`<div class="callout" style="margin-top: 14px;">
              ${t("overview.channelsHint")}
            </div>`}
      </div>
    </section>

    <section class="grid grid-cols-3" style="margin-top: 18px;">
      <div class="card stat-card">
        <div class="stat-label">${t("overview.instances")}</div>
        <div class="stat-value">${props.presenceCount}</div>
        <div class="muted">${t("overview.instancesHint")}</div>
      </div>
      <div class="card stat-card">
        <div class="stat-label">${t("overview.sessions")}</div>
        <div class="stat-value">${props.sessionsCount ?? t("common.na")}</div>
        <div class="muted">${t("overview.sessionsHint")}</div>
      </div>
      <div class="card stat-card">
        <div class="stat-label">${t("overview.cron")}</div>
        <div class="stat-value">
          ${props.cronEnabled == null
            ? t("common.na")
            : props.cronEnabled
              ? t("overview.enabled")
              : t("overview.disabled")}
        </div>
        <div class="muted">${t("overview.nextWake", { when: formatNextRun(props.cronNext) })}</div>
      </div>
    </section>

    <section class="card" style="margin-top: 18px;">
      <div class="card-title">${t("overview.notes.title")}</div>
      <div class="card-sub">${t("overview.notes.subtitle")}</div>
      <div class="note-grid" style="margin-top: 14px;">
        <div>
          <div class="note-title">${t("overview.notes.tailscaleServe.title")}</div>
          <div class="muted">${t("overview.notes.tailscaleServe.body")}</div>
        </div>
        <div>
          <div class="note-title">${t("overview.notes.sessionHygiene.title")}</div>
          <div class="muted">${t("overview.notes.sessionHygiene.body")}</div>
        </div>
        <div>
          <div class="note-title">${t("overview.notes.cronReminders.title")}</div>
          <div class="muted">${t("overview.notes.cronReminders.body")}</div>
        </div>
      </div>
    </section>
  `;
}
