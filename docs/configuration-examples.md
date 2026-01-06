---
summary: "Complete configuration examples with explanations for new users"
read_when:
  - Learning how to configure clawdbot
  - Looking for configuration examples
  - Setting up clawdbot for the first time
---
# Configuration Examples

This guide shows complete configuration examples and explains what each section does. Perfect for getting started or understanding the full range of options available.

## Quick Start: What You Actually Need

**The truth**: You probably don't need most of these options! Here's what matters for most users:

### Absolute Minimum (5 lines)
```json5
{
  agent: { workspace: "~/clawd" },
  whatsapp: { allowFrom: ["+1234567890"] }  // Replace with your real number
}
```

Save this to `~/.clawdbot/clawdbot.json` and you're ready to go.

### Recommended Starting Config (10 lines)
```json5
{
  identity: {
    name: "Clawd",
    theme: "helpful assistant"
  },
  agent: {
    workspace: "~/clawd",
    model: { primary: "anthropic/claude-sonnet-4-5" }
  },
  whatsapp: {
    allowFrom: ["+1234567890"],  // Your phone number
    groups: { "*": { requireMention: true } }
  }
}
```

This gives you:
- A named identity for your bot
- A dedicated workspace folder
- WhatsApp access restricted to your number
- Group chat protection (requires @mention to respond)

---

## Complete Example: All Options Explained

Below is a **maxed-out** configuration showing every major option. This is for reference—you only need the sections relevant to your setup.

> **Note**: This uses JSON5 format, which allows comments (`//`) and trailing commas. Regular JSON works too.

