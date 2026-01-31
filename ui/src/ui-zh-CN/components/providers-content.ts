/**
 * Model Provider Configuration Content Component
 * Right panel - Provider management
 */
import { html, nothing } from "lit";
import { t } from "../i18n";
import type { ProviderConfig, ModelConfig, ModelApi, AuthMode } from "../views/model-config";

// SVG icons
const icons = {
  provider: html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>`,
  add: html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`,
  trash: html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`,
  chevron: html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>`,
  settings: html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`,
  info: html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`,
  close: html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
};

// API protocol options - function to get localized labels
function getApiProtocols(): Array<{ value: ModelApi; label: string; hint: string }> {
  return [
    { value: "openai-completions", label: "OpenAI Completions", hint: t('providers.protocol.openaiCompletions') },
    { value: "openai-responses", label: "OpenAI Responses", hint: t('providers.protocol.openaiResponses') },
    { value: "anthropic-messages", label: "Anthropic Messages", hint: t('providers.protocol.anthropic') },
    { value: "google-generative-ai", label: "Google Generative AI", hint: t('providers.protocol.google') },
    { value: "github-copilot", label: "GitHub Copilot", hint: t('providers.protocol.githubCopilot') },
    { value: "bedrock-converse-stream", label: "AWS Bedrock", hint: t('providers.protocol.bedrock') },
  ];
}

// Auth mode options - function to get localized labels
function getAuthModes(): Array<{ value: AuthMode; label: string; hint: string }> {
  return [
    { value: "api-key", label: "API Key", hint: t('providers.auth.apiKey') },
    { value: "aws-sdk", label: "AWS SDK", hint: t('providers.auth.awsSdk') },
    { value: "oauth", label: "OAuth", hint: t('providers.auth.oauth') },
    { value: "token", label: "Bearer Token", hint: t('providers.auth.token') },
  ];
}

// New provider form state
export type ProviderFormState = {
  name: string;
  baseUrl: string;
  apiKey: string;
  api: ModelApi;
  auth: AuthMode;
};

// Default form state
const DEFAULT_PROVIDER_FORM: ProviderFormState = {
  name: "",
  baseUrl: "",
  apiKey: "",
  api: "openai-completions",
  auth: "api-key",
};

export type ProvidersContentProps = {
  providers: Record<string, ProviderConfig>;
  expandedProviders: Set<string>;
  // Add provider modal state
  showAddModal?: boolean;
  addForm?: ProviderFormState;
  addError?: string | null;
  // Callbacks
  onProviderToggle: (key: string) => void;
  onProviderAdd: () => void;
  onProviderRemove: (key: string) => void;
  onProviderRename: (oldKey: string, newKey: string) => void;
  onProviderUpdate: (key: string, field: string, value: unknown) => void;
  onModelAdd: (providerKey: string) => void;
  onModelRemove: (providerKey: string, modelIndex: number) => void;
  onModelUpdate: (providerKey: string, modelIndex: number, field: string, value: unknown) => void;
  // Modal callbacks
  onShowAddModal?: (show: boolean) => void;
  onAddFormChange?: (patch: Partial<ProviderFormState>) => void;
  onAddConfirm?: () => void;
};

/**
 * Render model row
 */
