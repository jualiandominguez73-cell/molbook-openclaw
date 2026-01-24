---
summary: "Run Clawdbot with Ollama (local LLM runtime)"
read_when:
  - You want to run Clawdbot with local models via Ollama
  - You need Ollama setup and configuration guidance
---
# Ollama

Ollama is a local LLM runtime that makes it easy to run open-source models on your machine. Clawdbot integrates with Ollama's OpenAI-compatible API and **automatically discovers models** installed on your machine.

## Quick start

1) Install Ollama: https://ollama.ai
2) Pull a model:

```bash
ollama pull llama3.3
# or
ollama pull qwen2.5-coder:32b
# or
ollama pull deepseek-r1:32b
```

3) Configure Clawdbot:

```json5
{
  agents: {
    defaults: {
      model: { primary: "ollama/llama3.3" }
    }
  }
}
```

Ollama is automatically detected when running locally (no explicit `models.providers` config needed). All models you've pulled via `ollama pull` are automatically available.

## Model Discovery

Clawdbot automatically detects all models installed on your Ollama instance by querying the `/api/tags` endpoint. You don't need to manually configure models in your config file.

To see what models are available:

```bash
ollama list
clawdbot models list
```

To add a new model, simply pull it with Ollama:

```bash
ollama pull mistral
```

The model will be automatically available in Clawdbot without any configuration changes.

## Recommended models

- **Llama 3.3** (`llama3.3`): General-purpose model with good instruction following
- **Qwen 2.5 Coder 32B** (`qwen2.5-coder:32b`): Specialized for code tasks
- **DeepSeek R1 32B** (`deepseek-r1:32b`): Reasoning-capable model (automatically detected)

## Reasoning Models

Clawdbot automatically detects reasoning models based on their name. Models containing "r1" or "reasoning" in their name are marked as reasoning models and will use extended thinking capabilities.

## Custom base URL

If Ollama runs on a different host/port, you can override the base URL. The models will still be automatically discovered:

```json5
{
  agents: {
    defaults: {
      model: { primary: "ollama/llama3.3" }
    }
  },
  models: {
    mode: "merge",
    providers: {
      ollama: {
        baseUrl: "http://192.168.1.100:11434/v1",
        apiKey: "ollama-local",
        api: "openai-completions"
      }
    }
  }
}
```

## Manual Model Configuration (Advanced)

If you need to override the automatic discovery or add custom model metadata, you can manually configure models:

```json5
{
  models: {
    mode: "merge",
    providers: {
      ollama: {
        baseUrl: "http://127.0.0.1:11434/v1",
        apiKey: "ollama-local",
        api: "openai-completions",
        models: [
          {
            id: "your-model-name",
            name: "Your Custom Model",
            reasoning: false,
            input: ["text"],
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: 128000,
            maxTokens: 8192
          }
        ]
      }
    }
  }
}
```

## Hybrid setup: Ollama + hosted fallback

Keep hosted models available when local fails:

```json5
{
  agents: {
    defaults: {
      model: {
        primary: "ollama/llama3.3",
        fallbacks: ["anthropic/claude-sonnet-4-5"]
      },
      models: {
        "ollama/llama3.3": { alias: "Llama Local" },
        "anthropic/claude-sonnet-4-5": { alias: "Sonnet" }
      }
    }
  }
}
```

## Model capabilities

- **API**: `openai-completions` (OpenAI Chat Completions compatible)
- **Input**: Text only (no built-in vision support through this integration)
- **Reasoning**: Depends on model (DeepSeek R1 supports reasoning mode)
- **Cost**: Free (local inference)

## Hardware requirements

For acceptable performance:
- **Minimum**: 16 GB RAM, M1/M2 Mac or equivalent GPU
- **Recommended**: 32+ GB RAM, M3 Max/Ultra or high-end NVIDIA GPU
- **Best**: 64+ GB RAM, M3 Ultra or multi-GPU setup

Smaller models (7B-13B params) work on modest hardware; larger models (32B+) need serious resources.

## Troubleshooting

### Ollama not responding

Check if Ollama is running:

```bash
ollama list
```

If not, start it:

```bash
ollama serve
```

### Model not found

Pull the model first:

```bash
ollama pull llama3.3
```

### Connection refused

Verify the base URL matches your Ollama instance:

```bash
curl http://127.0.0.1:11434/v1/models
```

## Performance tips

1. Keep models loaded in memory (Ollama caches loaded models)
2. Use quantized models (Q4/Q5) for better speed/memory tradeoff
3. Adjust context window based on your hardware capabilities
4. Consider using smaller models for simple tasks, larger for complex ones

## See also

- [Local models](/gateway/local-models) — General local model guidance
- [Model providers](/concepts/model-providers) — Provider configuration reference
- [Ollama documentation](https://github.com/ollama/ollama) — Official Ollama docs
