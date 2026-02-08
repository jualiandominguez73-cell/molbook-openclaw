---
summary: "CLI 新手引导流程、认证/模型设置、输出和内部机制的完整参考"
read_when:
  - 需要 openclaw onboard 的详细行为说明
  - 调试新手引导结果或集成新手引导客户端
title: "CLI 新手引导参考"
sidebarTitle: "CLI 参考"
x-i18n:
  source_path: start/wizard-cli-reference.md
  translated_by: "0xRaini"
  translated_at: "2026-02-09"
---

# CLI 新手引导参考

本页是 `openclaw onboard` 的完整参考文档。
简短指南请参阅 [新手引导向导 (CLI)](/start/wizard)。

## 向导的功能

本地模式（默认）将引导你完成：

- 模型和认证设置（OpenAI Code 订阅 OAuth、Anthropic API 密钥或 setup token，以及 MiniMax、GLM、Moonshot 和 AI Gateway 选项）
- 工作区位置和启动引导文件
- Gateway 设置（端口、绑定、认证、Tailscale）
- 渠道和提供商（Telegram、WhatsApp、Discord、Google Chat、Mattermost 插件、Signal）
- 守护进程安装（LaunchAgent 或 systemd 用户单元）
- 健康检查
- Skills 设置

远程模式将配置本机连接到其他位置的 Gateway。
它不会在远程主机上安装或修改任何内容。

## 本地流程详情

