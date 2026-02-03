# MeshGuard Extension for OpenClaw

AI Agent Governance - Policy enforcement, audit logging, and alerting for OpenClaw agents.

## Features

- **Policy Enforcement**: Define rules for what tools agents can use and under what conditions
- **Audit Logging**: Record all tool invocations with full context
- **Real-time Alerts**: Get notified via Telegram when policy violations occur
- **Cross-Startup Boundaries**: Prevent agents from accessing data outside their domain

## Installation

```bash
cd extensions/meshguard
pnpm install
pnpm build
```

## Configuration

Add to your agent's `openclaw.json`:

```json
{
  "extensions": ["meshguard"],
  "meshguard": {
    "enabled": true,
    "agentId": "my-agent",
    "policyFile": "./policies/my-agent.yaml",
    "auditFile": "./audit/my-agent.jsonl",
    "alertTelegram": {
      "botToken": "${TELEGRAM_BOT_TOKEN}",
      "chatId": 1234567890
    }
  }
}
```

## Policy File Format

```yaml
agent: my-agent
version: "1.0"

policies:
  # Allow specific tools
  - name: core-tools
    resource: tool
    conditions:
      tool: [exec, read, write]
    effect: allow

  # Block dangerous commands
  - name: block-rm-rf
    resource: exec
    conditions:
      command_pattern: ["rm -rf /"]
    effect: deny
    alert: critical

  # CRM boundaries
  - name: my-crm-only
    resource: twenty-crm
    conditions:
      workspace: [my-app.mollified.app]
    effect: allow

audit:
  log_level: verbose
  retention_days: 90
  sensitive_fields: [api_key, token, password]
  redact_pii: true

alerts:
  - name: violations
    channels: [telegram]
    recipients:
      telegram: [1234567890]
    severity: [warning, critical]
```

## Policy Effects

- `allow`: Permit the action
- `deny`: Block the action and return an error
- `approval_required`: (Future) Queue for human approval

## Condition Types

- `tool`: List of tool names
- `command_pattern`: Regex patterns for exec commands
- `domain`: HTTP domain allowlist
- `chat_id`: Telegram chat IDs
- `workspace`: CRM workspace identifiers

## Audit Log Format

Each line in the audit file is a JSON object:

```json
{
  "id": "uuid",
  "timestamp": 1706976000000,
  "agentId": "my-agent",
  "tool": "exec",
  "args": { "command": "ls -la" },
  "source": { "chatId": -1001234567890, "username": "user" },
  "decision": { "effect": "allow", "matchedRule": "core-tools" },
  "result": { "success": true, "duration_ms": 150 }
}
```

## Development

```bash
# Watch mode
pnpm dev

# Build
pnpm build
```

## License

MIT - Part of MeshGuard by DBH Ventures
