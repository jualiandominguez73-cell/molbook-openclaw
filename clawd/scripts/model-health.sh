#!/usr/bin/env bash
# Model Health Check Script v1.0
# Run: daily during debug mode, or manually
# Usage: ./model-health.sh [--quick|--full]
#
# Tests all configured model endpoints to verify they respond correctly.
# Debug mode addition - revert after 2026-02-10

set -euo pipefail

# Colors
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

MODE="${1:---full}"
FAILED=0
PASSED=0

echo "=========================================="
echo "Model Health Check - $(date '+%Y-%m-%d %H:%M')"
echo "Mode: $MODE"
echo "=========================================="

# === 1. OLLAMA MODELS ===
echo -e "\n${BLUE}--- 1. Ollama Models (Local) ---${NC}"

OLLAMA_HOST="172.26.0.1:11434"

# Check Ollama is running
if ! curl -sf "http://$OLLAMA_HOST/api/tags" >/dev/null 2>&1; then
    echo -e "${RED}[CRITICAL] Ollama not responding at $OLLAMA_HOST${NC}"
    FAILED=$((FAILED + 1))
else
    echo -e "${GREEN}[OK] Ollama API responding${NC}"
    PASSED=$((PASSED + 1))
    
    # Test glm-4.7-flash (primary local model)
    echo -n "Testing glm-4.7-flash... "
    RESPONSE=$(curl -sf "http://$OLLAMA_HOST/api/generate" \
        -d '{"model":"glm-4.7-flash","prompt":"Reply with OK","stream":false}' \
        --max-time 30 2>&1 || echo "TIMEOUT")
    
    if echo "$RESPONSE" | grep -q "response"; then
        echo -e "${GREEN}OK${NC}"
        PASSED=$((PASSED + 1))
    else
        echo -e "${RED}FAILED${NC}"
        FAILED=$((FAILED + 1))
    fi
    
    # Test qwen3-vl:4b (vision model)
    if [ "$MODE" = "--full" ]; then
        echo -n "Testing qwen3-vl:4b... "
        RESPONSE=$(curl -sf "http://$OLLAMA_HOST/api/generate" \
            -d '{"model":"qwen3-vl:4b","prompt":"Reply with OK","stream":false}' \
            --max-time 30 2>&1 || echo "TIMEOUT")
        
        if echo "$RESPONSE" | grep -q "response"; then
            echo -e "${GREEN}OK${NC}"
            PASSED=$((PASSED + 1))
        else
            echo -e "${YELLOW}WARN (may need loading)${NC}"
        fi
        
        # Test lfm2.5-thinking:1.2b (fast thinking model)
        echo -n "Testing lfm2.5-thinking:1.2b... "
        RESPONSE=$(curl -sf "http://$OLLAMA_HOST/api/generate" \
            -d '{"model":"lfm2.5-thinking:1.2b","prompt":"Reply with OK","stream":false}' \
            --max-time 30 2>&1 || echo "TIMEOUT")
        
        if echo "$RESPONSE" | grep -q "response"; then
            echo -e "${GREEN}OK${NC}"
            PASSED=$((PASSED + 1))
        else
            echo -e "${YELLOW}WARN (may need loading)${NC}"
        fi
    fi
fi

# === 2. ZAI CLOUD MODEL ===
echo -e "\n${BLUE}--- 2. ZAI Cloud Model ---${NC}"

# Check ZAI API key exists
if [ -z "${ZAI_API_KEY:-}" ]; then
    # Try to load from profile
    source ~/.profile 2>/dev/null || true
fi

if [ -z "${ZAI_API_KEY:-}" ]; then
    echo -e "${YELLOW}[WARN] ZAI_API_KEY not set - skipping ZAI test${NC}"
else
    echo -n "Testing zai/glm-4.7... "
    
    RESPONSE=$(curl -sf "https://api.z.ai/api/coding/paas/v4/chat/completions" \
        -H "Authorization: Bearer $ZAI_API_KEY" \
        -H "Content-Type: application/json" \
        -d '{"model":"glm-4.7","messages":[{"role":"user","content":"Reply with OK"}],"max_tokens":10}' \
        --max-time 30 2>&1 || echo "TIMEOUT")
    
    if echo "$RESPONSE" | grep -q "choices"; then
        echo -e "${GREEN}OK${NC}"
        PASSED=$((PASSED + 1))
    elif echo "$RESPONSE" | grep -q "TIMEOUT"; then
        echo -e "${RED}TIMEOUT${NC}"
        FAILED=$((FAILED + 1))
    else
        echo -e "${RED}FAILED${NC}"
        FAILED=$((FAILED + 1))
    fi
fi

# === 3. GATEWAY MODEL ACCESS ===
echo -e "\n${BLUE}--- 3. Gateway Model Access ---${NC}"

# Check if gateway can reach models via clawdbot
if command -v npm &>/dev/null; then
    echo -n "Testing gateway model routing... "
    
    # Quick test via memory search (uses model)
    if npm exec --prefix /home/liam -- clawdbot memory search "test" --agent liam-telegram 2>&1 | grep -qE "^[0-9]\.[0-9]"; then
        echo -e "${GREEN}OK${NC}"
        PASSED=$((PASSED + 1))
    else
        echo -e "${YELLOW}WARN (memory search not responding)${NC}"
    fi
fi

# === SUMMARY ===
echo -e "\n=========================================="
echo "MODEL HEALTH SUMMARY"
echo "=========================================="
echo -e "Passed: ${GREEN}$PASSED${NC} | Failed: ${RED}$FAILED${NC}"

if [ $FAILED -gt 0 ]; then
    echo -e "\n${RED}ACTION REQUIRED: $FAILED model(s) not responding${NC}"
    echo "Check: Ollama service, ZAI API key, network connectivity"
    exit 1
else
    echo -e "\n${GREEN}All models healthy${NC}"
    exit 0
fi
