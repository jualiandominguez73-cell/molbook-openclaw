#!/usr/bin/env bash
set -euo pipefail

echo "=== Ask Sage Docker Test Environment ==="
echo ""

# Build Docker image (builds OpenClaw inside container)
echo "Building Docker test image (this includes building OpenClaw)..."

# Use custom dockerignore for this build
if [ -f .dockerignore.asksage-test ]; then
  cp .dockerignore .dockerignore.bak 2>/dev/null || true
  cp .dockerignore.asksage-test .dockerignore
  trap "mv .dockerignore.bak .dockerignore 2>/dev/null || true" EXIT
fi

docker build -f Dockerfile.asksage-test -t openclaw-asksage-test .

# Check if API key is set
if [ -z "${ASKSAGE_API_KEY:-}" ]; then
  echo "Error: ASKSAGE_API_KEY environment variable not set"
  echo "Set it with: export ASKSAGE_API_KEY='your-key-here'"
  exit 1
fi

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Next steps:"
echo "1. Start the proxy in another terminal:"
echo "   bash scripts/test-asksage-proxy.sh"
echo ""
echo "2. Run the container with:"
echo "   docker run -it --rm \\"
echo "     --add-host=api.asksage.ai:host-gateway \\"
echo "     -e ASKSAGE_API_KEY=\"\$ASKSAGE_API_KEY\" \\"
echo "     -e http_proxy=http://host.docker.internal:8888 \\"
echo "     -e https_proxy=http://host.docker.internal:8888 \\"
echo "     openclaw-asksage-test"
echo ""
echo "3. Inside container, run:"
echo "   node openclaw.mjs onboard --auth-choice asksage-api-key --non-interactive"
echo "   node openclaw.mjs models list --provider asksage"
echo "   node openclaw.mjs agents add asksage-test --workspace /tmp/asksage-workspace --model asksage/aws-bedrock-claude-45-sonnet-gov || echo 'Agent creation failed or already exists'"
echo "   node openclaw.mjs agent --agent asksage-test --to +15555550123 --message 'Say hello and confirm you are working through Ask Sage. Say which model is currently running' --local --json"