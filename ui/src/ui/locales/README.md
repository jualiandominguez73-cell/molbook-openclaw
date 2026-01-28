# Clawdbot UI Localization (i18n) Guide

This project uses a custom lightweight i18n system for the UI.

## Structure

- `i18n.ts`: The i18n engine and `t()` function.
- `locales/en.ts`: English translations (source of truth).
- `locales/zh-CN.ts`: Chinese (Simplified) translations.

## Adding New Strings

1.  **Add the key to `en.ts`**: Always add new strings to `en.ts` first. Use a hierarchical key structure (e.g., `feature.component.label`).
2.  **Add the key to `zh-CN.ts`**: Provide the Chinese translation for the same key.
3.  **Use `t()` in your code**:
    ```typescript
    import { t } from "./i18n";
    // ...
    html`<span>${t("my.key")}</span>`
    ```

## Best Practices

- **Avoid hardcoded strings**: All user-facing text should be in the i18n files.
- **Interpolation**: Use `${variable}` syntax in i18n strings for dynamic content.
    - Locale: `"Hello, ${name}!"`
    - Code: `t("greeting", { name: "User" })`
- **Config Form Auto-Translation**: The configuration form automatically attempts to translate field labels and help text using the following keys:
    - Label: `config.label.<propertyName>`
    - Help/Description: `config.help.<propertyName>`
    - If these keys are not found, it falls back to the schema title or a "humanized" version of the property name.
- **Context**: If a string's meaning is ambiguous, add a comment in the i18n file for translators.
- **Consistency**: Use consistent terms for core concepts (Agent -> 智能体, Session -> 会话, etc.).
- **Formatting**: Use `formatMs`, `formatAgo`, etc., from `format.ts` which are already integrated with the i18n system.

## Common Terms (Chinese)

- **Agent**: 智能体
- **Session**: 会话
- **Channel**: 渠道
- **Cron Job**: 定时任务
- **Node**: 节点
- **Skill**: 技能
- **Gateway**: 网关
- **Dashboard**: 仪表板
