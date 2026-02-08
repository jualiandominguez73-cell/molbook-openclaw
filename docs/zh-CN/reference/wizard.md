---
summary: "CLI 新手引导向导的完整参考：每个步骤、标志和配置字段"
read_when:
  - 查找特定的向导步骤或标志
  - 使用非交互模式自动化新手引导
  - 调试向导行为
title: "新手引导向导参考"
sidebarTitle: "向导参考"
x-i18n:
  source_path: reference/wizard.md
  translated_by: "0xRaini"
  translated_at: "2026-02-09"
---

# 新手引导向导参考

这是 `openclaw onboard` CLI 向导的完整参考。
高级概述请参阅 [新手引导向导](/start/wizard)。

## 流程详情（本地模式）

<Steps>
  <Step title="现有配置检测">
    - 如果 `~/.openclaw/openclaw.json` 存在，选择 **保留 / 修改 / 重置**。
    - 重新运行向导**不会**清除任何内容，除非你明确选择 **重置**（或传入 `--reset`）。
    - 如果配置无效或包含旧版字段，向导会停止并要求你先运行 `openclaw doctor`。
    - 重置使用 `trash`（而非 `rm`）并提供范围选项：
      - 仅配置
      - 配置 + 凭证 + 会话
      - 完全重置（同时删除工作区）
  </Step>
  <Step title="模型/认证">
    - **Anthropic API 密钥（推荐）**：如果存在 `ANTHROPIC_API_KEY` 则使用它，否则提示输入密钥，然后保存供守护进程使用。
    - **Anthropic OAuth（Claude Code CLI）**：在 macOS 上，向导检查钥匙串项 "Claude Code-credentials"（选择"始终允许"以避免 launchd 启动时阻塞）；在 Linux/Windows 上，如果存在则复用 `~/.claude/.credentials.json`。
    - **Anthropic token（粘贴 setup-token）**：在任何机器上运行 `claude setup-token`，然后粘贴 token（可以命名；留空 = 默认）。
    - **OpenAI Code (Codex) 订阅（Codex CLI）**：如果存在 `~/.codex/auth.json`，向导可以复用它。
    - **OpenAI Code (Codex) 订阅（OAuth）**：浏览器流程；粘贴 `code#state`。
      - 当模型未设置或为 `openai/*` 时，将 `agents.defaults.model` 设为 `openai-codex/gpt-5.2`。
    - **OpenAI API 密钥**：如果存在 `OPENAI_API_KEY` 则使用它，否则提示输入密钥，然后保存到 `~/.openclaw/.env` 供 launchd 读取。
    - **xAI (Grok) API 密钥**：提示输入 `XAI_API_KEY` 并配置 xAI 作为模型提供商。
    - **OpenCode Zen（多模型代理）**：提示输入 `OPENCODE_API_KEY`（或 `OPENCODE_ZEN_API_KEY`，在 https://opencode.ai/auth 获取）。
    - **API 密钥**：为你存储密钥。
    - **Vercel AI Gateway（多模型代理）**：提示输入 `AI_GATEWAY_API_KEY`。
    - 详情：[Vercel AI Gateway](/providers/vercel-ai-gateway)
    - **Cloudflare AI Gateway**：提示输入账户 ID、网关 ID 和 `CLOUDFLARE_AI_GATEWAY_API_KEY`。
    - 详情：[Cloudflare AI Gateway](/providers/cloudflare-ai-gateway)
    - **MiniMax M2.1**：配置自动写入。
    - 详情：[MiniMax](/providers/minimax)
    - **Synthetic（Anthropic 兼容）**：提示输入 `SYNTHETIC_API_KEY`。
    - 详情：[Synthetic](/providers/synthetic)
    - **Moonshot (Kimi K2)**：配置自动写入。
    - **Kimi Coding**：配置自动写入。
    - 详情：[Moonshot AI (Kimi + Kimi Coding)](/providers/moonshot)
    - **跳过**：暂不配置认证。
    - 从检测到的选项中选择默认模型（或手动输入提供商/模型）。
    - 向导运行模型检查，如果配置的模型未知或缺少认证会发出警告。
    - OAuth 凭证存储在 `~/.openclaw/credentials/oauth.json`；认证配置文件存储在 `~/.openclaw/agents/<agentId>/agent/auth-profiles.json`（API 密钥 + OAuth）。
    - 详情：[/concepts/oauth](/concepts/oauth)
    <Note>
    无头/服务器提示：在有浏览器的机器上完成 OAuth，然后将
    `~/.openclaw/credentials/oauth.json`（或 `$OPENCLAW_STATE_DIR/credentials/oauth.json`）复制到
    Gateway 主机。
    </Note>
  </Step>
  <Step title="工作区">
    - 默认 `~/.openclaw/workspace`（可配置）。
    - 生成智能体启动引导仪式所需的工作区文件。
    - 完整工作区布局 + 备份指南：[智能体工作区](/concepts/agent-workspace)
  </Step>
  <Step title="Gateway">
    - 端口、绑定、认证模式、Tailscale 暴露方式。
    - 认证建议：即使在 loopback 上也保持 **Token** 认证，这样本地 WS 客户端必须认证。
    - 只有在你完全信任所有本地进程时才禁用认证。
    - 非 loopback 绑定仍然需要认证。
  </Step>
  <Step title="渠道">
    - [WhatsApp](/channels/whatsapp)：可选 QR 登录。
    - [Telegram](/channels/telegram)：Bot 令牌。
    - [Discord](/channels/discord)：Bot 令牌。
    - [Google Chat](/channels/googlechat)：服务账号 JSON + webhook 受众。
    - [Mattermost](/channels/mattermost)（插件）：Bot 令牌 + 基础 URL。
    - [Signal](/channels/signal)：可选 `signal-cli` 安装 + 账号配置。
    - [BlueBubbles](/channels/bluebubbles)：**iMessage 推荐方案**；服务器 URL + 密码 + webhook。
    - [iMessage](/channels/imessage)：旧版 `imsg` CLI 路径 + 数据库访问。
    - DM 安全：默认为配对模式。首次 DM 发送验证码；通过 `openclaw pairing approve <channel> <code>` 批准，或使用允许列表。
  </Step>
  <Step title="守护进程安装">
    - macOS：LaunchAgent
      - 需要已登录的用户会话；对于无头模式，使用自定义 LaunchDaemon（未随附）。
    - Linux（和 Windows 通过 WSL2）：systemd 用户单元
      - 向导尝试通过 `loginctl enable-linger <user>` 启用驻留，使 Gateway 在登出后保持运行。
      - 可能提示 sudo（写入 `/var/lib/systemd/linger`）；会先尝试无 sudo 执行。
    - **运行时选择**：Node（推荐；WhatsApp/Telegram 必需）。**不推荐** Bun。
  </Step>
  <Step title="健康检查">
    - 启动 Gateway（如需要）并运行 `openclaw health`。
    - 提示：`openclaw status --deep` 在状态输出中添加 Gateway 健康探测（需要可访问的 Gateway）。
  </Step>
  <Step title="Skills（推荐）">
    - 读取可用 skills 并检查依赖。
    - 让你选择包管理器：**npm / pnpm**（不推荐 bun）。
    - 安装可选依赖（部分在 macOS 上使用 Homebrew）。
  </Step>
  <Step title="完成">
    - 摘要 + 后续步骤，包括 iOS/Android/macOS 应用的额外功能。
  </Step>