```json5
{
  // ========================================
  // ENVIRONMENT & SHELL
  // ========================================
  // Load environment variables from your shell profile
  // Useful if you need API keys from .zshrc, .bashrc, etc.
  env: {
    shellEnv: {
      enabled: true,      // Set to false to skip shell env loading
      timeoutMs: 15000    // How long to wait for shell to load
    }
  },

  // ========================================
  // AUTHENTICATION PROFILES
  // ========================================
  // Manage multiple API keys and OAuth accounts
  // Each provider can have multiple profiles (e.g., personal + work)
  auth: {
    profiles: {
      "anthropic:default": { provider: "anthropic", mode: "oauth", email: "me@example.com" },
      "anthropic:work": { provider: "anthropic", mode: "api_key" },
      "openai:default": { provider: "openai", mode: "api_key" },
      "openai-codex:default": { provider: "openai-codex", mode: "oauth" },
      "openrouter:default": { provider: "openrouter", mode: "api_key" },
      "google:default": { provider: "google", mode: "api_key" }
    },
    // Round-robin order when using multiple accounts
    order: {
      anthropic: ["anthropic:default", "anthropic:work"],
      openai: ["openai:default"],
      "openai-codex": ["openai-codex:default"],
      openrouter: ["openrouter:default"],
      google: ["google:default"]
    }
  },

  // ========================================
  // BOT IDENTITY
  // ========================================
  // Give your bot a personality
  identity: {
    name: "Samantha",          // What to call your bot
    theme: "helpful sloth",    // Personality/behavior theme
    emoji: "🦥"                // Representative emoji
  },

  // ========================================
  // WIZARD STATE (Auto-generated)
  // ========================================
  // Tracks onboarding completion - you usually don't edit this manually
  wizard: {
    lastRunAt: "2026-01-01T00:00:00.000Z",
    lastRunVersion: "2026.1.4",
    lastRunCommit: "abc1234",
    lastRunCommand: "configure",
    lastRunMode: "local"
  },

  // ========================================
  // LOGGING
  // ========================================
  // Control what gets logged and where
  logging: {
    level: "info",                          // debug, info, warn, error
    file: "/tmp/clawdbot/clawdbot.log",     // Log file location
    consoleLevel: "info",                   // Separate level for console output
    consoleStyle: "pretty",                 // pretty or json
    redactSensitive: "tools",               // Redact sensitive data from tool outputs
    redactPatterns: [                       // Custom patterns to redact
      "\\bTOKEN\\b\\s*[=:]\\s*([\"']?)([^\\s\"']+)\\1",
      "/\\bsk-[A-Za-z0-9_-]{8,}\\b/gi"      // Redact API keys
    ]
  },

  // ========================================
  // MESSAGE FORMATTING
  // ========================================
  // Customize how messages appear
  messages: {
    messagePrefix: "[clawdbot]",   // Prefix for bot messages
    responsePrefix: "🦞",          // Emoji at start of responses
    ackReaction: "👀",             // Reaction when message received
    ackReactionScope: "group-mentions"  // When to react: always, never, group-mentions
  },

  // ========================================
  // MESSAGE ROUTING & QUEUING
  // ========================================
  routing: {
    // How the bot handles group chats
    groupChat: {
      mentionPatterns: ["@clawd", "clawdbot", "clawd"],  // What counts as a mention
      historyLimit: 50                                    // How many messages to remember
    },
    // How to handle message bursts
    queue: {
      mode: "collect",        // collect, fifo, or lifo
      debounceMs: 1000,       // Wait time before processing burst
      cap: 20,                // Max messages in queue
      drop: "summarize",      // What to do when full: drop, summarize
      bySurface: {            // Per-platform overrides
        whatsapp: "collect",
        telegram: "collect",
        discord: "collect",
        imessage: "collect",
        webchat: "collect"
      }
    }
  },

  // ========================================
  // WHATSAPP
  // ========================================
  whatsapp: {
    allowFrom: ["+15555550123"],      // Who can message the bot (use real numbers!)
    textChunkLimit: 4000,              // Max characters per message
    groups: {
      "*": { requireMention: true }    // Require @mention in all groups
    }
  },

  // ========================================
  // WEB INTERFACE
  // ========================================
  web: {
    enabled: true,                 // Enable web chat interface
    heartbeatSeconds: 60,          // Connection health check interval
    reconnect: {
      initialMs: 2000,             // Initial reconnect delay
      maxMs: 120000,               // Max reconnect delay
      factor: 1.4,                 // Exponential backoff multiplier
      jitter: 0.2,                 // Random jitter (0-20%)
      maxAttempts: 0               // 0 = unlimited retries
    }
  },

  // ========================================
  // TELEGRAM
  // ========================================
  telegram: {
    enabled: true,
    botToken: "YOUR_TELEGRAM_BOT_TOKEN",     // Get from @BotFather
    requireMention: true,                     // Require @mention to respond
    allowFrom: ["123456789"],                 // Telegram user IDs
    mediaMaxMb: 5,                            // Max media file size
    proxy: "socks5://localhost:9050",         // Optional proxy
    webhookUrl: "https://example.com/telegram-webhook",
    webhookSecret: "secret",
    webhookPath: "/telegram-webhook"
  },

  // ========================================
  // DISCORD
  // ========================================
  discord: {
    enabled: true,
    token: "YOUR_DISCORD_BOT_TOKEN",
    mediaMaxMb: 8,
    actions: {                               // Fine-grained permissions
      reactions: true,                       // React to messages
      stickers: true,                        // Send stickers
      polls: true,                           // Create polls
      permissions: true,                     // Check permissions
      messages: true,                        // Send messages
      threads: true,                         // Create/manage threads
      pins: true,                            // Pin messages
      search: true,                          // Search messages
      memberInfo: true,                      // Get member info
      roleInfo: true,                        // Get role info
      roles: false,                          // Assign roles (dangerous!)
      channelInfo: true,                     // Get channel info
      voiceStatus: true,                     // Voice channel status
      events: true,                          // Schedule events
      moderation: false                      // Kick/ban (dangerous!)
    },
    replyToMode: "off",                      // How to handle reply chains
    slashCommand: {
      enabled: true,
      name: "clawd",                         // /clawd in Discord
      sessionPrefix: "discord:slash",
      ephemeral: true                        // Only visible to user
    },
    dm: {
      enabled: true,
      allowFrom: ["1234567890", "steipete"],  // Discord user IDs or usernames
      groupEnabled: false,
      groupChannels: ["clawd-dm"]
    },
    guilds: {                                // Per-server configuration
      "123456789012345678": {                // Discord server ID
        slug: "friends-of-clawd",
        requireMention: false,
        reactionNotifications: "own",        // Get notified: own, all, none
        users: ["987654321098765432"],       // Allowed users in this server
        channels: {
          general: { allow: true },
          help: { allow: true, requireMention: true }
        }
      }
    },
    historyLimit: 20                         // Message history to include
  },

  // ========================================
  // SLACK
  // ========================================
  slack: {
    enabled: true,
    botToken: "xoxb-REPLACE_ME",             // Bot User OAuth Token
    appToken: "xapp-REPLACE_ME",             // App-Level Token (for Socket Mode)
    dm: {
      enabled: true,
      allowFrom: ["U123", "U456", "*"],      // User IDs (* = everyone)
      groupEnabled: false,
      groupChannels: ["G123"]
    },
    channels: {
      C123: { allow: true, requireMention: true },
      "#general": { allow: true, requireMention: false }
    },
    reactionNotifications: "own",
    reactionAllowlist: ["U123"],
    actions: {
      reactions: true,
      messages: true,
      pins: true,
      memberInfo: true,
      emojiList: true
    },
    slashCommand: {
      enabled: true,
      name: "clawd",
      sessionPrefix: "slack:slash",
      ephemeral: true
    },
    textChunkLimit: 4000,
    mediaMaxMb: 20
  },

  // ========================================
  // IMESSAGE (macOS only)
  // ========================================
  imessage: {
    enabled: true,
    cliPath: "imsg",                         // Path to imsg CLI tool
    dbPath: "~/Library/Messages/chat.db",    // iMessage database
    allowFrom: ["+15555550123", "user@example.com", "chat_id:123"],
    includeAttachments: false,
    mediaMaxMb: 16,
    service: "auto",                         // auto, iMessage, SMS
    region: "US"
  },

  // ========================================
  // TEXT-TO-SPEECH (ElevenLabs)
  // ========================================
  talk: {
    voiceId: "elevenlabs_voice_id",
    voiceAliases: {
      Clawd: "EXAVITQu4vr4xnSDxMaL",
      Roger: "CwhRBWXzGAHq8TQ4Fs17"
    },
    modelId: "eleven_v3",
    outputFormat: "mp3_44100_128",
    apiKey: "ELEVENLABS_API_KEY",
    interruptOnSpeech: true
  },

  // ========================================
  // AGENT (The AI Brain)
  // ========================================
  agent: {
    workspace: "~/clawd",                    // Where the agent can read/write files
    userTimezone: "America/Chicago",         // Your timezone for time-aware responses

    // Model registry - define all available models
    models: {
      "anthropic/claude-opus-4-5": { alias: "opus" },
      "anthropic/claude-sonnet-4-5": { alias: "sonnet" },
      "openai/gpt-5.2": { alias: "gpt" },
      "openai/gpt-5-mini": { alias: "gpt-mini" },
      "google/gemini-3-pro-preview": { alias: "gemini" },
      "google/gemini-3-flash-preview": { alias: "gemini-flash" },
      "openrouter/deepseek/deepseek-r1:free": {},
      "openrouter/meta-llama/llama-3.3-70b-instruct:free": {},
      "openrouter/qwen/qwen-2.5-vl-72b-instruct:free": {},
      "openrouter/google/gemini-2.0-flash-vision:free": {},
      "lmstudio/minimax-m2.1-gs32": { alias: "minimax" },
      "custom-proxy/llama-3.1-8b": {}
    },

    // Which models to use (with fallbacks)
    model: {
      primary: "anthropic/claude-sonnet-4-5",
      fallbacks: [
        "anthropic/claude-opus-4-5",
        "openai/gpt-5.2",
        "google/gemini-3-flash-preview",
        "openrouter/deepseek/deepseek-r1:free",
        "openrouter/meta-llama/llama-3.3-70b-instruct:free"
      ]
    },

    // Models for image understanding
    imageModel: {
      primary: "openrouter/qwen/qwen-2.5-vl-72b-instruct:free",
      fallbacks: ["openrouter/google/gemini-2.0-flash-vision:free"]
    },

    // Behavior defaults
    thinkingDefault: "low",              // low, medium, high - reasoning depth
    verboseDefault: "off",               // Show thinking process
    elevatedDefault: "on",               // Allow privileged operations
    timeoutSeconds: 600,                 // Max time for agent response
    mediaMaxMb: 5,                       // Max media file size

    // Heartbeat - periodic check-ins
    heartbeat: {
      every: "30m",                      // How often
      model: "anthropic/claude-sonnet-4-5",
      target: "last",                    // Where to send: last, or specific contact
      to: "+15555550123",
      prompt: "HEARTBEAT",
      ackMaxChars: 30                    // Max chars in heartbeat message
    },

    maxConcurrent: 3,                    // Max parallel conversations

    // Bash tool configuration
    bash: {
      backgroundMs: 10000,               // When to run bash commands in background
      timeoutSec: 1800,                  // Max bash command runtime (30 min)
      cleanupMs: 1800000                 // Clean up background processes after
    },

    contextTokens: 200000,               // Context window size
    blockStreamingDefault: "on",         // Buffer streaming for cleaner messages
    blockStreamingBreak: "text_end",     // When to break blocks
    blockStreamingChunk: {
      minChars: 800,
      maxChars: 1200
    },

    // Tool permissions
    tools: {
      allow: ["bash", "process", "read", "write", "edit"],
      deny: ["browser", "canvas"]
    },

    // Elevated mode - privileged operations
    elevated: {
      enabled: true,
      allowFrom: {                       // Who can use elevated mode
        whatsapp: ["+15555550123"],
        telegram: ["123456789"],
        discord: ["steipete", "1234567890123"],
        signal: ["+15555550123"],
        imessage: ["user@example.com"],
        webchat: ["session:demo"]
      }
    },

    // Sandbox - isolate agent operations (advanced)
    sandbox: {
      mode: "non-main",                  // When to sandbox: always, non-main, never
      perSession: true,                  // Create separate sandbox per conversation
      workspaceRoot: "~/.clawdbot/sandboxes",

      docker: {
        image: "clawdbot-sandbox:bookworm-slim",
        containerPrefix: "clawdbot-sbx-",
        workdir: "/workspace",
        readOnlyRoot: true,
        tmpfs: ["/tmp", "/var/tmp", "/run"],
        network: "none",                 // Isolated from network
        user: "1000:1000",
        capDrop: ["ALL"],                // Drop all capabilities
        env: { LANG: "C.UTF-8" },
        setupCommand: "apt-get update && apt-get install -y git curl jq",
        pidsLimit: 256,
        memory: "1g",
        memorySwap: "2g",
        cpus: 1,
        ulimits: {
          nofile: { soft: 1024, hard: 2048 },
          nproc: 256
        },
        seccompProfile: "/path/to/seccomp.json",
        apparmorProfile: "clawdbot-sandbox",
        dns: ["1.1.1.1", "8.8.8.8"],
        extraHosts: ["internal.service:10.0.0.5"]
      },

      browser: {
        enabled: false,
        image: "clawdbot-sandbox-browser:bookworm-slim",
        containerPrefix: "clawdbot-sbx-browser-",
        cdpPort: 9222,
        vncPort: 5900,
        noVncPort: 6080,
        headless: false,
        enableNoVnc: true
      },

      tools: {
        allow: ["bash", "process", "read", "write", "edit"],
        deny: ["browser", "canvas", "nodes", "cron", "discord", "gateway"]
      },

      prune: {
        idleHours: 24,
        maxAgeDays: 7
      }
    }
  },

  // ========================================
  // CUSTOM MODEL PROVIDERS
  // ========================================
  // Add local or custom API endpoints
  models: {
    mode: "merge",                       // merge with built-ins or replace
    providers: {
      "custom-proxy": {
        baseUrl: "http://localhost:4000/v1",
        apiKey: "LITELLM_KEY",
        api: "openai-completions",       // API format to use
        authHeader: true,
        headers: { "X-Proxy-Region": "us-west" },
        models: [
          {
            id: "llama-3.1-8b",
            name: "Llama 3.1 8B",
            reasoning: false,
            input: ["text"],
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: 128000,
            maxTokens: 32000
          }
        ]
      },
      lmstudio: {
        baseUrl: "http://127.0.0.1:1234/v1",
        apiKey: "lmstudio",
        api: "openai-responses",
        models: [
          {
            id: "minimax-m2.1-gs32",
            name: "MiniMax M2.1 GS32",
            reasoning: false,
            input: ["text"],
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: 196608,
            maxTokens: 8192
          }
        ]
      }
    }
  },

  // ========================================
  // SESSION MANAGEMENT
  // ========================================
  session: {
    scope: "per-sender",                 // per-sender, per-chat, global
    idleMinutes: 60,                     // Reset session after inactivity
    resetTriggers: ["/new", "/reset"],   // Commands that reset session
    store: "~/.clawdbot/sessions/sessions.json",
    agentToAgent: {
      maxPingPongTurns: 5                // Prevent infinite agent loops
    },
    sendPolicy: {
      rules: [
        { action: "deny", match: { surface: "discord", chatType: "group" } }
      ],
      default: "allow"
    }
  },

  // ========================================
  // SKILLS (Custom Tools/Commands)
  // ========================================
  skills: {
    allowBundled: ["brave-search", "gemini"],  // Which bundled skills to enable
    load: {
      extraDirs: [                       // Additional skill directories
        "~/Projects/agent-scripts/skills",
        "~/Projects/oss/some-skill-pack/skills"
      ]
    },
    install: {
      preferBrew: true,                  // Use Homebrew when available
      nodeManager: "npm"                 // npm, pnpm, yarn, bun
    },
    entries: {                           // Per-skill configuration
      "nano-banana-pro": {
        apiKey: "GEMINI_KEY_HERE",
        env: {
          GEMINI_API_KEY: "GEMINI_KEY_HERE"
        }
      },
      peekaboo: { enabled: true },
      sag: { enabled: false }
    }
  },

  // ========================================
  // BROWSER AUTOMATION
  // ========================================
  browser: {
    enabled: true,
    controlUrl: "http://127.0.0.1:18791",
    defaultProfile: "clawd",
    profiles: {                          // Multiple browser profiles
      clawd: { cdpPort: 18800, color: "#FF4500" },
      work: { cdpPort: 18801, color: "#0066CC" },
      remote: { cdpUrl: "http://10.0.0.42:9222", color: "#00AA00" }
    },
    color: "#FF4500",
    headless: false,                     // Run browser with UI
    noSandbox: false,
    executablePath: "/usr/bin/chromium",
    attachOnly: false                    // Attach to existing browser vs launch new
  },

  // ========================================
  // UI CUSTOMIZATION
  // ========================================
  ui: {
    seamColor: "#FF4500"                 // Brand color for web UI
  },

  // ========================================
  // GATEWAY (Server/Networking)
  // ========================================
  gateway: {
    mode: "local",                       // local, remote, or both
    port: 18789,
    bind: "loopback",                    // loopback, tailnet, or 0.0.0.0
    controlUi: {
      enabled: true,
      basePath: "/clawdbot"
    },
    auth: {
      mode: "token",                     // token, password, or both
      token: "gateway-token",
      password: "gateway-password",
      allowTailscale: true               // Trust Tailscale identity
    },
    tailscale: {
      mode: "serve",                     // serve (private) or funnel (public)
      resetOnExit: false
    },
    remote: {
      url: "ws://gateway.tailnet:18789",
      token: "remote-token",
      password: "remote-password"
    },
    reload: {
      mode: "hybrid",                    // How to reload config: hybrid, restart, hot
      debounceMs: 300
    }
  },

  // ========================================
  // WEBHOOKS (Inbound HTTP)
  // ========================================
  hooks: {
    enabled: true,
    token: "shared-secret",
    path: "/hooks",
    presets: ["gmail"],
    transformsDir: "~/.clawdbot/hooks",
    mappings: [
      {
        match: { path: "gmail" },
        action: "agent",
        wakeMode: "now",
        name: "Gmail",
        sessionKey: "hook:gmail:{{messages[0].id}}",
        messageTemplate: "From: {{messages[0].from}}\nSubject: {{messages[0].subject}}\n{{messages[0].snippet}}"
      }
    ],
    gmail: {
      account: "clawdbot@gmail.com",
      topic: "projects/<project-id>/topics/gog-gmail-watch",
      subscription: "gog-gmail-watch-push",
      pushToken: "shared-push-token",
      hookUrl: "http://127.0.0.1:18789/hooks/gmail",
      includeBody: true,
      maxBytes: 20000,
      renewEveryMinutes: 720,
      serve: { bind: "127.0.0.1", port: 8788, path: "/" },
      tailscale: { mode: "funnel", path: "/gmail-pubsub" }
    }
  },

  // ========================================
  // CANVAS HOST (Live HTML/Web Apps)
  // ========================================
  canvasHost: {
    enabled: true,
    root: "~/clawd/canvas",              // Where canvas apps are stored
    port: 18793,
    liveReload: true                     // Auto-reload on file changes
  },

  // ========================================
  // BRIDGE (Agent-to-Agent Communication)
  // ========================================
  bridge: {
    enabled: true,
    port: 18790,
    bind: "tailnet"                      // Expose to Tailscale network
  },

  // ========================================
  // DISCOVERY (Network Service Discovery)
  // ========================================
  discovery: {
    wideArea: { enabled: true }          // Enable Bonjour/mDNS discovery
  },

  // ========================================
  // CRON (Scheduled Tasks)
  // ========================================
  cron: {
    enabled: true,
    maxConcurrentRuns: 2                 // Max cron jobs running at once
  }
}
```

