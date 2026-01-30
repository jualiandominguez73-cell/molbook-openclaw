# 🚀 GitHub 部署快速上手

> **5 分钟在 GitHub Codespaces 上启动你的私人 AI Assistant！**

## ⚡ 超简单 3 步

### 步骤 1：创建 Codespace

```
1. 访问你的仓库: https://github.com/你的用户名/moltbot
2. 点击 "Code" → "Codespaces" → "Create codespace"
3. 等待 2-3 分钟...
```

### 步骤 2：等待自动初始化

```
Codespace 创建后会自动：
✓ 安装 Node.js 和 pnpm
✓ 安装 Ollama
✓ 下载 LLM 模型 (llama3.3, deepseek-coder, nomic-embed-text)
✓ 配置 Moltbot Gateway
✓ 构建项目
✓ 启动服务
```

### 步骤 3：开始使用！

```
1. 点击 "Ports" 标签
2. 添加端口: 18789
3. 点击访问地址
4. 开始对话！
```

---

## 📝 第一次使用

### 创建 Codespace

1. **访问仓库**

   访问：`https://github.com/你的用户名/moltbot`

2. **创建 Codespace**

   - 点击绿色的 **"Code"** 按钮
   - 切换到 **"Codespaces"** 标签
   - 点击 **"Create codespace on main"**

   选择配置：
   ```
   Machine Type: standard-4cores-linux-x64
   Region: (选择最近的)
   ```

3. **等待创建完成**

   大约需要 2-3 分钟，你会看到 VS Code 界面打开

### 验证安装

在 Codespace 终端运行：

```bash
# 检查 Ollama
ollama list

# 应该看到：
# - llama3.3
# - deepseek-coder
# - nomic-embed-text

# 检查 Gateway
./moltbot.mjs status

# 测试对话
./moltbot.mjs agent "你好"
```

---

## 🌐 访问你的 Gateway

### 方式 1：浏览器 WebChat（最简单）

```
1. 在 Codespace 界面点击 "Ports" 标签
2. 点击 "Add Port"
3. 输入: 18789
4. 点击生成的链接
5. 开始对话！
```

### 方式 2：本地 VS Code 连接

```bash
# 1. 在本地 VS Code 中
# 安装 "Remote - SSH" 扩展

# 2. 连接到 Codespace
# F1 → "Connect to Codespace"

# 3. 打开终端测试
./moltbot.mjs agent "测试连接"
```

### 方式 3：GitHub CLI

```bash
# 1. 安装 GitHub CLI
# macOS: brew install gh
# Windows: winget install GitHub.cli

# 2. 连接
gh codespace view --web

# 3. 测试
gh codespace ssh
./moltbot.mjs agent "测试"
```

---

## 💡 日常使用

### 在 Codespace 中使用

```bash
# 查看状态
./moltbot.mjs status

# 持续对话
./moltbot.mjs agent --session-id my-work "继续刚才的话题"

# 代码审查
git diff | ./moltbot.mjs agent "审查这些变更"

# 生成文档
./moltbot.mjs agent "为 auth.ts 生成 API 文档"

# 查看 Memory
./moltbot.mjs ltm stats
```

### 从本地访问

#### 配置本地客户端

```json
// C:\Users\你\.clawdbot\moltbot.json (Windows)
// ~/.clawdbot/moltbot.json (Linux/Mac)

{
  "gateway": {
    "mode": "remote",
    "remote": {
      "url": "wss://<your-codespace>-18789.github.dev",
      "token": "github-codespaces-token"
    }
  }
}
```

#### 查找 Codespace URL

```bash
# 获取你的 Codespace 名称
gh codespace list

# 格式：https://<name>-18789.<url>.github.dev
```

---

## 🔄 自动化功能

### GitHub Actions 自动运行

#### 每日健康检查（UTC 2:00）

```bash
# 自动执行：
✓ 检查 Gateway 状态
✓ 验证配置
✓ 生成报告
```

#### 触发手动任务

```bash
# 健康检查
gh workflow run github-deploy.yml -f health-check

# 备份 Memory
gh workflow run github-deploy.yml -f backup-memory

# 重启 Gateway
gh workflow run github-deploy.yml -f restart-gateway
```

---

## 🛠️ 管理 Codespace

### 查看状态

```bash
# 列出所有 Codespace
gh codespace list

# 查看详细信息
gh codespace view

# 查看资源使用
gh codespace view --json | jq '.resource'
```

### 控制运行

```bash
# 停止 Codespace（节省费用）
gh codespace stop <name>

# 启动 Codespace
gh codespace start <name>

# 删除 Codespace
gh codespace delete <name>
```

### 成本优化

```bash
# 不使用时停止
gh codespace stop

# 需要时再启动
gh codespace start

# 查看使用时间
gh codespace view --json | jq '.usage'
```

---

## ❓ 常见问题

### Q: 创建失败？

**A:** 检查：
- GitHub 账号是否有限制
- 是否超过 Codespace 数量限制
- 网络连接是否正常

### Q: 模型下载失败？

**A:**
```bash
# 手动下载
ollama pull llama3.3

# 或使用小模型
ollama pull phi3
```

### Q: 内存不足？

**A:** 使用较小的模型：
```bash
ollama pull gemma2:2b  # 2GB 模型
```

### Q: 端口无法访问？

**A:**
```bash
# 1. 检查 Codespace 是否运行
gh codespace list

# 2. 检查 Gateway 状态
./moltbot.mjs status

# 3. 重新配置端口转发
# 在 Codespace 界面点击 "Ports" → "Add Port" → 18789
```

### Q: 如何停止节省费用？

**A:**
```bash
# 停止 Codespace
gh codespace stop

# 删除不需要的 Codespace
gh codespace delete <name>

# 使用时再启动
gh codespace start <name>
```

---

## 💰 成本估算

### 免费额度

```
每月免费: 60 小时
```

### 超出费用

```
每小时: $0.18
```

### 实际使用估算

```
轻度使用 (每天 2 小时):     约 60 小时/月 → 免费
中度使用 (每天 4 小时):     约 120 小时/月 → $10.8
重度使用 (每天 8 小时):     约 240 小时/月 → $32.4
```

**省钱技巧**：
1. 不用就停止
2. 避免空闲运行
3. 使用较小的机器配置

---

## 🎯 推荐使用场景

### ✅ 适合 GitHub 部署

- 个人开发和学习
- 团队协作和展示
- 演示和 POC
- 临时项目

### ❌ 不适合 GitHub 部署

- 大规模生产环境
- 24/7 长期运行
- 数据敏感场景

---

## 📚 更多文档

- **GITHUB-DEPLOY.md** - 完整部署指南
- **QUICKSTART.md** - 通用快速上手
- **DEVELOPMENT-SETUP.md** - 架构详解

---

## 🚀 下一步

1. **立即尝试**：创建你的第一个 Codespace
2. **测试功能**：与 AI 对话，测试 Memory
3. **集成工具**：配置 Telegram Bot 或其他通道
4. **优化配置**：根据需求调整模型和配置

---

**准备开始？**

👉 **立即创建你的 Codespace**：[https://github.com/codespaces](https://github.com/codespaces)

**需要帮助？** 查看 [GITHUB-DEPLOY.md](.github/GITHUB-DEPLOY.md) 或提交 Issue

---

**最后更新**: 2025-01-30
