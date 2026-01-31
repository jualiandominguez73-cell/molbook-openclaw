/**
 * Skills Management Content Component
 * Manage skill allowlist, enable/disable, API Key configuration
 */
import { html, nothing } from "lit";
import { t } from "../i18n";
import type {
  SkillsContentProps,
  SkillStatusEntry,
  SkillStatusReport,
  SkillSourceFilter,
  SkillStatusFilter,
  SkillGroup,
  SkillMessage,
  SkillEditState,
  SkillEditorState,
  SkillCreateState,
  SkillDeleteState,
  EditableSkillSource,
  SkillEditorMode,
} from "../types/skills-config";

// ─── Helper functions ────────────────────────────────────────────

/**
 * Group skills by source
 */
function groupSkillsBySource(skills: SkillStatusEntry[]): SkillGroup[] {
  const groups: Record<string, SkillStatusEntry[]> = {
    "openclaw-bundled": [],
    "openclaw-managed": [],
    "openclaw-workspace": [],
  };

  for (const skill of skills) {
    const source = skill.source || "openclaw-workspace";
    if (!groups[source]) groups[source] = [];
    groups[source].push(skill);
  }

  const result: SkillGroup[] = [];
  if (groups["openclaw-bundled"].length > 0) {
    result.push({
      id: "bundled",
      label: t('skills.group.bundled', { count: groups["openclaw-bundled"].length }),
      skills: groups["openclaw-bundled"],
    });
  }
  if (groups["openclaw-managed"].length > 0) {
    result.push({
      id: "managed",
      label: t('skills.group.managed', { count: groups["openclaw-managed"].length }),
      skills: groups["openclaw-managed"],
    });
  }
  if (groups["openclaw-workspace"].length > 0) {
    result.push({
      id: "workspace",
      label: t('skills.group.workspace', { count: groups["openclaw-workspace"].length }),
      skills: groups["openclaw-workspace"],
    });
  }
  return result;
}

/**
 * Filter skill list
 */
function filterSkills(
  skills: SkillStatusEntry[],
  filter: string,
  sourceFilter: SkillSourceFilter,
  statusFilter: SkillStatusFilter,
): SkillStatusEntry[] {
  let filtered = skills;

  // Text search
  if (filter.trim()) {
    const q = filter.trim().toLowerCase();
    filtered = filtered.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.skillKey.toLowerCase().includes(q),
    );
  }

  // Source filter
  if (sourceFilter !== "all") {
    const sourceMap: Record<string, string> = {
      bundled: "openclaw-bundled",
      managed: "openclaw-managed",
      workspace: "openclaw-workspace",
    };
    const targetSource = sourceMap[sourceFilter];
    if (targetSource) {
      filtered = filtered.filter((s) => s.source === targetSource);
    }
  }

  // Status filter
  if (statusFilter === "eligible") {
    filtered = filtered.filter((s) => s.eligible);
  } else if (statusFilter === "blocked") {
    filtered = filtered.filter((s) => !s.eligible);
  } else if (statusFilter === "disabled") {
    filtered = filtered.filter((s) => s.disabled);
  }

  return filtered;
}

/**
 * Convert full source name to short format (for RPC)
 */
function toShortSource(source: string): EditableSkillSource | null {
  if (source === "openclaw-managed") return "managed";
  if (source === "openclaw-workspace") return "workspace";
  return null;
}

/**
 * Clamp text
 */
function clampText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

/**
 * Highlight search text in content (Phase 4)
 */
function highlightText(text: string, query: string): ReturnType<typeof html> {
  if (!query.trim()) return html`${text}`;

  const q = query.trim().toLowerCase();
  const lowerText = text.toLowerCase();
  const index = lowerText.indexOf(q);

  if (index === -1) return html`${text}`;

  const before = text.slice(0, index);
  const match = text.slice(index, index + q.length);
  const after = text.slice(index + q.length);

  return html`${before}<mark class="skills-highlight">${match}</mark>${after}`;
}

/**
 * Calculate skill statistics (Phase 4)
 */
function calculateStats(skills: SkillStatusEntry[]) {
  return {
    total: skills.length,
    eligible: skills.filter(s => s.eligible).length,
    blocked: skills.filter(s => !s.eligible && !s.disabled).length,
    disabled: skills.filter(s => s.disabled).length,
    bundled: skills.filter(s => s.source === "openclaw-bundled").length,
    managed: skills.filter(s => s.source === "openclaw-managed").length,
    workspace: skills.filter(s => s.source === "openclaw-workspace").length,
  };
}

// ─── Skill priority explanation ────────────────────────────

/**
 * Render skill priority explanation
 */
