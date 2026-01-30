# 汉化覆盖率报告

**状态**: ✅ 全量完成
**日期**: 2026-01-30

## 1. 核心视图 (Core Views)
- [x] **Overview (概览)**: 
  - 所有统计卡片、状态指示器、时间显示（如“5分钟前”）。
  - 网关配置表单（URL, Token, Password）及 Placeholder。
  - 认证错误提示、不安全上下文提示。
- [x] **Channels (渠道)**:
  - 渠道列表、状态标签。
  - 动态配置表单（Telegram, WhatsApp, etc.）。
- [x] **Instances (实例)**:
  - 实例列表、连接时间、IP 地址。
  - 刷新和操作按钮。
- [x] **Sessions (会话)**:
  - 会话列表、思考/推理等级下拉菜单。
  - 详细模式 (Verbose) 选项。
  - 删除确认。
- [x] **Cron (定时任务)**:
  - 任务列表、调度规则描述（如“每 5 分钟”）。
  - 运行历史、状态芯片（已启用/已禁用）。
  - 新建任务表单的所有字段和 Placeholder。
- [x] **Skills (技能)**:
  - 技能列表、来源标签（内置/托管）。
  - 安装/卸载/配置按钮。
- [x] **Nodes (节点)**:
  - 节点列表、角色描述。
  - 执行审批策略（Exec Approvals）的所有选项（白名单、询问等）。
  - 设备审批按钮。
- [x] **Chat (聊天)**:
  - 角色名称（你/助手）。
  - 附件提示、操作栏、时间戳。
- [x] **Logs (日志)**:
  - 日志条目、搜索框 Placeholder。
- [x] **Debug (调试)**:
  - RPC 调用表单、安全审计摘要。
- [x] **Config (配置)**:
  - 侧边栏导航。
  - 所有配置项的 Label 和 Description（动态映射）。
  - 顶部操作栏（保存、重载、应用）。

## 2. 全局组件 (Global Components)
- [x] **App Shell**: 侧边栏、顶部导航、主题切换。
- [x] **Dialogs**: 网关 URL 确认弹窗 (Gateway URL Confirmation)。
- [x] **Time Format**: 全局统一使用中文时间格式（刚刚、x分钟前）。

## 3. 遗漏修复 (Fixes)
- [x] 修复了 placeholder 硬编码问题。
- [x] 修复了动态生成的 Schema 字段翻译。
- [x] 修复了 "ago" 时间格式化函数。
