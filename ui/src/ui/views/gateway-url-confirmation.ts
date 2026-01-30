import { html, nothing } from "lit";

import type { AppViewState } from "../app-view-state";
import { t } from "../i18n";

export function renderGatewayUrlConfirmation(state: AppViewState) {
  const { pendingGatewayUrl } = state;
  const locale = state.settings.locale;
  if (!pendingGatewayUrl) return nothing;

  return html`
    <div class="exec-approval-overlay" role="dialog" aria-modal="true" aria-live="polite">
      <div class="exec-approval-card">
        <div class="exec-approval-header">
          <div>
            <div class="exec-approval-title">${t(locale, "gateway.url.confirm.title")}</div>
            <div class="exec-approval-sub">${t(locale, "gateway.url.confirm.subtitle")}</div>
          </div>
        </div>
        <div class="exec-approval-command mono">${pendingGatewayUrl}</div>
        <div class="callout danger" style="margin-top: 12px;">
          ${t(locale, "gateway.url.confirm.warning")}
        </div>
        <div class="exec-approval-actions">
          <button
            class="btn primary"
            @click=${() => state.handleGatewayUrlConfirm()}
          >
            ${t(locale, "gateway.url.confirm.confirm")}
          </button>
          <button
            class="btn"
            @click=${() => state.handleGatewayUrlCancel()}
          >
            ${t(locale, "gateway.url.confirm.cancel")}
          </button>
        </div>
      </div>
    </div>
  `;
}
