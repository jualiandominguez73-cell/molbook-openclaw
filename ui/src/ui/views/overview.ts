import { html } from "lit";

import type { GatewayHelloOk } from "../gateway";
import { formatAgo, formatDurationMs } from "../format";
import { formatNextRun } from "../presenter";
import type { UiSettings } from "../storage";
import { t, tFormat } from "../i18n";

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
  const locale = props.settings.locale;
  const snapshot = props.hello?.snapshot as
    | { uptimeMs?: number; policy?: { tickIntervalMs?: number } }
    | undefined;
  const uptime = snapshot?.uptimeMs
    ? formatDurationMs(snapshot.uptimeMs, locale)
    : t(locale, "overview.na");
  const tick = snapshot?.policy?.tickIntervalMs
    ? `${snapshot.policy.tickIntervalMs}ms`
    : t(locale, "overview.na");
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
          ${t(locale, "overview.auth.required")}
          <div style="margin-top: 6px;">
            <span class="mono">moltbot dashboard --no-open</span> → ${t(locale, "overview.auth.tokenHint")}<br />
            <span class="mono">moltbot doctor --generate-gateway-token</span> → ${t(locale, "overview.auth.setToken")}
          </div>
          <div style="margin-top: 6px;">
            <a
              class="session-link"
              href="https://docs.molt.bot/web/dashboard"
              target="_blank"
              rel="noreferrer"
              title=${t(locale, "overview.auth.docsTitle")}
              >${t(locale, "overview.auth.docs")}</a
            >
          </div>
        </div>
      `;
    }
    return html`
      <div class="muted" style="margin-top: 8px;">
        ${t(locale, "overview.auth.failed")}
        <div style="margin-top: 6px;">
          <a
            class="session-link"
            href="https://docs.molt.bot/web/dashboard"
            target="_blank"
            rel="noreferrer"
            title=${t(locale, "overview.auth.docsTitle")}
            >${t(locale, "overview.auth.docs")}</a
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
        ${t(locale, "overview.insecure.http")}
        <div style="margin-top: 6px;">
          ${t(locale, "overview.insecure.allow")}
        </div>
        <div style="margin-top: 6px;">
          <a
            class="session-link"
            href="https://docs.molt.bot/gateway/tailscale"
            target="_blank"
            rel="noreferrer"
            title=${t(locale, "overview.insecure.docsTailscaleTitle")}
            >${t(locale, "overview.insecure.docsTailscale")}</a
          >
          <span class="muted"> · </span>
          <a
            class="session-link"
            href="https://docs.molt.bot/web/control-ui#insecure-http"
            target="_blank"
            rel="noreferrer"
            title=${t(locale, "overview.insecure.docsHttpTitle")}
            >${t(locale, "overview.insecure.docsHttp")}</a
          >
        </div>
      </div>
    `;
  })();

  return html`
    <section class="grid grid-cols-2">
      <div class="card">
        <div class="card-title">${t(locale, "overview.gateway.title")}</div>
        <div class="card-sub">${t(locale, "overview.gateway.subtitle")}</div>
        <div class="form-grid" style="margin-top: 16px;">
          <label class="field">
            <span>${t(locale, "overview.gateway.url")}</span>
            <input
              .value=${props.settings.gatewayUrl}
              @input=${(e: Event) => {
                const v = (e.target as HTMLInputElement).value;
                props.onSettingsChange({ ...props.settings, gatewayUrl: v });
              }}
              placeholder=${t(locale, "gateway.placeholder.url")}
            />
          </label>
          <label class="field">
            <span>${t(locale, "overview.gateway.token")}</span>
            <input
              .value=${props.settings.token}
              @input=${(e: Event) => {
                const v = (e.target as HTMLInputElement).value;
                props.onSettingsChange({ ...props.settings, token: v });
              }}
              placeholder=${t(locale, "gateway.placeholder.token")}
            />
          </label>
          <label class="field">
            <span>${t(locale, "overview.gateway.password")}</span>
            <input
              type="password"
              .value=${props.password}
              @input=${(e: Event) => {
                const v = (e.target as HTMLInputElement).value;
                props.onPasswordChange(v);
              }}
              placeholder=${t(locale, "overview.gateway.passwordPlaceholder")}
            />
          </label>
          <label class="field">
            <span>${t(locale, "overview.gateway.session")}</span>
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
          <button class="btn" @click=${() => props.onConnect()}>
            ${t(locale, "overview.gateway.connect")}
          </button>
          <button class="btn" @click=${() => props.onRefresh()}>
            ${t(locale, "overview.gateway.refresh")}
          </button>
          <span class="muted">${t(locale, "overview.gateway.hint")}</span>
        </div>
      </div>

      <div class="card">
        <div class="card-title">${t(locale, "overview.snapshot.title")}</div>
        <div class="card-sub">${t(locale, "overview.snapshot.subtitle")}</div>
        <div class="stat-grid" style="margin-top: 16px;">
          <div class="stat">
            <div class="stat-label">${t(locale, "overview.snapshot.status")}</div>
            <div class="stat-value ${props.connected ? "ok" : "warn"}">
              ${props.connected
                ? t(locale, "overview.snapshot.connected")
                : t(locale, "overview.snapshot.disconnected")}
            </div>
          </div>
          <div class="stat">
            <div class="stat-label">${t(locale, "overview.snapshot.uptime")}</div>
            <div class="stat-value">${uptime}</div>
          </div>
          <div class="stat">
            <div class="stat-label">${t(locale, "overview.snapshot.tick")}</div>
            <div class="stat-value">${tick}</div>
          </div>
          <div class="stat">
            <div class="stat-label">${t(locale, "overview.snapshot.channels")}</div>
            <div class="stat-value">
              ${props.lastChannelsRefresh
                ? formatAgo(props.lastChannelsRefresh)
                : t(locale, "overview.na")}
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
              ${t(locale, "overview.snapshot.channelsHint")}
            </div>`}
      </div>
    </section>

    <section class="grid grid-cols-3" style="margin-top: 18px;">
      <div class="card stat-card">
        <div class="stat-label">${t(locale, "overview.stats.instances")}</div>
        <div class="stat-value">${props.presenceCount}</div>
        <div class="muted">${t(locale, "overview.stats.instancesHint")}</div>
      </div>
      <div class="card stat-card">
        <div class="stat-label">${t(locale, "overview.stats.sessions")}</div>
        <div class="stat-value">${props.sessionsCount ?? t(locale, "overview.na")}</div>
        <div class="muted">${t(locale, "overview.stats.sessionsHint")}</div>
      </div>
      <div class="card stat-card">
        <div class="stat-label">${t(locale, "overview.stats.cron")}</div>
        <div class="stat-value">
          ${props.cronEnabled == null
            ? t(locale, "overview.na")
            : props.cronEnabled
              ? t(locale, "overview.stats.enabled")
              : t(locale, "overview.stats.disabled")}
        </div>
        <div class="muted">
          ${tFormat(
            locale,
            "overview.stats.nextWake",
            { time: formatNextRun(props.cronNext, locale) },
            `Next wake ${formatNextRun(props.cronNext, locale)}`,
          )}
        </div>
      </div>
    </section>

    <section class="card" style="margin-top: 18px;">
      <div class="card-title">${t(locale, "overview.notes.title")}</div>
      <div class="card-sub">${t(locale, "overview.notes.subtitle")}</div>
      <div class="note-grid" style="margin-top: 14px;">
        <div>
          <div class="note-title">${t(locale, "overview.notes.tailscale")}</div>
          <div class="muted">${t(locale, "overview.notes.tailscaleHint")}</div>
        </div>
        <div>
          <div class="note-title">${t(locale, "overview.notes.session")}</div>
          <div class="muted">${t(locale, "overview.notes.sessionHint")}</div>
        </div>
        <div>
          <div class="note-title">${t(locale, "overview.notes.cron")}</div>
          <div class="muted">${t(locale, "overview.notes.cronHint")}</div>
        </div>
      </div>
    </section>
  `;
}
