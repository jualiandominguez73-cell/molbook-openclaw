import { html, nothing } from "lit";

import { formatMs } from "../format";
import {
  formatCronPayload,
  formatCronSchedule,
  formatCronState,
  formatNextRun,
} from "../presenter";
import type { ChannelUiMetaEntry, CronJob, CronRunLogEntry, CronStatus } from "../types";
import type { CronFormState } from "../ui-types";
import { t, tFormat, type Locale } from "../i18n";

export type CronProps = {
  loading: boolean;
  status: CronStatus | null;
  jobs: CronJob[];
  error: string | null;
  busy: boolean;
  form: CronFormState;
  channels: string[];
  channelLabels?: Record<string, string>;
  channelMeta?: ChannelUiMetaEntry[];
  runsJobId: string | null;
  runs: CronRunLogEntry[];
  locale?: Locale;
  onFormChange: (patch: Partial<CronFormState>) => void;
  onRefresh: () => void;
  onAdd: () => void;
  onToggle: (job: CronJob, enabled: boolean) => void;
  onRun: (job: CronJob) => void;
  onRemove: (job: CronJob) => void;
  onLoadRuns: (jobId: string) => void;
};

function buildChannelOptions(props: CronProps): string[] {
  const options = ["last", ...props.channels.filter(Boolean)];
  const current = props.form.channel?.trim();
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

function resolveChannelLabel(props: CronProps, channel: string): string {
  if (channel === "last") return t(props.locale, "cron.channel.last");
  const meta = props.channelMeta?.find((entry) => entry.id === channel);
  if (meta?.label) return meta.label;
  return props.channelLabels?.[channel] ?? channel;
}

export function renderCron(props: CronProps) {
  const channelOptions = buildChannelOptions(props);
  const locale = props.locale;
  return html`
    <section class="grid grid-cols-2">
      <div class="card">
        <div class="card-title">${t(locale, "cron.scheduler.title")}</div>
        <div class="card-sub">${t(locale, "cron.scheduler.subtitle")}</div>
        <div class="stat-grid" style="margin-top: 16px;">
          <div class="stat">
            <div class="stat-label">${t(locale, "common.enabled")}</div>
            <div class="stat-value">
              ${props.status
                ? props.status.enabled
                  ? t(locale, "common.yes")
                  : t(locale, "common.no")
                : t(locale, "common.na")}
            </div>
          </div>
          <div class="stat">
            <div class="stat-label">${t(locale, "common.jobs")}</div>
            <div class="stat-value">${props.status?.jobs ?? t(locale, "common.na")}</div>
          </div>
          <div class="stat">
            <div class="stat-label">${t(locale, "common.nextWake")}</div>
            <div class="stat-value">${formatNextRun(props.status?.nextWakeAtMs ?? null)}</div>
          </div>
        </div>
        <div class="row" style="margin-top: 12px;">
          <button class="btn" ?disabled=${props.loading} @click=${props.onRefresh}>
            ${props.loading ? t(locale, "common.refreshing") : t(locale, "common.refresh")}
          </button>
          ${props.error ? html`<span class="muted">${props.error}</span>` : nothing}
        </div>
      </div>

      <div class="card">
        <div class="card-title">${t(locale, "cron.newJob.title")}</div>
        <div class="card-sub">${t(locale, "cron.newJob.subtitle")}</div>
        <div class="form-grid" style="margin-top: 16px;">
          <label class="field">
            <span>${t(locale, "cron.fields.name")}</span>
            <input
              .value=${props.form.name}
              @input=${(e: Event) =>
                props.onFormChange({ name: (e.target as HTMLInputElement).value })}
            />
          </label>
          <label class="field">
            <span>${t(locale, "cron.fields.description")}</span>
            <input
              .value=${props.form.description}
              @input=${(e: Event) =>
                props.onFormChange({ description: (e.target as HTMLInputElement).value })}
            />
          </label>
          <label class="field">
            <span>${t(locale, "cron.fields.agentId")}</span>
            <input
              .value=${props.form.agentId}
              @input=${(e: Event) =>
                props.onFormChange({ agentId: (e.target as HTMLInputElement).value })}
              placeholder=${t(locale, "cron.placeholder.agentId")}
            />
          </label>
          <label class="field checkbox">
            <span>${t(locale, "common.enabled")}</span>
            <input
              type="checkbox"
              .checked=${props.form.enabled}
              @change=${(e: Event) =>
                props.onFormChange({ enabled: (e.target as HTMLInputElement).checked })}
            />
          </label>
          <label class="field">
            <span>${t(locale, "cron.fields.schedule")}</span>
            <select
              .value=${props.form.scheduleKind}
              @change=${(e: Event) =>
                props.onFormChange({
                  scheduleKind: (e.target as HTMLSelectElement).value as CronFormState["scheduleKind"],
                })}
            >
              <option value="every">${t(locale, "cron.options.every")}</option>
              <option value="at">${t(locale, "cron.options.at")}</option>
              <option value="cron">${t(locale, "cron.options.cron")}</option>
            </select>
          </label>
        </div>
        ${renderScheduleFields(props)}
        <div class="form-grid" style="margin-top: 12px;">
          <label class="field">
            <span>${t(locale, "cron.fields.session")}</span>
            <select
              .value=${props.form.sessionTarget}
              @change=${(e: Event) =>
                props.onFormChange({
                  sessionTarget: (e.target as HTMLSelectElement).value as CronFormState["sessionTarget"],
                })}
            >
              <option value="main">${t(locale, "cron.options.main")}</option>
              <option value="isolated">${t(locale, "cron.options.isolated")}</option>
            </select>
          </label>
          <label class="field">
            <span>${t(locale, "cron.fields.wakeMode")}</span>
            <select
              .value=${props.form.wakeMode}
              @change=${(e: Event) =>
                props.onFormChange({
                  wakeMode: (e.target as HTMLSelectElement).value as CronFormState["wakeMode"],
                })}
            >
              <option value="next-heartbeat">${t(locale, "cron.options.nextHeartbeat")}</option>
              <option value="now">${t(locale, "cron.options.now")}</option>
            </select>
          </label>
          <label class="field">
            <span>${t(locale, "cron.fields.payload")}</span>
            <select
              .value=${props.form.payloadKind}
              @change=${(e: Event) =>
                props.onFormChange({
                  payloadKind: (e.target as HTMLSelectElement).value as CronFormState["payloadKind"],
                })}
            >
              <option value="systemEvent">${t(locale, "cron.options.systemEvent")}</option>
              <option value="agentTurn">${t(locale, "cron.options.agentTurn")}</option>
            </select>
          </label>
        </div>
        <label class="field" style="margin-top: 12px;">
          <span>${props.form.payloadKind === "systemEvent" ? t(locale, "cron.fields.systemText") : t(locale, "cron.fields.agentMessage")}</span>
          <textarea
            .value=${props.form.payloadText}
            @input=${(e: Event) =>
              props.onFormChange({
                payloadText: (e.target as HTMLTextAreaElement).value,
              })}
            rows="4"
          ></textarea>
        </label>
	          ${props.form.payloadKind === "agentTurn"
	          ? html`
	              <div class="form-grid" style="margin-top: 12px;">
                <label class="field checkbox">
                  <span>${t(locale, "cron.fields.deliver")}</span>
                  <input
                    type="checkbox"
                    .checked=${props.form.deliver}
                    @change=${(e: Event) =>
                      props.onFormChange({
                        deliver: (e.target as HTMLInputElement).checked,
                      })}
                  />
	                </label>
	                <label class="field">
	                  <span>${t(locale, "cron.fields.channel")}</span>
	                  <select
	                    .value=${props.form.channel || "last"}
	                    @change=${(e: Event) =>
	                      props.onFormChange({
	                        channel: (e.target as HTMLSelectElement).value as CronFormState["channel"],
	                      })}
	                  >
	                    ${channelOptions.map(
                        (channel) =>
                          html`<option value=${channel}>
                            ${resolveChannelLabel(props, channel)}
                          </option>`,
                      )}
                  </select>
                </label>
                <label class="field">
                  <span>${t(locale, "cron.fields.to")}</span>
                  <input
                    .value=${props.form.to}
                    @input=${(e: Event) =>
                      props.onFormChange({ to: (e.target as HTMLInputElement).value })}
                    placeholder=${t(locale, "cron.placeholder.to")}
                  />
                </label>
                <label class="field">
                  <span>${t(locale, "cron.fields.timeout")}</span>
                  <input
                    .value=${props.form.timeoutSeconds}
                    @input=${(e: Event) =>
                      props.onFormChange({
                        timeoutSeconds: (e.target as HTMLInputElement).value,
                      })}
                  />
                </label>
                ${props.form.sessionTarget === "isolated"
                  ? html`
                      <label class="field">
                        <span>${t(locale, "cron.fields.postToMainPrefix")}</span>
                        <input
                          .value=${props.form.postToMainPrefix}
                          @input=${(e: Event) =>
                            props.onFormChange({
                              postToMainPrefix: (e.target as HTMLInputElement).value,
                            })}
                        />
                      </label>
                    `
                  : nothing}
              </div>
            `
          : nothing}
        <div class="row" style="margin-top: 14px;">
          <button class="btn primary" ?disabled=${props.busy} @click=${props.onAdd}>
            ${props.busy ? t(locale, "config.saving") : t(locale, "cron.actions.addJob")}
          </button>
        </div>
      </div>
    </section>

    <section class="card" style="margin-top: 18px;">
      <div class="card-title">${t(locale, "common.jobs")}</div>
      <div class="card-sub">${t(locale, "cron.scheduler.subtitle")}</div>
      ${props.jobs.length === 0
        ? html`<div class="muted" style="margin-top: 12px;">${t(locale, "cron.noneJobs")}</div>`
        : html`
            <div class="list" style="margin-top: 12px;">
              ${props.jobs.map((job) => renderJob(job, props))}
            </div>
          `}
    </section>

    <section class="card" style="margin-top: 18px;">
      <div class="card-title">${t(locale, "cron.runHistory")}</div>
      <div class="card-sub">${tFormat(locale, "cron.runs.subtitle", { job: props.runsJobId ?? t(locale, "cron.runs.selectJob") })}</div>
      ${props.runsJobId == null
        ? html`
            <div class="muted" style="margin-top: 12px;">
              ${t(locale, "cron.selectJob")}
            </div>
          `
        : props.runs.length === 0
          ? html`<div class="muted" style="margin-top: 12px;">${t(locale, "cron.noneRuns")}</div>`
          : html`
              <div class="list" style="margin-top: 12px;">
                ${props.runs.map((entry) => renderRun(entry))}
              </div>
            `}
    </section>
  `;
}

function renderScheduleFields(props: CronProps) {
  const form = props.form;
  const locale = props.locale;
  if (form.scheduleKind === "at") {
    return html`
      <label class="field" style="margin-top: 12px;">
        <span>${t(locale, "cron.fields.runAt")}</span>
        <input
          type="datetime-local"
          .value=${form.scheduleAt}
          @input=${(e: Event) =>
            props.onFormChange({
              scheduleAt: (e.target as HTMLInputElement).value,
            })}
        />
      </label>
    `;
  }
  if (form.scheduleKind === "every") {
    return html`
      <div class="form-grid" style="margin-top: 12px;">
        <label class="field">
          <span>${t(locale, "cron.fields.every")}</span>
          <input
            .value=${form.everyAmount}
            @input=${(e: Event) =>
              props.onFormChange({
                everyAmount: (e.target as HTMLInputElement).value,
              })}
          />
        </label>
        <label class="field">
          <span>${t(locale, "cron.fields.unit")}</span>
          <select
            .value=${form.everyUnit}
            @change=${(e: Event) =>
              props.onFormChange({
                everyUnit: (e.target as HTMLSelectElement).value as CronFormState["everyUnit"],
              })}
          >
            <option value="minutes">${t(locale, "cron.options.minutes")}</option>
            <option value="hours">${t(locale, "cron.options.hours")}</option>
            <option value="days">${t(locale, "cron.options.days")}</option>
          </select>
        </label>
      </div>
    `;
  }
  return html`
    <div class="form-grid" style="margin-top: 12px;">
      <label class="field">
        <span>${t(locale, "cron.fields.expression")}</span>
        <input
          .value=${form.cronExpr}
          @input=${(e: Event) =>
            props.onFormChange({ cronExpr: (e.target as HTMLInputElement).value })}
        />
      </label>
      <label class="field">
        <span>${t(locale, "cron.fields.timezone")}</span>
        <input
          .value=${form.cronTz}
          @input=${(e: Event) =>
            props.onFormChange({ cronTz: (e.target as HTMLInputElement).value })}
        />
      </label>
    </div>
  `;
}

function renderJob(job: CronJob, props: CronProps) {
  const isSelected = props.runsJobId === job.id;
  const itemClass = `list-item list-item-clickable${isSelected ? " list-item-selected" : ""}`;
  const locale = props.locale;
  return html`
    <div class=${itemClass} @click=${() => props.onLoadRuns(job.id)}>
      <div class="list-main">
        <div class="list-title">${job.name}</div>
        <div class="list-sub">${formatCronSchedule(job)}</div>
        <div class="muted">${formatCronPayload(job)}</div>
        ${job.agentId ? html`<div class="muted">Agent: ${job.agentId}</div>` : nothing}
        <div class="chip-row" style="margin-top: 6px;">
          <span class="chip">${job.enabled ? "enabled" : "disabled"}</span>
          <span class="chip">${job.sessionTarget}</span>
          <span class="chip">${job.wakeMode}</span>
        </div>
      </div>
      <div class="list-meta">
        <div>${formatCronState(job, locale)}</div>
        <div class="row" style="justify-content: flex-end; margin-top: 8px;">
          <button
            class="btn"
            ?disabled=${props.busy}
            @click=${(event: Event) => {
              event.stopPropagation();
              props.onToggle(job, !job.enabled);
            }}
          >
            ${job.enabled ? t(locale, "common.disable") : t(locale, "common.enable")}
          </button>
          <button
            class="btn"
            ?disabled=${props.busy}
            @click=${(event: Event) => {
              event.stopPropagation();
              props.onRun(job);
            }}
          >
            ${t(locale, "cron.actions.run")}
          </button>
          <button
            class="btn"
            ?disabled=${props.busy}
            @click=${(event: Event) => {
              event.stopPropagation();
              props.onLoadRuns(job.id);
            }}
          >
            ${t(locale, "cron.actions.runs")}
          </button>
          <button
            class="btn danger"
            ?disabled=${props.busy}
            @click=${(event: Event) => {
              event.stopPropagation();
              props.onRemove(job);
            }}
          >
            ${t(locale, "cron.actions.remove")}
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderRun(entry: CronRunLogEntry) {
  return html`
    <div class="list-item">
      <div class="list-main">
        <div class="list-title">${entry.status}</div>
        <div class="list-sub">${entry.summary ?? ""}</div>
      </div>
      <div class="list-meta">
        <div>${formatMs(entry.ts)}</div>
        <div class="muted">${entry.durationMs ?? 0}ms</div>
        ${entry.error ? html`<div class="muted">${entry.error}</div>` : nothing}
      </div>
    </div>
  `;
}
