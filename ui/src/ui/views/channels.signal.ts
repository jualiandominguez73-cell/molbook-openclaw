import { html, nothing } from "lit";

import { formatAgo } from "../format";
import type { SignalStatus } from "../types";
import { t } from "../i18n";
import type { ChannelsProps } from "./channels.types";
import { renderChannelConfigSection } from "./channels.config";

export function renderSignalCard(params: {
  props: ChannelsProps;
  signal?: SignalStatus | null;
  accountCountLabel: unknown;
}) {
  const { props, signal, accountCountLabel } = params;
  const locale = props.locale;

  return html`
    <div class="card">
      <div class="card-title">${t(locale, "channels.signal.title")}</div>
      <div class="card-sub">${t(locale, "channels.card.subtitle")}</div>
      ${accountCountLabel}

      <div class="status-list" style="margin-top: 16px;">
        <div>
          <span class="label">${t(locale, "common.configured")}</span>
          <span>${signal?.configured ? t(locale, "common.yes") : t(locale, "common.no")}</span>
        </div>
        <div>
          <span class="label">${t(locale, "common.running")}</span>
          <span>${signal?.running ? t(locale, "common.yes") : t(locale, "common.no")}</span>
        </div>
        <div>
          <span class="label">${t(locale, "common.lastStart")}</span>
          <span>
            ${signal?.lastStartAt ? formatAgo(signal.lastStartAt, locale) : t(locale, "common.na")}
          </span>
        </div>
        <div>
          <span class="label">${t(locale, "common.lastProbe")}</span>
          <span>
            ${signal?.lastProbeAt ? formatAgo(signal.lastProbeAt, locale) : t(locale, "common.na")}
          </span>
        </div>
      </div>

      ${signal?.lastError
        ? html`<div class="callout danger" style="margin-top: 12px;">
            ${signal.lastError}
          </div>`
        : nothing}

      ${signal?.probe
        ? html`<div class="callout" style="margin-top: 12px;">
            ${t(locale, "channels.probe")} ${signal.probe.ok ? t(locale, "channels.probe.ok") : t(locale, "channels.probe.failed")} ·
            ${signal.probe.status ?? ""} ${signal.probe.error ?? ""}
          </div>`
        : nothing}

      ${renderChannelConfigSection({ channelId: "signal", props })}

      <div class="row" style="margin-top: 12px;">
        <button class="btn" @click=${() => props.onRefresh(true)}>
          ${t(locale, "channels.probe")}
        </button>
      </div>
    </div>
  `;
}
