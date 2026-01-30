#!/bin/bash
set -e

echo "=========================================="
echo "  Moltbot Gateway - Initial Setup"
echo "=========================================="
echo ""

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ============================================================
# 1. 安装构建工具
# ============================================================
echo -e "${BLUE}[1/6] Installing build tools...${NC}"
echo ""

# 安装 Bun
echo "Installing Bun..."
curl -fsSL https://bun.sh/install | bash
export PATH="$HOME/.bun/bin:${PATH}"
echo 'export PATH="$HOME/.bun/bin:${PATH}"' >> $HOME/.bashrc

# 启用 corepack（安装 pnpm/yarn）
echo "Enabling corepack..."
corepack enable

echo -e "${GREEN}✓ Build tools installed!${NC}"

# ============================================================
# 2. 安装 Ollama（需要 root 权限）
# ============================================================
echo ""
echo -e "${BLUE}[2/6] Installing Ollama...${NC}"
echo ""

# 检查是否需要 sudo
if command -v sudo &> /dev/null; then
    curl -fsSL https://ollama.com/install.sh | sudo sh
else
    curl -fsSL https://ollama.com/install.sh | sh
fi

# 启动 Ollama 服务
echo -e "${GREEN}Starting Ollama service...${NC}"

# 后台启动 Ollama
ollama serve > /tmp/ollama.log 2>&1 &
OLLAMA_PID=$!
sleep 5

# 等待 Ollama 启动
echo "Waiting for Ollama to be ready..."
for i in {1..30}; do
    if curl -s http://127.0.0.1:11434/api/tags > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Ollama is ready!${NC}"
        break
    fi
    echo "Waiting... ($i/30)"
    sleep 2
done

# ============================================================
# 3. 安装 LLM 模型
# ============================================================
echo ""
echo -e "${BLUE}[3/6] Pulling LLM models...${NC}"
echo ""

echo "Installing nomic-embed-text (embeddings)..."
ollama pull nomic-embed-text

echo "Installing llama3.3 (main model)..."
ollama pull llama3.3

echo "Installing deepseek-coder (code assistant)..."
ollama pull deepseek-coder

echo -e "${GREEN}✓ All models installed!${NC}"

# ============================================================
# 4. 配置 Moltbot
# ============================================================
echo ""
echo -e "${BLUE}[4/6] Configuring Moltbot...${NC}"
echo ""

# 创建配置目录
mkdir -p $HOME/.clawdbot/memory

# 创建配置文件
cat > $HOME/.moltbot/moltbot.json << 'EOF'
{
  "gateway": {
    "mode": "local",
    "bind": "0.0.0.0",
    "auth": {
      "token": "github-codespaces-token"
    }
  },

  "models": {
    "mode": "merge",
    "providers": {
      "ollama": {
        "baseUrl": "http://127.0.0.1:11434",
        "models": [
          {
            "id": "llama3.3",
            "name": "Llama 3.3",
            "reasoning": false,
            "input": ["text"],
            "cost": { "input": 0, "output": 0 },
            "contextWindow": 128000,
            "maxTokens": 8192
          },
          {
            "id": "deepseek-coder",
            "name": "DeepSeek Coder",
            "reasoning": false,
            "input": ["text"],
            "cost": { "input": 0, "output": 0 },
            "contextWindow": 128000,
            "maxTokens": 8192
          }
        ]
      }
    }
  },

  "agents": {
    "defaults": {
      "model": {
        "primary": "ollama/llama3.3",
        "fallbacks": ["ollama/deepseek-coder"]
      },
      "workspace": "$HOME/.clawdbot/workspace",
      "maxConcurrent": 4
    }
  },

  "browser": {
    "enabled": true
  },

  "plugins": {
    "entries": {
      "memory-lancedb": {
        "enabled": true,
        "config": {
          "embedding": {
            "provider": "ollama",
            "model": "nomic-embed-text",
            "baseUrl": "http://127.0.0.1:11434/v1"
          },
          "autoCapture": true,
          "autoRecall": true
        }
      }
    },
    "slots": {
      "memory": "memory-lancedb"
    }
  }
}
EOF

echo -e "${GREEN}✓ Configuration created!${NC}"

# ============================================================
# 5. 构建项目
# ============================================================
echo ""
echo -e "${BLUE}[5/6] Building Moltbot...${NC}"
echo ""

# 确保在正确的目录
cd /workspace

# 安装依赖
echo "Installing dependencies..."
pnpm install --frozen-lockfile

# 构建
echo "Building project..."
CLAWDBOT_A2UI_SKIP_MISSING=1 pnpm build

echo -e "${GREEN}✓ Build complete!${NC}"

# ============================================================
# 6. 启动 Gateway
# ============================================================
echo ""
echo -e "${BLUE}[6/6] Starting Gateway...${NC}"
echo ""

# 创建启动脚本
cat > $HOME/start-gateway.sh << 'EOF'
#!/bin/bash
set -e

# 确保环境变量正确
export PATH="$HOME/.bun/bin:${PATH}"

# 启动 Ollama（如果还没运行）
if ! pgrep -x "ollama" > /dev/null; then
    echo "Starting Ollama..."
    ollama serve > /tmp/ollama.log 2>&1 &
    sleep 5
fi

# 启动 Moltbot Gateway
echo "Starting Moltbot Gateway..."
cd /workspace

# 使用 nohup 在后台运行
nohup node /workspace/moltbot.mjs gateway \
    --bind 0.0.0.0 \
    --port 18789 \
    > /tmp/moltbot.log 2>&1 &

GATEWAY_PID=$!
echo $GATEWAY_PID > /tmp/moltbot.pid

echo ""
echo "=========================================="
echo "  Moltbot Gateway Started!"
echo "=========================================="
echo ""
echo "Gateway PID: $GATEWAY_PID"
echo "Logs: tail -f /tmp/moltbot.log"
echo ""
echo "To stop: kill $GATEWAY_PID"
echo "        or: pkill -f moltbot.mjs"
echo ""
EOF

chmod +x $HOME/start-gateway.sh

# 启动 Gateway
$HOME/start-gateway.sh

# 等待 Gateway 启动
sleep 5

# 验证 Gateway 是否运行
if pgrep -f "moltbot.mjs gateway" > /dev/null; then
    echo -e "${GREEN}✓ Gateway is running!${NC}"
else
    echo -e "${YELLOW}⚠ Gateway may not be starting properly. Check logs:${NC}"
    echo "tail -f /tmp/moltbot.log"
fi

# ============================================================
# 完成
# ============================================================
echo ""
echo "=========================================="
echo "  Setup Complete!"
echo "=========================================="
echo ""
echo -e "${GREEN}Your Moltbot Gateway is ready!${NC}"
echo ""
echo "🌐 Access URLs:"
echo "   • Port Forwarding: Port 18789"
echo ""
echo "📝 Next Steps:"
echo "   1. Click 'Ports' tab in Codespaces"
echo "   2. Forward port 18789"
echo "   3. Access the WebChat"
echo ""
echo "🔧 Useful Commands:"
echo "   • Gateway status: cd /workspace && ./moltbot.mjs status"
echo "   • View logs: tail -f /tmp/moltbot.log"
echo "   • Restart Gateway: ~/start-gateway.sh"
echo "   • Test connection: ./moltbot.mjs agent 'test'"
echo ""
echo "📚 Documentation:"
echo "   • GITHUB-QUICKSTART.md"
echo "   • QUICKSTART.md"
echo "   • DEVELOPMENT-SETUP.md"
echo ""