function renderPriorityExplanation() {
  return html`
    <div class="skills-priority-info">
      <div class="skills-priority-info__header">
        <span class="skills-priority-info__icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="16" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12.01" y2="8"></line>
          </svg>
        </span>
        <span class="skills-priority-info__title">${t('skills.priority.title')}</span>
      </div>
      <div class="skills-priority-info__content">
        <p class="skills-priority-info__desc">
          ${t('skills.priority.desc')}
        </p>
        <ol class="skills-priority-info__list">
          <li>
            <span class="skills-priority-info__source">${t('skills.priority.extraDirs')}</span>
            <span class="skills-priority-info__priority">${t('skills.priority.lowest')}</span>
          </li>
          <li>
            <span class="skills-priority-info__source">${t('skills.priority.bundled')}</span>
            <span class="skills-priority-info__priority">openclaw-bundled</span>
          </li>
          <li>
            <span class="skills-priority-info__source">${t('skills.priority.managed')}</span>
            <span class="skills-priority-info__priority">~/.openclaw/skills/</span>
          </li>
          <li>
            <span class="skills-priority-info__source">${t('skills.priority.workspace')}</span>
            <span class="skills-priority-info__priority skills-priority-info__priority--high">${t('skills.priority.highest')}</span>
          </li>
        </ol>
        <p class="skills-priority-info__note">
          ${t('skills.priority.note')}
        </p>
      </div>
    </div>
  `;
}

// ─── 主渲染函数 / Main render function ──────────────────────────────────────

export function renderSkillsContent(props: SkillsContentProps) {
  const skills = props.report?.skills ?? [];
  const filtered = filterSkills(skills, props.filter, props.sourceFilter, props.statusFilter);
  const groups = groupSkillsBySource(filtered);
  const stats = calculateStats(skills);

  return html`
    <div class="skills-content">
      <!-- 头部 -->
      <div class="skills-header">
        <div class="skills-header__info">
          <h3 class="skills-title">${t('skills.title')}</h3>
          <p class="skills-desc">${t('skills.desc')}</p>
        </div>
        <div class="skills-header__actions">
          <!-- 创建技能按钮 -->
          <button
            class="mc-btn mc-btn--sm"
            @click=${() => props.onCreateOpen()}
          >
            + ${t('skills.createSkill')}
          </button>
          <button
            class="mc-btn mc-btn--sm"
            ?disabled=${props.loading}
            @click=${props.onRefresh}
          >
            ${props.loading ? t('label.loading') : t('action.refresh')}
          </button>
          ${props.hasChanges
            ? html`
                <button
                  class="mc-btn mc-btn--sm primary"
                  ?disabled=${props.saving}
                  @click=${props.onSave}
                >
                  ${props.saving ? t('status.saving') : t('skills.saveConfig')}
                </button>
              `
            : nothing}
        </div>
      </div>

      <!-- 统计摘要 (Phase 4) -->
      ${skills.length > 0 ? renderStatsBar(stats) : nothing}

      <!-- 技能优先级说明 -->
      ${renderPriorityExplanation()}

      <!-- 全局设置 -->
      ${renderGlobalSettings(props)}

      <!-- 筛选栏 -->
      ${renderFilterBar(props, skills.length, filtered.length)}

      <!-- 错误提示 -->
      ${props.error
        ? html`<div class="skills-error">${props.error}</div>`
        : nothing}

      <!-- 技能列表 -->
      ${props.loading && !props.report
        ? html`<div class="skills-loading">${t('skills.loading')}</div>`
        : groups.length === 0
          ? html`<div class="skills-empty">${t('skills.noResults')}</div>`
          : groups.map((group) => renderSkillGroup(group, props))}
    </div>

    <!-- 编辑器弹窗 -->
    ${props.editorState.open ? renderEditorModal(props) : nothing}

    <!-- 创建技能弹窗 -->
    ${props.createState.open ? renderCreateModal(props) : nothing}

    <!-- 删除确认弹窗 -->
    ${props.deleteState.open ? renderDeleteModal(props) : nothing}
  `;
}

// ─── 统计摘要 (Phase 4) / Stats bar ─────────────────────────────────────────

type SkillStats = {
  total: number;
  eligible: number;
  blocked: number;
  disabled: number;
  bundled: number;
  managed: number;
  workspace: number;
};

function renderStatsBar(stats: SkillStats) {
  return html`
    <div class="skills-stats">
      <div class="skills-stats__item">
        <span class="skills-stats__value">${stats.total}</span>
        <span class="skills-stats__label">${t('stats.total')}</span>
      </div>
      <div class="skills-stats__divider"></div>
      <div class="skills-stats__item skills-stats__item--ok">
        <span class="skills-stats__value">${stats.eligible}</span>
        <span class="skills-stats__label">${t('stats.eligible')}</span>
      </div>
      <div class="skills-stats__item skills-stats__item--warn">
        <span class="skills-stats__value">${stats.blocked}</span>
        <span class="skills-stats__label">${t('stats.blocked')}</span>
      </div>
      <div class="skills-stats__item skills-stats__item--disabled">
        <span class="skills-stats__value">${stats.disabled}</span>
        <span class="skills-stats__label">${t('stats.disabled')}</span>
      </div>
      <div class="skills-stats__divider"></div>
      <div class="skills-stats__item">
        <span class="skills-stats__value">${stats.bundled}</span>
        <span class="skills-stats__label">${t('stats.bundled')}</span>
      </div>
      <div class="skills-stats__item">
        <span class="skills-stats__value">${stats.managed}</span>
        <span class="skills-stats__label">${t('stats.managed')}</span>
      </div>
      <div class="skills-stats__item">
        <span class="skills-stats__value">${stats.workspace}</span>
        <span class="skills-stats__label">${t('stats.workspace')}</span>
      </div>
    </div>
  `;
}