---

## Understanding the Sections

### Core Essentials (Start Here)

These are the sections most users actually configure:

- **`identity`** - Give your bot a name and personality
- **`agent.workspace`** - Where the bot can read/write files (keep it sandboxed!)
- **`agent.model`** - Which AI model to use
- **Platform sections** (`whatsapp`, `telegram`, `discord`, etc.) - Connect your messaging platforms

### Security & Access Control

- **`allowFrom`** arrays - Whitelist who can use the bot (use real phone numbers/IDs!)
- **`elevated.allowFrom`** - Who gets privileged operations (be careful!)
- **`sandbox`** - Isolate the bot's operations (advanced users)

### Advanced Features (Optional)

- **`skills`** - Add custom tools and commands
- **`browser`** - Enable browser automation
- **`cron`** - Schedule recurring tasks
- **`hooks`** - Receive webhooks from external services
- **`models`** - Add custom/local AI models

---

## Common Patterns

### Multi-Platform Setup
```json5
{
  agent: { workspace: "~/clawd" },
  whatsapp: { allowFrom: ["+1234567890"] },
  telegram: {
    enabled: true,
    botToken: "YOUR_TOKEN",
    allowFrom: ["123456789"]
  },
  discord: {
    enabled: true,
    token: "YOUR_TOKEN",
    dm: { allowFrom: ["yourname"] }
  }
}
```

