import { html, nothing } from "lit";

import { formatAgo } from "../format";
import type { WhatsAppStatus } from "../types";
import { t } from "../i18n";
import type { ChannelsProps } from "./channels.types";
import { renderChannelConfigSection } from "./channels.config";
import { formatDuration } from "./channels.shared";

export function renderWhatsAppCard(params: {
  props: ChannelsProps;
  whatsapp?: WhatsAppStatus;
  accountCountLabel: unknown;
}) {
  const { props, whatsapp, accountCountLabel } = params;
  const locale = props.locale;

  return html`
    <div class="card">
      <div class="card-title">${t(locale, "channels.whatsapp.title")}</div>
      <div class="card-sub">${t(locale, "channels.whatsapp.subtitle")}</div>
      ${accountCountLabel}

      <div class="status-list" style="margin-top: 16px;">
        <div>
          <span class="label">${t(locale, "common.configured")}</span>
          <span>${whatsapp?.configured ? t(locale, "common.yes") : t(locale, "common.no")}</span>
        </div>
        <div>
          <span class="label">${t(locale, "channels.whatsapp.linked")}</span>
          <span>${whatsapp?.linked ? t(locale, "common.yes") : t(locale, "common.no")}</span>
        </div>
        <div>
          <span class="label">${t(locale, "common.running")}</span>
          <span>${whatsapp?.running ? t(locale, "common.yes") : t(locale, "common.no")}</span>
        </div>
        <div>
          <span class="label">${t(locale, "channels.whatsapp.connected")}</span>
          <span>${whatsapp?.connected ? t(locale, "common.yes") : t(locale, "common.no")}</span>
        </div>
        <div>
          <span class="label">${t(locale, "channels.whatsapp.lastConnect")}</span>
          <span>
            ${whatsapp?.lastConnectedAt
              ? formatAgo(whatsapp.lastConnectedAt, locale)
              : t(locale, "common.na")}
          </span>
        </div>
        <div>
          <span class="label">${t(locale, "channels.whatsapp.lastMessage")}</span>
          <span>
            ${whatsapp?.lastMessageAt ? formatAgo(whatsapp.lastMessageAt, locale) : t(locale, "common.na")}
          </span>
        </div>
        <div>
          <span class="label">${t(locale, "channels.whatsapp.authAge")}</span>
          <span>
            ${whatsapp?.authAgeMs != null
              ? formatDuration(whatsapp.authAgeMs, locale) 
              : t(locale, "common.na")}
          </span>
        </div>
      </div>

      ${whatsapp?.lastError
        ? html`<div class="callout danger" style="margin-top: 12px;">
            ${whatsapp.lastError}
          </div>`
        : nothing}

      ${props.whatsappMessage
        ? html`<div class="callout" style="margin-top: 12px;">
            ${props.whatsappMessage}
          </div>`
        : nothing}

      ${props.whatsappQrDataUrl
        ? html`<div class="qr-wrap">
            <img src=${props.whatsappQrDataUrl} alt="WhatsApp QR" />
          </div>`
        : nothing}

      <div class="row" style="margin-top: 14px; flex-wrap: wrap;">
        <button
          class="btn primary"
          ?disabled=${props.whatsappBusy}
          @click=${() => props.onWhatsAppStart(false)}
        >
          ${props.whatsappBusy ? t(locale, "channels.whatsapp.working") : t(locale, "channels.whatsapp.showQr")}
        </button>
        <button
          class="btn"
          ?disabled=${props.whatsappBusy}
          @click=${() => props.onWhatsAppStart(true)}
        >
          ${t(locale, "channels.whatsapp.relink")}
        </button>
        <button
          class="btn"
          ?disabled=${props.whatsappBusy}
          @click=${() => props.onWhatsAppWait()}
        >
          ${t(locale, "channels.whatsapp.wait")}
        </button>
        <button
          class="btn danger"
          ?disabled=${props.whatsappBusy}
          @click=${() => props.onWhatsAppLogout()}
        >
          ${t(locale, "channels.whatsapp.logout")}
        </button>
        <button class="btn" @click=${() => props.onRefresh(true)}>
          ${t(locale, "common.refresh")}
        </button>
      </div>

      ${renderChannelConfigSection({ channelId: "whatsapp", props })}
    </div>
  `;
}