// ─── 全局设置 / Global settings ─────────────────────────────────────────────

function renderGlobalSettings(props: SkillsContentProps) {
  const extraDirs = props.config?.load?.extraDirs ?? [];
  const extraDirsText = extraDirs.join("\n");

  return html`
    <div class="skills-section skills-global-settings">
      <div class="skills-section__header">
        <h4 class="skills-section__title">${t('skills.globalSettings')}</h4>
      </div>
      <div class="skills-settings-grid">
        <!-- 白名单模式 -->
        <div class="skills-setting-item">
          <div class="skills-setting-item__header">
            <span class="skills-setting-item__title">${t('skills.bundledMode')}</span>
            <span class="skills-setting-item__desc">${t('skills.bundledModeDesc')}</span>
          </div>
          <div class="skills-radio-group">
            <label class="skills-radio">
              <input
                type="radio"
                name="allowlist-mode"
                value="all"
                .checked=${props.allowlistMode === "all"}
                @change=${() => props.onAllowlistModeChange("all")}
              />
              <span class="skills-radio__mark"></span>
              <span class="skills-radio__text">${t('skills.allowAll')}</span>
            </label>
            <label class="skills-radio">
              <input
                type="radio"
                name="allowlist-mode"
                value="whitelist"
                .checked=${props.allowlistMode === "whitelist"}
                @change=${() => props.onAllowlistModeChange("whitelist")}
              />
              <span class="skills-radio__mark"></span>
              <span class="skills-radio__text">${t('skills.allowlistOnly')}</span>
            </label>
          </div>
        </div>

        <!-- 安装偏好 -->
        <div class="skills-setting-item">
          <div class="skills-setting-item__header">
            <span class="skills-setting-item__title">${t('skills.installPreference')}</span>
            <span class="skills-setting-item__desc">${t('skills.installPreferenceDesc')}</span>
          </div>
          <select
            class="skills-select"
            .value=${props.config?.install?.preferBrew ? "true" : "false"}
            @change=${(e: Event) => {
              const value = (e.target as HTMLSelectElement).value === "true";
              props.onGlobalSettingChange("preferBrew", value);
            }}
          >
            <option value="true">${t('skills.preferBrew')}</option>
            <option value="false">${t('skills.useDefaultInstall')}</option>
          </select>
        </div>

        <!-- Node 包管理器 -->
        <div class="skills-setting-item">
          <div class="skills-setting-item__header">
            <span class="skills-setting-item__title">${t('skills.nodePackageManager')}</span>
            <span class="skills-setting-item__desc">${t('skills.nodePackageManagerDesc')}</span>
          </div>
          <select
            class="skills-select"
            .value=${props.config?.install?.nodeManager ?? "npm"}
            @change=${(e: Event) => {
              const value = (e.target as HTMLSelectElement).value;
              props.onGlobalSettingChange("nodeManager", value);
            }}
          >
            <option value="npm">npm</option>
            <option value="pnpm">pnpm</option>
            <option value="yarn">yarn</option>
            <option value="bun">bun</option>
          </select>
        </div>

        <!-- 文件监视 -->
        <div class="skills-setting-item">
          <div class="skills-setting-item__header">
            <span class="skills-setting-item__title">${t('skills.fileWatching')}</span>
            <span class="skills-setting-item__desc">${t('skills.fileWatchingDesc')}</span>
          </div>
          <label class="skills-checkbox">
            <input
              type="checkbox"
              .checked=${props.config?.load?.watch ?? false}
              @change=${(e: Event) => {
                const checked = (e.target as HTMLInputElement).checked;
                props.onGlobalSettingChange("watch", checked);
              }}
            />
            <span class="skills-checkbox__text">${t('skills.enableFileWatching')}</span>
          </label>
        </div>
      </div>

      <!-- 额外技能目录 -->
      <div class="skills-extra-dirs">
        <div class="skills-extra-dirs__header">
          <span class="skills-extra-dirs__title">${t('skills.extraDirs')}</span>
          <span class="skills-extra-dirs__desc">${t('skills.extraDirsDesc')}</span>
        </div>
        <textarea
          class="skills-extra-dirs__textarea"
          placeholder="/path/to/skills&#10;/another/skills/dir"
          .value=${extraDirsText}
          @change=${(e: Event) => {
            const text = (e.target as HTMLTextAreaElement).value;
            const dirs = text
              .split("\n")
              .map((d) => d.trim())
              .filter((d) => d.length > 0);
            props.onExtraDirsChange(dirs);
          }}
        ></textarea>
      </div>
    </div>
  `;
}

// ─── 筛选栏 / Filter bar ────────────────────────────────────────────────────

