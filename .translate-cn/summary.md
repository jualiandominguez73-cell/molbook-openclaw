# OpenCray 汉化工作总结

## 1. 汉化概览
本项目 `ui/src/ui` 目录下的用户可见界面文本已全面汉化为简体中文。汉化工作遵循了以下原则：
*   **全面覆盖**：包括界面标签、按钮、菜单、错误提示、状态描述、帮助文本等。
*   **术语一致性**：建立并遵循了统一的术语表（如 Sessions -> 会话, Channels -> 通道）。
*   **代码安全**：严格保留了代码逻辑、变量名和 API 关键字。
*   **格式保留**：保留了原有的 HTML 结构和字符串模板格式。

## 2. 已汉化文件清单
以下文件已完成汉化：

### 核心视图 (Views)
*   `ui/src/ui/views/app-render.ts` (主界面渲染)
*   `ui/src/ui/views/channels.ts` (通道列表)
*   `ui/src/ui/views/channels.*.ts` (各具体通道卡片: Discord, Telegram, Slack, WhatsApp, Signal, iMessage, Google Chat 等)
*   `ui/src/ui/views/channels.config.ts` (通道配置表单)
*   `ui/src/ui/views/chat.ts` (聊天界面)
*   `ui/src/ui/views/config.ts` (设置界面)
*   `ui/src/ui/views/config-form.*.ts` (配置表单组件)
*   `ui/src/ui/views/cron.ts` (定时任务)
*   `ui/src/ui/views/debug.ts` (调试界面)
*   `ui/src/ui/views/devices.ts` (设备管理 - 包含在 controllers 中)
*   `ui/src/ui/views/exec-approval.ts` (执行审批弹窗)
*   `ui/src/ui/views/gateway-url-confirmation.ts` (网关 URL 确认)
*   `ui/src/ui/views/instances.ts` (实例列表)
*   `ui/src/ui/views/logs.ts` (日志查看器)
*   `ui/src/ui/views/markdown-sidebar.ts` (Markdown 侧边栏)
*   `ui/src/ui/views/nodes.ts` (节点管理)
*   `ui/src/ui/views/overview.ts` (系统概览)
*   `ui/src/ui/views/sessions.ts` (会话管理)
*   `ui/src/ui/views/skills.ts` (技能管理)
*   `ui/src/ui/views/tool-display.ts` (工具显示逻辑)

### 控制器与工具 (Controllers & Utils)
*   `ui/src/ui/controllers/*.ts` (错误消息和状态文本)
*   `ui/src/ui/format.ts` (时间格式化: "刚刚", "几分钟前")
*   `ui/src/ui/presenter.ts` (通用展示逻辑)
*   `ui/src/ui/navigation.ts` (导航菜单)
*   `ui/src/ui/tool-display.json` (工具名称和描述)

## 3. 汉化对照表 (部分示例)

| 原文 (English) | 译文 (简体中文) | 备注 |
| :--- | :--- | :--- |
| **通用** | | |
| Status | 状态 | |
| Configured | 已配置 | |
| Running | 运行中 | |
| Last Start | 上次启动 | |
| Last Probe | 上次探测 | |
| n/a | 暂无 | 用于空值显示 |
| **聊天 (Chat)** | | |
| Message | 消息 | |
| Thinking... | 思考中... | |
| Send | 发送 | |
| **设置 (Config)** | | |
| Configuration | 设置 | |
| Valid | 有效 | |
| Invalid | 无效 | |
| **日志 (Logs)** | | |
| Logs | 日志 | |
| Trace/Debug/Info | 追踪/调试/信息 | |
| Warn/Error/Fatal | 警告/错误/致命 | |
| **会话 (Sessions)** | | |
| Sessions | 会话 | |
| Active | 活跃 | |
| Stored | 已存储 | |
| **通道 (Channels)** | | |
| Channel Health | 通道健康状态 | |
| Snapshot | 快照 | |
| **时间 (Time)** | | |
| just now | 刚刚 | |
| m ago | 分钟前 | |
| h ago | 小时前 | |

## 4. 手动测试指南
由于禁止进行内部自动测试，请按照以下步骤进行手动验证：

1.  **启动应用**：运行项目并打开 Web 界面。
2.  **检查导航栏**：确认顶部/侧边导航栏的标签（聊天、控制、智能体、设置）均显示为中文。
3.  **浏览各模块**：
    *   **概览 (Overview)**：检查系统状态、版本信息是否为中文。
    *   **通道 (Channels)**：点击“控制”->“通道”，检查各卡片（Discord, Telegram 等）的标题下方的描述、状态列表（已配置、运行中）是否为中文。
    *   **会话 (Sessions)**：检查表头和状态标签。
    *   **设置 (Config)**：进入设置，查看侧边栏标题和右侧表单的提示信息。
    *   **日志 (Logs)**：查看日志级别下拉菜单是否为中文（信息、错误等）。
4.  **交互测试**：
    *   尝试点击“刷新”或“探测”按钮，观察按钮状态变为“正在刷新…”或“探测中…”。
    *   在聊天界面发送消息，观察“思考中...”状态。
5.  **错误提示测试**（如可行）：
    *   如果可能，断开网关连接，观察出现的错误横幅或提示是否为中文（例如“连接已断开”）。

## 5. 翻译记录存储
所有汉化记录已存储在项目根目录的 `.translate-cn` 文件夹中，包含 JSON 格式的更新记录和本总结文件。
