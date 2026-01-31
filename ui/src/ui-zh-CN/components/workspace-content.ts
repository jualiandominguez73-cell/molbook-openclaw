/**
 * Workspace File Management Content Component
 * Right panel - File list + Editor + Preview
 */
import { html, nothing } from "lit";
import { t } from "../i18n";

// ─── Types ──────────────────────────────────────────────────────

/** Workspace file info */
export type WorkspaceFileInfo = {
  name: string;
  path: string;
  exists: boolean;
  size: number;
  modifiedAt: number | null;
};

/** Agent option */
export type WorkspaceAgentOption = {
  id: string;
  name?: string;
  default?: boolean;
};

/** Component props */
export type WorkspaceContentProps = {
  /** File list */
  files: WorkspaceFileInfo[];
  /** Current workspace directory */
  workspaceDir: string;
  /** Current Agent ID */
  agentId: string;
  /** Available agents */
  agents: WorkspaceAgentOption[];
  /** Currently selected file name */
  selectedFile: string | null;
  /** Editor content */
  editorContent: string;
  /** Original content (for change detection) */
  originalContent: string;
  /** Loading state */
  loading: boolean;
  /** Saving state */
  saving: boolean;
  /** Error message */
  error: string | null;
  /** Editor mode: edit, preview, split */
  editorMode: "edit" | "preview" | "split";
  /** Set of expanded folders */
  expandedFolders?: Set<string>;

  // Callbacks
  /** Select file */
  onFileSelect: (fileName: string) => void;
  /** Editor content changed */
  onContentChange: (content: string) => void;
  /** Save file */
  onFileSave: () => void;
  /** Refresh file list */
  onRefresh: () => void;
  /** Toggle editor mode */
  onModeChange: (mode: "edit" | "preview" | "split") => void;
  /** Create new file */
  onFileCreate: (fileName: string) => void;
  /** Toggle folder expansion */
  onFolderToggle?: (folderName: string) => void;
  /** Switch agent */
  onAgentChange?: (agentId: string) => void;
};

// ─── Icons ──────────────────────────────────────────────────────

const icons = {
  // Folder icon
  folder: html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`,
  // File icon
  file: html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>`,
  // Edit icon
  edit: html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`,
  // Eye icon
  eye: html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`,
  // Split icon
  split: html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="12" y1="3" x2="12" y2="21"></line></svg>`,
  // Save icon
  save: html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>`,
  // Refresh icon
  refresh: html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>`,
  // Plus icon
  plus: html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`,
  // Chevron right (collapsed)
  chevronRight: html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>`,
  // Chevron down (expanded)
  chevronDown: html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>`,
};

// ─── File description map ────────────────────────────────────────

const FILE_DESCRIPTIONS: Record<string, string> = {
  "SOUL.md": t('workspace.file.soul'),
  "IDENTITY.md": t('workspace.file.identity'),
  "TOOLS.md": t('workspace.file.tools'),
  "USER.md": t('workspace.file.user'),
  "HEARTBEAT.md": t('workspace.file.heartbeat'),
  "BOOTSTRAP.md": t('workspace.file.bootstrap'),
  "MEMORY.md": t('workspace.file.memory'),
  "memory.md": t('workspace.file.memory'),
  "AGENTS.md": t('workspace.file.agents'),
};

/**
 * Get file description, supports dated files in memory/ directory
 */
function getFileDescription(fileName: string): string {
  // Check static descriptions first
  if (FILE_DESCRIPTIONS[fileName]) {
    return FILE_DESCRIPTIONS[fileName];
  }

  // Handle memory/ directory files (memory/YYYY-MM-DD.md)
  if (fileName.startsWith("memory/")) {
    const dateMatch = fileName.match(/^memory\/(\d{4})-(\d{2})-(\d{2})\.md$/);
    if (dateMatch) {
      const [, year, month, day] = dateMatch;
      return t('workspace.file.dailyLog', { year, month, day });
    }
    return t('workspace.file.dailyLogFallback');
  }

  return "";
}

