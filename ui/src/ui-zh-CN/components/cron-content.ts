/**
 * Cron Scheduled Task Content Component
 */
import { html, nothing } from "lit";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { t } from "../i18n";
import type { CronJob } from "../../ui/types";
import type { CronFormState } from "../../ui/ui-types";
import type { CronContentProps } from "../types/cron-config";
import { formatMs } from "../../ui/format";
import {
  formatCronPayload,
  formatCronSchedule,
  formatCronState,
  formatNextRun,
} from "../../ui/presenter";

// Icons
const icons = {
  clock: html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`,
  plus: html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`,
  edit: html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`,
  play: html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`,
  trash: html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`,
  chevronDown: html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="6 9 12 15 18 9"></polyline></svg>`,
  check: html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
  x: html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
  alertCircle: html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`,
  refresh: html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>`,
};

/**
 * 默认表单状态
 */
const DEFAULT_FORM: CronFormState = {
  name: "",
  description: "",
  agentId: "",
  enabled: true,
  scheduleKind: "every",
  scheduleAt: "",
  everyAmount: "30",
  everyUnit: "minutes",
  cronExpr: "0 7 * * *",
  cronTz: "",
  sessionTarget: "main",
  wakeMode: "next-heartbeat",
  payloadKind: "systemEvent",
  payloadText: "",
  deliver: false,
  channel: "last",
  to: "",
  timeoutSeconds: "",
  postToMainPrefix: "",
};

// 空函数，用于回调默认值
const noop = () => {};

/**
 * 获取安全的回调函数
 */
function getSafeCallbacks(props: CronContentProps) {
  return {
    onFormChange: props.onFormChange ?? noop,
    onRefresh: props.onRefresh ?? noop,
    onAdd: props.onAdd ?? noop,
    onUpdate: props.onUpdate ?? noop,
    onToggle: props.onToggle ?? noop,
    onRun: props.onRun ?? noop,
    onRemove: props.onRemove ?? noop,
    onLoadRuns: props.onLoadRuns ?? noop,
    onExpandJob: props.onExpandJob ?? noop,
    onDeleteConfirm: props.onDeleteConfirm ?? noop,
    onShowCreateModal: props.onShowCreateModal ?? noop,
    onEdit: props.onEdit ?? noop,
  };
}

/**
 * 构建通道选项列表
 */
