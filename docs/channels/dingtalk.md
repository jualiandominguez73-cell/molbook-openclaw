---
summary: "DingTalk bot support status, capabilities, and configuration"
read_when:
  - Working on DingTalk channel features
---
# DingTalk

Status: beta; inbound via WebSocket using `dingtalk-stream` SDK.

## Quick setup
1) Create an enterprise internal robot in DingTalk Open Platform.
2) Enable "Stream Mode" in robot settings.
3) Configure `channels.dingtalk.clientId` and `channels.dingtalk.clientSecret`.
4) Start the gateway.

Minimal config:
```json5
{
  channels: {
    dingtalk: {
      enabled: true,
      clientId: "YOUR_APP_KEY",
      clientSecret: "YOUR_APP_SECRET"
    }
  }
}
```

Multi-account example:
```json5
{
  channels: {
    dingtalk: {
      accounts: {
        work: { clientId: "APP_KEY", clientSecret: "APP_SECRET" },
        personal: { clientId: "APP_KEY", clientSecret: "APP_SECRET" }
      }
    }
  }
}
```

## How it works
- Messages are received over the DingTalk WebSocket stream (no public URL needed).
- Replies are sent back via the session webhook provided in each message.
- DMs use pairing by default (`channels.dingtalk.dm.policy`).
- Group chats can be restricted with `channels.dingtalk.groupPolicy` and `channels.dingtalk.groups`.

## Target formats
- `dingtalk:<conversation_id>` for group chats.
- `dingtalk:<user_id>` for direct messages.

## Configuration reference (DingTalk)
- `channels.dingtalk.clientId`: DingTalk AppKey (Client ID).
- `channels.dingtalk.clientSecret`: DingTalk AppSecret (Client Secret).
- `channels.dingtalk.dm.policy`: DM policy (`pairing`, `allowlist`, `open`, `disabled`).
- `channels.dingtalk.dm.allowFrom`: allowlist for DMs when policy is `allowlist` or `open`.
- `channels.dingtalk.groupPolicy`: `open`, `allowlist`, or `disabled`.
- `channels.dingtalk.groups`: per-chat overrides keyed by `conversation_id` (supports `requireMention`, `tools`, `users`).
- `channels.dingtalk.requireMention`: whether the bot must be @mentioned in groups (default: `true`).
- `channels.dingtalk.textChunkLimit`: max characters per message chunk (default: `4000`).