function renderModelRow(
  providerKey: string,
  index: number,
  model: ModelConfig,
  props: ProvidersContentProps,
) {
  const hasText = model.input?.includes("text") ?? true;
  const hasImage = model.input?.includes("image") ?? false;

  const handleInputChange = (type: "text" | "image", checked: boolean) => {
    const currentInput = model.input ?? ["text"];
    let newInput: Array<"text" | "image">;
    if (checked) {
      newInput = [...new Set([...currentInput, type])];
    } else {
      newInput = currentInput.filter((t) => t !== type);
      if (newInput.length === 0) newInput = ["text"]; // At least keep text
    }
    props.onModelUpdate(providerKey, index, "input", newInput);
  };

  return html`
    <div class="mc-model-row">
      <div class="mc-model-row__main">
        <div class="mc-model-row__field mc-model-row__field--id">
          <label class="mc-field mc-field--sm">
            <span class="mc-field__label">${t('providers.modelId')}</span>
            <input
              type="text"
              class="mc-input mc-input--sm"
              .value=${model.id}
              @input=${(e: Event) =>
                props.onModelUpdate(providerKey, index, "id", (e.target as HTMLInputElement).value)}
            />
          </label>
        </div>
        <div class="mc-model-row__field mc-model-row__field--name">
          <label class="mc-field mc-field--sm">
            <span class="mc-field__label">${t('providers.modelName')}</span>
            <input
              type="text"
              class="mc-input mc-input--sm"
              .value=${model.name}
              @input=${(e: Event) =>
                props.onModelUpdate(providerKey, index, "name", (e.target as HTMLInputElement).value)}
            />
          </label>
        </div>
        <div class="mc-model-row__field mc-model-row__field--context">
          <label class="mc-field mc-field--sm">
            <span class="mc-field__label">${t('providers.contextWindow')}</span>
            <input
              type="number"
              class="mc-input mc-input--sm"
              .value=${String(model.contextWindow)}
              @input=${(e: Event) =>
                props.onModelUpdate(
                  providerKey,
                  index,
                  "contextWindow",
                  Number((e.target as HTMLInputElement).value),
                )}
            />
          </label>
        </div>
        <div class="mc-model-row__field mc-model-row__field--tokens">
          <label class="mc-field mc-field--sm">
            <span class="mc-field__label">${t('providers.maxTokens')}</span>
            <input
              type="number"
              class="mc-input mc-input--sm"
              .value=${String(model.maxTokens)}
              @input=${(e: Event) =>
                props.onModelUpdate(
                  providerKey,
                  index,
                  "maxTokens",
                  Number((e.target as HTMLInputElement).value),
                )}
            />
          </label>
        </div>
        <div class="mc-model-row__field mc-model-row__field--input">
          <div class="mc-field mc-field--sm">
            <span class="mc-field__label">${t('providers.modelInput')}</span>
            <div class="mc-checkbox-group">
              <label class="mc-checkbox">
                <input
                  type="checkbox"
                  .checked=${hasText}
                  @change=${(e: Event) => handleInputChange("text", (e.target as HTMLInputElement).checked)}
                />
                <span>${t('providers.inputText')}</span>
              </label>
              <label class="mc-checkbox">
                <input
                  type="checkbox"
                  .checked=${hasImage}
                  @change=${(e: Event) => handleInputChange("image", (e.target as HTMLInputElement).checked)}
                />
                <span>${t('providers.inputImage')}</span>
              </label>
            </div>
          </div>
        </div>
        <div class="mc-model-row__field mc-model-row__field--reasoning">
          <label class="mc-toggle-field">
            <span class="mc-toggle-field__label">${t('providers.modelReasoning')}</span>
            <div class="mc-toggle">
              <input
                type="checkbox"
                .checked=${model.reasoning}
                @change=${(e: Event) =>
                  props.onModelUpdate(
                    providerKey,
                    index,
                    "reasoning",
                    (e.target as HTMLInputElement).checked,
                  )}
              />
              <span class="mc-toggle__track"></span>
            </div>
          </label>
        </div>
      </div>
      <button
        class="mc-icon-btn mc-icon-btn--danger mc-model-row__remove"
        title=${t('action.delete')}
        @click=${() => props.onModelRemove(providerKey, index)}
      >
        ${icons.trash}
      </button>
    </div>
    ${renderModelAdvanced(providerKey, index, model, props)}
  `;
}

/**
 * Render model advanced config (cost and compatibility)
 */
