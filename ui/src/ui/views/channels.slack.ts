import { html, nothing } from "lit";

import { formatAgo } from "../format";
import type { SlackStatus } from "../types";
import { t } from "../i18n";
import type { ChannelsProps } from "./channels.types";
import { renderChannelConfigSection } from "./channels.config";

export function renderSlackCard(params: {
  props: ChannelsProps;
  slack?: SlackStatus | null;
  accountCountLabel: unknown;
}) {
  const { props, slack, accountCountLabel } = params;
  const locale = props.locale;

  return html`
    <div class="card">
      <div class="card-title">${t(locale, "channels.slack.title")}</div>
      <div class="card-sub">${t(locale, "channels.card.subtitle")}</div>
      ${accountCountLabel}

      <div class="status-list" style="margin-top: 16px;">
        <div>
          <span class="label">${t(locale, "common.configured")}</span>
          <span>${slack?.configured ? t(locale, "common.yes") : t(locale, "common.no")}</span>
        </div>
        <div>
          <span class="label">${t(locale, "common.running")}</span>
          <span>${slack?.running ? t(locale, "common.yes") : t(locale, "common.no")}</span>
        </div>
        <div>
          <span class="label">${t(locale, "common.lastStart")}</span>
          <span>
            ${slack?.lastStartAt ? formatAgo(slack.lastStartAt, locale) : t(locale, "common.na")}
          </span>
        </div>
        <div>
          <span class="label">${t(locale, "common.lastProbe")}</span>
          <span>
            ${slack?.lastProbeAt ? formatAgo(slack.lastProbeAt, locale) : t(locale, "common.na")}
          </span>
        </div>
      </div>

      ${slack?.lastError
        ? html`<div class="callout danger" style="margin-top: 12px;">
            ${slack.lastError}
          </div>`
        : nothing}

      ${slack?.probe
        ? html`<div class="callout" style="margin-top: 12px;">
            ${t(locale, "channels.probe")} ${slack.probe.ok ? t(locale, "channels.probe.ok") : t(locale, "channels.probe.failed")} ·
            ${slack.probe.status ?? ""} ${slack.probe.error ?? ""}
          </div>`
        : nothing}

      ${renderChannelConfigSection({ channelId: "slack", props })}

      <div class="row" style="margin-top: 12px;">
        <button class="btn" @click=${() => props.onRefresh(true)}>
          ${t(locale, "channels.probe")}
        </button>
      </div>
    </div>
  `;
}
