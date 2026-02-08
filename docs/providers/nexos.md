---
summary: "Use Nexos.ai Gateway in OpenClaw"
read_when:
  - You want to use Nexos.ai as a model provider
  - You need Nexos.ai setup guidance
title: "Nexos.ai"
---

# Nexos.ai

Nexos provides an OpenAI‑compatible gateway API. Configure it as a provider and
point OpenClaw at your Nexos Gateway base URL.

## Quick setup (API key)

```json5
{
  env: { NEXOS_API_KEY: "sk-..." },
  agents: {
    defaults: { model: { primary: "nexos/<model-id>" } },
  },
  models: {
    mode: "merge",
    providers: {
      nexos: {
        baseUrl: "https://api.nexos.ai/v1",
        apiKey: "${NEXOS_API_KEY}",
        api: "openai-completions",
        models: [
          {
            id: "<model-id>",
            name: "Nexos Model",
            reasoning: false,
            input: ["text"],
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: 128000,
            maxTokens: 8192,
          },
        ],
      },
    },
  },
}
```

## Notes

- Replace `<model-id>` with the Nexos model ID you want to expose.
- If Nexos issues OAuth tokens, prefer a provider auth plugin to mint bearer tokens and store them in auth profiles.
