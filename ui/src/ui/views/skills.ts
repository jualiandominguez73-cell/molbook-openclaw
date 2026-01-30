import { html, nothing } from "lit";

import { clampText } from "../format";
import type { SkillStatusEntry, SkillStatusReport } from "../types";
import type { SkillMessageMap } from "../controllers/skills";
import { t, tFormat, type Locale } from "../i18n";

export type SkillsProps = {
  loading: boolean;
  report: SkillStatusReport | null;
  error: string | null;
  filter: string;
  edits: Record<string, string>;
  busyKey: string | null;
  messages: SkillMessageMap;
  locale?: Locale;
  onFilterChange: (next: string) => void;
  onRefresh: () => void;
  onToggle: (skillKey: string, enabled: boolean) => void;
  onEdit: (skillKey: string, value: string) => void;
  onSaveKey: (skillKey: string) => void;
  onInstall: (skillKey: string, name: string, installId: string) => void;
};

export function renderSkills(props: SkillsProps) {
  const skills = props.report?.skills ?? [];
  const filter = props.filter.trim().toLowerCase();
  const locale = props.locale;
  const filtered = filter
    ? skills.filter((skill) =>
        [skill.name, skill.description, skill.source]
          .join(" ")
          .toLowerCase()
          .includes(filter),
      )
    : skills;

  return html`
    <section class="card">
      <div class="row" style="justify-content: space-between;">
        <div>
          <div class="card-title">${t(locale, "skills.title")}</div>
          <div class="card-sub">${t(locale, "skills.subtitle")}</div>
        </div>
        <button class="btn" ?disabled=${props.loading} @click=${props.onRefresh}>
          ${props.loading ? t(locale, "common.loading") : t(locale, "common.refresh")}
        </button>
      </div>

      <div class="filters" style="margin-top: 14px;">
        <label class="field" style="flex: 1;">
          <span>${t(locale, "common.filter")}</span>
          <input
            .value=${props.filter}
            @input=${(e: Event) =>
              props.onFilterChange((e.target as HTMLInputElement).value)}
            placeholder=${t(locale, "skills.filter.placeholder")}
          />
        </label>
        <div class="muted">${tFormat(locale, "skills.shown", { count: filtered.length })}</div>
      </div>

      ${props.error
        ? html`<div class="callout danger" style="margin-top: 12px;">${props.error}</div>`
        : nothing}

      ${filtered.length === 0
        ? html`<div class="muted" style="margin-top: 16px;">${t(locale, "skills.none")}</div>`
        : html`
            <div class="list" style="margin-top: 16px;">
              ${filtered.map((skill) => renderSkill(skill, props, locale))}
            </div>
          `}
    </section>
  `;
}

function renderSkill(skill: SkillStatusEntry, props: SkillsProps, locale?: Locale) {
  const busy = props.busyKey === skill.skillKey;
  const apiKey = props.edits[skill.skillKey] ?? "";
  const message = props.messages[skill.skillKey] ?? null;
  const canInstall =
    skill.install.length > 0 && skill.missing.bins.length > 0;
  const missing = [
    ...skill.missing.bins.map((b) => `bin:${b}`),
    ...skill.missing.env.map((e) => `env:${e}`),
    ...skill.missing.config.map((c) => `config:${c}`),
    ...skill.missing.os.map((o) => `os:${o}`),
  ];
  const reasons: string[] = [];
  if (skill.disabled) reasons.push(t(locale, "skills.disabled"));
  if (skill.blockedByAllowlist) reasons.push(t(locale, "skills.blockedAllowlist"));
  return html`
    <div class="list-item">
      <div class="list-main">
        <div class="list-title">
          ${skill.emoji ? `${skill.emoji} ` : ""}${skill.name}
        </div>
        <div class="list-sub">${clampText(skill.description, 140)}</div>
        <div class="chip-row" style="margin-top: 6px;">
          <span class="chip">${t(locale, `skills.source.${skill.source}`, skill.source)}</span>
          <span class="chip ${skill.eligible ? "chip-ok" : "chip-warn"}">
            ${skill.eligible ? t(locale, "skills.eligible") : t(locale, "skills.blocked")}
          </span>
          ${skill.disabled ? html`<span class="chip chip-warn">${t(locale, "skills.disabled")}</span>` : nothing}
        </div>
        ${missing.length > 0
          ? html`
              <div class="muted" style="margin-top: 6px;">
                ${tFormat(locale, "skills.missing", { value: missing.join(", ") })}
              </div>
            `
          : nothing}
        ${reasons.length > 0
          ? html`
              <div class="muted" style="margin-top: 6px;">
                ${tFormat(locale, "skills.reason", { value: reasons.join(", ") })}
              </div>
            `
          : nothing}
      </div>
      <div class="list-meta">
        <div class="row" style="justify-content: flex-end; flex-wrap: wrap;">
          <button
            class="btn"
            ?disabled=${busy}
            @click=${() => props.onToggle(skill.skillKey, skill.disabled)}
          >
            ${skill.disabled ? t(locale, "common.enable") : t(locale, "common.disable")}
          </button>
          ${canInstall
            ? html`<button
                class="btn"
                ?disabled=${busy}
                @click=${() =>
                  props.onInstall(skill.skillKey, skill.name, skill.install[0].id)}
              >
                ${busy ? t(locale, "common.installing") : skill.install[0].label}
              </button>`
            : nothing}
        </div>
        ${message
          ? html`<div
              class="muted"
              style="margin-top: 8px; color: ${
                message.kind === "error"
                  ? "var(--danger-color, #d14343)"
                  : "var(--success-color, #0a7f5a)"
              };"
            >
              ${message.message}
            </div>`
          : nothing}
        ${skill.primaryEnv
          ? html`
              <div class="field" style="margin-top: 10px;">
                <span>${t(locale, "skills.apiKey")}</span>
                <input
                  type="password"
                  .value=${apiKey}
                  @input=${(e: Event) =>
                    props.onEdit(skill.skillKey, (e.target as HTMLInputElement).value)}
                />
              </div>
              <button
                class="btn primary"
                style="margin-top: 8px;"
                ?disabled=${busy}
                @click=${() => props.onSaveKey(skill.skillKey)}
              >
                ${t(locale, "common.saveKey")}
              </button>
            `
          : nothing}
      </div>
    </div>
  `;
}
