import { html, nothing } from "lit";

import { formatAgo } from "../format";
import type { GoogleChatStatus } from "../types";
import { t } from "../i18n";
import { renderChannelConfigSection } from "./channels.config";
import type { ChannelsProps } from "./channels.types";

export function renderGoogleChatCard(params: {
  props: ChannelsProps;
  googleChat?: GoogleChatStatus | null;
  accountCountLabel: unknown;
}) {
  const { props, googleChat, accountCountLabel } = params;
  const locale = props.locale;

  return html`
    <div class="card">
      <div class="card-title">${t(locale, "channels.googlechat.title")}</div>
      <div class="card-sub">${t(locale, "channels.card.subtitle")}</div>
      ${accountCountLabel}

      <div class="status-list" style="margin-top: 16px;">
        <div>
          <span class="label">${t(locale, "common.configured")}</span>
          <span>
            ${googleChat
              ? googleChat.configured
                ? t(locale, "common.yes")
                : t(locale, "common.no")
              : t(locale, "common.na")}
          </span>
        </div>
        <div>
          <span class="label">${t(locale, "common.running")}</span>
          <span>
            ${googleChat
              ? googleChat.running
                ? t(locale, "common.yes")
                : t(locale, "common.no")
              : t(locale, "common.na")}
          </span>
        </div>
        <div>
          <span class="label">${t(locale, "channels.googlechat.credential")}</span>
          <span>${googleChat?.credentialSource ?? t(locale, "common.na")}</span>
        </div>
        <div>
          <span class="label">${t(locale, "channels.googlechat.audience")}</span>
          <span>
            ${googleChat?.audienceType
              ? `${googleChat.audienceType}${googleChat.audience ? ` · ${googleChat.audience}` : ""}`
              : t(locale, "common.na")}
          </span>
        </div>
        <div>
          <span class="label">${t(locale, "common.lastStart")}</span>
          <span>
            ${googleChat?.lastStartAt
              ? formatAgo(googleChat.lastStartAt)
              : t(locale, "common.na")}
          </span>
        </div>
        <div>
          <span class="label">${t(locale, "common.lastProbe")}</span>
          <span>
            ${googleChat?.lastProbeAt
              ? formatAgo(googleChat.lastProbeAt)
              : t(locale, "common.na")}
          </span>
        </div>
      </div>

      ${googleChat?.lastError
        ? html`<div class="callout danger" style="margin-top: 12px;">
            ${googleChat.lastError}
          </div>`
        : nothing}

      ${googleChat?.probe
        ? html`<div class="callout" style="margin-top: 12px;">
            ${t(locale, "channels.probe")} ${googleChat.probe.ok ? t(locale, "channels.probe.ok") : t(locale, "channels.probe.failed")} ·
            ${googleChat.probe.status ?? ""} ${googleChat.probe.error ?? ""}
          </div>`
        : nothing}

      ${renderChannelConfigSection({ channelId: "googlechat", props })}

      <div class="row" style="margin-top: 12px;">
        <button class="btn" @click=${() => props.onRefresh(true)}>
          ${t(locale, "channels.probe")}
        </button>
      </div>
    </div>
  `;
}
