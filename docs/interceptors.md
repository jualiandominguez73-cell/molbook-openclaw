# Interceptors

Interceptors let you hook into the tool execution pipeline to mutate arguments before a tool runs (`tool.before`) and transform results after it completes (`tool.after`). They are independent from hooks and plugins, though plugins will typically use them.

Common uses:

- Inject default arguments into specific tools
- Block dangerous tool calls based on custom logic
- Redact sensitive data from tool results
- Log or audit every tool invocation
- Transform tool output before the agent sees it

## How It Works

Every tool call flows through the interceptor pipeline:

```
User prompt
  -> Agent decides to call a tool
    -> tool.before interceptors (can mutate args or block)
      -> Tool executes
    -> tool.after interceptors (can mutate result)
  -> Agent receives the result
```

Interceptors are registered on a **registry** (a simple ordered list). When a tool executes, the adapter queries the registry for matching interceptors, runs them sequentially, and uses the (possibly mutated) output.

## Interceptor Names

| Name | When it runs | What it can do |
|------|-------------|----------------|
| `tool.before` | Before the tool executes | Mutate args, block execution |
| `tool.after` | After the tool executes | Mutate the result |

## Types

### Registration

Each interceptor is registered with an `InterceptorRegistration`:

```typescript
import type { InterceptorRegistration } from "../interceptors/index.js";

const registration: InterceptorRegistration<"tool.before"> = {
  id: "my-arg-injector",         // unique identifier
  name: "tool.before",           // which hook point
  priority: 10,                  // higher runs first (default: 0)
  toolMatcher: /^exec$/,         // optional regex filter on tool name
  handler: (input, output) => {
    // input is read-only context
    // output is mutable — modify it in place
  },
};
```

### tool.before

**Input** (read-only):

```typescript
type ToolBeforeInput = {
  toolName: string;    // normalized tool name (e.g. "exec", "read")
  toolCallId: string;  // unique ID for this tool call
};
```

**Output** (mutable):

```typescript
type ToolBeforeOutput = {
  args: Record<string, unknown>;  // tool arguments — mutate to change what the tool receives
  block?: boolean;                // set true to prevent execution
  blockReason?: string;           // reason shown to the agent when blocked
};
```

### tool.after

**Input** (read-only):

```typescript
type ToolAfterInput = {
  toolName: string;    // normalized tool name
  toolCallId: string;  // unique ID for this tool call
  isError: boolean;    // whether the tool threw an error
};
```

**Output** (mutable):

```typescript
type ToolAfterOutput = {
  result: AgentToolResult<unknown>;  // the tool result — replace or mutate
};
```

## Adding a New Interceptor

### 1. Get the registry

The global interceptor registry is created at gateway startup. Access it from anywhere:

```typescript
import { getGlobalInterceptorRegistry } from "../interceptors/global.js";

const registry = getGlobalInterceptorRegistry();
if (!registry) {
  // Gateway not initialized yet
  return;
}
```

### 2. Register your interceptor

```typescript
registry.add({
  id: "my-plugin:redact-secrets",
  name: "tool.after",
  priority: 5,
  handler: (_input, output) => {
    // Redact any API keys from tool output
    if (typeof output.result.output === "string") {
      output.result = {
        ...output.result,
        output: output.result.output.replace(/sk-[a-zA-Z0-9]{20,}/g, "sk-***"),
      };
    }
  },
});
```

### 3. Remove when done (optional)

```typescript
registry.remove("my-plugin:redact-secrets");
```

## Examples

### Block a tool

Prevent the `exec` tool from running `rm -rf`:

```typescript
registry.add({
  id: "safety:no-rm-rf",
  name: "tool.before",
  priority: 100,  // high priority — runs first
  toolMatcher: /^exec$/,
  handler: (_input, output) => {
    const cmd = String(output.args.command ?? "");
    if (cmd.includes("rm -rf")) {
      output.block = true;
      output.blockReason = "rm -rf is not allowed";
    }
  },
});
```

When blocked, the agent receives a result like:

```json
{ "status": "blocked", "tool": "exec", "reason": "rm -rf is not allowed" }
```

### Inject default arguments

Always add `--color=never` to exec commands:

```typescript
registry.add({
  id: "style:no-color",
  name: "tool.before",
  toolMatcher: /^exec$/,
  handler: (_input, output) => {
    const cmd = String(output.args.command ?? "");
    if (!cmd.includes("--color")) {
      output.args = { ...output.args, command: `${cmd} --color=never` };
    }
  },
});
```

### Log every tool call

```typescript
registry.add({
  id: "audit:log-tools",
  name: "tool.before",
  priority: -10,  // low priority — runs last, after all mutations
  handler: (input, output) => {
    console.log(`[audit] tool=${input.toolName} callId=${input.toolCallId} args=${JSON.stringify(output.args)}`);
  },
});
```

### Transform tool results

Strip ANSI escape codes from all tool output:

```typescript
const ANSI_RE = /\x1b\[[0-9;]*m/g;

registry.add({
  id: "clean:strip-ansi",
  name: "tool.after",
  handler: (_input, output) => {
    if (typeof output.result.output === "string") {
      output.result = {
        ...output.result,
        output: output.result.output.replace(ANSI_RE, ""),
      };
    }
  },
});
```

### Async interceptor

Interceptors can be async. Each runs sequentially in priority order:

```typescript
registry.add({
  id: "enrich:fetch-metadata",
  name: "tool.after",
  toolMatcher: /^web_search$/,
  handler: async (_input, output) => {
    const details = output.result.details as Record<string, unknown>;
    if (details?.url) {
      const meta = await fetchPageMetadata(String(details.url));
      output.result = {
        ...output.result,
        details: { ...details, meta },
      };
    }
  },
});
```

## Priority and Ordering

Interceptors run in **descending priority order** (higher number runs first). Interceptors with the same priority run in registration order.

| Priority | Use case |
|----------|----------|
| 100+ | Security gates, blockers |
| 10-99 | Argument transformation |
| 0 (default) | General-purpose |
| Negative | Logging, auditing (observe final state) |

## Tool Matching

The optional `toolMatcher` field is a `RegExp` tested against the normalized tool name. If omitted, the interceptor runs for all tools.

```typescript
// Match only "exec"
toolMatcher: /^exec$/

// Match any tool starting with "web"
toolMatcher: /^web/

// Match "read" or "write"
toolMatcher: /^(read|write)$/
```

When `toolMatcher` is set and doesn't match the current tool, the interceptor is skipped entirely.

## Registry API

The registry is created via `createInterceptorRegistry()`:

```typescript
import { createInterceptorRegistry } from "../interceptors/index.js";

const registry = createInterceptorRegistry();
```

| Method | Description |
|--------|-------------|
| `add(reg)` | Register an interceptor |
| `remove(id)` | Remove by ID |
| `get(name, toolName?)` | Get matching interceptors, sorted by priority |
| `list()` | List all registered interceptors |
| `clear()` | Remove all interceptors |

## Global Registry

A global singleton registry is initialized at gateway startup via `initializeGlobalInterceptors()`. It is called automatically in `runEmbeddedAttempt()`.

```typescript
import {
  initializeGlobalInterceptors,
  getGlobalInterceptorRegistry,
  resetGlobalInterceptors,
} from "../interceptors/global.js";

// Initialize (idempotent)
const registry = initializeGlobalInterceptors();

// Access from anywhere
const reg = getGlobalInterceptorRegistry(); // null if not initialized

// Reset (for tests only)
resetGlobalInterceptors();
```

## Architecture

### Source Files

- `src/interceptors/types.ts` — Type definitions
- `src/interceptors/registry.ts` — Array-backed registry with add/remove/get/clear
- `src/interceptors/trigger.ts` — Runs matched interceptors sequentially
- `src/interceptors/global.ts` — Global singleton (created at gateway startup)
- `src/interceptors/index.ts` — Public re-exports

### Integration Points

- `src/agents/pi-tool-definition-adapter.ts` — Wraps every tool's `execute()` with the `tool.before`/`tool.after` pipeline
- `src/agents/pi-embedded-runner/run/attempt.ts` — Calls `initializeGlobalInterceptors()` at the start of each run

### Initialization Flow

```
Gateway startup
  -> loadPlugins() (existing)
  -> initializeGlobalInterceptors() (creates empty registry)
  -> Plugins call registry.add() to register interceptors
  -> Tools created via toToolDefinitions() read the global registry
  -> Each tool.execute() runs: tool.before -> real execute -> tool.after
```

## Testing

Run interceptor tests:

```bash
pnpm test src/interceptors/
```

Run adapter integration tests:

```bash
pnpm test src/agents/pi-tool-definition-adapter
```

When writing tests, use `resetGlobalInterceptors()` in `afterEach` to clean up:

```typescript
import { afterEach } from "vitest";
import {
  initializeGlobalInterceptors,
  resetGlobalInterceptors,
} from "../interceptors/global.js";

afterEach(() => {
  resetGlobalInterceptors();
});
```

## Interceptors vs Hooks vs Plugins

| Feature | Interceptors | Hooks | Plugins |
|---------|-------------|-------|---------|
| Scope | Tool execution pipeline | Agent/command lifecycle events | Full extension system |
| Timing | Synchronous with tool call | Event-driven | Loaded at startup |
| Can block tools | Yes | No | Via interceptors |
| Can mutate args | Yes | No | Via interceptors |
| Can mutate results | Yes | Limited (`tool_result_persist`) | Via interceptors |
| Discovery | Programmatic (`registry.add`) | Directory-based | Manifest-based |

## See Also

- `docs/hooks.md` — Event-driven automation for commands and lifecycle
- `docs/plugin.md` — Full extension system
- `docs/plugins/agent-tools.md` — Building tools for plugins