### Work Bot (Restricted Access)
```json5
{
  identity: {
    name: "WorkBot",
    theme: "professional assistant"
  },
  agent: {
    workspace: "~/work-clawd",
    elevated: {
      enabled: false  // Disable privileged ops for safety
    }
  },
  slack: {
    enabled: true,
    botToken: "xoxb-...",
    channels: {
      "#engineering": { allow: true, requireMention: true },
      "#general": { allow: true, requireMention: true }
    }
  }
}
```

### Local Models Only
```json5
{
  agent: {
    workspace: "~/clawd",
    model: {
      primary: "lmstudio/minimax-m2.1-gs32"
    }
  },
  models: {
    mode: "merge",
    providers: {
      lmstudio: {
        baseUrl: "http://127.0.0.1:1234/v1",
        apiKey: "lmstudio",
        api: "openai-responses",
        models: [
          {
            id: "minimax-m2.1-gs32",
            name: "MiniMax M2.1 GS32",
            reasoning: false,
            input: ["text"],
            contextWindow: 196608,
            maxTokens: 8192
          }
        ]
      }
    }
  }
}
```

---

## Next Steps

1. Start with the [Recommended Starting Config](#recommended-starting-config-10-lines)
2. Add platform integrations as needed (see [WhatsApp](whatsapp.md), [Telegram](telegram.md), [Discord](discord.md))
3. Customize identity and behavior
4. Explore advanced features when you're comfortable

For detailed explanations of each section, see the [complete configuration reference](configuration.md).

---

## Troubleshooting

**"My config isn't loading!"**
- Check file location: `~/.clawdbot/clawdbot.json`
- Validate JSON syntax (use [jsonlint.com](https://jsonlint.com) if needed)
- Check logs: `clawdbot doctor` or look in `~/.clawdbot/logs/`

**"Bot isn't responding in WhatsApp groups"**
- Make sure `groups: { "*": { requireMention: true } }` is set
- Add mention patterns: `routing.groupChat.mentionPatterns: ["@clawd"]`

**"Permission denied errors"**
- Check `agent.workspace` path exists and is writable
- Review `elevated.allowFrom` - you might not have elevated permissions

**"Can't connect to Telegram/Discord"**
- Verify tokens are correct (no quotes/spaces)
- Check network connectivity
- Look for error messages in logs

For more help, see [Troubleshooting](troubleshooting.md) or [FAQ](faq.md).