function renderModelAdvanced(
  providerKey: string,
  index: number,
  model: ModelConfig,
  props: ProvidersContentProps,
) {
  const cost = model.cost ?? { input: 0, output: 0 };
  const compat = model.compat ?? {};

  return html`
    <div class="mc-model-advanced">
      <details class="mc-model-advanced__details">
        <summary class="mc-model-advanced__summary">
          ${icons.settings}
          <span>${t('providers.advancedConfig')}</span>
        </summary>
        <div class="mc-model-advanced__content">
          <!-- 成本配置 -->
          <div class="mc-model-advanced__section">
            <div class="mc-model-advanced__section-title">${t('providers.modelCost')}</div>
            <div class="mc-model-advanced__grid">
              <label class="mc-field mc-field--sm">
                <span class="mc-field__label">${t('providers.costInput')}</span>
                <div class="mc-input-with-unit">
                  <input
                    type="number"
                    class="mc-input mc-input--sm"
                    step="0.01"
                    .value=${String(cost.input ?? 0)}
                    @input=${(e: Event) =>
                      props.onModelUpdate(providerKey, index, "cost", {
                        ...cost,
                        input: Number((e.target as HTMLInputElement).value),
                      })}
                  />
                  <span class="mc-input-unit">${t('providers.costUnit')}</span>
                </div>
              </label>
              <label class="mc-field mc-field--sm">
                <span class="mc-field__label">${t('providers.costOutput')}</span>
                <div class="mc-input-with-unit">
                  <input
                    type="number"
                    class="mc-input mc-input--sm"
                    step="0.01"
                    .value=${String(cost.output ?? 0)}
                    @input=${(e: Event) =>
                      props.onModelUpdate(providerKey, index, "cost", {
                        ...cost,
                        output: Number((e.target as HTMLInputElement).value),
                      })}
                  />
                  <span class="mc-input-unit">${t('providers.costUnit')}</span>
                </div>
              </label>
              <label class="mc-field mc-field--sm">
                <span class="mc-field__label">${t('providers.costCacheRead')}</span>
                <div class="mc-input-with-unit">
                  <input
                    type="number"
                    class="mc-input mc-input--sm"
                    step="0.01"
                    .value=${String(cost.cacheRead ?? 0)}
                    @input=${(e: Event) =>
                      props.onModelUpdate(providerKey, index, "cost", {
                        ...cost,
                        cacheRead: Number((e.target as HTMLInputElement).value),
                      })}
                  />
                  <span class="mc-input-unit">${t('providers.costUnit')}</span>
                </div>
              </label>
              <label class="mc-field mc-field--sm">
                <span class="mc-field__label">${t('providers.costCacheWrite')}</span>
                <div class="mc-input-with-unit">
                  <input
                    type="number"
                    class="mc-input mc-input--sm"
                    step="0.01"
                    .value=${String(cost.cacheWrite ?? 0)}
                    @input=${(e: Event) =>
                      props.onModelUpdate(providerKey, index, "cost", {
                        ...cost,
                        cacheWrite: Number((e.target as HTMLInputElement).value),
                      })}
                  />
                  <span class="mc-input-unit">${t('providers.costUnit')}</span>
                </div>
              </label>
            </div>
          </div>

          <!-- 兼容性配置 -->
          <div class="mc-model-advanced__section">
            <div class="mc-model-advanced__section-title">${t('providers.modelCompat')}</div>
            <div class="mc-model-advanced__compat">
              <label class="mc-checkbox">
                <input
                  type="checkbox"
                  .checked=${compat.supportsStore ?? false}
                  @change=${(e: Event) =>
                    props.onModelUpdate(providerKey, index, "compat", {
                      ...compat,
                      supportsStore: (e.target as HTMLInputElement).checked,
                    })}
                />
                <span>${t('providers.compatStore')}</span>
              </label>
              <label class="mc-checkbox">
                <input
                  type="checkbox"
                  .checked=${compat.supportsDeveloperRole ?? false}
                  @change=${(e: Event) =>
                    props.onModelUpdate(providerKey, index, "compat", {
                      ...compat,
                      supportsDeveloperRole: (e.target as HTMLInputElement).checked,
                    })}
                />
                <span>${t('providers.compatDeveloper')}</span>
              </label>
              <label class="mc-checkbox">
                <input
                  type="checkbox"
                  .checked=${compat.supportsReasoningEffort ?? false}
                  @change=${(e: Event) =>
                    props.onModelUpdate(providerKey, index, "compat", {
                      ...compat,
                      supportsReasoningEffort: (e.target as HTMLInputElement).checked,
                    })}
                />
                <span>${t('providers.compatReasoning')}</span>
              </label>
              <div class="mc-compat-select">
                <span class="mc-compat-select__label">${t('providers.compatMaxTokens')}:</span>
                <select
                  class="mc-select mc-select--sm"
                  @change=${(e: Event) =>
                    props.onModelUpdate(providerKey, index, "compat", {
                      ...compat,
                      maxTokensField: (e.target as HTMLSelectElement).value as "max_tokens" | "max_completion_tokens",
                    })}
                >
                  <option value="max_tokens" .selected=${(compat.maxTokensField ?? "max_tokens") === "max_tokens"}>${t('providers.maxTokensField')}</option>
                  <option value="max_completion_tokens" .selected=${compat.maxTokensField === "max_completion_tokens"}>${t('providers.maxCompletionTokensField')}</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </details>
    </div>
  `;
}

