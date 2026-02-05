---
summary: "Use NVIDIA NIM API for Kimi K2.5, DeepSeek V3.2, MiniMax M2.1, GLM-4.7 and more"
read_when:
  - You want to use NVIDIA NIM LLM models in OpenClaw
  - You need Kimi K2.5, DeepSeek, Qwen, LLaMA, or other models via NVIDIA
title: "NVIDIA NIM"
---

# NVIDIA NIM

NVIDIA NIM provides access to a wide range of state-of-the-art LLM models through an OpenAI-compatible API. Configure the provider and set your default model to `nvidia/moonshotai/kimi-k2-instruct`, `nvidia/deepseek-ai/deepseek-v3.2`, or any other available model.

## Getting started

1. Get your NVIDIA API key from [build.nvidia.com](https://build.nvidia.com/)
2. Set the `NVIDIA_API_KEY` environment variable
3. Configure the provider in your OpenClaw config

```bash
openclaw onboard --auth-choice nvidia-api-key
```

## Available models (complete alphabetical list)

> **Note:** This is the complete list of 150+ models available on NVIDIA's NIM platform as retrieved from the `/v1/models` API endpoint. Models are organized alphabetically by their provider/model ID.

### 0-9

- `nvidia/01-ai/yi-large` - Yi Large by 01-ai

### A

- `nvidia/abacusai/dracarys-llama-3.1-70b-instruct` - Dracarys Llama 3.1 70B Instruct by AbacusAI
- `nvidia/adept/fuyu-8b` - Fuyu 8B by Adept
- `nvidia/ai21labs/jamba-1.5-large-instruct` - Jamba 1.5 Large Instruct by AI21 Labs
- `nvidia/ai21labs/jamba-1.5-mini-instruct` - Jamba 1.5 Mini Instruct by AI21 Labs
- `nvidia/aisingapore/sea-lion-7b-instruct` - Sea Lion 7B Instruct by AI Singapore

### B

- `nvidia/baai/bge-m3` - BGE M3 by BAAI
- `nvidia/baichuan-inc/baichuan2-13b-chat` - Baichuan2 13B Chat by Baichuan Inc
- `nvidia/bigcode/starcoder2-15b` - StarCoder2 15B by BigCode
- `nvidia/bigcode/starcoder2-7b` - StarCoder2 7B by BigCode
- `nvidia/bytedance/seed-oss-36b-instruct` - Seed OSS 36B Instruct by ByteDance

### C

### D

- `nvidia/databricks/dbrx-instruct` - DBRX Instruct by Databricks
- `nvidia/deepseek-ai/deepseek-coder-6.7b-instruct` - DeepSeek Coder 6.7B Instruct
- `nvidia/deepseek-ai/deepseek-r1` - DeepSeek R1 reasoning model
- `nvidia/deepseek-ai/deepseek-r1-0528` - DeepSeek R1 0528
- `nvidia/deepseek-ai/deepseek-r1-distill-llama-8b` - DeepSeek R1 Distill Llama 8B
- `nvidia/deepseek-ai/deepseek-r1-distill-qwen-14b` - DeepSeek R1 Distill Qwen 14B
- `nvidia/deepseek-ai/deepseek-r1-distill-qwen-32b` - DeepSeek R1 Distill Qwen 32B
- `nvidia/deepseek-ai/deepseek-r1-distill-qwen-7b` - DeepSeek R1 Distill Qwen 7B
- `nvidia/deepseek-ai/deepseek-v3.1` - DeepSeek V3.1
- `nvidia/deepseek-ai/deepseek-v3.1-terminus` - DeepSeek V3.1 Terminus
- `nvidia/deepseek-ai/deepseek-v3.2` - DeepSeek V3.2 with reasoning and tool call support

### E

### F

### G

- `nvidia/google/codegemma-1.1-7b` - CodeGemma 1.1 7B by Google
- `nvidia/google/codegemma-7b` - CodeGemma 7B by Google
- `nvidia/google/deplot` - DePlot by Google
- `nvidia/google/gemma-2-27b-it` - Gemma 2 27B Instruct
- `nvidia/google/gemma-2-2b-it` - Gemma 2 2B Instruct
- `nvidia/google/gemma-2-9b-it` - Gemma 2 9B Instruct
- `nvidia/google/gemma-2b` - Gemma 2B
- `nvidia/google/gemma-3-12b-it` - Gemma 3 12B Instruct
- `nvidia/google/gemma-3-1b-it` - Gemma 3 1B Instruct
- `nvidia/google/gemma-3-27b-it` - Gemma 3 27B Instruct
- `nvidia/google/gemma-3-4b-it` - Gemma 3 4B Instruct
- `nvidia/google/gemma-3n-e2b-it` - Gemma 3N E2B Instruct
- `nvidia/google/gemma-3n-e4b-it` - Gemma 3N E4B Instruct
- `nvidia/google/gemma-7b` - Gemma 7B
- `nvidia/google/paligemma` - PaliGemma by Google
- `nvidia/google/recurrentgemma-2b` - RecurrentGemma 2B
- `nvidia/google/shieldgemma-9b` - ShieldGemma 9B
- `nvidia/gotocompany/gemma-2-9b-cpt-sahabatai-instruct` - Gemma 2 9B CPT Sahabatai Instruct by GoToCompany

### H

### I

- `nvidia/ibm/granite-3.0-3b-a800m-instruct` - IBM Granite 3.0 3B A800M Instruct
- `nvidia/ibm/granite-3.0-8b-instruct` - IBM Granite 3.0 8B Instruct
- `nvidia/ibm/granite-3.3-8b-instruct` - IBM Granite 3.3 8B Instruct
- `nvidia/ibm/granite-34b-code-instruct` - IBM Granite 34B Code Instruct
- `nvidia/ibm/granite-8b-code-instruct` - IBM Granite 8B Code Instruct
- `nvidia/ibm/granite-guardian-3.0-8b` - IBM Granite Guardian 3.0 8B
- `nvidia/igenius/colosseum_355b_instruct_16k` - iGenius Colosseum 355B Instruct 16K
- `nvidia/igenius/italia_10b_instruct_16k` - iGenius Italia 10B Instruct 16K
- `nvidia/institute-of-science-tokyo/llama-3.1-swallow-70b-instruct-v0.1` - Llama 3.1 Swallow 70B Instruct
- `nvidia/institute-of-science-tokyo/llama-3.1-swallow-8b-instruct-v0.1` - Llama 3.1 Swallow 8B Instruct

### J

### K

### L

- `nvidia/marin/marin-8b-instruct` - Marin 8B Instruct by Marin
- `nvidia/mediatek/breeze-7b-instruct` - Breeze 7B Instruct by MediaTek
- `nvidia/meta/codellama-70b` - CodeLlama 70B by Meta
- `nvidia/meta/llama-3.1-405b-instruct` - Llama 3.1 405B Instruct
- `nvidia/meta/llama-3.1-70b-instruct` - Llama 3.1 70B Instruct
- `nvidia/meta/llama-3.1-8b-instruct` - Llama 3.1 8B Instruct
- `nvidia/meta/llama-3.2-11b-vision-instruct` - Llama 3.2 11B Vision Instruct
- `nvidia/meta/llama-3.2-1b-instruct` - Llama 3.2 1B Instruct
- `nvidia/meta/llama-3.2-3b-instruct` - Llama 3.2 3B Instruct
- `nvidia/meta/llama-3.2-90b-vision-instruct` - Llama 3.2 90B Vision Instruct
- `nvidia/meta/llama-3.3-70b-instruct` - Llama 3.3 70B Instruct
- `nvidia/meta/llama-4-maverick-17b-128e-instruct` - Llama 4 Maverick 17B 128E Instruct
- `nvidia/meta/llama-4-scout-17b-16e-instruct` - Llama 4 Scout 17B 16E Instruct
- `nvidia/meta/llama-guard-4-12b` - Llama Guard 4 12B
- `nvidia/meta/llama2-70b` - Llama 2 70B
- `nvidia/meta/llama3-70b-instruct` - Llama 3 70B Instruct
- `nvidia/meta/llama3-8b-instruct` - Llama 3 8B Instruct

### M

- `nvidia/microsoft/kosmos-2` - Kosmos 2 by Microsoft
- `nvidia/microsoft/phi-3-medium-128k-instruct` - Phi-3 Medium 128K Instruct
- `nvidia/microsoft/phi-3-medium-4k-instruct` - Phi-3 Medium 4K Instruct
- `nvidia/microsoft/phi-3-mini-128k-instruct` - Phi-3 Mini 128K Instruct
- `nvidia/microsoft/phi-3-mini-4k-instruct` - Phi-3 Mini 4K Instruct
- `nvidia/microsoft/phi-3-small-128k-instruct` - Phi-3 Small 128K Instruct
- `nvidia/microsoft/phi-3-small-8k-instruct` - Phi-3 Small 8K Instruct
- `nvidia/microsoft/phi-3-vision-128k-instruct` - Phi-3 Vision 128K Instruct
- `nvidia/microsoft/phi-3.5-mini-instruct` - Phi-3.5 Mini Instruct
- `nvidia/microsoft/phi-3.5-moe-instruct` - Phi-3.5 MoE Instruct
- `nvidia/microsoft/phi-3.5-vision-instruct` - Phi-3.5 Vision Instruct
- `nvidia/microsoft/phi-4-mini-flash-reasoning` - Phi-4 Mini Flash Reasoning
- `nvidia/microsoft/phi-4-mini-instruct` - Phi-4 Mini Instruct
- `nvidia/microsoft/phi-4-multimodal-instruct` - Phi-4 Multimodal Instruct
- `nvidia/minimaxai/minimax-m2` - MiniMax M2
- `nvidia/minimaxai/minimax-m2.1` - MiniMax M2.1 with advanced reasoning capabilities
- `nvidia/mistralai/codestral-22b-instruct-v0.1` - Codestral 22B Instruct v0.1
- `nvidia/mistralai/devstral-2-123b-instruct-2512` - Devstral 2 123B Instruct 2512
- `nvidia/mistralai/magistral-small-2506` - Magistral Small 2506
- `nvidia/mistralai/mamba-codestral-7b-v0.1` - Mamba Codestral 7B v0.1
- `nvidia/mistralai/mathstral-7b-v0.1` - Mathstral 7B v0.1
- `nvidia/mistralai/ministral-14b-instruct-2512` - Ministral 14B Instruct 2512
- `nvidia/mistralai/mistral-7b-instruct-v0.2` - Mistral 7B Instruct v0.2
- `nvidia/mistralai/mistral-7b-instruct-v0.3` - Mistral 7B Instruct v0.3
- `nvidia/mistralai/mistral-large` - Mistral Large
- `nvidia/mistralai/mistral-large-2-instruct` - Mistral Large 2 Instruct
- `nvidia/mistralai/mistral-large-3-675b-instruct-2512` - Mistral Large 3 675B Instruct 2512
- `nvidia/mistralai/mistral-medium-3-instruct` - Mistral Medium 3 Instruct
- `nvidia/mistralai/mistral-nemotron` - Mistral Nemotron
- `nvidia/mistralai/mistral-small-24b-instruct` - Mistral Small 24B Instruct
- `nvidia/mistralai/mistral-small-3.1-24b-instruct-2503` - Mistral Small 3.1 24B Instruct 2503
- `nvidia/mistralai/mixtral-8x22b-instruct-v0.1` - Mixtral 8x22B Instruct v0.1
- `nvidia/mistralai/mixtral-8x22b-v0.1` - Mixtral 8x22B v0.1
- `nvidia/mistralai/mixtral-8x7b-instruct-v0.1` - Mixtral 8x7B Instruct v0.1
- `nvidia/moonshotai/kimi-k2-instruct` - Kimi K2 Instruct (multimodal, 1T parameters, 32B active)
- `nvidia/moonshotai/kimi-k2-instruct-0905` - Kimi K2 Instruct 0905
- `nvidia/moonshotai/kimi-k2-thinking` - Kimi K2 Thinking (reasoning model)

### N

- `nvidia/nv-mistralai/mistral-nemo-12b-instruct` - Mistral Nemo 12B Instruct by NV-MistralAI
- `nvidia/nvidia/cosmos-reason2-8b` - Cosmos Reason2 8B by NVIDIA
- `nvidia/nvidia/embed-qa-4` - Embed QA 4 by NVIDIA
- `nvidia/nvidia/llama-3.1-nemoguard-8b-content-safety` - Llama 3.1 NemoGuard 8B Content Safety
- `nvidia/nvidia/llama-3.1-nemoguard-8b-topic-control` - Llama 3.1 NemoGuard 8B Topic Control
- `nvidia/nvidia/llama-3.1-nemotron-51b-instruct` - Llama 3.1 Nemotron 51B Instruct
- `nvidia/nvidia/llama-3.1-nemotron-70b-instruct` - Llama 3.1 Nemotron 70B Instruct
- `nvidia/nvidia/llama-3.1-nemotron-70b-reward` - Llama 3.1 Nemotron 70B Reward
- `nvidia/nvidia/llama-3.1-nemotron-nano-4b-v1.1` - Llama 3.1 Nemotron Nano 4B v1.1
- `nvidia/nvidia/llama-3.1-nemotron-nano-8b-v1` - Llama 3.1 Nemotron Nano 8B v1
- `nvidia/nvidia/llama-3.1-nemotron-nano-vl-8b-v1` - Llama 3.1 Nemotron Nano VL 8B v1 (Vision)
- `nvidia/nvidia/llama-3.1-nemotron-safety-guard-8b-v3` - Llama 3.1 Nemotron Safety Guard 8B v3
- `nvidia/nvidia/llama-3.1-nemotron-ultra-253b-v1` - Llama 3.1 Nemotron Ultra 253B v1
- `nvidia/nvidia/llama-3.2-nemoretriever-1b-vlm-embed-v1` - Llama 3.2 NemoRetriever 1B VLM Embed v1
- `nvidia/nvidia/llama-3.2-nemoretriever-300m-embed-v1` - Llama 3.2 NemoRetriever 300M Embed v1
- `nvidia/nvidia/llama-3.2-nemoretriever-300m-embed-v2` - Llama 3.2 NemoRetriever 300M Embed v2
- `nvidia/nvidia/llama-3.2-nv-embedqa-1b-v1` - Llama 3.2 NV EmbedQA 1B v1
- `nvidia/nvidia/llama-3.2-nv-embedqa-1b-v2` - Llama 3.2 NV EmbedQA 1B v2
- `nvidia/nvidia/llama-3.3-nemotron-super-49b-v1` - Llama 3.3 Nemotron Super 49B v1
- `nvidia/nvidia/llama-3.3-nemotron-super-49b-v1.5` - Llama 3.3 Nemotron Super 49B v1.5
- `nvidia/nvidia/llama3-chatqa-1.5-70b` - Llama 3 ChatQA 1.5 70B
- `nvidia/nvidia/llama3-chatqa-1.5-8b` - Llama 3 ChatQA 1.5 8B
- `nvidia/nvidia/mistral-nemo-minitron-8b-8k-instruct` - Mistral Nemo Minitron 8B 8K Instruct
- `nvidia/nvidia/mistral-nemo-minitron-8b-base` - Mistral Nemo Minitron 8B Base
- `nvidia/nvidia/nemoretriever-parse` - NemoRetriever Parse by NVIDIA
- `nvidia/nvidia/nemotron-3-nano-30b-a3b` - Nemotron 3 Nano 30B A3B
- `nvidia/nvidia/nemotron-4-340b-instruct` - Nemotron 4 340B Instruct
- `nvidia/nvidia/nemotron-4-340b-reward` - Nemotron 4 340B Reward
- `nvidia/nvidia/nemotron-4-mini-hindi-4b-instruct` - Nemotron 4 Mini Hindi 4B Instruct
- `nvidia/nvidia/nemotron-mini-4b-instruct` - Nemotron Mini 4B Instruct
- `nvidia/nvidia/nemotron-nano-12b-v2-vl` - Nemotron Nano 12B v2 VL (Vision)
- `nvidia/nvidia/nemotron-nano-3-30b-a3b` - Nemotron Nano 3 30B A3B
- `nvidia/nvidia/nemotron-parse` - Nemotron Parse by NVIDIA
- `nvidia/nvidia/neva-22b` - Neva 22B by NVIDIA
- `nvidia/nvidia/nv-embed-v1` - NV Embed v1
- `nvidia/nvidia/nv-embedcode-7b-v1` - NV EmbedCode 7B v1
- `nvidia/nvidia/nv-embedqa-e5-v5` - NV EmbedQA E5 v5
- `nvidia/nvidia/nv-embedqa-mistral-7b-v2` - NV EmbedQA Mistral 7B v2
- `nvidia/nvidia/nvclip` - NV-CLIP by NVIDIA
- `nvidia/nvidia/nvidia-nemotron-nano-9b-v2` - NVIDIA Nemotron Nano 9B v2
- `nvidia/nvidia/riva-translate-4b-instruct` - Riva Translate 4B Instruct
- `nvidia/nvidia/riva-translate-4b-instruct-v1.1` - Riva Translate 4B Instruct v1.1
- `nvidia/nvidia/streampetr` - StreamPETR by NVIDIA
- `nvidia/nvidia/usdcode-llama-3.1-70b-instruct` - USDCode Llama 3.1 70B Instruct
- `nvidia/nvidia/vila` - VILA by NVIDIA

### O

- `nvidia/openai/gpt-oss-120b` - GPT-OSS 120B by OpenAI
- `nvidia/opengpt-x/teuken-7b-instruct-commercial-v0.4` - Teuken 7B Instruct Commercial v0.4 by OpenGPT-X

### P

### Q

- `nvidia/qwen/qwen2-7b-instruct` - Qwen 2 7B Instruct
- `nvidia/qwen/qwen2.5-7b-instruct` - Qwen 2.5 7B Instruct
- `nvidia/qwen/qwen2.5-coder-32b-instruct` - Qwen 2.5 Coder 32B Instruct
- `nvidia/qwen/qwen2.5-coder-7b-instruct` - Qwen 2.5 Coder 7B Instruct
- `nvidia/qwen/qwen3-235b-a22b` - Qwen 3 235B A22B
- `nvidia/qwen/qwen3-coder-480b-a35b-instruct` - Qwen 3 Coder 480B A35B Instruct
- `nvidia/qwen/qwen3-next-80b-a3b-instruct` - Qwen 3 Next 80B A3B Instruct
- `nvidia/qwen/qwen3-next-80b-a3b-thinking` - Qwen 3 Next 80B A3B Thinking (reasoning)
- `nvidia/qwen/qwq-32b` - QwQ 32B

### R

- `nvidia/rakuten/rakutenai-7b-chat` - RakutenAI 7B Chat
- `nvidia/rakuten/rakutenai-7b-instruct` - RakutenAI 7B Instruct

### S

- `nvidia/sarvamai/sarvam-m` - Sarvam M by SarvamAI
- `nvidia/snowflake/arctic-embed-l` - Arctic Embed L by Snowflake
- `nvidia/speakleash/bielik-11b-v2.3-instruct` - Bielik 11B v2.3 Instruct
- `nvidia/speakleash/bielik-11b-v2.6-instruct` - Bielik 11B v2.6 Instruct
- `nvidia/stockmark/stockmark-2-100b-instruct` - Stockmark 2 100B Instruct

### T

- `nvidia/thudm/chatglm3-6b` - ChatGLM3 6B by Tsinghua University
- `nvidia/tiiuae/falcon3-7b-instruct` - Falcon 3 7B Instruct by TII UAE
- `nvidia/tokyotech-llm/llama-3-swallow-70b-instruct-v0.1` - Llama 3 Swallow 70B Instruct

### U

- `nvidia/upstage/solar-10.7b-instruct` - Solar 10.7B Instruct
- `nvidia/utter-project/eurollm-9b-instruct` - Eurollm 9B Instruct

### V

### W

- `nvidia/writer/palmyra-creative-122b` - Palmyra Creative 122B
- `nvidia/writer/palmyra-fin-70b-32k` - Palmyra Fin 70B 32K
- `nvidia/writer/palmyra-med-70b` - Palmyra Med 70B
- `nvidia/writer/palmyra-med-70b-32k` - Palmyra Med 70B 32K

### X

### Y

- `nvidia/yentinglin/llama-3-taiwan-70b-instruct` - Llama 3 Taiwan 70B Instruct

### Z

- `nvidia/z-ai/glm4.7` - GLM-4.7 by Z.AI
- `nvidia/zyphra/zamba2-7b-instruct` - Zamba2 7B Instruct

---

## Config snippet

```json5
{
  env: { NVIDIA_API_KEY: "nvapi-..." },
  agents: {
    defaults: {
      model: { primary: "nvidia/moonshotai/kimi-k2-instruct" },
      models: {
        // Popular models aliases
        "nvidia/moonshotai/kimi-k2-instruct": { alias: "Kimi K2.5" },
        "nvidia/deepseek-ai/deepseek-v3.2": { alias: "DeepSeek V3.2" },
        "nvidia/meta/llama-3.3-70b-instruct": { alias: "Llama 3.3 70B" },
        "nvidia/z-ai/glm4.7": { alias: "GLM-4.7" },
        "nvidia/minimaxai/minimax-m2.1": { alias: "MiniMax M2.1" },
      },
    },
  },
  models: {
    mode: "merge",
    providers: {
      nvidia: {
        baseUrl: "https://integrate.api.nvidia.com/v1",
        apiKey: "${NVIDIA_API_KEY}",
        api: "openai-completions",
        models: [
          // Kimi K2 Instruct - Multimodal MoE (1T params, 32B active)
          {
            id: "moonshotai/kimi-k2-instruct",
            name: "Kimi K2 Instruct",
            reasoning: true,
            input: ["text", "image", "video"],
            cost: { input: 0.0001, output: 0.0001, cacheRead: 0, cacheWrite: 0 },
            contextWindow: 256000,
            maxTokens: 8192,
          },
          // DeepSeek V3.2
          {
            id: "deepseek-ai/deepseek-v3.2",
            name: "DeepSeek V3.2",
            reasoning: true,
            input: ["text"],
            cost: { input: 0.28, output: 0.4, cacheRead: 0, cacheWrite: 0 },
            contextWindow: 163840,
            maxTokens: 65536,
          },
          // MiniMax M2.1
          {
            id: "minimaxai/minimax-m2.1",
            name: "MiniMax M2.1",
            reasoning: true,
            input: ["text"],
            cost: { input: 0.3, output: 1.2, cacheRead: 0, cacheWrite: 0 },
            contextWindow: 204800,
            maxTokens: 131072,
          },
          // GLM-4.7
          {
            id: "z-ai/glm4.7",
            name: "GLM-4.7",
            reasoning: false,
            input: ["text"],
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: 128000,
            maxTokens: 8192,
          },
          // Llama 3.3 70B
          {
            id: "meta/llama-3.3-70b-instruct",
            name: "Llama 3.3 70B Instruct",
            reasoning: false,
            input: ["text"],
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: 131072,
            maxTokens: 8192,
          },
        ],
      },
    },
  },
}
```

## Notes

- NVIDIA model refs use `nvidia/<modelId>` format
- The NVIDIA NIM API is OpenAI-compatible (`openai-completions`)
- Some models support extended context windows up to 256K tokens
- Kimi K2.5 supports multimodal input (text, images, video)
- Reasoning models (DeepSeek V3.2, Kimi K2.5, MiniMax M2.1) have advanced thinking capabilities
- Pricing varies by model - check [build.nvidia.com](https://build.nvidia.com/) for current rates
- The base URL `https://integrate.api.nvidia.com/v1` provides unified access to all models
- **This list is dynamically generated from NVIDIA's `/v1/models` API endpoint**

## Model families available

- **01-ai**: Yi Large
- **AbacusAI**: Dracarys Llama models
- **AI21 Labs**: Jamba 1.5 models
- **ByteDance**: Seed OSS models
- **Databricks**: DBRX Instruct
- **DeepSeek**: Advanced reasoning models (V3.1, V3.2, R1 series, Coder)
- **Google**: Gemma 2 & 3 family, CodeGemma, PaliGemma, ShieldGemma
- **IBM**: Granite 3.0 & 3.3, Guardian
- **iGenius**: Colosseum, Italia models
- **Meta**: Llama 3.x, Llama 4, CodeLlama, Llama Guard
- **Microsoft**: Phi-3 & Phi-4 family, Kosmos
- **MiniMax**: M2 & M2.1 reasoning models
- **MistralAI**: Mistral Large/Small, Mixtral, Codestral, Mathstral
- **MoonshotAI**: Kimi K2 Instruct & Thinking
- **NVIDIA**: Nemotron series, NemoRetriever, Embed models, VILA
- **OpenAI**: GPT-OSS models
- **Qwen**: Qwen 2.5, 3 Next, QwQ reasoning, Coder
- **RakutenAI**: RakutenAI 7B
- **Snowflake**: Arctic Embed
- **Upstage**: Solar models
- **Writer**: Palmyra family (Creative, Fin, Med)
- **Z.AI**: GLM-4.7
- **Zyphra**: Zamba2

See [build.nvidia.com/models](https://build.nvidia.com/models) for the complete catalog with details on each model.
