#!/usr/bin/env bash
set -euo pipefail

# Simple filtering proxy using socat
# Only allows connections to api.asksage.ai

PROXY_PORT=8888
ASKSAGE_IP=$(dig +short api.asksage.ai | head -1)

if [ -z "$ASKSAGE_IP" ]; then
  echo "Error: Could not resolve api.asksage.ai"
  exit 1
fi

echo "Starting filtering proxy on port $PROXY_PORT"
echo "Allowing only: api.asksage.ai ($ASKSAGE_IP)"
echo "Press Ctrl+C to stop"

# Check if socat is installed
if ! command -v socat &> /dev/null; then
  echo "Error: socat is required but not installed"
  echo "Install with: brew install socat (macOS) or apt-get install socat (Linux)"
  exit 1
fi

# Use socat to forward only to Ask Sage
# This is a simple implementation - for production use a proper filtering proxy
while true; do
  socat TCP4-LISTEN:$PROXY_PORT,reuseaddr,fork \
    TCP4:$ASKSAGE_IP:443 || echo "Connection closed, restarting..."
  sleep 1
done