/**
 * Render Headers editor
 */
function renderHeadersEditor(
  providerKey: string,
  headers: Record<string, string> | undefined,
  props: ProvidersContentProps,
) {
  const entries = Object.entries(headers ?? {});

  const handleAddHeader = () => {
    const newHeaders = { ...(headers ?? {}), "": "" };
    props.onProviderUpdate(providerKey, "headers", newHeaders);
  };

  const handleRemoveHeader = (key: string) => {
    const newHeaders = { ...(headers ?? {}) };
    delete newHeaders[key];
    props.onProviderUpdate(providerKey, "headers", Object.keys(newHeaders).length > 0 ? newHeaders : undefined);
  };

  const handleHeaderChange = (oldKey: string, newKey: string, value: string) => {
    const newHeaders: Record<string, string> = {};
    for (const [k, v] of Object.entries(headers ?? {})) {
      if (k === oldKey) {
        if (newKey) newHeaders[newKey] = value;
      } else {
        newHeaders[k] = v;
      }
    }
    props.onProviderUpdate(providerKey, "headers", Object.keys(newHeaders).length > 0 ? newHeaders : undefined);
  };

  return html`
    <div class="mc-headers-section">
      <div class="mc-headers-section__header">
        <span class="mc-headers-section__title">${t('providers.headers')}</span>
        <button class="mc-btn mc-btn--sm" @click=${handleAddHeader}>
          ${icons.add} ${t('providers.addHeader')}
        </button>
      </div>
      ${entries.length === 0
        ? html`<div class="mc-headers-section__hint">${t('providers.headersHint')}</div>`
        : html`
            <div class="mc-headers-list">
              ${entries.map(
                ([key, value]) => html`
                  <div class="mc-header-row">
                    <input
                      type="text"
                      class="mc-input mc-input--sm"
                      placeholder=${t('providers.headerKey')}
                      .value=${key}
                      @input=${(e: Event) =>
                        handleHeaderChange(key, (e.target as HTMLInputElement).value, value)}
                    />
                    <input
                      type="text"
                      class="mc-input mc-input--sm"
                      placeholder=${t('providers.headerValue')}
                      .value=${value}
                      @input=${(e: Event) =>
                        handleHeaderChange(key, key, (e.target as HTMLInputElement).value)}
                    />
                    <button
                      class="mc-icon-btn mc-icon-btn--danger mc-icon-btn--sm"
                      @click=${() => handleRemoveHeader(key)}
                    >
                      ${icons.trash}
                    </button>
                  </div>
                `,
              )}
            </div>
          `}
    </div>
  `;
}

/**
 * Get protocol label
 */
function getProtocolLabel(api: ModelApi): string {
  const protocol = getApiProtocols().find((p) => p.value === api);
  return protocol?.label ?? api;
}

/**
 * Render provider card
 */
