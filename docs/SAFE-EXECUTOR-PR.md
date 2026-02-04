# Safe Execution Layer for OpenClaw

## Summary

This PR adds a defense-in-depth security module for OpenClaw powered by [ajs-clawbot](https://www.npmjs.com/package/ajs-clawbot), providing **Runtime-Layer Permission** security that makes dangerous operations impossible rather than merely discouraged.

## The Problem

When you expose your OpenClaw bot to external users (Discord servers, Telegram groups, etc.), they can craft messages that exploit prompt injection to:
- Read sensitive files (.env, SSH keys, credentials)
- Execute arbitrary commands
- Exfiltrate data via network requests
- Cause denial of service through flooding or infinite loops

Current "fixes" (regex filters, prompt engineering) use **Application-Layer Permission** - the capability exists and a boolean decides whether to use it. This is trivially bypassed via prompt injection.

## The Solution: Runtime-Layer Permission

This module uses **ajs-clawbot's capability-based security** where dangerous capabilities literally don't exist until explicitly granted. There's nothing to bypass.

```
  APPLICATION-LAYER                      RUNTIME-LAYER (ajs-clawbot)
  ==================                     ===========================

  +------------------+                   +------------------+
  |   Agent Code     |                   |   Agent Code     |
  +--------+---------+                   +--------+---------+
           |                                      |
           v                                      v
  +------------------+                   +------------------+
  | if (allowed) {   |  <-- bypass!      |   fs.read()?     |
  |   fs.read()      |                   +--------+---------+
  | }                |                            |
  +--------+---------+                            v
           |                             +------------------+
           v                             | CAPABILITY NOT   |
  +------------------+                   | BOUND TO VM      |
  |  fs.read() runs  |                   |                  |
  |  (always exists) |                   | Function doesn't |
  +------------------+                   | exist to call!   |
                                         +------------------+
```

## Features

### 1. Zero Capabilities by Default
Skills start with nothing. They can't read files, fetch URLs, or execute commands unless explicitly granted.

### 2. Trust Levels by Message Source
```typescript
// Automatically determined from message context
CLI user        -> 'full' trust
Owner flag      -> 'full' trust  
Trusted users   -> 'shell' trust
DMs             -> 'write' trust
Group chats     -> 'llm' trust
Public channels -> 'network' trust
```

### 3. Always-Blocked Patterns
Sensitive files blocked regardless of trust level:
- Environment: `.env`, `.env.*`
- SSH: `id_rsa`, `id_ed25519`, `.ssh/*`
- Credentials: `credentials.*`, `secrets.*`
- Certificates: `*.pem`, `*.key`
- Cloud: `.aws/*`, `.gcloud/*`, `.kube/*`

### 4. SSRF Protection
- Private IPs: 10.x, 192.168.x, 127.x, etc.
- IPv6 private ranges: fc00::/7, fe80::/10, ::1
- IPv4-mapped-IPv6 bypass detection: ::ffff:192.168.x.x
- Cloud metadata: 169.254.169.254
- Blocked hostnames: localhost, *.local, metadata.google.internal

### 5. Environment Sanitization
Blocks dangerous env vars: LD_PRELOAD, NODE_OPTIONS, PYTHONPATH, BASH_ENV, etc.

### 6. Rate Limiting & Flood Protection
- Self-message rejection (prevents recursion attacks)
- Per-requester rate limits
- Global rate limits
- Automatic cooldown

### 7. Process Tree Killing
Timeouts kill entire process trees, not just parent processes.

## Usage

```typescript
import { createOpenClawExecutor } from './safe-executor';

const { executor, execute } = createOpenClawExecutor({
  workspaceRoot: process.env.OPENCLAW_WORKSPACE,
  llmPredict: anthropicClient.predict,
  allowedHosts: ['api.github.com', 'api.weather.gov'],
  selfIds: ['my-bot-id'],
  strictRateLimiting: true, // for public channels
});

// Execute skill with automatic trust level from message source
const result = await execute(
  './skills/weather',
  { city: 'Seattle' },
  { provider: 'discord', channelType: 'group', userId: 'user-123' }
);
```

## Files Changed

- `src/safe-executor/index.ts` - Module exports (re-exports from ajs-clawbot)
- `src/safe-executor/openclaw-executor.ts` - OpenClaw-specific integration
- `src/safe-executor/config.ts` - Configuration loading
- `src/safe-executor/safe-executor.test.ts` - 24 integration tests

## Dependencies

- `ajs-clawbot@^0.2.6` - Runtime-layer capability-based security

## Testing

24 integration tests covering:
- Trust level mapping from message sources
- Security utilities (blocked paths, env vars, IPs, hostnames)
- Process utilities
- Executor factory creation

The underlying ajs-clawbot package has 254 tests.

## Backwards Compatibility

This module is opt-in and doesn't change existing behavior. It can be integrated gradually:
1. Start with logging mode (validate but don't block)
2. Enable for public channels first
3. Gradually tighten based on audit findings
