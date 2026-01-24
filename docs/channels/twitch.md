---
summary: "Twitch chat bot support status, capabilities, and configuration"
read_when:
  - Setting up Twitch chat integration for Clawdbot
  - Configuring Twitch bot permissions and access control
---
# Twitch (plugin)

Twitch chat support via IRC connection. Clawdbot connects as a Twitch user (bot account) to receive and send messages in channels. Requires a Twitch application with OAuth token.

Status: ready for Twitch chat via IRC connection with @twurple.

## Plugin required

Twitch ships as a plugin and is not bundled with the core install.

Install via CLI (npm registry):

```bash
clawdbot plugins install @clawdbot/twitch
```

Local checkout (when running from a git repo):

```bash
clawdbot plugins install ./extensions/twitch
```

Details: [Plugins](/plugin)

## Setup

1) Install the Twitch plugin:
   - From npm: `clawdbot plugins install @clawdbot/twitch`
   - From a local checkout: `clawdbot plugins install ./extensions/twitch`

2) Create a Twitch application:
   - Go to [Twitch Developer Console](https://dev.twitch.tv/console)
   - Click "Register Your Application"
   - Set Application Type to "Chat Bot"
   - Copy the Client ID

3) Generate your OAuth token:
   - Use [Twitch Token Generator](https://twitchtokengenerator.com/) or [TwitchApps TMI](https://twitchapps.com/tmi/)
   - Select scopes: `chat:read` and `chat:write`
   - Copy the token (starts with `oauth:`)

4) Configure credentials:
   - Env: `CLAWDBOT_TWITCH_ACCESS_TOKEN=...` (default account only)
   - Or config: `channels.twitch.accounts.default.token`
   - If both are set, config takes precedence (env fallback is default-account only)

5) Start the gateway. Twitch starts when a token is resolved (config first, env fallback).

6) Invite the bot to your channel (it will auto-join the channel specified in config).

Minimal config (default account):

```json5
{
  channels: {
    twitch: {
      enabled: true,
      accounts: {
        default: {
          username: "mybot",
          token: "oauth:your_token_here",
          clientId: "your_client_id_here"
        }
      }
    }
  }
}
```

Env-only setup:

```bash
export CLAWDBOT_TWITCH_ACCESS_TOKEN=oauth:your_token_here
```

With env, you still need `clientId` in config (or use the minimal config above without `token`).

## Token setup

### Option 1: Static token (simple)