function renderProviderCard(
  key: string,
  provider: ProviderConfig,
  expanded: boolean,
  props: ProvidersContentProps,
) {
  const protocolLabel = getProtocolLabel(provider.api);
  const authMode = provider.auth ?? "api-key";
  const showApiKey = authMode === "api-key" || authMode === "token";

  return html`
    <div class="mc-provider-card ${expanded ? "mc-provider-card--expanded" : ""}">
      <div
        class="mc-provider-card__header"
        @click=${() => props.onProviderToggle(key)}
      >
        <div class="mc-provider-card__info">
          <div class="mc-provider-card__icon">${icons.provider}</div>
          <div class="mc-provider-card__details">
            <div class="mc-provider-card__name">${key}</div>
            <div class="mc-provider-card__meta">
              <span class="mc-provider-card__protocol">${protocolLabel}</span>
              <span class="mc-provider-card__count">${provider.models.length} ${t('providers.modelCount')}</span>
            </div>
          </div>
        </div>
        <div class="mc-provider-card__actions">
          <button
            class="mc-icon-btn mc-icon-btn--danger"
            title=${t('action.delete')}
            @click=${(e: Event) => {
              e.stopPropagation();
              props.onProviderRemove(key);
            }}
          >
            ${icons.trash}
          </button>
          <span class="mc-provider-card__chevron ${expanded ? "mc-provider-card__chevron--open" : ""}">
            ${icons.chevron}
          </span>
        </div>
      </div>

      ${expanded
        ? html`
            <div class="mc-provider-card__content">
              <div class="mc-form-section">
                <div class="mc-form-row">
                  <label class="mc-field">
                    <span class="mc-field__label">${t('providers.name')}</span>
                    <input
                      type="text"
                      class="mc-input"
                      .value=${key}
                      @blur=${(e: Event) => {
                        const newKey = (e.target as HTMLInputElement).value.trim();
                        if (newKey && newKey !== key) {
                          props.onProviderRename(key, newKey);
                        }
                      }}
                      @keydown=${(e: KeyboardEvent) => {
                        if (e.key === "Enter") {
                          (e.target as HTMLInputElement).blur();
                        }
                      }}
                    />
                  </label>
                </div>
                <div class="mc-form-row">
                  <label class="mc-field">
                    <span class="mc-field__label">${t('providers.baseUrl')}</span>
                    <input
                      type="text"
                      class="mc-input"
                      .value=${provider.baseUrl}
                      placeholder="https://api.example.com/v1"
                      @input=${(e: Event) =>
                        props.onProviderUpdate(key, "baseUrl", (e.target as HTMLInputElement).value)}
                    />
                  </label>
                </div>
                <div class="mc-form-row mc-form-row--2col">
                  <label class="mc-field">
                    <span class="mc-field__label">${t('providers.apiProtocol')}</span>
                    <select
                      class="mc-select"
                      @change=${(e: Event) =>
                        props.onProviderUpdate(key, "api", (e.target as HTMLSelectElement).value)}
                    >
                      ${getApiProtocols().map(
                        (p) => html`<option value=${p.value} title=${p.hint} .selected=${provider.api === p.value}>${p.label}</option>`,
                      )}
                    </select>
                  </label>
                  <label class="mc-field">
                    <span class="mc-field__label">${t('providers.authMode')}</span>
                    <select
                      class="mc-select"
                      @change=${(e: Event) =>
                        props.onProviderUpdate(key, "auth", (e.target as HTMLSelectElement).value)}
                    >
                      ${getAuthModes().map(
                        (a) => html`<option value=${a.value} title=${a.hint} .selected=${(provider.auth ?? "api-key") === a.value}>${a.label}</option>`,
                      )}
                    </select>
                  </label>
                </div>
                ${showApiKey
                  ? html`
                      <div class="mc-form-row">
                        <label class="mc-field">
                          <span class="mc-field__label">${t('providers.apiKey')}</span>
                          <input
                            type="password"
                            class="mc-input"
                            .value=${provider.apiKey ?? ""}
                            placeholder=${t('providers.apiKeyPlaceholder')}
                            @input=${(e: Event) =>
                              props.onProviderUpdate(key, "apiKey", (e.target as HTMLInputElement).value)}
                          />
                        </label>
                      </div>
                    `
                  : nothing}
                ${renderHeadersEditor(key, provider.headers, props)}
              </div>

              <div class="mc-models-section">
                <div class="mc-models-header">
                  <span class="mc-models-title">${t('providers.modelsList')}</span>
                  <button
                    class="mc-btn mc-btn--sm"
                    @click=${() => props.onModelAdd(key)}
                  >
                    ${icons.add}
                    <span>${t('providers.addModel')}</span>
                  </button>
                </div>
                <div class="mc-models-list">
                  ${provider.models.map((model, idx) =>
                    renderModelRow(key, idx, model, props),
                  )}
                </div>
              </div>
            </div>
          `
        : nothing}
    </div>
  `;
}

/**
 * Render add provider modal
 */
