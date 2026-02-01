---
summary: "Use Mistral AI models in OpenClaw with API key authentication"
read_when:
  - You want to use Mistral models in OpenClaw
  - You need to configure Mistral API credentials
title: "Mistral AI"
---

# Mistral AI

Mistral AI provides powerful open-weight and commercial language models. OpenClaw supports Mistral as a built-in provider with API key authentication.

## Quick start

### Option A: CLI paste-token (recommended)

If you have an API key from the [Mistral Console](https://console.mistral.ai/api-keys/):

```bash
openclaw models auth paste-token --provider mistral
# Paste your Mistral API key when prompted
```

### Option B: Environment variable

Set the `MISTRAL_API_KEY` environment variable:

```bash
export MISTRAL_API_KEY="your-api-key-here"
```

Or add it to your `openclaw.json`:

```json5
{
  env: { MISTRAL_API_KEY: "your-api-key-here" },
  agents: { defaults: { model: { primary: "mistral/mistral-large-latest" } } },
}
```

## Configuration

### Config snippet

```json5
{
  agents: { defaults: { model: { primary: "mistral/mistral-large-latest" } } },
}
```

### Available models

Mistral offers several model tiers:

| Model ID                | Description          | Use case                      |
| ----------------------- | -------------------- | ----------------------------- |
| `mistral-large-latest`  | Most capable model   | Complex reasoning, coding     |
| `mistral-medium-latest` | Balanced performance | General tasks                 |
| `mistral-small-latest`  | Fast and efficient   | Simple tasks, high throughput |
| `codestral-latest`      | Code-specialized     | Code generation, completion   |
| `mistral-embed`         | Embeddings           | Semantic search, RAG          |

Example with a specific model:

```json5
{
  agents: {
    defaults: {
      model: { primary: "mistral/codestral-latest" },
    },
  },
}
```

## CLI commands

```bash
# Set Mistral as default model
openclaw models set mistral/mistral-large-latest

# Check authentication status
openclaw models status

# List available models
openclaw models list --provider mistral
```

## Getting an API key

1. Create an account at [console.mistral.ai](https://console.mistral.ai)
2. Navigate to **API Keys** in the left sidebar
3. Click **Create new key**
4. Copy the key and use one of the setup methods above

## Troubleshooting

**No API key found for provider "mistral"**

- Ensure you've configured auth using one of the methods above.
- Run `openclaw models status` to verify authentication.
- Check that `MISTRAL_API_KEY` is set if using environment variables.

**401 Unauthorized errors**

- Verify your API key is correct and not expired.
- Check your Mistral account has available credits.
- Re-run `openclaw models auth paste-token --provider mistral`.

**Model not found**

- Run `openclaw models list --provider mistral` to see available models.
- Ensure you're using the correct model ID format: `mistral/<model-id>`.

More: [Model providers](/concepts/model-providers) and [/help/faq](/help/faq).
