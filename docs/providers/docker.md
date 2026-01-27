---
summary: "Run Moltbot with Docker Model Runner (private local LLMs)"
read_when:
  - You want to run Moltbot with local models via Docker Model Runner (DMR)
  - You use Docker Desktop and want to leverage the built-in model runner
---
# Docker Model Runner

Docker Model Runner (DMR) is a private, local AI inference engine built into Docker Desktop and Docker Engine. It allows you to run open-source models like `gpt-oss` and `glm-4.7-flash` with full privacy on your own hardware.

## Quick start

1) **Install Docker Desktop**: Ensure you have the latest version of [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed.

2) **Enable Model Runner**: Open your terminal and enable TCP access for the model runner:

```bash
docker desktop enable model-runner --tcp
```

3) **Pull a model**: Pull a recommended model to your local machine:

```bash
docker model pull gpt-oss
# or
docker model pull glm-4.7-flash
```

4) **Configure Moltbot**: Update your configuration to point to the DMR server's OpenAI-compatible API endpoint (typically `http://localhost:12434/v1`).

```json5
{
  models: {
    providers: {
      docker: {
        baseUrl: "http://localhost:12434/v1",
        apiKey: "docker-dmr", // Any value works as DMR doesn't require a real key
        api: "openai-completions",
        models: [
          {
            id: "gpt-oss",
            name: "GPT OSS",
            contextWindow: 8192,
            maxTokens: 32768
          }
        ]
      }
    }
  },
  agents: {
    defaults: {
      model: { primary: "docker/gpt-oss" }
    }
  }
}
```

## How it works

Moltbot connects to Docker Model Runner via its OpenAI-compatible API. This allows you to leverage powerful local models while maintaining complete data privacy—your prompts and data never leave your machine.

### Key Benefits

- **Privacy**: All inference happens locally on your hardware.
- **Simplicity**: No complex setup; works directly with Docker Desktop.

## Advanced Configuration

### Custom Models

You can repackage and use models with larger context windows or specific capabilities using `docker model pull`. Once pulled, simply add the model ID to your `models` list in the configuration.

### Troubleshooting

- **Connection issues**: Ensure that TCP access is enabled with `docker desktop enable model-runner --tcp`.
- **Port conflicts**: Check if another service (like Ollama) is already using port `12434`.
- **Model availability**: Run `docker model ls` to see your currently installed models.

## See Also

- [Run a Private Personal AI with Moltbot + DMR](https://www.docker.com/blog/moltbot-docker-model-runner-private-personal-ai/) - Official Docker Blog Post
- [Model Providers](/providers/models) - Overview of all supported providers
- [Configuration](/gateway/configuration) - Full config reference