function renderFilterBar(props: SkillsContentProps, total: number, shown: number) {
  return html`
    <div class="skills-filter">
      <div class="skills-filter__search">
        <input
          type="text"
          class="skills-filter__input"
          placeholder=${t('skills.search')}
          .value=${props.filter}
          @input=${(e: Event) =>
            props.onFilterChange((e.target as HTMLInputElement).value)}
        />
      </div>
      <div class="skills-filter__selects">
        <select
          class="skills-filter__select"
          .value=${props.sourceFilter}
          @change=${(e: Event) =>
            props.onSourceFilterChange(
              (e.target as HTMLSelectElement).value as SkillSourceFilter,
            )}
        >
          <option value="all">${t('skills.source.all')}</option>
          <option value="bundled">${t('skills.source.bundled')}</option>
          <option value="managed">${t('skills.source.managed')}</option>
          <option value="workspace">${t('skills.source.workspace')}</option>
        </select>
        <select
          class="skills-filter__select"
          .value=${props.statusFilter}
          @change=${(e: Event) =>
            props.onStatusFilterChange(
              (e.target as HTMLSelectElement).value as SkillStatusFilter,
            )}
        >
          <option value="all">${t('skills.status.all')}</option>
          <option value="eligible">${t('skills.status.eligible')}</option>
          <option value="blocked">${t('skills.status.blocked')}</option>
          <option value="disabled">${t('skills.status.disabled')}</option>
        </select>
      </div>
      <div class="skills-filter__count">
        ${t('skills.showing', { shown, total })}
      </div>
    </div>
  `;
}

// ─── 技能分组 / Skill group ─────────────────────────────────────────────────

function renderSkillGroup(group: SkillGroup, props: SkillsContentProps) {
  const isExpanded = props.expandedGroups.has(group.id);

  return html`
    <div class="skills-group ${isExpanded ? "skills-group--expanded" : ""}">
      <div
        class="skills-group__header"
        @click=${() => props.onGroupToggle(group.id)}
      >
        <span class="skills-group__icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="${isExpanded ? "6 9 12 15 18 9" : "9 6 15 12 9 18"}"></polyline>
          </svg>
        </span>
        <span class="skills-group__label">${group.label}</span>
      </div>
      ${isExpanded
        ? html`
            <div class="skills-group__body">
              ${group.skills.map((skill) => renderSkillItem(skill, props))}
            </div>
          `
        : nothing}
    </div>
  `;
}

// ─── 技能条目 / Skill item ──────────────────────────────────────────────────