function renderAddProviderModal(props: ProvidersContentProps) {
  if (!props.showAddModal) return nothing;

  const form = props.addForm ?? DEFAULT_PROVIDER_FORM;
  const onFormChange = props.onAddFormChange ?? (() => {});
  const onShowAddModal = props.onShowAddModal ?? (() => {});
  const onAddConfirm = props.onAddConfirm ?? (() => {});
  const showApiKey = form.auth === "api-key" || form.auth === "token";

  const handleClose = () => {
    onShowAddModal(false);
  };

  const handleSubmit = () => {
    onAddConfirm();
  };

  return html`
    <div class="cron-confirm-modal" @click=${handleClose}>
      <div class="cron-create-modal__content" @click=${(e: Event) => e.stopPropagation()}>
        <div class="cron-create-modal__header">
          <div class="cron-create-modal__title">
            ${icons.provider}
            <span>${t('providers.create')}</span>
          </div>
          <button class="cron-create-modal__close" @click=${handleClose}>
            ${icons.close}
          </button>
        </div>

        <div class="cron-create-modal__body">
          <!-- Provider name -->
          <div class="mc-field" style="margin-bottom: 16px;">
            <label class="mc-field__label">${t('providers.name')}</label>
            <input
              type="text"
              class="mc-input"
              placeholder=${t('providers.namePlaceholder')}
              .value=${form.name}
              @input=${(e: Event) =>
                onFormChange({ name: (e.target as HTMLInputElement).value })}
            />
          </div>

          <!-- Base URL -->
          <div class="mc-field" style="margin-bottom: 16px;">
            <label class="mc-field__label">${t('providers.baseUrl')}</label>
            <input
              type="text"
              class="mc-input"
              placeholder=${t('providers.baseUrlPlaceholder')}
              .value=${form.baseUrl}
              @input=${(e: Event) =>
                onFormChange({ baseUrl: (e.target as HTMLInputElement).value })}
            />
          </div>

          <!-- API protocol and auth mode -->
          <div class="cron-form-grid" style="margin-bottom: 16px;">
            <div class="mc-field">
              <label class="mc-field__label">${t('providers.apiProtocol')}</label>
              <select
                class="mc-select"
                @change=${(e: Event) =>
                  onFormChange({ api: (e.target as HTMLSelectElement).value as ModelApi })}
              >
                ${getApiProtocols().map(
                  (p) => html`<option value=${p.value} title=${p.hint} .selected=${form.api === p.value}>${p.label}</option>`,
                )}
              </select>
            </div>
            <div class="mc-field">
              <label class="mc-field__label">${t('providers.authMode')}</label>
              <select
                class="mc-select"
                @change=${(e: Event) =>
                  onFormChange({ auth: (e.target as HTMLSelectElement).value as AuthMode })}
              >
                ${getAuthModes().map(
                  (a) => html`<option value=${a.value} title=${a.hint} .selected=${form.auth === a.value}>${a.label}</option>`,
                )}
              </select>
            </div>
          </div>

          <!-- API Key -->
          ${showApiKey
            ? html`
                <div class="mc-field" style="margin-bottom: 16px;">
                  <label class="mc-field__label">${t('providers.apiKey')}</label>
                  <input
                    type="password"
                    class="mc-input"
                    placeholder=${t('providers.apiKeyPlaceholder')}
                    .value=${form.apiKey}
                    @input=${(e: Event) =>
                      onFormChange({ apiKey: (e.target as HTMLInputElement).value })}
                  />
                </div>
              `
            : nothing}

          <!-- Error message -->
          ${props.addError
            ? html`
                <div class="cron-error-banner">
                  ${icons.info}
                  <span>${props.addError}</span>
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
            ?disabled=${!form.name.trim()}
            @click=${handleSubmit}
          >
            ${t('providers.confirmCreate')}
          </button>
        </div>
      </div>
    </div>
  `;
}

/**
 * Render provider config content
 */
export function renderProvidersContent(props: ProvidersContentProps) {
  const providerKeys = Object.keys(props.providers);
  const onShowAddModal = props.onShowAddModal ?? (() => {});

  // For backward compatibility: if onShowAddModal is not provided, call onProviderAdd directly
  const handleAddClick = () => {
    if (props.onShowAddModal) {
      onShowAddModal(true);
    } else {
      props.onProviderAdd();
    }
  };

  return html`
    <div class="config-content">
      <div class="config-content__header">
        <div class="config-content__icon">${icons.provider}</div>
        <div class="config-content__titles">
          <h2 class="config-content__title">${t('providers.title')}</h2>
          <p class="config-content__desc">${t('providers.desc')}</p>
        </div>
        <button class="mc-btn mc-btn--primary" @click=${handleAddClick}>
          ${icons.add}
          <span>${t('providers.add')}</span>
        </button>
      </div>

      <!-- Field description tip card -->
      <details class="cron-tip-card cron-tip-card--collapsible">
        <summary class="cron-tip-card__title">
          ${icons.info}
          <span>${t('providers.configGuide')}</span>
          ${icons.chevron}
        </summary>
        <div class="cron-tip-card__content">
          <div class="cron-tip-card__section">
            <div class="cron-tip-card__section-title">${t('providers.providerConfig')}</div>
            <table class="cron-tip-card__table">
              <tr>
                <td class="cron-tip-card__term">${t('providers.baseUrl')}</td>
                <td class="cron-tip-card__def">${t('providers.baseUrlDesc')}</td>
              </tr>
              <tr>
                <td class="cron-tip-card__term">${t('providers.apiProtocol')}</td>
                <td class="cron-tip-card__def">${t('providers.apiProtocolDesc')}</td>
              </tr>
              <tr>
                <td class="cron-tip-card__term">${t('providers.authMode')}</td>
                <td class="cron-tip-card__def">${t('providers.authModeDesc')}</td>
              </tr>
              <tr>
                <td class="cron-tip-card__term">${t('providers.apiKey')}</td>
                <td class="cron-tip-card__def">${t('providers.apiKeyDesc')}</td>
              </tr>
              <tr>
                <td class="cron-tip-card__term">${t('providers.headers')}</td>
                <td class="cron-tip-card__def">${t('providers.headersDesc')}</td>
              </tr>
            </table>
          </div>
          <div class="cron-tip-card__section">
            <div class="cron-tip-card__section-title">${t('providers.modelConfig')}</div>
            <table class="cron-tip-card__table">
              <tr>
                <td class="cron-tip-card__term">${t('providers.modelId')}</td>
                <td class="cron-tip-card__def">${t('providers.modelIdDesc')}</td>
              </tr>
              <tr>
                <td class="cron-tip-card__term">${t('providers.modelName')}</td>
                <td class="cron-tip-card__def">${t('providers.modelNameDesc')}</td>
              </tr>
              <tr>
                <td class="cron-tip-card__term">${t('providers.contextWindow')}</td>
                <td class="cron-tip-card__def">${t('providers.contextWindowDesc')}</td>
              </tr>
              <tr>
                <td class="cron-tip-card__term">${t('providers.maxTokens')}</td>
                <td class="cron-tip-card__def">${t('providers.maxTokensDesc')}</td>
              </tr>
              <tr>
                <td class="cron-tip-card__term">${t('providers.modelInput')}</td>
                <td class="cron-tip-card__def">${t('providers.modelInputDesc')}</td>
              </tr>
              <tr>
                <td class="cron-tip-card__term">${t('providers.modelReasoning')}</td>
                <td class="cron-tip-card__def">${t('providers.modelReasoningDesc')}</td>
              </tr>
              <tr>
                <td class="cron-tip-card__term">${t('providers.modelCost')}</td>
                <td class="cron-tip-card__def">${t('providers.modelCostDesc')}</td>
              </tr>
              <tr>
                <td class="cron-tip-card__term">${t('providers.modelCompat')}</td>
                <td class="cron-tip-card__def">${t('providers.modelCompatDesc')}</td>
              </tr>
            </table>
          </div>
        </div>
      </details>

      <div class="config-content__body">
        ${providerKeys.length === 0
          ? html`<div class="mc-empty">${t('providers.noProviders')}</div>`
          : html`
              <div class="mc-providers-grid">
                ${providerKeys.map((key) =>
                  renderProviderCard(
                    key,
                    props.providers[key],
                    props.expandedProviders.has(key),
                    props,
                  ),
                )}
              </div>
            `}
      </div>

      <!-- Add provider modal -->
      ${renderAddProviderModal(props)}
    </div>
  `;
}
