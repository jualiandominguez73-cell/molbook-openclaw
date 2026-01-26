import { html, nothing } from "lit";

import { icon } from "../icons";
import type { AppViewState } from "../app-view-state";

export type ExecApprovalDecision =
  | "allow-once"
  | "allow-session"
  | "allow-always"
  | "deny"
  | "deny-always";

export type ExecApprovalHistoryEntry = {
  id: string;
  command: string;
  decision: ExecApprovalDecision;
  timestamp: number;
  agentId?: string;
  sessionKey?: string;
};

function formatRemaining(ms: number): string {
  const remaining = Math.max(0, ms);
  const totalSeconds = Math.floor(remaining / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h`;
}

function formatAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function renderMetaRow(label: string, value?: string | null) {
  if (!value) return nothing;
  return html`<div class="exec-approval-meta-row"><span>${label}</span><span>${value}</span></div>`;
}

function truncateCommand(command: string, maxLen = 60): string {
  if (command.length <= maxLen) return command;
  return command.slice(0, maxLen - 3) + "...";
}

export function renderExecApprovalPrompt(state: AppViewState) {
  const active = state.execApprovalQueue[0];
  if (!active) return nothing;
  const request = active.request;
  const remainingMs = active.expiresAtMs - Date.now();
  const remaining = remainingMs > 0 ? `expires in ${formatRemaining(remainingMs)}` : "expired";
  const queueCount = state.execApprovalQueue.length;
  const showAdvanced = state.execApprovalShowAdvanced ?? false;

  return html`
    <div class="exec-approval-overlay" role="dialog" aria-live="polite">
      <div class="exec-approval-card">
        <div class="exec-approval-header">
          <div>
            <div class="exec-approval-title">
              ${icon("shield", { size: 18 })}
              Exec approval needed
            </div>
            <div class="exec-approval-sub">${remaining}</div>
          </div>
          <div class="exec-approval-header-right">
            ${queueCount > 1
              ? html`<div class="exec-approval-queue">${queueCount} pending</div>`
              : nothing}
            ${state.execApprovalHistory?.length
              ? html`
                  <button
                    class="exec-approval-history-btn"
                    title="View approval history"
                    @click=${() => state.toggleExecApprovalHistory?.()}
                  >
                    ${icon("clock", { size: 14 })}
                  </button>
                `
              : nothing}
          </div>
        </div>
        <div class="exec-approval-command mono">${request.command}</div>
        <div class="exec-approval-meta">
          ${renderMetaRow("Host", request.host)}
          ${renderMetaRow("Agent", request.agentId)}
          ${renderMetaRow("Session", request.sessionKey)}
          ${renderMetaRow("CWD", request.cwd)}
          ${renderMetaRow("Resolved", request.resolvedPath)}
          ${renderMetaRow("Security", request.security)}
          ${renderMetaRow("Ask", request.ask)}
        </div>
        ${state.execApprovalError
          ? html`<div class="exec-approval-error">${state.execApprovalError}</div>`
          : nothing}
        <div class="exec-approval-actions">
          <button
            class="btn primary"
            ?disabled=${state.execApprovalBusy}
            @click=${() => state.handleExecApprovalDecision("allow-once")}
            title="Allow this command once"
          >
            ${icon("check", { size: 14 })}
            Allow once
          </button>
          <button
            class="btn"
            ?disabled=${state.execApprovalBusy}
            @click=${() => state.handleExecApprovalDecision("allow-session")}
            title="Allow this command for the current session only"
          >
            ${icon("check-circle", { size: 14 })}
            Allow for session
          </button>
          <button
            class="btn"
            ?disabled=${state.execApprovalBusy}
            @click=${() => state.handleExecApprovalDecision("allow-always")}
            title="Always allow this command pattern"
          >
            ${icon("shield", { size: 14 })}
            Always allow
          </button>
          <button
            class="btn danger"
            ?disabled=${state.execApprovalBusy}
            @click=${() => state.handleExecApprovalDecision("deny")}
            title="Deny this command"
          >
            ${icon("x", { size: 14 })}
            Deny
          </button>
        </div>
        <div class="exec-approval-advanced-toggle">
          <button
            class="exec-approval-advanced-btn"
            @click=${() => state.toggleExecApprovalAdvanced?.()}
          >
            ${icon(showAdvanced ? "chevron-up" : "chevron-down", { size: 12 })}
            ${showAdvanced ? "Hide advanced options" : "Show advanced options"}
          </button>
        </div>
        ${showAdvanced
          ? html`
              <div class="exec-approval-advanced">
                <button
                  class="btn btn--sm danger"
                  ?disabled=${state.execApprovalBusy}
                  @click=${() => state.handleExecApprovalDecision("deny-always")}
                  title="Always deny this command pattern"
                >
                  ${icon("shield-off", { size: 12 })}
                  Always deny this pattern
                </button>
                <button
                  class="btn btn--sm"
                  ?disabled=${state.execApprovalBusy}
                  @click=${() => state.extendExecApprovalTimeout?.()}
                  title="Extend the timeout for this approval"
                >
                  ${icon("clock", { size: 12 })}
                  Extend timeout (+60s)
                </button>
              </div>
            `
          : nothing}
      </div>
    </div>
  `;
}

export function renderExecApprovalHistory(state: AppViewState) {
  if (!state.execApprovalHistoryOpen) return nothing;
  const history = state.execApprovalHistory ?? [];

  const decisionBadgeClass = (decision: ExecApprovalDecision) => {
    if (decision.startsWith("allow")) return "badge--ok";
    if (decision.startsWith("deny")) return "badge--danger";
    return "badge--muted";
  };

  const decisionLabel = (decision: ExecApprovalDecision) => {
    switch (decision) {
      case "allow-once":
        return "Allowed once";
      case "allow-session":
        return "Allowed (session)";
      case "allow-always":
        return "Always allowed";
      case "deny":
        return "Denied";
      case "deny-always":
        return "Always denied";
      default:
        return decision;
    }
  };

  return html`
    <div class="exec-approval-history-backdrop" @click=${() => state.toggleExecApprovalHistory?.()}></div>
    <div class="exec-approval-history-panel">
      <div class="exec-approval-history-header">
        <h3>Approval History</h3>
        <button
          class="btn btn--icon btn--sm"
          @click=${() => state.toggleExecApprovalHistory?.()}
          title="Close"
        >
          ${icon("x", { size: 14 })}
        </button>
      </div>
      <div class="exec-approval-history-body">
        ${history.length === 0
          ? html`
              <div class="exec-approval-history-empty">
                ${icon("clock", { size: 32 })}
                <p>No approval history yet</p>
              </div>
            `
          : html`
              <div class="exec-approval-history-list">
                ${history.slice(0, 50).map(
                  (entry) => html`
                    <div class="exec-approval-history-item">
                      <div class="exec-approval-history-item-header">
                        <span class="badge ${decisionBadgeClass(entry.decision)}">
                          ${decisionLabel(entry.decision)}
                        </span>
                        <span class="exec-approval-history-item-time">${formatAgo(entry.timestamp)}</span>
                      </div>
                      <div class="exec-approval-history-item-command mono">
                        ${truncateCommand(entry.command)}
                      </div>
                      <div class="exec-approval-history-item-meta">
                        ${entry.agentId ? html`<span>Agent: ${entry.agentId}</span>` : nothing}
                        ${entry.sessionKey ? html`<span>Session: ${entry.sessionKey}</span>` : nothing}
                      </div>
                    </div>
                  `,
                )}
              </div>
            `}
      </div>
      ${history.length > 0
        ? html`
            <div class="exec-approval-history-footer">
              <button
                class="btn btn--sm btn--secondary"
                @click=${() => state.clearExecApprovalHistory?.()}
              >
                ${icon("trash", { size: 12 })}
                Clear history
              </button>
            </div>
          `
        : nothing}
    </div>
  `;
}