<Steps>
  <Step title="现有配置检测">
    - 如果 `~/.openclaw/openclaw.json` 存在，可选择保留、修改或重置。
    - 重新运行向导不会清除任何内容，除非你明确选择重置（或传入 `--reset`）。
    - 如果配置无效或包含旧版字段，向导会停止并要求你先运行 `openclaw doctor`。
    - 重置使用 `trash` 并提供范围选项：
      - 仅配置
      - 配置 + 凭证 + 会话
      - 完全重置（同时删除工作区）
  </Step>
  <Step title="模型和认证">
    - 完整选项矩阵请参阅 [认证和模型选项](#认证和模型选项)。
  </Step>
  <Step title="工作区">
    - 默认 `~/.openclaw/workspace`（可配置）。
    - 生成首次运行启动引导仪式所需的工作区文件。
    - 工作区布局：[智能体工作区](/concepts/agent-workspace)。
  </Step>
  <Step title="Gateway">
    - 提示端口、绑定、认证模式和 Tailscale 暴露方式。
    - 建议：即使在 loopback 上也保持令牌认证，这样本地 WS 客户端也必须认证。
    - 只有在你完全信任所有本地进程时才禁用认证。
    - 非 loopback 绑定仍然需要认证。
  </Step>
  <Step title="渠道">
    - [WhatsApp](/channels/whatsapp)：可选 QR 登录
    - [Telegram](/channels/telegram)：Bot 令牌
    - [Discord](/channels/discord)：Bot 令牌
    - [Google Chat](/channels/googlechat)：服务账号 JSON + webhook 受众
    - [Mattermost](/channels/mattermost) 插件：Bot 令牌 + 基础 URL
    - [Signal](/channels/signal)：可选 `signal-cli` 安装 + 账号配置
    - [BlueBubbles](/channels/bluebubbles)：iMessage 推荐方案；服务器 URL + 密码 + webhook
    - [iMessage](/channels/imessage)：旧版 `imsg` CLI 路径 + 数据库访问
    - DM 安全：默认为配对模式。首次 DM 会发送验证码；通过
      `openclaw pairing approve <channel> <code>` 批准，或使用允许列表。
  </Step>
  <Step title="守护进程安装">
    - macOS：LaunchAgent
      - 需要已登录的用户会话；对于无头模式，使用自定义 LaunchDaemon（未随附）。
    - Linux 和 Windows（通过 WSL2）：systemd 用户单元
      - 向导会尝试 `loginctl enable-linger <user>`，使 Gateway 在登出后保持运行。
      - 可能提示 sudo（写入 `/var/lib/systemd/linger`）；会先尝试无 sudo 执行。
    - 运行时选择：Node（推荐；WhatsApp 和 Telegram 必需）。不推荐 Bun。
  </Step>
  <Step title="健康检查">
    - 启动 Gateway（如需要）并运行 `openclaw health`。
    - `openclaw status --deep` 在状态输出中添加 Gateway 健康探测。
  </Step>
  <Step title="Skills">
    - 读取可用 skills 并检查依赖。
    - 让你选择包管理器：npm 或 pnpm（不推荐 bun）。
    - 安装可选依赖（部分在 macOS 上使用 Homebrew）。
  </Step>
  <Step title="完成">
    - 摘要和后续步骤，包括 iOS、Android 和 macOS 应用选项。
  </Step>
</Steps>

<Note>
如果未检测到 GUI，向导会打印 SSH 端口转发说明来访问 Control UI，而不是打开浏览器。
如果 Control UI 资源缺失，向导会尝试构建；备选方案是 `pnpm ui:build`（自动安装 UI 依赖）。
</Note>

## 远程模式详情

远程模式将配置本机连接到其他位置的 Gateway。

<Info>
远程模式不会在远程主机上安装或修改任何内容。
</Info>

你需要设置：

- 远程 Gateway URL（`ws://...`）
- 如果远程 Gateway 需要认证则提供令牌（推荐）

<Note>
- 如果 Gateway 仅绑定 loopback，使用 SSH 隧道或 tailnet。
- 发现提示：
  - macOS：Bonjour（`dns-sd`）
  - Linux：Avahi（`avahi-browse`）
</Note>

## 认证和模型选项

<AccordionGroup>
  <Accordion title="Anthropic API 密钥（推荐）">
    如果存在 `ANTHROPIC_API_KEY` 则使用它，否则提示输入密钥，然后保存供守护进程使用。
  </Accordion>
  <Accordion title="Anthropic OAuth（Claude Code CLI）">
    - macOS：检查钥匙串项 "Claude Code-credentials"
    - Linux 和 Windows：如果存在则复用 `~/.claude/.credentials.json`

    在 macOS 上，选择"始终允许"以避免 launchd 启动时阻塞。

  </Accordion>
  <Accordion title="Anthropic token（setup-token 粘贴）">
    在任何机器上运行 `claude setup-token`，然后粘贴 token。
    可以命名；留空使用默认名称。
  </Accordion>
  <Accordion title="OpenAI Code 订阅（复用 Codex CLI）">
    如果存在 `~/.codex/auth.json`，向导可以复用它。
  </Accordion>
  <Accordion title="OpenAI Code 订阅（OAuth）">
    浏览器流程；粘贴 `code#state`。

    当模型未设置或为 `openai/*` 时，将 `agents.defaults.model` 设为 `openai-codex/gpt-5.3-codex`。

  </Accordion>
  <Accordion title="OpenAI API 密钥">
    如果存在 `OPENAI_API_KEY` 则使用它，否则提示输入密钥，然后保存到
    `~/.openclaw/.env` 供 launchd 读取。

    当模型未设置、为 `openai/*` 或 `openai-codex/*` 时，将 `agents.defaults.model` 设为 `openai/gpt-5.1-codex`。

  </Accordion>
  <Accordion title="xAI (Grok) API 密钥">
    提示输入 `XAI_API_KEY` 并配置 xAI 作为模型提供商。
  </Accordion>
  <Accordion title="OpenCode Zen">
    提示输入 `OPENCODE_API_KEY`（或 `OPENCODE_ZEN_API_KEY`）。
    设置 URL：[opencode.ai/auth](https://opencode.ai/auth)。
  </Accordion>
  <Accordion title="API 密钥（通用）">
    为你存储密钥。
  </Accordion>
  <Accordion title="Vercel AI Gateway">
    提示输入 `AI_GATEWAY_API_KEY`。
    详情：[Vercel AI Gateway](/providers/vercel-ai-gateway)。
  </Accordion>
  <Accordion title="Cloudflare AI Gateway">
    提示输入账户 ID、网关 ID 和 `CLOUDFLARE_AI_GATEWAY_API_KEY`。
    详情：[Cloudflare AI Gateway](/providers/cloudflare-ai-gateway)。
  </Accordion>
  <Accordion title="MiniMax M2.1">
    配置自动写入。
    详情：[MiniMax](/providers/minimax)。
  </Accordion>
  <Accordion title="Synthetic（Anthropic 兼容）">
    提示输入 `SYNTHETIC_API_KEY`。
    详情：[Synthetic](/providers/synthetic)。
  </Accordion>
  <Accordion title="Moonshot 和 Kimi Coding">
    Moonshot（Kimi K2）和 Kimi Coding 配置自动写入。
    详情：[Moonshot AI (Kimi + Kimi Coding)](/providers/moonshot)。
  </Accordion>
  <Accordion title="跳过">
    不配置认证。
  </Accordion>
</AccordionGroup>

模型行为：

- 从检测到的选项中选择默认模型，或手动输入提供商和模型。
- 向导会运行模型检查，如果配置的模型未知或缺少认证会发出警告。

凭证和配置文件路径：

- OAuth 凭证：`~/.openclaw/credentials/oauth.json`
- 认证配置文件（API 密钥 + OAuth）：`~/.openclaw/agents/<agentId>/agent/auth-profiles.json`

<Note>
无头和服务器提示：在有浏览器的机器上完成 OAuth，然后将
`~/.openclaw/credentials/oauth.json`（或 `$OPENCLAW_STATE_DIR/credentials/oauth.json`）
复制到 Gateway 主机。
</Note>

## 输出和内部机制

`~/.openclaw/openclaw.json` 中的典型字段：

- `agents.defaults.workspace`
- `agents.defaults.model` / `models.providers`（如果选择了 Minimax）
- `gateway.*`（mode、bind、auth、tailscale）
- `channels.telegram.botToken`、`channels.discord.token`、`channels.signal.*`、`channels.imessage.*`
- 渠道允许列表（Slack、Discord、Matrix、Microsoft Teams），当你在提示中选择启用时（名称会尽可能解析为 ID）
- `skills.install.nodeManager`
- `wizard.lastRunAt`
- `wizard.lastRunVersion`
- `wizard.lastRunCommit`
- `wizard.lastRunCommand`
- `wizard.lastRunMode`

`openclaw agents add` 会写入 `agents.list[]` 和可选的 `bindings`。

WhatsApp 凭证存储在 `~/.openclaw/credentials/whatsapp/<accountId>/`。
会话存储在 `~/.openclaw/agents/<agentId>/sessions/`。

<Note>
部分渠道以插件形式提供。在新手引导期间选择时，向导会提示安装插件（npm 或本地路径），然后再进行渠道配置。
</Note>

Gateway 向导 RPC：

- `wizard.start`
- `wizard.next`
- `wizard.cancel`
- `wizard.status`

客户端（macOS 应用和 Control UI）可以渲染步骤而无需重新实现新手引导逻辑。

Signal 设置行为：

- 下载相应的发布资源
- 存储在 `~/.openclaw/tools/signal-cli/<version>/`
- 在配置中写入 `channels.signal.cliPath`
- JVM 构建需要 Java 21
- 在可用时使用原生构建
- Windows 使用 WSL2 并在 WSL 内部执行 Linux signal-cli 流程

## 相关文档

- 新手引导中心：[新手引导向导 (CLI)](/start/wizard)
- 自动化和脚本：[CLI 自动化](/start/wizard-cli-automation)
- 命令参考：[`openclaw onboard`](/cli/onboard)
