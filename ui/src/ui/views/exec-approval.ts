import { html, nothing } from "lit";

import type { AppViewState } from "../app-view-state";
import { t, tFormat } from "../i18n";

function formatRemaining(ms: number, locale?: string): string {
  const remaining = Math.max(0, ms);
  
  if (locale === "zh") {
    const totalSeconds = Math.floor(remaining / 1000);
    if (totalSeconds < 60) return `${totalSeconds}秒`;
    const minutes = Math.floor(totalSeconds / 60);
    if (minutes < 60) return `${minutes}分`;
    const hours = Math.floor(minutes / 60);
    return `${hours}小时`;
  }

  const totalSeconds = Math.floor(remaining / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h`;
}

function renderMetaRow(label: string, value?: string | null) {
  if (!value) return nothing;
  return html`<div class="exec-approval-meta-row"><span>${label}</span><span>${value}</span></div>`;
}

export function renderExecApprovalPrompt(state: AppViewState) {
  const active = state.execApprovalQueue[0];
  const locale = state.settings.locale;
  if (!active) return nothing;
  const request = active.request;
  const remainingMs = active.expiresAtMs - Date.now();
  const remaining = remainingMs > 0 ? tFormat(locale, "execApproval.expiresIn", { value: formatRemaining(remainingMs, locale) }) : t(locale, "execApproval.expired");
  const queueCount = state.execApprovalQueue.length;
  return html`
    <div class="exec-approval-overlay" role="dialog" aria-live="polite">
      <div class="exec-approval-card">
        <div class="exec-approval-header">
          <div>
            <div class="exec-approval-title">${t(locale, "execApproval.title")}</div>
            <div class="exec-approval-sub">${remaining}</div>
          </div>
          ${queueCount > 1
            ? html`<div class="exec-approval-queue">${tFormat(locale, "execApproval.pending", { count: queueCount })}</div>`
            : nothing}
        </div>
        <div class="exec-approval-command mono">${request.command}</div>
        <div class="exec-approval-meta">
          ${renderMetaRow(t(locale, "execApproval.host"), request.host)}
          ${renderMetaRow(t(locale, "execApproval.agent"), request.agentId)}
          ${renderMetaRow(t(locale, "execApproval.session"), request.sessionKey)}
          ${renderMetaRow(t(locale, "execApproval.cwd"), request.cwd)}
          ${renderMetaRow(t(locale, "execApproval.resolved"), request.resolvedPath)}
          ${renderMetaRow(t(locale, "execApproval.security"), request.security)}
          ${renderMetaRow(t(locale, "execApproval.ask"), request.ask)}
        </div>
        ${state.execApprovalError
          ? html`<div class="exec-approval-error">${state.execApprovalError}</div>`
          : nothing}
        <div class="exec-approval-actions">
          <button
            class="btn primary"
            ?disabled=${state.execApprovalBusy}
            @click=${() => state.handleExecApprovalDecision("allow-once")}
          >
            ${t(locale, "execApproval.allowOnce")}
          </button>
          <button
            class="btn"
            ?disabled=${state.execApprovalBusy}
            @click=${() => state.handleExecApprovalDecision("allow-always")}
          >
            ${t(locale, "execApproval.alwaysAllow")}
          </button>
          <button
            class="btn danger"
            ?disabled=${state.execApprovalBusy}
            @click=${() => state.handleExecApprovalDecision("deny")}
          >
            ${t(locale, "execApproval.deny")}
          </button>
        </div>
      </div>
    </div>
  `;
}
