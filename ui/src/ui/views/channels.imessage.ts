import { html, nothing } from "lit";

import { formatAgo } from "../format";
import type { IMessageStatus } from "../types";
import type { ChannelsProps } from "./channels.types";
import { renderChannelConfigSection } from "./channels.config";
import { t } from "../i18n";

export function renderIMessageCard(params: {
  props: ChannelsProps;
  imessage?: IMessageStatus | null;
  accountCountLabel: unknown;
}) {
  const { props, imessage, accountCountLabel } = params;

  return html`
    <div class="card">
      <div class="card-title">${t("channels.imessage.title")}</div>
      <div class="card-sub">${t("channels.imessage.subtitle")}</div>
      ${accountCountLabel}

      <div class="status-list" style="margin-top: 16px;">
        <div>
          <span class="label">${t("channels.status.configured")}</span>
          <span>${imessage?.configured ? t("common.yes") : t("common.no")}</span>
        </div>
        <div>
          <span class="label">${t("channels.status.running")}</span>
          <span>${imessage?.running ? t("common.yes") : t("common.no")}</span>
        </div>
        <div>
          <span class="label">${t("channels.discord.lastStart")}</span>
          <span>${imessage?.lastStartAt ? formatAgo(imessage.lastStartAt) : t("common.na")}</span>
        </div>
        <div>
          <span class="label">${t("channels.discord.lastProbe")}</span>
          <span>${imessage?.lastProbeAt ? formatAgo(imessage.lastProbeAt) : t("common.na")}</span>
        </div>
      </div>

      ${imessage?.lastError
        ? html`<div class="callout danger" style="margin-top: 12px;">
            ${imessage.lastError}
          </div>`
        : nothing}

      ${imessage?.probe
        ? html`<div class="callout" style="margin-top: 12px;">
            ${t("channels.probe")} ${imessage.probe.ok ? t("channels.probeOk") : t("channels.probeFailed")} ·
            ${imessage.probe.error ?? ""}
          </div>`
        : nothing}

      ${renderChannelConfigSection({ channelId: "imessage", props })}

      <div class="row" style="margin-top: 12px;">
        <button class="btn" @click=${() => props.onRefresh(true)}>
          ${t("channels.probe")}
        </button>
      </div>
    </div>
  `;
}
