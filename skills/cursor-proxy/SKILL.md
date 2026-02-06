---
name: cursor-proxy
description: OpenAI-compatible API proxy for Cursor IDE. Start a local proxy that translates OpenAI API calls to Cursor's internal API, enabling use of Cursor subscription models (GPT-4o, Claude 4 Sonnet, Claude 4.5 Opus) via OpenClaw. Use when user wants to use Cursor models, start Cursor proxy, or configure Cursor as a provider.
metadata:
  {
    "openclaw":
      {
        "emoji": "🖱️",
        "author": "xiaoyaner",
        "version": "1.1.0",
        "requires": {
          "bins": ["python3"],
          "python": ["httpx", "protobuf"]
        },
        "install": [
          {
            "id": "pip-deps",
            "kind": "shell",
            "command": "pip3 install httpx[http2] protobuf",
            "label": "Install Python dependencies"
          }
        ]
      }
  }
---

# Cursor Proxy

OpenAI-compatible API proxy for Cursor IDE, allowing OpenClaw to use Cursor subscription models.

## ⚠️ Important

This uses **reverse-engineered, unofficial Cursor API**. It may break when Cursor updates.

## Prerequisites

- Active Cursor IDE subscription (logged in locally)
- Cursor installed at default location
- Python 3.8+

## Quick Start

```bash
# Start proxy
python3 {SKILL_DIR}/scripts/proxy.py

# Test
curl http://localhost:3011/v1/models
```

## Model Filtering

By default, the proxy exposes a **curated subset** of models. You can customize this.

### Option 1: Config File

Create `~/.cursor-proxy.json`:

```json
{
  "models": {
    "allowlist": ["claude-4-sonnet", "claude-4.5-opus-high-thinking", "gpt-5.2-high"],
    "prefixes": ["claude-", "gpt-5"],
    "blocklist": ["*-fast", "*-low"]
  }
}
```

| Field | Description |
|-------|-------------|
| `allowlist` | Only expose these exact models |
| `prefixes` | Only expose models starting with these prefixes |
| `blocklist` | Exclude models matching these glob patterns |

Priority: `allowlist` > `prefixes` > `blocklist`

### Option 2: Environment Variables

```bash
# Expose only specific models
CURSOR_MODEL_ALLOWLIST="claude-4-sonnet,gpt-5.2-high" python3 proxy.py

# Filter by prefix
CURSOR_MODEL_PREFIXES="claude-,gpt-5" python3 proxy.py
```

### Discover All Models

```bash
# See all available models (hidden endpoint)
curl http://localhost:3011/v1/models/all
```

## Default Curated Models

When no config is provided:

- `claude-4-sonnet`
- `claude-4.5-sonnet`
- `claude-4.5-opus-high`
- `claude-4.5-opus-high-thinking`
- `claude-4.6-opus-high-thinking`
- `gpt-4o`
- `gpt-5.2-high`
- `gpt-5.1-codex-max`
- `gemini-3-pro`

## OpenClaw Configuration

Add to `openclaw.json`:

```json
{
  "models": {
    "providers": {
      "cursor": {
        "baseUrl": "http://127.0.0.1:3011/v1",
        "apiKey": "local-proxy",
        "api": "openai-completions",
        "models": [
          {
            "id": "claude-4-sonnet",
            "name": "Claude 4 Sonnet (Cursor)",
            "contextWindow": 200000,
            "maxTokens": 8192
          },
          {
            "id": "claude-4.5-opus-high-thinking",
            "name": "Claude 4.5 Opus Thinking (Cursor)",
            "reasoning": true,
            "contextWindow": 200000,
            "maxTokens": 8192
          }
        ]
      }
    }
  },
  "agents": {
    "defaults": {
      "models": {
        "cursor/claude-4-sonnet": {"alias": "cursor-sonnet"},
        "cursor/claude-4.5-opus-high-thinking": {"alias": "cursor-opus"}
      }
    }
  }
}
```

## Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/chat/completions` | POST | Chat completions (OpenAI format) |
| `/v1/models` | GET | Filtered model list |
| `/v1/models/all` | GET | All available models (discovery) |
| `/health` | GET | Health check |

## Running as Service

### tmux (Recommended)

```bash
# Start
tmux new-session -d -s cursor-proxy "python3 {SKILL_DIR}/scripts/proxy.py"

# Check
tmux capture-pane -t cursor-proxy -p | tail -5

# Stop
tmux kill-session -t cursor-proxy
```

### launchd (macOS)

```xml
<!-- ~/Library/LaunchAgents/com.cursor-proxy.plist -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "...">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.cursor-proxy</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/bin/python3</string>
    <string>/path/to/proxy.py</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
</dict>
</plist>
```

## Troubleshooting

### "Cursor client not found"
- Ensure Cursor IDE is installed and you're logged in
- Check `~/Library/Application Support/Cursor/` exists

### "Model not found"
- Use `/v1/models/all` to see all available models
- Check your subscription tier supports the model

### Proxy stops after Cursor update
- The API is reverse-engineered and may change
- Check for skill updates

## Credits

Based on [eisbaw/cursor_api_demo](https://github.com/eisbaw/cursor_api_demo).