Use [Twitch Token Generator](https://twitchtokengenerator.com/):

1. Select scopes: `chat:read` and `chat:write`
2. Copy the token (starts with `oauth:`)
3. Add to config:

```json5
{
  channels: {
    twitch: {
      accounts: {
        default: {
          username: "mybot",
          token: "oauth:abc123...",
          clientId: "your_client_id"
        }
      }
    }
  }
}
```

### Option 2: Automatic token refresh (recommended)

For long-running bots, configure RefreshingAuthProvider:

1. Use [Twitch Token Generator](https://twitchtokengenerator.com/) with **"Include Refresh Token"** checked
2. Get your Client Secret from [Twitch Developer Console](https://dev.twitch.tv/console)
3. Add to config:

```json5
{
  channels: {
    twitch: {
      accounts: {
        default: {
          username: "mybot",
          token: "oauth:abc123...",
          clientId: "your_client_id",
          clientSecret: "your_client_secret",
          refreshToken: "your_refresh_token",
          expiresIn: 14400,
          obtainmentTimestamp: 1706092800000
        }
      }
    }
  }
}
```

The bot will automatically refresh tokens before they expire and log refresh events.

## Access control

### Allowlist by User ID (recommended)

Most secure: only allow specific Twitch user IDs:

```json5
{
  channels: {
    twitch: {
      accounts: {
        default: {
          username: "mybot",
          token: "oauth:...",
          clientId: "...",
          allowFrom: ["123456789", "987654321"]
        }
      }
    }
  }
}
```

**Why user IDs instead of usernames?** Twitch usernames can change, which could allow someone to hijack another user's access. User IDs are permanent.

Find your Twitch user ID at: https://www.streamweasels.com/tools/convert-your-twitch-username-to-user-id/

### Role-based restrictions

Restrict access to specific roles:

```json5
{
  channels: {
    twitch: {
      accounts: {
        default: {
          username: "mybot",
          token: "oauth:...",
          clientId: "...",
          allowedRoles: ["moderator", "vip"]
        }
      }
    }
  }
}
```

**Available roles:**
- `"moderator"` - Channel moderators
- `"owner"` - Channel owner/broadcaster
- `"vip"` - VIPs
- `"subscriber"` - Subscribers
- `"all"` - Anyone in chat

### Combined allowlist + roles

Users in `allowFrom` bypass role checks:

```json5
{
  channels: {
    twitch: {
      accounts: {
        default: {
          username: "mybot",
          token: "oauth:...",
          clientId: "...",
          allowFrom: ["123456789"],
          allowedRoles: ["moderator"]
        }
      }
    }
  }
}
```

In this example:
- User `123456789` can always message (bypasses role check)
- All moderators can message
- Everyone else is blocked

### Require @mention

Only respond when the bot is mentioned:

```json5
{
  channels: {
    twitch: {
      accounts: {
        default: {
          username: "mybot",
          token: "oauth:...",
          clientId: "...",
          requireMention: true
        }
      }
    }
  }
}
```

## Multiple accounts

Configure multiple Twitch channels:

```json5
{
  channels: {
    twitch: {
      accounts: {
        main: {
          username: "mybot",
          token: "oauth:...",
          clientId: "...",
          channel: "streamer1"
        },
        secondary: {
          username: "mybot",
          token: "oauth:...",
          clientId: "...",
          channel: "streamer2",
          allowedRoles: ["moderator"]
        }
      }
    }
  }
}
```

## Environment variables

For the default account, you can use environment variables instead of config:

- `CLAWDBOT_TWITCH_ACCESS_TOKEN` - OAuth token (with `oauth:` prefix)

Env fallback only works for the default account. For multi-account setups, use config.

Example:

```bash
export CLAWDBOT_TWITCH_ACCESS_TOKEN=oauth:abc123def456...
```

Config:

```json5
{
  channels: {
    twitch: {
      enabled: true,
      accounts: {
        default: {
          username: "mybot",
          clientId: "your_client_id"
          // token will be read from CLAWDBOT_TWITCH_ACCESS_TOKEN
        }
      }
    }
  }
}
```

Priority: account config > base config > env var (for default account only).

## Plugin options

Control markdown stripping behavior:

```json5
{
  plugins: {
    entries: {
      twitch: {
        stripMarkdown: true
      }
    }
  }
}
```

- `stripMarkdown` (default: `true`) - Remove markdown formatting before sending to Twitch

Twitch doesn't support markdown, so this is enabled by default. Disable if you want to send markdown as-is (it will appear as plain text with markdown symbols).

## Troubleshooting

First, run diagnostic commands:

```bash
clawdbot doctor
clawdbot channels status --probe
```

### Bot doesn't respond to messages

**Check access control:**
```json5
{
  channels: {
    twitch: {
      accounts: {
        default: {
          username: "mybot",
          token: "oauth:...",
          clientId: "...",
          // Temporary: allow everyone
          allowedRoles: ["all"]
        }
      }
    }
  }
}
```

**Check the bot is in the channel:** The bot must join the channel (either `channel: "target_channel"` or defaults to `username`).

### Token issues

**"Failed to connect" or authentication errors:**
- Verify token starts with `oauth:`
- Check token has `chat:read` and `chat:write` scopes
- If using RefreshingAuthProvider, verify `clientSecret` and `refreshToken` are set

### Token refresh not working

**Check logs for refresh events:**
```
[twitch] Using env token source for mybot
[twitch] Access token refreshed for user 123456 (expires in 14400s)
```

If you see "token refresh disabled (no refresh token)":
- Ensure `clientSecret` is provided
- Ensure `refreshToken` is provided (from Twitch Token Generator with "Include Refresh Token" checked)

## Capabilities & limits

**Supported:**
- ✅ Channel messages (group chat)
- ✅ Whispers/DMs (received but replies not supported - Twitch doesn't allow bots to send whispers)
- ✅ Markdown stripping (automatically applied)
- ✅ Message chunking (500 char limit)
- ✅ Access control (user ID allowlist, role-based)
- ✅ @mention requirement
- ✅ Automatic token refresh (with RefreshingAuthProvider)
- ✅ Multi-account support

**Not supported:**
- ❌ Native reactions
- ❌ Threaded replies
- ❌ Message editing
- ❌ Message deletion
- ❌ Rich embeds/media uploads (sends media URLs as text)

## Config reference

### Account config

```typescript
{
  username: string,           // Bot username (required)
  token: string,              // OAuth token with chat:read and chat:write (required)
  clientId: string,           // Twitch Client ID (required)
  channel?: string,           // Channel to join (default: username)
  enabled?: boolean,          // Enable this account (default: true)
  clientSecret?: string,      // For RefreshingAuthProvider
  refreshToken?: string,      // For RefreshingAuthProvider
  expiresIn?: number,         // Token expiry in seconds
  obtainmentTimestamp?: number, // Token obtained timestamp
  allowFrom?: string[],       // User ID allowlist
  allowedRoles?: TwitchRole[], // Role-based access control
  requireMention?: boolean    // Require @mention (default: false)
}
```

**TwitchRole:** `"moderator"` | `"owner"` | `"vip"` | `"subscriber"` | `"all"`

### Plugin config

```typescript
{
  stripMarkdown?: boolean  // Strip markdown from outbound (default: true)
}
```

## Tool actions

The agent can call `twitch` with action:

- `send` - Send a message to a channel

Example:

```json5
{
  "action": "twitch",
  "params": {
    "message": "Hello Twitch!",
    "to": "#mychannel"
  }
}
```

## Safety & ops

- **Treat tokens like passwords** - Never commit tokens to git
- **Use RefreshingAuthProvider** for long-running bots
- **Use user ID allowlists** instead of usernames for access control
- **Monitor logs** for token refresh events and connection status
- **Scope tokens minimally** - Only request `chat:read` and `chat:write`
- **If stuck**: Restart the gateway after confirming no other process owns the session

## Message limits

- **500 characters** per message (Twitch limit)
- Messages are automatically chunked at word boundaries
- Markdown is stripped before chunking to avoid breaking patterns
- No rate limiting (uses Twitch's built-in rate limits)
