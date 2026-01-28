import type { ConfigUiHints } from "../types";
import { t } from "../i18n";

export function configUiHintOverrides(): ConfigUiHints {
  return {
    diagnostics: {
      label: t("config.meta.diagnostics.label"),
      help: t("config.meta.diagnostics.desc"),
    },
    "diagnostics.cacheTrace": { label: t("config.hints.diagnostics.cacheTrace.label") },
    "diagnostics.enabled": {
      label: t("config.hints.diagnostics.enabled.label"),
      help: t("config.hints.diagnostics.enabled.help"),
    },
    "diagnostics.flags": {
      label: t("config.hints.diagnostics.flags.label"),
      help: t("config.hints.diagnostics.flags.help"),
    },
    "diagnostics.otel": { label: t("config.hints.diagnostics.otel.label") },

    "diagnostics.cacheTrace.enabled": {
      label: t("config.hints.diagnostics.cacheTrace.enabled.label"),
      help: t("config.hints.diagnostics.cacheTrace.enabled.help"),
    },
    "diagnostics.cacheTrace.filePath": {
      label: t("config.hints.diagnostics.cacheTrace.filePath.label"),
      help: t("config.hints.diagnostics.cacheTrace.filePath.help"),
    },
    "diagnostics.cacheTrace.includeMessages": {
      label: t("config.hints.diagnostics.cacheTrace.includeMessages.label"),
      help: t("config.hints.diagnostics.cacheTrace.includeMessages.help"),
    },
    "diagnostics.cacheTrace.includePrompt": {
      label: t("config.hints.diagnostics.cacheTrace.includePrompt.label"),
      help: t("config.hints.diagnostics.cacheTrace.includePrompt.help"),
    },
    "diagnostics.cacheTrace.includeSystem": {
      label: t("config.hints.diagnostics.cacheTrace.includeSystem.label"),
      help: t("config.hints.diagnostics.cacheTrace.includeSystem.help"),
    },

    "diagnostics.otel.enabled": { label: t("config.hints.diagnostics.otel.enabled") },
    "diagnostics.otel.endpoint": { label: t("config.hints.diagnostics.otel.endpoint") },
    "diagnostics.otel.protocol": { label: t("config.hints.diagnostics.otel.protocol") },
    "diagnostics.otel.headers": { label: t("config.hints.diagnostics.otel.headers") },
    "diagnostics.otel.serviceName": { label: t("config.hints.diagnostics.otel.serviceName") },
    "diagnostics.otel.traces": { label: t("config.hints.diagnostics.otel.traces") },
    "diagnostics.otel.metrics": { label: t("config.hints.diagnostics.otel.metrics") },
    "diagnostics.otel.logs": { label: t("config.hints.diagnostics.otel.logs") },
    "diagnostics.otel.sampleRate": { label: t("config.hints.diagnostics.otel.sampleRate") },
    "diagnostics.otel.flushIntervalMs": { label: t("config.hints.diagnostics.otel.flushIntervalMs") },

    approvals: { label: t("config.meta.approvals.label"), help: t("config.meta.approvals.desc") },
    "approvals.exec": { label: t("config.hints.approvals.exec.label") },
    "approvals.exec.agentFilter": { label: t("config.hints.approvals.exec.agentFilter") },
    "approvals.exec.enabled": { label: t("config.hints.approvals.exec.enabled") },
    "approvals.exec.mode": {
      label: t("config.hints.approvals.exec.mode"),
      itemTemplate: {
        optionLabels: {
          session: t("config.options.approvals.exec.mode.session"),
          targets: t("config.options.approvals.exec.mode.targets"),
          both: t("config.options.approvals.exec.mode.both"),
        },
      },
    },
    "approvals.exec.sessionFilter": { label: t("config.hints.approvals.exec.sessionFilter") },
    "approvals.exec.targets": { label: t("config.hints.approvals.exec.targets") },
    "approvals.exec.targets.channel": { label: t("config.hints.approvals.exec.targets.channel") },
    "approvals.exec.targets.to": { label: t("config.hints.approvals.exec.targets.to") },
    "approvals.exec.targets.accountId": { label: t("config.hints.approvals.exec.targets.accountId") },
    "approvals.exec.targets.threadId": { label: t("config.hints.approvals.exec.targets.threadId") },

    media: { label: t("config.meta.media.label"), help: t("config.meta.media.desc") },
    "media.preserveFilenames": {
      label: t("config.hints.media.preserveFilenames.label"),
      help: t("config.hints.media.preserveFilenames.help"),
    },

    // Gateway section and subsections
    gateway: { label: "网关", help: "网关服务器设置（端口、认证、绑定）" },
    "gateway.auth": { label: "认证" },
    "gateway.bind": { label: "绑定" },
    "gateway.controlUi": { label: "控制界面" },
    "gateway.http": { label: "HTTP" },
    "gateway.mode": { label: "模式" },
    "gateway.nodes": { label: "节点" },
    "gateway.port": { label: "端口" },
    "gateway.reload": { label: "重新加载" },
    "gateway.remote": { label: "远程" },
    "gateway.tailscale": { label: "Tailscale" },
    "gateway.tls": { label: "TLS" },
    "gateway.trustedProxies": { label: "信任代理" },

    // Other top-level sections
    env: { label: "环境", help: "环境变量与全局配置" },
    update: { label: "更新", help: "系统更新与版本管理" },
    agents: { label: "智能体", help: "AI 智能体配置与默认设置" },
    channels: { label: "渠道", help: "消息平台连接配置（Telegram, Discord 等）" },
    messages: { label: "消息", help: "消息处理与响应设置" },
    commands: { label: "命令", help: "系统与聊天命令权限管理" },
    hooks: { label: "钩子", help: "系统事件钩子配置" },
    skills: { label: "技能", help: "智能体可用技能管理" },
    tools: { label: "工具", help: "外部工具集成配置" },
    wizard: { label: "安装向导", help: "初次运行安装向导设置" },
    logging: { label: "日志", help: "系统日志与审计记录配置" },
    browser: { label: "浏览器", help: "自动化浏览器与快照设置" },
    ui: { label: "界面", help: "控制台界面外观与主题设置" },
    models: { label: "模型", help: "AI 模型供应商与端点配置" },
    bindings: { label: "按键绑定", help: "界面快捷键映射" },
    broadcast: { label: "广播", help: "系统广播与通知设置" },
    audio: { label: "音频", help: "语音输出与音频处理设置" },
    session: { label: "会话", help: "用户会话与上下文管理" },
    cron: { label: "定时任务", help: "计划任务与定时执行配置" },
    web: { label: "Web 服务", help: "Web 访问与公开端点设置" },
    discovery: { label: "服务发现", help: "网络发现与 mDNS 设置" },
    canvasHost: { label: "Canvas 宿主", help: "Canvas 渲染与展示设置" },
    talk: { label: "对话", help: "语音识别与交互设置" },
    plugins: { label: "插件", help: "系统插件管理与扩展" },
    nodeHost: { label: "节点宿主", help: "节点连接与代理管理" },

    // Gateway Auth fields
    "gateway.auth.allowTailscale": { label: "允许 Tailscale" },
    "gateway.auth.mode": {
      label: "模式",
      itemTemplate: {
        optionLabels: {
          token: "Token",
          password: "密码",
        },
      },
    },
    "gateway.auth.password": {
      label: "网关密码",
      help: "使用 Tailscale Funnel 时必填。",
    },
    "gateway.auth.token": {
      label: "网关 Token",
      help: "访问网关默认必填（除非使用 Tailscale Serve 身份）；非回环绑定必填。",
    },
  };
}
