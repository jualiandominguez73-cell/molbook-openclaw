# Ask Sage Docker Testing

This guide explains how to test the Ask Sage integration in an isolated Docker environment without installing Node.js or pnpm on your host machine.

## Requirements

- Docker (only requirement!)
- Ask Sage API key
- This repository cloned locally

## Quick Start

```bash
# Set your API key
export ASKSAGE_API_KEY="your-api-key-here"

# Run complete test (builds + tests everything)
bash scripts/test-asksage-complete.sh
```

This single command will:
1. Build OpenClaw in a Docker container
2. Create a test Docker image
3. Run onboarding, list models, and test chat

## Step-by-Step Usage

### Option 1: All-in-One (Recommended)

```bash
export ASKSAGE_API_KEY="your-key"
bash scripts/test-asksage-complete.sh
```

### Option 2: Manual Steps

**Step 1: Build OpenClaw (in Docker)**
```bash
bash scripts/docker-build-asksage-openclaw.sh
```

**Step 2: Run Tests**
```bash
export ASKSAGE_API_KEY="your-key"
bash scripts/test-asksage-simple.sh
```

### Option 3: Interactive Testing

**Build the test image:**
```bash
bash scripts/docker-build-asksage-openclaw.sh
docker build -f Dockerfile.asksage-test -t openclaw-asksage-test .
```

**Run interactively:**
```bash
docker run -it --rm \
  --add-host=api.asksage.ai:$(dig +short api.asksage.ai | head -1) \
  -e ASKSAGE_API_KEY="your-key" \
  openclaw-asksage-test bash

# Inside container:
node openclaw.mjs onboard --auth-choice asksage-api-key --non-interactive
node openclaw.mjs models list --provider asksage
node openclaw.mjs agents add asksage-test --workspace /tmp/asksage-workspace --model asksage/aws-bedrock-claude-45-sonnet-gov || echo 'Agent creation failed or already exists'
node openclaw.mjs agent --agent asksage-test --to +15555550123 --message 'Say hello and confirm you are working through Ask Sage. Say which model is currently running' --local --json
```

## Files Created

- `Dockerfile.asksage-test` - Test container definition
- `.dockerignore.asksage-test` - Custom ignore file for test builds
- `scripts/docker-build-asksage-openclaw.sh` - Builds OpenClaw in Docker
- `scripts/docker-build-asksage-openclaw-minimal.sh` - Builds a minimal version of OpenClaw in Docker
- `scripts/test-asksage-simple.sh` - Automated test runner
- `scripts/test-asksage-complete.sh` - Complete build + test
- `scripts/test-asksage-docker.sh` - Setup with proxy (advanced)
- `scripts/test-asksage-proxy.sh` - Filtering proxy (advanced)

## Network Isolation

The simple test approach uses Docker's `--add-host` flag to restrict connectivity to only `api.asksage.ai`. For more advanced network filtering with a proxy, see:

```bash
# Terminal 1: Start proxy
bash scripts/test-asksage-proxy.sh

# Terminal 2: Run tests through proxy
bash scripts/test-asksage-docker.sh
```

## Troubleshooting

### "dist folder not found"
Run `bash scripts/docker-build-asksage-openclaw.sh` first.

### "ASKSAGE_API_KEY not set"
Export your API key: `export ASKSAGE_API_KEY="your-key"`

### "Cannot resolve api.asksage.ai"
Check your DNS resolution or internet connectivity.

### Build errors with node-llama-cpp
This is expected and handled - the build uses `--ignore-scripts` to skip optional native modules.

## What Gets Tested

The automated test script validates:
1. **Onboarding** - Configures Ask Sage provider with API key
2. **Model Discovery** - Lists all available Anthropic models. **Currently not working**
3. **Chat Functionality** - Sends a test message to Google Claude 4 Sonnet

## Clean Up

Remove the Docker image when done:
```bash
docker rmi openclaw-asksage-test
```

Remove the dist folder:
```bash
rm -rf dist
```