function renderSkillItem(skill: SkillStatusEntry, props: SkillsContentProps) {
  const isBusy = props.busySkill === skill.skillKey;
  const message = props.messages[skill.skillKey];
  const edit = props.edits[skill.skillKey];
  const isBundled = skill.source === "openclaw-bundled";
  const isEditable = skill.source === "openclaw-managed" || skill.source === "openclaw-workspace";
  const inAllowlist = edit?.inAllowlist ?? props.allowlistDraft.has(skill.skillKey);
  const canInstall = skill.install.length > 0 && skill.missing.bins.length > 0;
  const isSelected = props.selectedSkill === skill.skillKey;

  // 缺失项
  const missing = [
    ...skill.missing.bins.map((b) => `bin:${b}`),
    ...skill.missing.anyBins.map((b) => `anyBin:${b}`),
    ...skill.missing.env.map((e) => `env:${e}`),
    ...skill.missing.config.map((c) => `config:${c}`),
    ...skill.missing.os.map((o) => `os:${o}`),
  ];

  // 状态原因
  const reasons: string[] = [];
  if (skill.disabled) reasons.push(t('label.disabled'));
  if (skill.blockedByAllowlist) reasons.push(t('skills.blockedByAllowlist'));

  // 检查是否有额外环境变量需要配置
  const hasExtraEnv = (skill.requirements?.env ?? []).filter(e => e !== skill.primaryEnv).length > 0;

  return html`
    <div
      class="skills-item ${skill.eligible ? "skills-item--eligible" : "skills-item--blocked"} ${skill.disabled ? "skills-item--disabled" : ""} ${isSelected ? "skills-item--expanded" : ""}"
    >
      <div class="skills-item__main">
        <div class="skills-item__header">
          <span class="skills-item__name">
            ${skill.emoji ? `${skill.emoji} ` : ""}${highlightText(skill.name, props.filter)}
          </span>
          ${isBundled && props.allowlistMode === "whitelist"
            ? html`
                <label class="skills-allowlist-toggle" title=${t('skills.addToAllowlist')}>
                  <input
                    type="checkbox"
                    .checked=${inAllowlist}
                    @change=${(e: Event) => {
                      const checked = (e.target as HTMLInputElement).checked;
                      props.onAllowlistToggle(skill.skillKey, checked);
                    }}
                  />
                  <span class="skills-allowlist-toggle__icon">
                    ${inAllowlist ? "✓" : ""}
                  </span>
                </label>
              `
            : nothing}
          <!-- 展开/折叠按钮 -->
          <button
            class="mc-icon-btn skills-item__expand-btn"
            title="${isSelected ? t('skills.collapseDetails') : t('skills.expandDetails')}"
            @click=${() => props.onSkillSelect(isSelected ? null : skill.skillKey)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="${isSelected ? "18 15 12 9 6 15" : "6 9 12 15 18 9"}"></polyline>
            </svg>
          </button>
        </div>
        <div class="skills-item__desc">${highlightText(clampText(skill.description, 120), props.filter)}</div>
        <div class="skills-item__chips">
          <span class="skills-chip">${skill.source}</span>
          <span class="skills-chip ${skill.eligible ? "skills-chip--ok" : "skills-chip--warn"}">
            ${skill.eligible ? t('skills.status.available') : t('skills.status.blocked')}
          </span>
          ${skill.disabled
            ? html`<span class="skills-chip skills-chip--warn">${t('label.disabled')}</span>`
            : nothing}
        </div>
        ${missing.length > 0
          ? html`
              <div class="skills-item__missing">
                ${t('skills.missing')}: ${missing.join(", ")}
              </div>
            `
          : nothing}
        ${reasons.length > 0
          ? html`
              <div class="skills-item__reasons">
                ${t('skills.reasons')}: ${reasons.join(", ")}
              </div>
            `
          : nothing}
      </div>

      <div class="skills-item__actions">
        <!-- 启用/禁用按钮 -->
        <button
          class="mc-btn mc-btn--sm"
          ?disabled=${isBusy}
          @click=${() => props.onSkillToggle(skill.skillKey, skill.disabled)}
        >
          ${skill.disabled ? t('action.enable') : t('action.disable')}
        </button>

        <!-- 安装按钮 -->
        ${canInstall
          ? html`
              <button
                class="mc-btn mc-btn--sm"
                ?disabled=${isBusy}
                @click=${() =>
                  props.onInstall(skill.skillKey, skill.name, skill.install[0].id)}
              >
                ${isBusy ? t('skills.installing') : skill.install[0].label}
              </button>
            `
          : nothing}

        <!-- 编辑按钮（仅 managed 和 workspace 技能）-->
        ${isEditable
          ? html`
              <button
                class="mc-btn mc-btn--sm"
                ?disabled=${isBusy}
                @click=${() =>
                  props.onEditorOpen(
                    skill.skillKey,
                    skill.name,
                    toShortSource(skill.source) as EditableSkillSource
                  )}
              >
                ${t('action.edit')}
              </button>
              <button
                class="mc-btn mc-btn--sm mc-btn--danger"
                ?disabled=${isBusy}
                @click=${() =>
                  props.onDeleteOpen(
                    skill.skillKey,
                    skill.name,
                    toShortSource(skill.source) as EditableSkillSource
                  )}
              >
                ${t('action.delete')}
              </button>
            `
          : nothing}

        <!-- 消息提示 -->
        ${message ? renderSkillMessage(message) : nothing}

        <!-- 安装进度指示器 (Phase 4) -->
        ${isBusy && canInstall ? renderInstallProgress(skill.name) : nothing}

        <!-- API Key 输入 -->
        ${skill.primaryEnv ? renderApiKeyInput(skill, props, isBusy) : nothing}
      </div>

      <!-- 展开区域：环境变量和配置编辑器 -->
      ${isSelected
        ? html`
            <div class="skills-item__details">
              <!-- 基本信息 -->
              <div class="skills-detail-section">
                <div class="skills-detail-section__title">${t('skills.details.basicInfo')}</div>
                <div class="skills-detail-info">
                  <div class="skills-detail-row">
                    <span class="skills-detail-label">${t('skills.details.skillKey')}:</span>
                    <span class="skills-detail-value mono">${skill.skillKey}</span>
                  </div>
                  <div class="skills-detail-row">
                    <span class="skills-detail-label">${t('skills.details.path')}:</span>
                    <span class="skills-detail-value mono">${clampText(skill.filePath, 60)}</span>
                  </div>
                  ${skill.homepage
                    ? html`
                        <div class="skills-detail-row">
                          <span class="skills-detail-label">${t('skills.details.homepage')}:</span>
                          <a class="skills-detail-link" href="${skill.homepage}" target="_blank" rel="noreferrer">
                            ${skill.homepage}
                          </a>
                        </div>
                      `
                    : nothing}
                  <!-- SKILL.md 文档链接 (Phase 4) -->
                  ${skill.filePath ? renderSkillDocsLink(skill.filePath) : nothing}
                </div>
              </div>

              <!-- 环境变量编辑器 -->
              ${hasExtraEnv ? renderEnvEditor(skill, props) : nothing}

              <!-- 自定义配置编辑器 -->
              ${renderConfigEditor(skill, props)}
            </div>
          `
        : nothing}
    </div>
  `;
}

// ─── 消息提示 / Message display ─────────────────────────────────────────────

function renderSkillMessage(message: SkillMessage) {
  return html`
    <div
      class="skills-message ${message.kind === "error" ? "skills-message--error" : "skills-message--success"}"
    >
      ${message.message}
    </div>
  `;
}

// ─── 安装进度指示器 (Phase 4) / Installation progress indicator ─────────────

function renderInstallProgress(skillName: string) {
  return html`
    <div class="skills-progress">
      <div class="skills-progress__header">
        <span class="skills-progress__title">${t('skills.install.title', { skillName })}</span>
        <span class="skills-progress__status">${t('skills.install.status')}</span>
      </div>
      <div class="skills-progress__bar">
        <div class="skills-progress__fill skills-progress__fill--indeterminate"></div>
      </div>
      <div class="skills-progress__message">
        ${t('skills.install.message')}
      </div>
    </div>
  `;
}

// ─── SKILL.md 文档预览 (Phase 4) / SKILL.md document preview ────────────────

