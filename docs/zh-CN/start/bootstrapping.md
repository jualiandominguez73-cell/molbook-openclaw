---
summary: "智能体启动仪式：初始化工作区和身份文件"
read_when:
  - 了解智能体首次运行时发生什么
  - 了解启动引导文件的位置
  - 调试新手引导身份设置
title: "智能体启动引导"
sidebarTitle: "启动引导"
x-i18n:
  source_path: start/bootstrapping.md
  translated_by: "0xRaini"
  translated_at: "2026-02-09"
---

# 智能体启动引导

启动引导（Bootstrapping）是**首次运行**时的仪式，用于准备智能体工作区并收集身份信息。它在新手引导（onboarding）完成后、智能体首次启动时执行。

## 启动引导的作用

智能体首次运行时，OpenClaw 会初始化工作区（默认路径 `~/.openclaw/workspace`）：

- 生成 `AGENTS.md`、`BOOTSTRAP.md`、`IDENTITY.md`、`USER.md` 文件
- 运行一个简短的问答仪式（逐个提问）
- 将身份和偏好写入 `IDENTITY.md`、`USER.md`、`SOUL.md`
- 完成后删除 `BOOTSTRAP.md`，确保只运行一次

## 运行位置

启动引导始终在 **Gateway 主机** 上运行。如果 macOS 应用连接到远程 Gateway，工作区和启动引导文件将位于该远程机器上。

<Note>
当 Gateway 运行在另一台机器上时，请在 Gateway 主机上编辑工作区文件（例如 `user@gateway-host:~/.openclaw/workspace`）。
</Note>

## 相关文档

- macOS 应用新手引导：[新手引导](/start/onboarding)
- 工作区布局：[智能体工作区](/concepts/agent-workspace)