// ─── 辅助函数 / Helpers ─────────────────────────────────────────────────────

/** Format file size */
function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Format time */
function formatTime(ts: number | null): string {
  if (!ts) return "-";
  const d = new Date(ts);
  return d.toLocaleString(undefined, {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Simple Markdown to HTML renderer
 * Supports headings, bold, italic, code blocks, lists
 */
function renderMarkdownToHtml(md: string): string {
  if (!md) return `<p class="ws-preview__empty">${t('workspace.emptyFile')}</p>`;

  let result = md
    // Escape HTML
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Code blocks
  result = result.replace(
    /```(\w*)\n([\s\S]*?)```/g,
    '<pre class="ws-preview__code"><code>$2</code></pre>',
  );

  // Inline code
  result = result.replace(/`([^`]+)`/g, '<code class="ws-preview__inline-code">$1</code>');

  // Headings
  result = result.replace(/^### (.+)$/gm, '<h3 class="ws-preview__h3">$1</h3>');
  result = result.replace(/^## (.+)$/gm, '<h2 class="ws-preview__h2">$1</h2>');
  result = result.replace(/^# (.+)$/gm, '<h1 class="ws-preview__h1">$1</h1>');

  // Bold and italic
  result = result.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  result = result.replace(/\*(.+?)\*/g, "<em>$1</em>");

  // Unordered lists
  result = result.replace(/^[-*] (.+)$/gm, '<li class="ws-preview__li">$1</li>');

  // Horizontal rule
  result = result.replace(/^---$/gm, '<hr class="ws-preview__hr">');

  // Paragraphs (lines that are not already wrapped)
  const lines = result.split("\n");
  const processed: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (
      !trimmed ||
      trimmed.startsWith("<h") ||
      trimmed.startsWith("<pre") ||
      trimmed.startsWith("<li") ||
      trimmed.startsWith("<hr") ||
      trimmed.startsWith("</")
    ) {
      processed.push(line);
    } else {
      processed.push(`<p class="ws-preview__p">${line}</p>`);
    }
  }

  return processed.join("\n");
}

// ─── 文件分组 / Group files by directory ──────────────────────────────────

type FileGroup = {
  /** Folder name (null = root) */
  folder: string | null;
  /** Folder description */
  desc: string;
  /** File list */
  files: WorkspaceFileInfo[];
};

const FOLDER_DESCRIPTIONS: Record<string, string> = {
  memory: t('workspace.folder.memory'),
};

/**
 * Group file list by directory
 */
function groupFilesByFolder(files: WorkspaceFileInfo[]): FileGroup[] {
  const rootFiles: WorkspaceFileInfo[] = [];
  const folderMap = new Map<string, WorkspaceFileInfo[]>();

  for (const file of files) {
    const slashIdx = file.name.indexOf("/");
    if (slashIdx === -1) {
      rootFiles.push(file);
    } else {
      const folder = file.name.slice(0, slashIdx);
      if (!folderMap.has(folder)) {
        folderMap.set(folder, []);
      }
      folderMap.get(folder)!.push(file);
    }
  }

  const groups: FileGroup[] = [];

  // Root files first
  if (rootFiles.length > 0) {
    groups.push({ folder: null, desc: "", files: rootFiles });
  }

  // Then folders
  for (const [folder, folderFiles] of folderMap) {
    groups.push({
      folder,
      desc: FOLDER_DESCRIPTIONS[folder] ?? "",
      files: folderFiles,
    });
  }

  return groups;
}

// ─── 渲染单个文件项 / Render single file item ──────────────────────────────

function renderFileItem(
  file: WorkspaceFileInfo,
  props: WorkspaceContentProps,
  hasChanges: boolean,
  indent = false,
) {
  const isSelected = props.selectedFile === file.name;
  const desc = getFileDescription(file.name);
  // For indented items, only show the base name / 缩进项只显示基础文件名
  const displayName = indent && file.name.includes("/")
    ? file.name.slice(file.name.lastIndexOf("/") + 1)
    : file.name;

  return html`
    <button
      class="ws-file-item ${isSelected ? "ws-file-item--active" : ""} ${!file.exists ? "ws-file-item--missing" : ""} ${indent ? "ws-file-item--indent" : ""}"
      @click=${() => props.onFileSelect(file.name)}
      title=${file.path}
    >
      <span class="ws-file-item__icon">${icons.file}</span>
      <span class="ws-file-item__info">
        <span class="ws-file-item__name">
          ${displayName}
          ${!file.exists
            ? html`<span class="ws-file-item__badge ws-file-item__badge--new">${t('workspace.newBadge')}</span>`
            : nothing}
          ${isSelected && hasChanges
            ? html`<span class="ws-file-item__badge ws-file-item__badge--unsaved">${t('workspace.unsaved')}</span>`
            : nothing}
        </span>
        <span class="ws-file-item__desc">${desc}</span>
        ${file.exists
          ? html`<span class="ws-file-item__meta">${formatSize(file.size)} · ${formatTime(file.modifiedAt)}</span>`
          : nothing}
      </span>
    </button>
  `;
}

// ─── 渲染文件列表 / Render file list ──────────────────────────────────────

function renderFileList(props: WorkspaceContentProps) {
  const hasChanges = !!(
    props.selectedFile && props.editorContent !== props.originalContent
  );
  const groups = groupFilesByFolder(props.files);
  const expandedFolders = props.expandedFolders ?? new Set<string>();

  return html`
    <div class="ws-file-list">
      <div class="ws-file-list__header">
        <div class="ws-file-list__title">${t('workspace.files')}</div>
        <button
          class="mc-btn mc-btn--sm"
          ?disabled=${props.loading}
          @click=${() => {
            const today = new Date();
            const yyyy = today.getFullYear();
            const mm = String(today.getMonth() + 1).padStart(2, "0");
            const dd = String(today.getDate()).padStart(2, "0");
            props.onFileCreate(`memory/${yyyy}-${mm}-${dd}.md`);
          }}
          title=${t('workspace.createTodayLog')}
        >
          ${icons.plus}
        </button>
        <button
          class="mc-btn mc-btn--sm"
          ?disabled=${props.loading}
          @click=${props.onRefresh}
          title=${t('action.refresh')}
        >
          ${icons.refresh}
        </button>
      </div>
      <div class="ws-file-list__body">
        ${groups.map((group) => {
          // Root files: render directly / 根目录文件直接渲染
          if (group.folder === null) {
            return group.files.map((file) =>
              renderFileItem(file, props, hasChanges, false),
            );
          }

          // Folder group: render as collapsible / 文件夹：渲染为可展开
          const folderName = group.folder;
          const isExpanded = expandedFolders.has(folderName);
          const fileCount = group.files.length;
          // Check if any child is selected / 检查是否有子文件被选中
          const hasSelectedChild = group.files.some(
            (f) => f.name === props.selectedFile,
          );

          return html`
            <button
              class="ws-folder-item ${hasSelectedChild ? "ws-folder-item--has-active" : ""}"
              @click=${() => props.onFolderToggle?.(folderName)}
              title="${folderName}/ (${t('workspace.folderFiles', { count: fileCount })})"
            >
              <span class="ws-folder-item__chevron">
                ${isExpanded ? icons.chevronDown : icons.chevronRight}
              </span>
              <span class="ws-folder-item__icon">${icons.folder}</span>
              <span class="ws-folder-item__info">
                <span class="ws-folder-item__name">
                  ${folderName}/
                  <span class="ws-folder-item__count">${fileCount}</span>
                </span>
                ${group.desc
                  ? html`<span class="ws-folder-item__desc">${group.desc}</span>`
                  : nothing}
              </span>
            </button>
            ${isExpanded
              ? group.files.map((file) =>
                  renderFileItem(file, props, hasChanges, true),
                )
              : nothing}
          `;
        })}
      </div>
      <!-- 工作区目录显示 / Workspace dir display -->
      <div class="ws-file-list__footer">
        <span class="ws-file-list__dir-label">${t('agent.workspace')}</span>
        <span class="ws-file-list__dir-path" title=${props.workspaceDir}>${props.workspaceDir}</span>
      </div>
    </div>
  `;
}

// ─── 渲染编辑器工具栏 / Render editor toolbar ────────────────────────────────

function renderEditorToolbar(props: WorkspaceContentProps) {
  const hasChanges = props.editorContent !== props.originalContent;

  return html`
    <div class="ws-editor__toolbar">
      <div class="ws-editor__toolbar-left">
        <span class="ws-editor__filename">${props.selectedFile ?? ""}</span>
        ${hasChanges
          ? html`<span class="ws-editor__unsaved-dot" title=${t('workspace.unsaved')}></span>`
          : nothing}
      </div>
      <div class="ws-editor__toolbar-right">
        <!-- 模式切换 / Mode toggle -->
        <div class="ws-editor__mode-group">
          <button
            class="ws-editor__mode-btn ${props.editorMode === "edit" ? "ws-editor__mode-btn--active" : ""}"
            @click=${() => props.onModeChange("edit")}
            title=${t('workspace.editor')}
          >${icons.edit}</button>
          <button
            class="ws-editor__mode-btn ${props.editorMode === "split" ? "ws-editor__mode-btn--active" : ""}"
            @click=${() => props.onModeChange("split")}
            title=${t('workspace.split')}
          >${icons.split}</button>
          <button
            class="ws-editor__mode-btn ${props.editorMode === "preview" ? "ws-editor__mode-btn--active" : ""}"
            @click=${() => props.onModeChange("preview")}
            title=${t('workspace.preview')}
          >${icons.eye}</button>
        </div>
        <!-- 保存按钮 / Save button -->
        <button
          class="mc-btn mc-btn--sm mc-btn--primary"
          ?disabled=${!hasChanges || props.saving}
          @click=${props.onFileSave}
        >
          ${icons.save}
          ${props.saving ? t('status.saving') : t('action.save')}
        </button>
      </div>
    </div>
  `;
}

// ─── 渲染编辑器 / Render editor ─────────────────────────────────────────────

function renderEditor(props: WorkspaceContentProps) {
  if (!props.selectedFile) {
    return html`
      <div class="ws-editor__empty">
        <div class="ws-editor__empty-icon">${icons.file}</div>
        <div class="ws-editor__empty-text">${t('workspace.selectFile')}</div>
      </div>
    `;
  }

  const showEditor = props.editorMode === "edit" || props.editorMode === "split";
  const showPreview = props.editorMode === "preview" || props.editorMode === "split";

  return html`
    ${renderEditorToolbar(props)}
    ${props.error
      ? html`<div class="mc-error">${props.error}</div>`
      : nothing}
    <div class="ws-editor__panels ${props.editorMode === "split" ? "ws-editor__panels--split" : ""}">
      ${showEditor
        ? html`
            <div class="ws-editor__edit-panel">
              <textarea
                class="ws-editor__textarea"
                .value=${props.editorContent}
                @input=${(e: Event) =>
                  props.onContentChange(
                    (e.target as HTMLTextAreaElement).value,
                  )}
                placeholder=${t('workspace.editor.inputPlaceholder')}
                spellcheck="false"
              ></textarea>
            </div>
          `
        : nothing}
      ${showPreview
        ? html`
            <div class="ws-editor__preview-panel">
              <div class="ws-preview">
                ${renderMarkdownPreview(props.editorContent)}
              </div>
            </div>
          `
        : nothing}
    </div>
  `;
}

/**
 * 渲染 Markdown 预览（使用 unsafeHTML 代替）
 * Render Markdown preview
 *
 * 为了避免依赖 lit 的 unsafeHTML 指令，使用 iframe srcdoc
 * To avoid dependency on lit's unsafeHTML directive, use iframe srcdoc
 */
function renderMarkdownPreview(content: string) {
  const htmlContent = renderMarkdownToHtml(content);
  // 使用 srcdoc iframe 来安全渲染 HTML
  // Use srcdoc iframe to safely render HTML
  const fullHtml = `<!DOCTYPE html>
<html>
<head>
<style>
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: 14px;
    line-height: 1.7;
    color: #e0e0e0;
    background: transparent;
    margin: 0;
    padding: 4px;
    word-wrap: break-word;
  }
  @media (prefers-color-scheme: light) {
    body { color: #333; }
  }
  h1 { font-size: 1.6em; margin: 0.8em 0 0.4em; border-bottom: 1px solid rgba(128,128,128,0.3); padding-bottom: 0.3em; }
  h2 { font-size: 1.3em; margin: 0.7em 0 0.3em; }
  h3 { font-size: 1.1em; margin: 0.6em 0 0.3em; }
  p { margin: 0.4em 0; }
  pre { background: rgba(0,0,0,0.3); padding: 12px; border-radius: 6px; overflow-x: auto; font-size: 13px; }
  code { font-family: "SF Mono", "Fira Code", monospace; font-size: 0.9em; }
  p code { background: rgba(0,0,0,0.2); padding: 2px 5px; border-radius: 3px; }
  li { margin: 0.2em 0; margin-left: 1.2em; }
  hr { border: none; border-top: 1px solid rgba(128,128,128,0.3); margin: 1em 0; }
  strong { font-weight: 600; }
</style>
</head>
<body>${htmlContent}</body>
</html>`;

  return html`<iframe
    class="ws-preview__iframe"
    srcdoc=${fullHtml}
    sandbox="allow-same-origin"
    frameborder="0"
  ></iframe>`;
}

// ─── 主渲染函数 / Main render function ──────────────────────────────────────

/**
 * 渲染 Agent 选择器
 * Render agent selector
 */
function renderAgentSelector(props: WorkspaceContentProps) {
  // 如果没有多个 agent 或没有回调，不显示选择器
  if (!props.agents || props.agents.length <= 1 || !props.onAgentChange) {
    return nothing;
  }

  return html`
    <div class="ws-agent-selector">
      <label class="ws-agent-selector__label">Agent:</label>
      <select
        class="ws-agent-selector__select"
        .value=${props.agentId}
        @change=${(e: Event) => {
          const select = e.target as HTMLSelectElement;
          props.onAgentChange?.(select.value);
        }}
      >
        ${props.agents.map(
          (agent) => html`
            <option value=${agent.id} ?selected=${agent.id === props.agentId}>
              ${agent.name || agent.id}${agent.default ? " (默认)" : ""}
            </option>
          `,
        )}
      </select>
    </div>
  `;
}

/**
 * 渲染工作区文件管理内容
 * Render workspace file management content
 */
export function renderWorkspaceContent(props: WorkspaceContentProps) {
  return html`
    <div class="config-content">
      <div class="config-content__header">
        <div class="config-content__icon">${icons.folder}</div>
        <div class="config-content__titles">
          <h2 class="config-content__title">${t('workspace.title')}</h2>
          <p class="config-content__desc">${t('workspace.desc')}</p>
        </div>
        ${renderAgentSelector(props)}
      </div>
      <div class="ws-layout">
        <!-- 左侧文件列表 / Left file list -->
        ${renderFileList(props)}
        <!-- 右侧编辑器 / Right editor -->
        <div class="ws-editor">
          ${props.loading
            ? html`<div class="ws-editor__loading">${t('label.loading')}</div>`
            : renderEditor(props)}
        </div>
      </div>
    </div>
  `;
}