function buildChannelOptions(props: CronContentProps): string[] {
  const channels = props.channels ?? [];
  const options = ["last", ...channels.filter(Boolean)];
  const form = props.form ?? DEFAULT_FORM;
  const current = form.channel?.trim();
  if (current && !options.includes(current)) {
    options.push(current);
  }
  const seen = new Set<string>();
  return options.filter((value) => {
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

/**
 * 解析通道显示标签
 */
function resolveChannelLabel(props: CronContentProps, channel: string): string {
  if (channel === "last") return t('cron.channelLast');
  const meta = props.channelMeta?.find((entry) => entry.id === channel);
  if (meta?.label) return meta.label;
  return props.channelLabels?.[channel] ?? channel;
}

/**
 * 渲染调度器状态卡片
 */
function renderStatusCard(props: CronContentProps) {
  const status = props.status;
  return html`
    <div class="cron-status-card">
      <div class="cron-status-card__item">
        <div class="cron-status-card__label">${t('cron.status')}</div>
        <div class="cron-status-card__value ${status?.enabled ? "cron-status-card__value--ok" : ""}">
          ${status ? (status.enabled ? t('cron.statusEnabled') : t('cron.statusDisabled')) : "—"}
        </div>
      </div>
      <div class="cron-status-card__item">
        <div class="cron-status-card__label">${t('cron.jobCount')}</div>
        <div class="cron-status-card__value">
          ${status ? t('cron.nJobs', { count: status.jobs ?? 0 }) : "—"}
        </div>
      </div>
      <div class="cron-status-card__item">
        <div class="cron-status-card__label">${t('cron.nextWake')}</div>
        <div class="cron-status-card__value" style="font-size: 14px;">
          ${formatNextRun(status?.nextWakeAtMs ?? null)}
        </div>
      </div>
    </div>
  `;
}

/**
 * 渲染调度类型字段
 */
function renderScheduleFields(props: CronContentProps) {
  const form = props.form ?? DEFAULT_FORM;
  const { onFormChange } = getSafeCallbacks(props);

  return html`
    <!-- 调度类型切换 -->
    <div class="cron-schedule-tabs">
      <button
        class="cron-schedule-tab ${form.scheduleKind === "every" ? "cron-schedule-tab--active" : ""}"
        @click=${() => onFormChange({ scheduleKind: "every" })}
      >
        ${t('cron.schedule.every')}
      </button>
      <button
        class="cron-schedule-tab ${form.scheduleKind === "at" ? "cron-schedule-tab--active" : ""}"
        @click=${() => onFormChange({ scheduleKind: "at" })}
      >
        ${t('cron.schedule.at')}
      </button>
      <button
        class="cron-schedule-tab ${form.scheduleKind === "cron" ? "cron-schedule-tab--active" : ""}"
        @click=${() => onFormChange({ scheduleKind: "cron" })}
      >
        ${t('cron.schedule.cron')}
      </button>
    </div>

    <!-- 调度参数 -->
    ${form.scheduleKind === "at"
      ? html`
          <div class="mc-field">
            <label class="mc-field__label">${t('cron.runAt')}</label>
            <input
              type="datetime-local"
              class="mc-input"
              .value=${form.scheduleAt}
              @input=${(e: Event) =>
                onFormChange({ scheduleAt: (e.target as HTMLInputElement).value })}
            />
          </div>
        `
      : form.scheduleKind === "every"
        ? html`
            <div class="cron-form-grid">
              <div class="mc-field">
                <label class="mc-field__label">${t('cron.every')}</label>
                <input
                  type="number"
                  class="mc-input"
                  min="1"
                  .value=${form.everyAmount}
                  @input=${(e: Event) =>
                    onFormChange({ everyAmount: (e.target as HTMLInputElement).value })}
                />
              </div>
              <div class="mc-field">
                <label class="mc-field__label">${t('cron.everyUnit')}</label>
                <select
                  class="mc-select"
                  .value=${form.everyUnit}
                  @change=${(e: Event) =>
                    onFormChange({
                      everyUnit: (e.target as HTMLSelectElement).value as CronFormState["everyUnit"],
                    })}
                >
                  <option value="minutes">${t('cron.minutes')}</option>
                  <option value="hours">${t('cron.hours')}</option>
                  <option value="days">${t('cron.days')}</option>
                </select>
              </div>
            </div>
          `
        : html`
            <div class="cron-form-grid">
              <div class="mc-field">
                <label class="mc-field__label">${t('cron.cronExpr')}</label>
                <input
                  type="text"
                  class="mc-input"
                  placeholder=${t('cron.cronExprPlaceholder')}
                  .value=${form.cronExpr}
                  @input=${(e: Event) =>
                    onFormChange({ cronExpr: (e.target as HTMLInputElement).value })}
                />
              </div>
              <div class="mc-field">
                <label class="mc-field__label">${t('cron.cronTz')}</label>
                <input
                  type="text"
                  class="mc-input"
                  placeholder=${t('cron.cronTzPlaceholder')}
                  .value=${form.cronTz}
                  @input=${(e: Event) =>
                    onFormChange({ cronTz: (e.target as HTMLInputElement).value })}
                />
              </div>
            </div>
          `}
  `;
}

/**
 * 渲染新建/编辑任务弹窗
 */
function renderCreateModal(props: CronContentProps) {
  if (!props.showCreateModal) return nothing;

  const isEditMode = !!props.editJobId;
  const form = props.form ?? DEFAULT_FORM;
  const channelOptions = buildChannelOptions(props);
  const { onFormChange, onAdd, onUpdate, onShowCreateModal } = getSafeCallbacks(props);

  const handleClose = () => {
    onShowCreateModal(false);
  };

  const handleSubmit = async () => {
    if (isEditMode) {
      await onUpdate();
    } else {
      await onAdd();
    }
    // 成功后关闭弹窗（如果没有错误）
    if (!props.error) {
      onShowCreateModal(false);
    }
  };

  const modalTitle = isEditMode ? t('cron.editJob') : t('cron.newJob');
  const submitLabel = isEditMode
    ? (props.busy ? t('cron.updating') : t('cron.updateJob'))
    : (props.busy ? t('cron.adding') : t('cron.addJob'));

  return html`
    <div class="cron-confirm-modal" @click=${handleClose}>
      <div class="cron-create-modal__content" @click=${(e: Event) => e.stopPropagation()}>
        <div class="cron-create-modal__header">
          <div class="cron-create-modal__title">
            ${isEditMode ? icons.edit : icons.clock}
            <span>${modalTitle}</span>
          </div>
          <button class="cron-create-modal__close" @click=${handleClose}>
            ${icons.x}
          </button>
        </div>

        <div class="cron-create-modal__body">
          <!-- 基本信息 -->
          <div class="cron-form-grid" style="margin-bottom: 16px;">
            <div class="mc-field">
              <label class="mc-field__label">${t('cron.jobName')}</label>
              <input
                type="text"
                class="mc-input"
                placeholder=${t('cron.jobNamePlaceholder')}
                .value=${form.name}
                @input=${(e: Event) =>
                  onFormChange({ name: (e.target as HTMLInputElement).value })}
              />
            </div>
            <div class="mc-field">
              <label class="mc-field__label">${t('cron.description')}</label>
              <input
                type="text"
                class="mc-input"
                placeholder=${t('cron.descriptionPlaceholder')}
                .value=${form.description}
                @input=${(e: Event) =>
                  onFormChange({ description: (e.target as HTMLInputElement).value })}
              />
            </div>
          </div>

          <div class="cron-form-grid" style="margin-bottom: 16px;">
            <div class="mc-field">
              <label class="mc-field__label">${t('cron.agentId')}</label>
              <select
                class="mc-select"
                .value=${form.agentId || props.defaultAgentId || ""}
                @change=${(e: Event) =>
                  onFormChange({ agentId: (e.target as HTMLSelectElement).value })}
              >
                <option value="">${t('cron.agentIdPlaceholder')}</option>
                ${(props.agents ?? []).map(
                  (agent) =>
                    html`<option value=${agent.id}>
                      ${agent.name ?? agent.identity?.name ?? agent.id}${agent.default ? t('label.defaultSuffix') : ""}
                    </option>`,
                )}
              </select>
            </div>
            <div class="mc-field" style="justify-content: center;">
              <label class="mc-toggle-field">
                <span class="mc-toggle-field__label">${t('cron.jobEnabled')}</span>
                <div class="mc-toggle">
                  <input
                    type="checkbox"
                    .checked=${form.enabled}
                    @change=${(e: Event) =>
                      onFormChange({ enabled: (e.target as HTMLInputElement).checked })}
                  />
                  <span class="mc-toggle__track"></span>
                </div>
              </label>
            </div>
          </div>

          <!-- 调度类型 -->
          ${renderScheduleFields(props)}

          <!-- 会话和唤醒方式 -->
          <div class="cron-form-grid" style="margin-top: 16px; margin-bottom: 16px;">
            <div class="mc-field">
              <label class="mc-field__label">${t('cron.sessionTarget')}</label>
              <select
                class="mc-select"
                .value=${form.sessionTarget}
                @change=${(e: Event) => {
                  const newTarget = (e.target as HTMLSelectElement).value as CronFormState["sessionTarget"];
                  // main 会话只能使用 systemEvent 类型
                  if (newTarget === "main" && form.payloadKind === "agentTurn") {
                    onFormChange({
                      sessionTarget: newTarget,
                      payloadKind: "systemEvent",
                    });
                  } else {
                    onFormChange({ sessionTarget: newTarget });
                  }
                }}
              >
                <option value="main">${t('cron.sessionTarget.main')}</option>
                <option value="isolated">${t('cron.sessionTarget.isolated')}</option>
              </select>
            </div>
            <div class="mc-field">
              <label class="mc-field__label">${t('cron.wakeMode')}</label>
              <select
                class="mc-select"
                .value=${form.wakeMode}
                @change=${(e: Event) =>
                  onFormChange({
                    wakeMode: (e.target as HTMLSelectElement).value as CronFormState["wakeMode"],
                  })}
              >
                <option value="next-heartbeat">${t('cron.wakeMode.nextHeartbeat')}</option>
                <option value="now">${t('cron.wakeMode.now')}</option>
              </select>
            </div>
          </div>

          <!-- 任务类型 -->
          <div class="mc-field" style="margin-bottom: 16px;">
            <label class="mc-field__label">${t('cron.payloadKind')}</label>
            <select
              class="mc-select"
              .value=${form.payloadKind}
              @change=${(e: Event) =>
                onFormChange({
                  payloadKind: (e.target as HTMLSelectElement).value as CronFormState["payloadKind"],
                })}
            >
              <option value="systemEvent">${t('cron.payload.systemEvent')}</option>
              <option value="agentTurn" ?disabled=${form.sessionTarget === "main"}>
                ${t('cron.payload.agentTurn')}${form.sessionTarget === "main" ? t('cron.agentTurn.isolatedOnly') : ""}
              </option>
            </select>
          </div>

          <!-- 消息内容 -->
          <div class="mc-field" style="margin-bottom: 16px;">
            <label class="mc-field__label">${t('cron.payloadText')}</label>
            <textarea
              class="mc-textarea"
              rows="3"
              placeholder=${t('cron.payloadTextPlaceholder')}
              .value=${form.payloadText}
              @input=${(e: Event) =>
                onFormChange({ payloadText: (e.target as HTMLTextAreaElement).value })}
            ></textarea>
          </div>

          <!-- Agent 执行选项 -->
          ${form.payloadKind === "agentTurn"
            ? html`
                <div class="cron-form-grid" style="margin-bottom: 16px;">
                  <div class="mc-field" style="justify-content: center;">
                    <label class="mc-toggle-field">
                      <span class="mc-toggle-field__label">${t('cron.deliver')}</span>
                      <div class="mc-toggle">
                        <input
                          type="checkbox"
                          .checked=${form.deliver}
                          @change=${(e: Event) =>
                            onFormChange({ deliver: (e.target as HTMLInputElement).checked })}
                        />
                        <span class="mc-toggle__track"></span>
                      </div>
                    </label>
                  </div>
                  <div class="mc-field">
                    <label class="mc-field__label">${t('cron.channel')}</label>
                    <select
                      class="mc-select"
                      .value=${form.channel || "last"}
                      @change=${(e: Event) =>
                        onFormChange({
                          channel: (e.target as HTMLSelectElement).value,
                        })}
                    >
                      ${channelOptions.map(
                        (channel) =>
                          html`<option value=${channel}>${resolveChannelLabel(props, channel)}</option>`,
                      )}
                    </select>
                  </div>
                </div>

                <div class="cron-form-grid" style="margin-bottom: 16px;">
                  <div class="mc-field">
                    <label class="mc-field__label">${t('cron.to')}</label>
                    <input
                      type="text"
                      class="mc-input"
                      placeholder=${t('cron.toPlaceholder')}
                      .value=${form.to}
                      @input=${(e: Event) =>
                        onFormChange({ to: (e.target as HTMLInputElement).value })}
                    />
                  </div>
                  <div class="mc-field">
                    <label class="mc-field__label">${t('cron.timeoutSeconds')}</label>
                    <input
                      type="number"
                      class="mc-input"
                      min="0"
                      .value=${form.timeoutSeconds}
                      @input=${(e: Event) =>
                        onFormChange({ timeoutSeconds: (e.target as HTMLInputElement).value })}
                    />
                  </div>
                </div>

                ${form.sessionTarget === "isolated"
                  ? html`
                      <div class="mc-field" style="margin-bottom: 16px;">
                        <label class="mc-field__label">${t('cron.postToMainPrefix')}</label>
                        <input
                          type="text"
                          class="mc-input"
                          placeholder=${t('cron.postToMainPrefixPlaceholder')}
                          .value=${form.postToMainPrefix}
                          @input=${(e: Event) =>
                            onFormChange({ postToMainPrefix: (e.target as HTMLInputElement).value })}
                        />
                      </div>
                    `
                  : nothing}
              `
            : nothing}

          <!-- 错误提示 -->
          ${props.error
            ? html`
                <div class="cron-error-banner">
                  ${icons.alertCircle}
                  <span>${props.error}</span>
                </div>
              `
            : nothing}
        </div>

        <div class="cron-create-modal__footer">
          <button class="mc-btn" @click=${handleClose}>
            ${t('action.cancel')}
          </button>
          <button
            class="mc-btn mc-btn--primary"
            ?disabled=${props.busy}
            @click=${handleSubmit}
          >
            ${submitLabel}
          </button>
        </div>
      </div>
    </div>
  `;
}

/**
 * 渲染任务状态徽章
 */
function renderJobBadge(job: CronJob) {
  if (job.state?.runningAtMs) {
    return html`<span class="cron-job-card__badge cron-job-card__badge--running">${t('cron.statusRunning')}</span>`;
  }
  if (job.enabled) {
    return html`<span class="cron-job-card__badge cron-job-card__badge--enabled">${t('cron.statusEnabled')}</span>`;
  }
  return html`<span class="cron-job-card__badge cron-job-card__badge--disabled">${t('cron.statusDisabled')}</span>`;
}

/**
 * 渲染任务详情
 */
function renderJobDetails(job: CronJob, props: CronContentProps) {
  const state = job.state;
  const lastStatusText =
    state?.lastStatus === "ok"
      ? t('cron.statusOk')
      : state?.lastStatus === "error"
        ? t('cron.statusError')
        : state?.lastStatus === "skipped"
          ? t('cron.statusSkipped')
          : t('cron.statusNA');
  const { onToggle, onRun, onLoadRuns, onDeleteConfirm, onEdit } = getSafeCallbacks(props);

  return html`
    <div class="cron-job-card__details">
      <div class="cron-job-card__meta">
        <div class="cron-job-card__meta-item">
          <span class="cron-job-card__meta-label">${t('cron.sessionTarget')}</span>
          <span class="cron-job-card__meta-value">
            ${job.sessionTarget === "main" ? t('cron.sessionTarget.main') : t('cron.sessionTarget.isolated')}
          </span>
        </div>
        <div class="cron-job-card__meta-item">
          <span class="cron-job-card__meta-label">${t('cron.wakeMode')}</span>
          <span class="cron-job-card__meta-value">
            ${job.wakeMode === "now" ? t('cron.wakeMode.now') : t('cron.wakeMode.nextHeartbeat')}
          </span>
        </div>
        <div class="cron-job-card__meta-item">
          <span class="cron-job-card__meta-label">${t('cron.lastStatus')}</span>
          <span class="cron-job-card__meta-value">${lastStatusText}</span>
        </div>
        <div class="cron-job-card__meta-item">
          <span class="cron-job-card__meta-label">${t('cron.nextRun')}</span>
          <span class="cron-job-card__meta-value">
            ${state?.nextRunAtMs ? formatMs(state.nextRunAtMs) : "—"}
          </span>
        </div>
        ${job.agentId
          ? html`
              <div class="cron-job-card__meta-item">
                <span class="cron-job-card__meta-label">Agent</span>
                <span class="cron-job-card__meta-value">${job.agentId}</span>
              </div>
            `
          : nothing}
        ${job.description
          ? html`
              <div class="cron-job-card__meta-item" style="grid-column: 1 / -1;">
                <span class="cron-job-card__meta-label">${t('cron.description')}</span>
                <span class="cron-job-card__meta-value">${job.description}</span>
              </div>
            `
          : nothing}
      </div>

      <div class="cron-job-card__actions">
        <button
          class="mc-btn mc-btn--sm"
          ?disabled=${props.busy}
          @click=${(e: Event) => {
            e.stopPropagation();
            onEdit(job);
          }}
        >
          ${icons.edit}
          ${t('cron.editJob')}
        </button>
        <button
          class="mc-btn mc-btn--sm"
          ?disabled=${props.busy}
          @click=${(e: Event) => {
            e.stopPropagation();
            onToggle(job, !job.enabled);
          }}
        >
          ${job.enabled ? t('cron.disableJob') : t('cron.enableJob')}
        </button>
        <button
          class="mc-btn mc-btn--sm"
          ?disabled=${props.busy}
          @click=${(e: Event) => {
            e.stopPropagation();
            onRun(job);
          }}
        >
          ${icons.play}
          ${t('cron.runNow')}
        </button>
        <button
          class="mc-btn mc-btn--sm"
          ?disabled=${props.busy}
          @click=${(e: Event) => {
            e.stopPropagation();
            onLoadRuns(job.id);
          }}
        >
          ${t('cron.viewRuns')}
        </button>
        <button
          class="mc-btn mc-btn--sm mc-btn--danger"
          ?disabled=${props.busy}
          @click=${(e: Event) => {
            e.stopPropagation();
            onDeleteConfirm(job.id);
          }}
        >
          ${icons.trash}
          ${t('cron.deleteJob')}
        </button>
      </div>
    </div>
  `;
}

/**
 * 渲染单个任务卡片
 */
function renderJobCard(job: CronJob, props: CronContentProps) {
  const isExpanded = props.expandedJobId === job.id;
  const isSelected = props.runsJobId === job.id;
  const { onExpandJob } = getSafeCallbacks(props);

  return html`
    <div
      class="cron-job-card ${isSelected ? "cron-job-card--selected" : ""}"
    >
      <div
        class="cron-job-card__header"
        @click=${() => onExpandJob(isExpanded ? null : job.id)}
      >
        <div class="cron-job-card__info">
          <div class="cron-job-card__name">${job.name}</div>
          <div class="cron-job-card__schedule">${formatCronSchedule(job)}</div>
          <div class="cron-job-card__payload" style="font-size: 12px; color: var(--muted); margin-top: 4px;">
            ${formatCronPayload(job)}
          </div>
        </div>
        <div class="cron-job-card__status">
          ${renderJobBadge(job)}
          <span class="cron-job-card__chevron" style="transform: rotate(${isExpanded ? "180deg" : "0deg"}); transition: transform 0.2s ease;">
            ${icons.chevronDown}
          </span>
        </div>
      </div>
      ${isExpanded ? renderJobDetails(job, props) : nothing}
    </div>
  `;
}

/**
 * 渲染任务列表
 */
function renderJobsList(props: CronContentProps) {
  const jobs = props.jobs ?? [];
  if (jobs.length === 0) {
    return html`
      <div class="cron-empty">
        <div class="cron-empty__icon">${icons.clock}</div>
        <div class="cron-empty__text">${t('cron.noJobs')}</div>
        <div style="font-size: 13px;">${t('cron.noJobsHint')}</div>
      </div>
    `;
  }

  return html`
    <div class="cron-jobs-list">
      ${jobs.map((job) => renderJobCard(job, props))}
    </div>
  `;
}

/**
 * 渲染运行历史
 */
function renderRunHistory(props: CronContentProps) {
  if (!props.runsJobId) {
    return html`
      <div class="cron-form-section">
        <div class="cron-form-section__title">
          <span>${t('cron.runHistory')}</span>
        </div>
        <div class="cron-empty" style="padding: 24px;">
          <div style="font-size: 13px; color: var(--muted);">${t('cron.selectJobToViewRuns')}</div>
        </div>
      </div>
    `;
  }

  const jobs = props.jobs ?? [];
  const runs = props.runs ?? [];
  const selectedJob = jobs.find((j) => j.id === props.runsJobId);
  const jobName = selectedJob?.name ?? props.runsJobId;

  return html`
    <div class="cron-form-section">
      <div class="cron-form-section__title">
        <span>${t('cron.runHistory')}: ${jobName}</span>
      </div>
      ${runs.length === 0
        ? html`
            <div class="cron-empty" style="padding: 24px;">
              <div style="font-size: 13px; color: var(--muted);">${t('cron.noRuns')}</div>
            </div>
          `
        : html`
            <div class="cron-runs-list">
              ${runs.map((entry) => renderRunItem(entry))}
            </div>
          `}
    </div>
  `;
}

/**
 * 渲染运行记录项
 */
function renderRunItem(entry: { ts: number; status: string; durationMs?: number; error?: string; summary?: string }) {
  const statusIcon =
    entry.status === "ok"
      ? icons.check
      : entry.status === "error"
        ? icons.x
        : icons.alertCircle;
  const dotClass =
    entry.status === "ok"
      ? "cron-run-item__dot--ok"
      : entry.status === "error"
        ? "cron-run-item__dot--error"
        : "cron-run-item__dot--skipped";

  return html`
    <div class="cron-run-item">
      <div class="cron-run-item__status">
        <span class="cron-run-item__dot ${dotClass}"></span>
        <span style="font-weight: 500;">${entry.status}</span>
        ${entry.summary ? html`<span style="color: var(--muted); margin-left: 8px;">${entry.summary}</span>` : nothing}
      </div>
      <div style="text-align: right;">
        <div style="font-size: 13px;">${formatMs(entry.ts)}</div>
        ${entry.durationMs != null
          ? html`<div style="font-size: 12px; color: var(--muted);">${t('cron.duration')}: ${entry.durationMs}ms</div>`
          : nothing}
        ${entry.error
          ? html`<div style="font-size: 12px; color: var(--danger); margin-top: 4px;">${entry.error}</div>`
          : nothing}
      </div>
    </div>
  `;
}

/**
 * 渲染删除确认弹窗
 */
function renderDeleteConfirmModal(props: CronContentProps) {
  if (!props.deleteConfirmJobId) return nothing;

  const jobs = props.jobs ?? [];
  const job = jobs.find((j) => j.id === props.deleteConfirmJobId);
  if (!job) return nothing;

  const { onDeleteConfirm, onRemove } = getSafeCallbacks(props);

  return html`
    <div class="cron-confirm-modal" @click=${() => onDeleteConfirm(null)}>
      <div class="cron-confirm-modal__content" @click=${(e: Event) => e.stopPropagation()}>
        <div class="cron-confirm-modal__title">${t('cron.deleteConfirmTitle')}</div>
        <div class="cron-confirm-modal__desc">${t('cron.deleteConfirmDesc')}</div>
        <div class="cron-confirm-modal__actions">
          <button class="mc-btn" @click=${() => onDeleteConfirm(null)}>
            ${t('action.cancel')}
          </button>
          <button
            class="mc-btn mc-btn--danger"
            ?disabled=${props.busy}
            @click=${() => {
              onRemove(job);
              onDeleteConfirm(null);
            }}
          >
            ${t('action.confirm')}
          </button>
        </div>
      </div>
    </div>
  `;
}

/**
 * 渲染 Cron 内容主组件
 */
export function renderCronContent(props: CronContentProps) {
  const jobs = props.jobs ?? [];
  const { onRefresh, onShowCreateModal } = getSafeCallbacks(props);

  return html`
    <div class="config-content">
      <!-- 页面头部 -->
      <div class="config-content__header">
        <span class="config-content__icon">${icons.clock}</span>
        <div class="config-content__titles">
          <h2 class="config-content__title">${t('cron.title')}</h2>
          <p class="config-content__desc">${t('cron.desc')}</p>
        </div>
        <div style="margin-left: auto; display: flex; gap: 8px;">
          <button
            class="mc-btn"
            ?disabled=${props.loading}
            @click=${onRefresh}
          >
            ${icons.refresh}
            ${props.loading ? t('cron.refreshing') : t('cron.refresh')}
          </button>
          <button
            class="mc-btn mc-btn--primary"
            @click=${() => onShowCreateModal(true)}
          >
            ${icons.plus}
            ${t('cron.newJob')}
          </button>
        </div>
      </div>

      <!-- 状态卡片 -->
      ${renderStatusCard(props)}

      <!-- 使用提示 -->
      <div class="cron-tip-card">
        <div class="cron-tip-card__title">${icons.alertCircle} ${t('cron.tips.title')}</div>
        <table class="cron-tip-card__table">
          <tbody>
            <tr>
              <td class="cron-tip-card__term">${t('cron.tips.sessionType')}</td>
              <td class="cron-tip-card__def">${unsafeHTML(t('cron.tips.sessionType.desc'))}</td>
            </tr>
            <tr>
              <td class="cron-tip-card__term">${t('cron.tips.wakeMode')}</td>
              <td class="cron-tip-card__def">${unsafeHTML(t('cron.tips.wakeMode.desc'))}</td>
            </tr>
            <tr>
              <td class="cron-tip-card__term">${t('cron.tips.payloadKind')}</td>
              <td class="cron-tip-card__def">${unsafeHTML(t('cron.tips.payloadKind.desc'))}</td>
            </tr>
            <tr>
              <td class="cron-tip-card__term">${t('cron.tips.deliver')}</td>
              <td class="cron-tip-card__def">${t('cron.tips.deliver.desc')}</td>
            </tr>
            <tr>
              <td class="cron-tip-card__term">${t('cron.tips.postToMain')}</td>
              <td class="cron-tip-card__def">${t('cron.tips.postToMain.desc')}</td>
            </tr>
            <tr>
              <td class="cron-tip-card__term">${t('cron.tips.schedule')}</td>
              <td class="cron-tip-card__def">${unsafeHTML(t('cron.tips.schedule.desc'))}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 任务列表 -->
      <div class="cron-form-section">
        <div class="cron-form-section__title">
          <span>${t('cron.jobsList')}</span>
          <span style="margin-left: auto; font-size: 12px; font-weight: 400; color: var(--muted);">
            ${jobs.length} 个任务
          </span>
        </div>
        ${renderJobsList(props)}
      </div>

      <!-- 运行历史 -->
      ${renderRunHistory(props)}

      <!-- 新建任务弹窗 -->
      ${renderCreateModal(props)}

      <!-- 删除确认弹窗 -->
      ${renderDeleteConfirmModal(props)}
    </div>
  `;
}