</Steps>

<Note>
如果未检测到 GUI，向导会打印 SSH 端口转发说明来访问 Control UI，而不是打开浏览器。
如果 Control UI 资源缺失，向导会尝试构建；备选方案是 `pnpm ui:build`（自动安装 UI 依赖）。
</Note>

## 非交互模式

使用 `--non-interactive` 来自动化或脚本化新手引导：

```bash
openclaw onboard --non-interactive \
  --mode local \
  --auth-choice apiKey \
  --anthropic-api-key "$ANTHROPIC_API_KEY" \
  --gateway-port 18789 \
  --gateway-bind loopback \
  --install-daemon \
  --daemon-runtime node \
  --skip-skills
```

添加 `--json` 可获取机器可读的摘要。

<Note>
`--json` **不会**自动启用非交互模式。在脚本中请使用 `--non-interactive`（以及 `--workspace`）。
</Note>

<AccordionGroup>
  <Accordion title="Gemini 示例">
    ```bash
    openclaw onboard --non-interactive \
      --mode local \
      --auth-choice gemini-api-key \
      --gemini-api-key "$GEMINI_API_KEY" \
      --gateway-port 18789 \
      --gateway-bind loopback
    ```
  </Accordion>
  <Accordion title="Z.AI 示例">
    ```bash
    openclaw onboard --non-interactive \
      --mode local \
      --auth-choice zai-api-key \
      --zai-api-key "$ZAI_API_KEY" \
      --gateway-port 18789 \
      --gateway-bind loopback
    ```
  </Accordion>
  <Accordion title="Vercel AI Gateway 示例">
    ```bash
    openclaw onboard --non-interactive \
      --mode local \
      --auth-choice ai-gateway-api-key \
      --ai-gateway-api-key "$AI_GATEWAY_API_KEY" \
      --gateway-port 18789 \
      --gateway-bind loopback
    ```
  </Accordion>
  <Accordion title="Cloudflare AI Gateway 示例">
    ```bash
    openclaw onboard --non-interactive \
      --mode local \
      --auth-choice cloudflare-ai-gateway-api-key \
      --cloudflare-ai-gateway-account-id "your-account-id" \
      --cloudflare-ai-gateway-gateway-id "your-gateway-id" \
      --cloudflare-ai-gateway-api-key "$CLOUDFLARE_AI_GATEWAY_API_KEY" \
      --gateway-port 18789 \
      --gateway-bind loopback
    ```
  </Accordion>
  <Accordion title="Moonshot 示例">
    ```bash
    openclaw onboard --non-interactive \
      --mode local \
      --auth-choice moonshot-api-key \
      --moonshot-api-key "$MOONSHOT_API_KEY" \
      --gateway-port 18789 \
      --gateway-bind loopback
    ```
  </Accordion>
  <Accordion title="Synthetic 示例">
    ```bash
    openclaw onboard --non-interactive \
      --mode local \
      --auth-choice synthetic-api-key \
      --synthetic-api-key "$SYNTHETIC_API_KEY" \
      --gateway-port 18789 \
      --gateway-bind loopback
    ```
  </Accordion>
  <Accordion title="OpenCode Zen 示例">
    ```bash
    openclaw onboard --non-interactive \
      --mode local \
      --auth-choice opencode-zen \
      --opencode-zen-api-key "$OPENCODE_API_KEY" \
      --gateway-port 18789 \
      --gateway-bind loopback
    ```
  </Accordion>
