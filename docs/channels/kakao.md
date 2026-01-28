---
title: KakaoWork
description: Connect Moltbot to KakaoWork for Korea-focused enterprise messaging
---

# KakaoWork

Connect Moltbot to [KakaoWork](https://www.kakaowork.com/), Korea's leading enterprise messaging platform.

<Note>
KakaoWork is available as a third-party plugin. Install with:
```bash
moltbot plugins install @hanishkeloth/moltbot-kakao
```
</Note>

## Features

- Direct message conversations via KakaoWork Bot API
- Reactive callback handling for button interactions
- Multi-account configuration support
- Pairing-based DM access control
- Rate limit aware (200 req/min workspace limit)

## Prerequisites

1. KakaoWork workspace admin access
2. Bot created in [KakaoWork Admin Console](https://admin.kakaowork.com)
3. Bot App Key

## Getting Your App Key

1. Go to [KakaoWork Admin Console](https://admin.kakaowork.com)
2. Navigate to **봇 관리** (Bot Management)
3. Click **봇 추가** (Add Bot) or select existing bot
4. Copy the **App Key** from bot settings

## Installation

```bash
moltbot plugins install @hanishkeloth/moltbot-kakao
```

## Configuration

### Using Environment Variable

```bash
export KAKAOWORK_APP_KEY="your-app-key-here"
```

### Using Config File

Add to `~/.config/moltbot/config.jsonc`:

```jsonc
{
  "channels": {
    "kakao": {
      "enabled": true,
      "appKey": "your-app-key-here",
      "dmPolicy": "pairing"
    }
  }
}
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `appKey` | string | - | Bot App Key from KakaoWork admin |
| `keyFile` | string | - | Path to file containing app key |
| `callbackUrl` | string | - | HTTPS URL for reactive events |
| `callbackPath` | string | - | Gateway HTTP path for callbacks |
| `dmPolicy` | string | `"pairing"` | Access policy (see below) |
| `allowFrom` | array | `[]` | User IDs allowed to DM the bot |
| `proxy` | string | - | Proxy URL for API requests |

## DM Policies

| Policy | Description |
|--------|-------------|
| `pairing` | Users must pair with a code before chatting (default) |
| `allowlist` | Only users in `allowFrom` list can chat |
| `open` | Anyone in workspace can chat |
| `disabled` | DMs are disabled |

## Multi-Account Setup

For multiple KakaoWork bots:

```jsonc
{
  "channels": {
    "kakao": {
      "enabled": true,
      "accounts": {
        "support": {
          "appKey": "SUPPORT_BOT_APP_KEY",
          "dmPolicy": "open"
        },
        "internal": {
          "appKey": "INTERNAL_BOT_APP_KEY",
          "dmPolicy": "allowlist",
          "allowFrom": ["12345", "67890"]
        }
      },
      "defaultAccount": "support"
    }
  }
}
```

## Callback URL (Reactive Events)

To receive button interactions and modal submissions:

1. Set up HTTPS endpoint (use ngrok for testing)
2. Configure callback URL:

```jsonc
{
  "channels": {
    "kakao": {
      "callbackUrl": "https://your-domain.com/kakao/callback",
      "callbackPath": "/kakao/callback"
    }
  }
}
```

3. Register the callback URL in KakaoWork Admin Console

## Sending Messages

```bash
# Send to conversation ID
moltbot message send --channel kakao --to 123456789 --message "Hello!"

# Using the agent
moltbot agent --message "Say hello" --channel kakao
```

## Pairing Flow

When `dmPolicy: "pairing"` (default):

1. User sends message to bot
2. Bot replies with pairing code
3. Admin approves: `moltbot pairing approve kakao <user-id>`
4. User can now chat freely

## Rate Limits

KakaoWork enforces **200 requests per minute** at the workspace level. The plugin handles rate limiting automatically, but be aware when sending bulk messages.

## Troubleshooting

### "Invalid authentication" error
- Check your App Key is correct
- Verify bot is activated in KakaoWork Admin

### Messages not sending
- Ensure bot has permission to message the user
- Check if rate limit (200/min) is exceeded
- Verify conversation exists (use `conversations.open` first)

### Callback not receiving events
- Callback URL must be HTTPS
- Check firewall allows incoming connections
- Verify callback URL registered in KakaoWork Admin

## API Reference

This plugin uses the [KakaoWork Web API](https://docs.kakaoi.ai/kakao_work/webapireference/):

- `bots.info` - Get bot information
- `conversations.open` - Create/open DM conversations
- `conversations.list` - List bot conversations
- `messages.send` - Send messages

## Links

- [KakaoWork Developer Docs](https://docs.kakaoi.ai/kakao_work/)
- [Plugin Repository](https://github.com/hanishkeloth/moltbot-kakao)
- [npm Package](https://www.npmjs.com/package/@hanishkeloth/moltbot-kakao)
