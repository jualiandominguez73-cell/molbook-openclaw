---
summary: "Channel-specific troubleshooting shortcuts (Discord/Telegram/WhatsApp/iMessage)"
read_when:
  - A channel connects but messages don’t flow
  - Investigating channel misconfiguration (intents, permissions, privacy mode)
title: "Channel Troubleshooting"
---

# Channel troubleshooting

Start with:

```bash
openclaw doctor
openclaw channels status --probe
```

`channels status --probe` prints warnings when it can detect common channel misconfigurations, and includes small live checks (credentials, some permissions/membership).

## Channels

- Discord: [/channels/discord#troubleshooting](/channels/discord#troubleshooting)
- Telegram: [/channels/telegram#troubleshooting](/channels/telegram#troubleshooting)
- WhatsApp: [/channels/whatsapp#troubleshooting-quick](/channels/whatsapp#troubleshooting-quick)
- iMessage (legacy): [/channels/imessage#troubleshooting-macos-privacy-and-security-tcc](/channels/imessage#troubleshooting-macos-privacy-and-security-tcc)

## Telegram quick fixes

- Logs show `HttpError: Network request for 'sendMessage' failed` or `sendChatAction` → check IPv6 DNS. If `api.telegram.org` resolves to IPv6 first and the host lacks IPv6 egress, force IPv4 or enable IPv6. See [/channels/telegram#troubleshooting](/channels/telegram#troubleshooting).
- Logs show `setMyCommands failed` with `BOT_COMMANDS_TOO_MUCH` → Telegram command menu exceeded 100 commands. OpenClaw trims to 100 and logs a warning; reduce menu size with `channels.telegram.commands.nativeSkills: false` and/or fewer `channels.telegram.customCommands`.
- For preflight detection, run `openclaw doctor` and check for `channels.telegram.commands.menu.near_limit` / `channels.telegram.commands.menu.limit_exceeded`.
- Logs show `setMyCommands failed` (other errors) → check outbound HTTPS and DNS reachability to `api.telegram.org` (common on locked-down VPS or proxies).