function renderSkillDocsLink(filePath: string) {
  // 计算 SKILL.md 路径（与技能文件同目录）
  const dirPath = filePath.replace(/\/[^/]+$/, "");
  const skillMdPath = `${dirPath}/SKILL.md`;

  return html`
    <div class="skills-detail-row">
      <span class="skills-detail-label">${t('skills.documentation')}</span>
      <span class="skills-detail-value">
        <a class="skills-docs-preview__link" href="file://${skillMdPath}" target="_blank" rel="noreferrer" title=${t('skills.viewSkillMd')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10 9 9 9 8 9"></polyline>
          </svg>
          SKILL.md
        </a>
      </span>
    </div>
  `;
}

// ─── API Key 输入 / API Key input ───────────────────────────────────────────

function renderApiKeyInput(
  skill: SkillStatusEntry,
  props: SkillsContentProps,
  isBusy: boolean,
) {
  const edit = props.edits[skill.skillKey];
  const apiKey = edit?.apiKey ?? "";

  return html`
    <div class="skills-apikey">
      <label class="skills-apikey__label">${skill.primaryEnv}</label>
      <div class="skills-apikey__row">
        <input
          type="password"
          class="skills-apikey__input"
          placeholder=${t('skills.enterApiKey')}
          .value=${apiKey}
          @input=${(e: Event) =>
            props.onSkillApiKeyChange(
              skill.skillKey,
              (e.target as HTMLInputElement).value,
            )}
        />
        <button
          class="mc-btn mc-btn--sm primary"
          ?disabled=${isBusy || !apiKey.trim()}
          @click=${() => props.onSkillApiKeySave(skill.skillKey)}
        >
          ${t('action.save')}
        </button>
      </div>
    </div>
  `;
}

// ─── 环境变量编辑器 / Environment variable editor ────────────────────────────

function renderEnvEditor(
  skill: SkillStatusEntry,
  props: SkillsContentProps,
) {
  const edit = props.edits[skill.skillKey];
  const envEntries = Object.entries(edit?.env ?? {});
  const requiredEnvs = skill.requirements?.env ?? [];

  // 合并已有环境变量和需求环境变量
  const allEnvKeys = new Set([
    ...requiredEnvs,
    ...envEntries.map(([k]) => k),
  ]);

  // 过滤掉 primaryEnv（已在 API Key 输入中处理）
  const otherEnvKeys = [...allEnvKeys].filter(k => k !== skill.primaryEnv);

  if (otherEnvKeys.length === 0) return nothing;

  return html`
    <div class="skills-env-editor">
      <div class="skills-env-editor__header">
        <span class="skills-env-editor__title">${t('skills.env.title')}</span>
      </div>
      <div class="skills-env-editor__list">
        ${otherEnvKeys.map((envKey) => {
          const value = edit?.env?.[envKey] ?? "";
          const isRequired = requiredEnvs.includes(envKey);
          const isMissing = skill.missing?.env?.includes(envKey);

          return html`
            <div class="skills-env-row ${isMissing ? "skills-env-row--missing" : ""}">
              <div class="skills-env-row__key">
                <span class="skills-env-row__label">${envKey}</span>
                ${isRequired
                  ? html`<span class="skills-env-row__badge">${t('skills.env.required')}</span>`
                  : nothing}
              </div>
              <div class="skills-env-row__value">
                <input
                  type="password"
                  class="skills-env-row__input"
                  placeholder=${t('skills.enterValue')}
                  .value=${value}
                  @input=${(e: Event) =>
                    props.onSkillEnvChange(
                      skill.skillKey,
                      envKey,
                      (e.target as HTMLInputElement).value,
                    )}
                />
                ${!isRequired
                  ? html`
                      <button
                        class="mc-icon-btn mc-icon-btn--danger"
                        title=${t('action.delete')}
                        @click=${() => props.onSkillEnvRemove(skill.skillKey, envKey)}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <line x1="18" y1="6" x2="6" y2="18"></line>
                          <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                      </button>
                    `
                  : nothing}
              </div>
            </div>
          `;
        })}
      </div>
    </div>
  `;
}

// ─── 自定义配置编辑器 / Custom config editor ─────────────────────────────────

function renderConfigEditor(
  skill: SkillStatusEntry,
  props: SkillsContentProps,
) {
  const edit = props.edits[skill.skillKey];
  const configJson = edit?.config
    ? JSON.stringify(edit.config, null, 2)
    : "{}";

  return html`
    <div class="skills-config-editor">
      <div class="skills-config-editor__header">
        <span class="skills-config-editor__title">${t('skills.config.title')}</span>
        <span class="skills-config-editor__hint">${t('skills.config.hint')}</span>
      </div>
      <textarea
        class="skills-config-editor__textarea"
        placeholder='{"key": "value"}'
        .value=${configJson}
        @change=${(e: Event) => {
          const text = (e.target as HTMLTextAreaElement).value;
          try {
            const parsed = JSON.parse(text);
            props.onSkillConfigChange(skill.skillKey, parsed);
          } catch {
            // 忽略无效 JSON
          }
        }}
      ></textarea>
    </div>
  `;
}

// =========================================================================
// 弹窗组件 / Modal components (Phase 5-6)
// =========================================================================

// ─── 编辑器弹窗 / Editor modal ───────────────────────────────────────────────

/**
 * 渲染技能编辑器弹窗
 * Render skill editor modal
 */
