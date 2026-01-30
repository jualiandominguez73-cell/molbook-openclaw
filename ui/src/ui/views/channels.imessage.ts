import { html, nothing } from "lit";

import { formatAgo } from "../format";
import type { IMessageStatus } from "../types";
import { t } from "../i18n";
import type { ChannelsProps } from "./channels.types";
import { renderChannelConfigSection } from "./channels.config";

export function renderIMessageCard(params: {
  props: ChannelsProps;
  imessage?: IMessageStatus | null;
  accountCountLabel: unknown;
}) {
  const { props, imessage, accountCountLabel } = params;
  const locale = props.locale;

  return html`
    <div class="card">
      <div class="card-title">${t(locale, "channels.imessage.title")}</div>
      <div class="card-sub">${t(locale, "channels.card.subtitle")}</div>
      ${accountCountLabel}

      <div class="status-list" style="margin-top: 16px;">
        <div>
          <span class="label">${t(locale, "common.configured")}</span>
          <span>${imessage?.configured ? t(locale, "common.yes") : t(locale, "common.no")}</span>
        </div>
        <div>
          <span class="label">${t(locale, "common.running")}</span>
          <span>${imessage?.running ? t(locale, "common.yes") : t(locale, "common.no")}</span>
        </div>
        <div>
          <span class="label">${t(locale, "common.lastStart")}</span>
          <span>
            ${imessage?.lastStartAt ? formatAgo(imessage.lastStartAt, locale) : t(locale, "common.na")}
          </span>
        </div>
        <div>
          <span class="label">${t(locale, "common.lastProbe")}</span>
          <span>
            ${imessage?.lastProbeAt ? formatAgo(imessage.lastProbeAt, locale) : t(locale, "common.na")}
          </span>
        </div>
      </div>

      ${imessage?.lastError
        ? html`<div class="callout danger" style="margin-top: 12px;">
            ${imessage.lastError}
          </div>`
        : nothing}

      ${imessage?.probe
        ? html`<div class="callout" style="margin-top: 12px;">
            ${t(locale, "channels.probe")} ${imessage.probe.ok ? t(locale, "channels.probe.ok") : t(locale, "channels.probe.failed")} ·
            ${imessage.probe.error ?? ""}
          </div>`
        : nothing}

      ${renderChannelConfigSection({ channelId: "imessage", props })}

      <div class="row" style="margin-top: 12px;">
        <button class="btn" @click=${() => props.onRefresh(true)}>
          ${t(locale, "channels.probe")}
        </button>
      </div>
    </div>
  `;
}