</AccordionGroup>

### 添加智能体（非交互式）

```bash
openclaw agents add work \
  --workspace ~/.openclaw/workspace-work \
  --model openai/gpt-5.2 \
  --bind whatsapp:biz \
  --non-interactive \
  --json
```

## Gateway 向导 RPC

Gateway 通过 RPC 暴露向导流程（`wizard.start`、`wizard.next`、`wizard.cancel`、`wizard.status`）。
客户端（macOS 应用、Control UI）可以渲染步骤而无需重新实现新手引导逻辑。

## Signal 设置（signal-cli）

向导可以从 GitHub releases 安装 `signal-cli`：

- 下载相应的发布资源。
- 存储在 `~/.openclaw/tools/signal-cli/<version>/`。
- 将 `channels.signal.cliPath` 写入配置。

注意事项：

- JVM 构建需要 **Java 21**。
- 在可用时使用原生构建。
- Windows 使用 WSL2；signal-cli 安装在 WSL 内部按 Linux 流程执行。

## 向导写入的内容

`~/.openclaw/openclaw.json` 中的典型字段：

- `agents.defaults.workspace`
- `agents.defaults.model` / `models.providers`（如果选择了 Minimax）
- `gateway.*`（mode、bind、auth、tailscale）
- `channels.telegram.botToken`、`channels.discord.token`、`channels.signal.*`、`channels.imessage.*`
- 渠道允许列表（Slack/Discord/Matrix/Microsoft Teams），当你在提示中选择启用时（名称会尽可能解析为 ID）
- `skills.install.nodeManager`
- `wizard.lastRunAt`
- `wizard.lastRunVersion`
- `wizard.lastRunCommit`
- `wizard.lastRunCommand`
- `wizard.lastRunMode`

`openclaw agents add` 会写入 `agents.list[]` 和可选的 `bindings`。

WhatsApp 凭证存储在 `~/.openclaw/credentials/whatsapp/<accountId>/`。
会话存储在 `~/.openclaw/agents/<agentId>/sessions/`。

部分渠道以插件形式提供。在新手引导期间选择时，向导会提示安装插件（npm 或本地路径），然后才能进行配置。

## 相关文档

- 向导概述：[新手引导向导](/start/wizard)
- macOS 应用新手引导：[新手引导](/start/onboarding)
- 配置参考：[Gateway 配置](/gateway/configuration)
- 提供商：[WhatsApp](/channels/whatsapp)、[Telegram](/channels/telegram)、[Discord](/channels/discord)、[Google Chat](/channels/googlechat)、[Signal](/channels/signal)、[BlueBubbles](/channels/bluebubbles)（iMessage）、[iMessage](/channels/imessage)（旧版）
- Skills：[Skills](/tools/skills)、[Skills 配置](/tools/skills-config)
