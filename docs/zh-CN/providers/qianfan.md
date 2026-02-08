---
summary: "使用千帆的统一 API 在 OpenClaw 中访问多种模型"
read_when:
  - 想要使用单个 API 密钥访问多个 LLM
  - 需要百度千帆设置指南
title: "千帆 (Qianfan)"
x-i18n:
  source_path: providers/qianfan.md
  translated_by: "0xRaini"
  translated_at: "2026-02-09"
---

# 千帆提供商指南

千帆是百度的 MaaS 平台，提供**统一 API**，通过单一端点和 API 密钥将请求路由到多个模型。它兼容 OpenAI，因此大多数 OpenAI SDK 只需切换 base URL 即可使用。

## 前置条件

1. 拥有千帆 API 访问权限的百度云账号
2. 从千帆控制台获取的 API 密钥
3. 系统已安装 OpenClaw

## 获取 API 密钥

1. 访问[千帆控制台](https://console.bce.baidu.com/qianfan/ais/console/apiKey)
2. 创建新应用或选择现有应用
3. 生成 API 密钥（格式：`bce-v3/ALTAK-...`）
4. 复制 API 密钥以便在 OpenClaw 中使用

## CLI 设置

```bash
openclaw onboard --auth-choice qianfan-api-key
```

## 相关文档

- [OpenClaw 配置](/configuration)
- [模型提供商](/concepts/model-providers)
- [智能体设置](/agents)
- [千帆 API 文档](https://cloud.baidu.com/doc/qianfan-api/s/3m7of64lb)