function renderEditorModal(props: SkillsContentProps) {
  const { editorState } = props;
  const hasChanges = editorState.content !== editorState.original;

  return html`
    <div class="skills-modal-overlay" @click=${props.onEditorClose}>
      <div class="skills-modal skills-editor-modal" @click=${(e: Event) => e.stopPropagation()}>
        <!-- 弹窗头部 -->
        <div class="skills-modal__header">
          <div class="skills-modal__title">
            <span class="skills-modal__icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
              </svg>
            </span>
            ${t('skills.editor.title', { skillName: editorState.skillName })}
          </div>
          <button class="skills-modal__close" @click=${props.onEditorClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <!-- 工具栏 -->
        <div class="skills-editor__toolbar">
          <div class="skills-editor__mode-tabs">
            <button
              class="skills-editor__mode-tab ${editorState.mode === "edit" ? "active" : ""}"
              @click=${() => props.onEditorModeChange("edit")}
            >
              ${t('action.edit')}
            </button>
            <button
              class="skills-editor__mode-tab ${editorState.mode === "preview" ? "active" : ""}"
              @click=${() => props.onEditorModeChange("preview")}
            >
              ${t('workspace.preview')}
            </button>
            <button
              class="skills-editor__mode-tab ${editorState.mode === "split" ? "active" : ""}"
              @click=${() => props.onEditorModeChange("split")}
            >
              ${t('workspace.split')}
            </button>
          </div>
          <div class="skills-editor__info">
            <span class="skills-editor__source">${editorState.source}</span>
            ${hasChanges ? html`<span class="skills-editor__dirty">${t('workspace.unsaved')}</span>` : nothing}
          </div>
        </div>

        <!-- 编辑器内容 -->
        <div class="skills-modal__body skills-editor__body">
          ${editorState.loading
            ? html`<div class="skills-editor__loading">${t('label.loading')}</div>`
            : editorState.error
              ? html`<div class="skills-editor__error">${editorState.error}</div>`
              : renderEditorContent(props)}
        </div>

        <!-- 底部按钮 -->
        <div class="skills-modal__footer">
          <button class="mc-btn" @click=${props.onEditorClose}>
            ${t('action.cancel')}
          </button>
          <button
            class="mc-btn primary"
            ?disabled=${editorState.saving || !hasChanges}
            @click=${props.onEditorSave}
          >
            ${editorState.saving ? t('status.saving') : t('action.save')}
          </button>
        </div>
      </div>
    </div>
  `;
}

/**
 * 渲染编辑器内容区域（根据模式）
 * Render editor content area (based on mode)
 */
function renderEditorContent(props: SkillsContentProps) {
  const { editorState } = props;

  switch (editorState.mode) {
    case "edit":
      return html`
        <div class="skills-editor__pane skills-editor__pane--full">
          <textarea
            class="skills-editor__textarea"
            .value=${editorState.content}
            @input=${(e: Event) =>
              props.onEditorContentChange((e.target as HTMLTextAreaElement).value)}
            placeholder=${t('skills.editor.placeholder')}
          ></textarea>
        </div>
      `;
    case "preview":
      return html`
        <div class="skills-editor__pane skills-editor__pane--full skills-editor__preview">
          ${renderMarkdownPreview(editorState.content)}
        </div>
      `;
    case "split":
      return html`
        <div class="skills-editor__split">
          <div class="skills-editor__pane">
            <textarea
              class="skills-editor__textarea"
              .value=${editorState.content}
              @input=${(e: Event) =>
                props.onEditorContentChange((e.target as HTMLTextAreaElement).value)}
              placeholder=${t('skills.editor.placeholder')}
            ></textarea>
          </div>
          <div class="skills-editor__divider"></div>
          <div class="skills-editor__pane skills-editor__preview">
            ${renderMarkdownPreview(editorState.content)}
          </div>
        </div>
      `;
    default:
      return nothing;
  }
}

/**
 * 简单的 Markdown 预览（仅处理基本格式）
 * Simple markdown preview (basic formatting only)
 */
