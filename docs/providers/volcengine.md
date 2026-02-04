---
summary: "Use Volcengine Ark with OpenClaw"
read_when:
  - You want Volcengine models in OpenClaw
  - You need VOLCENGINE_API_KEY setup
title: "Volcengine Ark"
---

# Volcengine Ark

Volcengine Ark provides OpenAI-compatible APIs for hosted models. OpenClaw uses the
`volcengine` provider with an API key. Create your API key in the Volcengine console.

## Model overview

- Default model: `doubao-seed-1-8-251228`
- Base URL: `https://ark.cn-beijing.volces.com/api/v3`
- Authorization: `Bearer $VOLCENGINE_API_KEY`

## CLI setup

```bash
openclaw onboard --auth-choice volcengine-api-key
# or non-interactive
openclaw onboard --auth-choice volcengine-api-key --volcengine-api-key "$VOLCENGINE_API_KEY"
```

## Config snippet

```json5
{
  env: { VOLCENGINE_API_KEY: "your-key" },
  agents: { defaults: { model: { primary: "volcengine/doubao-seed-1-8-251228" } } },
  models: {
    mode: "merge",
    providers: {
      volcengine: {
        baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
        api: "openai-completions",
        apiKey: "VOLCENGINE_API_KEY",
        models: [
          {
            id: "doubao-seed-1-8-251228",
            name: "Doubao Seed 1.8",
            reasoning: false,
            input: ["text"],
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: 128000,
            maxTokens: 32000,
          },
        ],
      },
    },
  },
}
```

## Notes

- Model ref: `volcengine/doubao-seed-1-8-251228`.
- The provider is injected automatically when `VOLCENGINE_API_KEY` is set (or an auth profile exists).
- See [/concepts/model-providers](/concepts/model-providers) for provider rules.
