# BlockRun Extension

Smart LLM router that saves 63% on inference costs. Routes every request to the cheapest model that can handle it across 30+ models from OpenAI, Anthropic, Google, DeepSeek, and xAI.

## Setup

```bash
# Set wallet key (or let the plugin auto-generate one)
export BLOCKRUN_WALLET_KEY=0x...

# Enable smart routing
openclaw config set model blockrun/auto
```

## How It Works

- Hybrid rules-first classifier handles ~80% of requests in <1ms
- LLM fallback for ambiguous cases (~$0.00003 per classification)
- Payment via x402 USDC micropayments on Base — non-custodial
- Local proxy between OpenClaw and BlockRun API

## Links

- npm: [@blockrun/clawrouter](https://www.npmjs.com/package/@blockrun/clawrouter)
- GitHub: [BlockRunAI/ClawRouter](https://github.com/BlockRunAI/ClawRouter)
- x402: [x402.org](https://x402.org)