function renderMarkdownPreview(content: string) {
  // 简单处理：将内容按行分割，处理标题和代码块
  const lines = content.split("\n");
  const elements: ReturnType<typeof html>[] = [];
  let inCodeBlock = false;
  let codeContent = "";

  for (const line of lines) {
    if (line.startsWith("```")) {
      if (inCodeBlock) {
        elements.push(html`<pre class="skills-preview__code">${codeContent}</pre>`);
        codeContent = "";
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeContent += line + "\n";
      continue;
    }

    if (line.startsWith("### ")) {
      elements.push(html`<h4 class="skills-preview__h4">${line.slice(4)}</h4>`);
    } else if (line.startsWith("## ")) {
      elements.push(html`<h3 class="skills-preview__h3">${line.slice(3)}</h3>`);
    } else if (line.startsWith("# ")) {
      elements.push(html`<h2 class="skills-preview__h2">${line.slice(2)}</h2>`);
    } else if (line.startsWith("---")) {
      elements.push(html`<hr class="skills-preview__hr" />`);
    } else if (line.startsWith("- ")) {
      elements.push(html`<li class="skills-preview__li">${line.slice(2)}</li>`);
    } else if (line.trim()) {
      elements.push(html`<p class="skills-preview__p">${line}</p>`);
    }
  }

  return html`<div class="skills-preview__content">${elements}</div>`;
}

// ─── 创建技能弹窗 / Create skill modal ───────────────────────────────────────

/**
 * 渲染创建技能弹窗
 * Render create skill modal
 */
function renderCreateModal(props: SkillsContentProps) {
  const { createState } = props;

  return html`
    <div class="skills-modal-overlay" @click=${props.onCreateClose}>
      <div class="skills-modal skills-create-modal" @click=${(e: Event) => e.stopPropagation()}>
        <!-- 弹窗头部 -->
        <div class="skills-modal__header">
          <div class="skills-modal__title">
            <span class="skills-modal__icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="16"></line>
                <line x1="8" y1="12" x2="16" y2="12"></line>
              </svg>
            </span>
            ${t('skills.create.title')}
          </div>
          <button class="skills-modal__close" @click=${props.onCreateClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <!-- 弹窗内容 -->
        <div class="skills-modal__body">
          ${createState.error
            ? html`<div class="skills-create__error">${createState.error}</div>`
            : nothing}

          <div class="skills-create__field">
            <label class="skills-create__label">${t('skills.create.nameLabel')}</label>
            <input
              type="text"
              class="skills-create__input ${createState.nameError ? "error" : ""}"
              placeholder="my-skill"
              .value=${createState.name}
              @input=${(e: Event) =>
                props.onCreateNameChange((e.target as HTMLInputElement).value)}
            />
            ${createState.nameError
              ? html`<div class="skills-create__field-error">${createState.nameError}</div>`
              : html`<div class="skills-create__hint">${t('skills.create.nameHint')}</div>`}
          </div>

          <div class="skills-create__field">
            <label class="skills-create__label">${t('skills.create.locationLabel')}</label>
            <div class="skills-create__radio-group">
              <label class="skills-create__radio">
                <input
                  type="radio"
                  name="create-source"
                  value="workspace"
                  .checked=${createState.source === "workspace"}
                  @change=${() => props.onCreateSourceChange("workspace")}
                />
                <span class="skills-create__radio-mark"></span>
                <span class="skills-create__radio-text">
                  <strong>${t('skills.create.workspace')}</strong>
                  <small>${t('skills.create.workspaceDesc')}</small>
                </span>
              </label>
              <label class="skills-create__radio">
                <input
                  type="radio"
                  name="create-source"
                  value="managed"
                  .checked=${createState.source === "managed"}
                  @change=${() => props.onCreateSourceChange("managed")}
                />
                <span class="skills-create__radio-mark"></span>
                <span class="skills-create__radio-text">
                  <strong>${t('skills.create.managed')}</strong>
                  <small>${t('skills.create.managedDesc')}</small>
                </span>
              </label>
            </div>
          </div>
        </div>

        <!-- 底部按钮 -->
        <div class="skills-modal__footer">
          <button class="mc-btn" @click=${props.onCreateClose}>
            ${t('action.cancel')}
          </button>
          <button
            class="mc-btn primary"
            ?disabled=${createState.creating || !!createState.nameError || !createState.name.trim()}
            @click=${props.onCreateConfirm}
          >
            ${createState.creating ? t('skills.creating') : t('skills.createSkill')}
          </button>
        </div>
      </div>
    </div>
  `;
}

// ─── 删除确认弹窗 / Delete confirmation modal ────────────────────────────────

/**
 * 渲染删除确认弹窗
 * Render delete confirmation modal
 */
function renderDeleteModal(props: SkillsContentProps) {
  const { deleteState } = props;

  return html`
    <div class="skills-modal-overlay" @click=${props.onDeleteClose}>
      <div class="skills-modal skills-delete-modal" @click=${(e: Event) => e.stopPropagation()}>
        <!-- 弹窗头部 -->
        <div class="skills-modal__header skills-modal__header--danger">
          <div class="skills-modal__title">
            <span class="skills-modal__icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                <line x1="10" y1="11" x2="10" y2="17"></line>
                <line x1="14" y1="11" x2="14" y2="17"></line>
              </svg>
            </span>
            ${t('skills.delete.title')}
          </div>
          <button class="skills-modal__close" @click=${props.onDeleteClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <!-- 弹窗内容 -->
        <div class="skills-modal__body">
          ${deleteState.error
            ? html`<div class="skills-delete__error">${deleteState.error}</div>`
            : nothing}

          <div class="skills-delete__warning">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
            <span>${t('skills.delete.warning')}</span>
          </div>

          <p class="skills-delete__message">
            ${t('skills.delete.message', { skillName: deleteState.skillName })}
          </p>
          <p class="skills-delete__info">
            ${t('skills.delete.info')}
          </p>
        </div>

        <!-- 底部按钮 -->
        <div class="skills-modal__footer">
          <button class="mc-btn" @click=${props.onDeleteClose}>
            ${t('action.cancel')}
          </button>
          <button
            class="mc-btn mc-btn--danger"
            ?disabled=${deleteState.deleting}
            @click=${props.onDeleteConfirm}
          >
            ${deleteState.deleting ? t('skills.deleting') : t('skills.confirmDelete')}
          </button>
        </div>
      </div>
    </div>
  `;
}
