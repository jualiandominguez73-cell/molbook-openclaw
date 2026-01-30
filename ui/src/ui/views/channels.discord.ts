import { html, nothing } from "lit";

import { formatAgo } from "../format";
import type { DiscordStatus } from "../types";
import { t } from "../i18n";
import type { ChannelsProps } from "./channels.types";
import { renderChannelConfigSection } from "./channels.config";

export function renderDiscordCard(params: {
  props: ChannelsProps;
  discord?: DiscordStatus | null;
  accountCountLabel: unknown;
}) {
  const { props, discord, accountCountLabel } = params;
  const locale = props.locale;

  return html`
    <div class="card">
      <div class="card-title">${t(locale, "channels.discord.title")}</div>
      <div class="card-sub">${t(locale, "channels.card.subtitle")}</div>
      ${accountCountLabel}

      <div class="status-list" style="margin-top: 16px;">
        <div>
          <span class="label">${t(locale, "common.configured")}</span>
          <span>${discord?.configured ? t(locale, "common.yes") : t(locale, "common.no")}</span>
        </div>
        <div>
          <span class="label">${t(locale, "common.running")}</span>
          <span>${discord?.running ? t(locale, "common.yes") : t(locale, "common.no")}</span>
        </div>
        <div>
          <span class="label">${t(locale, "common.lastStart")}</span>
          <span>
            ${discord?.lastStartAt ? formatAgo(discord.lastStartAt, locale) : t(locale, "common.na")}
          </span>
        </div>
        <div>
          <span class="label">${t(locale, "common.lastProbe")}</span>
          <span>
            ${discord?.lastProbeAt ? formatAgo(discord.lastProbeAt, locale) : t(locale, "common.na")}
          </span>
        </div>
      </div>

      ${discord?.lastError
        ? html`<div class="callout danger" style="margin-top: 12px;">
            ${discord.lastError}
          </div>`
        : nothing}

      ${discord?.probe
        ? html`<div class="callout" style="margin-top: 12px;">
            ${t(locale, "channels.probe")} ${discord.probe.ok ? t(locale, "channels.probe.ok") : t(locale, "channels.probe.failed")} ·
            ${discord.probe.status ?? ""} ${discord.probe.error ?? ""}
          </div>`
        : nothing}

      ${renderChannelConfigSection({ channelId: "discord", props })}

      <div class="row" style="margin-top: 12px;">
        <button class="btn" @click=${() => props.onRefresh(true)}>
          ${t(locale, "channels.probe")}
        </button>
      </div>
    </div>
  `;
}
