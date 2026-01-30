Fixes #4918

## Changes

Updates @mariozechner/pi-* dependencies from 0.49.3 to 0.50.5 and addresses all breaking API changes:

### Dependency Updates
- `@mariozechner/pi-agent-core`: 0.49.3 → 0.50.5
- `@mariozechner/pi-ai`: 0.49.3 → 0.50.5
- `@mariozechner/pi-coding-agent`: 0.49.3 → 0.50.5
- `@mariozechner/pi-tui`: 0.49.3 → 0.50.5

### API Migration
- Replace `discoverAuthStorage(path)` → `new AuthStorage(path/auth.json)`
- Replace `discoverModels(auth, path)` → `new ModelRegistry(auth, path/models.json)`
- Update `createAgentSession` to use `DefaultResourceLoader` with `systemPromptOverride` instead of direct `systemPrompt` option
- Fix type imports and test mock compatibility

### Files Changed
- `src/agents/context.ts`
- `src/agents/model-catalog.ts`
- `src/agents/pi-embedded-runner/model.ts`
- `src/agents/pi-embedded-runner/run/types.ts`
- `src/agents/pi-embedded-runner/compact.ts`
- `src/agents/pi-embedded-runner/run/attempt.ts`
- `src/agents/pi-embedded-runner/system-prompt.ts`
- `src/agents/tools/image-tool.ts`
- `src/commands/models/list.registry.ts`
- `src/commands/auth-choice.apply.oauth.ts`
- `src/media-understanding/providers/image.ts`
- `src/gateway/test-helpers.mocks.ts`
- `package.json`
