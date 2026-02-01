---
summary: "Use Mistral AI models with OpenClaw"
read_when:
  - You want Mistral models in OpenClaw
  - You need MISTRAL_API_KEY setup
title: "Mistral"
---

# Mistral

Mistral AI provides powerful open-weight and proprietary models via their API platform.
Create your API key at [console.mistral.ai](https://console.mistral.ai).

## CLI setup

```bash
openclaw models auth paste-token --provider mistral
```

You will be prompted to paste your Mistral API key.

## Config snippet

```json5
{
  env: { MISTRAL_API_KEY: "..." },
  agents: { defaults: { model: { primary: "mistral/mistral-large-latest" } } },
}
```

## Available models

Common Mistral model IDs:

- `mistral/mistral-large-latest` - Flagship model
- `mistral/mistral-medium-latest` - Balanced performance
- `mistral/mistral-small-latest` - Fast and efficient
- `mistral/codestral-latest` - Code-optimized
- `mistral/open-mistral-nemo` - Open-weight model

## Notes

- Model refs use `mistral/<model-id>` format.
- Mistral uses Bearer auth with your API key.
- For model selection and failover config, see [/concepts/models](/concepts/models).
