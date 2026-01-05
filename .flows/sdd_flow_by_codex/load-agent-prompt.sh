#!/bin/bash

################################################################################
# Agent Prompt Loader
# 
# Purpose: Load agent prompts from external YAML files
# Usage: ./load-agent-prompt.sh --agent <agent-name>
#        ./load-agent-prompt.sh --list
################################################################################

set -e

# Colors
BLUE='\033[0;34m'
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PROMPTS_DIR="$(dirname "$0")/prompts"
REGISTRY_FILE="$PROMPTS_DIR/agent-registry.yaml"

# Check if required tools are available
check_dependencies() {
    if ! command -v yq &> /dev/null; then
        echo -e "${RED}Error: yq not found${NC}"
        echo "Install yq: https://github.com/mikefarah/yq"
        echo "On macOS: brew install yq"
        echo "On Ubuntu: snap install yq"
        exit 1
    fi
}

# List all available agents
list_agents() {
    echo -e "${BLUE}Available Agents:${NC}"
    echo "=================="
    
    if [ ! -f "$REGISTRY_FILE" ]; then
        echo -e "${RED}Error: Registry file not found: $REGISTRY_FILE${NC}"
        exit 1
    fi
    
    agents=$(yq -r '.agents | keys | .[]' "$REGISTRY_FILE" 2>/dev/null || true)
    
    if [ -z "$agents" ]; then
        echo -e "${YELLOW}No agents found in registry${NC}"
        exit 0
    fi
    
    while IFS= read -r agent; do
        description=$(yq -r ".agents.\"$agent\".description" "$REGISTRY_FILE" 2>/dev/null || true)
        category=$(yq -r ".agents.\"$agent\".category" "$REGISTRY_FILE" 2>/dev/null || true)
        version=$(yq -r ".agents.\"$agent\".version" "$REGISTRY_FILE" 2>/dev/null || true)
        
        echo -e "${GREEN}  $agent${NC}"
        echo "    Version: $version"
        echo "    Category: $category"
        echo "    Description: $description"
        echo ""
    done <<< "$agents"
}

# Get agent file path
get_agent_file() {
    local agent_name="$1"
    
    if [ -z "$agent_name" ]; then
        echo -e "${RED}Error: Agent name not specified${NC}"
        exit 1
    fi
    
    agent_file=$(yq -r ".agents.\"$agent_name\".file" "$REGISTRY_FILE" 2>/dev/null || true)
    
    if [ -z "$agent_file" ] || [ "$agent_file" = "null" ]; then
        echo -e "${RED}Error: Agent '$agent_name' not found in registry${NC}"
        exit 1
    fi
    
    # Return full path
    echo "$PROMPTS_DIR/$agent_file"
}

# Load agent prompt
load_agent_prompt() {
    local agent_name="$1"
    local format="${2:-yaml}"  # yaml or json
    
    agent_file=$(get_agent_file "$agent_name")
    
    if [ ! -f "$agent_file" ]; then
        echo -e "${RED}Error: Agent file not found: $agent_file${NC}"
        exit 1
    fi
    
    echo -e "${BLUE}Loading agent: $agent_name${NC}"
    echo -e "${BLUE}Source: $agent_file${NC}"
    echo ""
    
    case "$format" in
        yaml)
            cat "$agent_file"
            ;;
        json)
            # Convert YAML to JSON
            yq eval -j "$agent_file"
            ;;
        raw)
            # Output just the prompt content (for embedding)
            yq eval '.prompt' "$agent_file" 2>/dev/null || \
            yq eval '.personality' "$agent_file"
            ;;
        *)
            echo -e "${RED}Error: Invalid format: $format${NC}"
            echo "Supported formats: yaml, json, raw"
            exit 1
            ;;
    esac
}

# Validate agent prompt
validate_agent() {
    local agent_name="$1"
    
    agent_file=$(get_agent_file "$agent_name")
    
    echo -e "${BLUE}Validating agent: $agent_name${NC}"
    echo -e "${BLUE}File: $agent_file${NC}"
    echo ""
    
    # Check required fields
    required_fields=("name" "description" "personality" "primary_directive")
    all_valid=true
    
    for field in "${required_fields[@]}"; do
        value=$(yq -r ".$field" "$agent_file" 2>/dev/null || true)
        if [ -z "$value" ] || [ "$value" = "null" ]; then
            echo -e "${RED}✗ Missing required field: $field${NC}"
            all_valid=false
        else
            echo -e "${GREEN}✓ $field present${NC}"
        fi
    done
    
    # Check file exists
    if [ -f "$agent_file" ]; then
        echo -e "${GREEN}✓ File exists${NC}"
    else
        echo -e "${RED}✗ File not found${NC}"
        all_valid=false
    fi
    
    # Check YAML syntax
    if yq -r "$agent_file" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Valid YAML syntax${NC}"
    else
        echo -e "${RED}✗ Invalid YAML syntax${NC}"
        all_valid=false
    fi
    
    if [ "$all_valid" = true ]; then
        echo ""
        echo -e "${GREEN}✅ Agent validation passed!${NC}"
        return 0
    else
        echo ""
        echo -e "${RED}❌ Agent validation failed!${NC}"
        return 1
    fi
}

# Show usage
usage() {
    echo "Agent Prompt Loader"
    echo ""
    echo "Usage:"
    echo "  $0 --list                          List all available agents"
    echo "  $0 --agent <name> [--format yaml]  Load agent prompt (default: yaml)"
    echo "  $0 --agent <name> --format json    Load agent prompt as JSON"
    echo "  $0 --agent <name> --format raw     Load raw prompt content"
    echo "  $0 --validate <name>               Validate agent definition"
    echo ""
    echo "Examples:"
    echo "  $0 --list"
    echo "  $0 --agent peter-project-gathering-expert"
    echo "  $0 --agent peter-project-gathering-expert --format json"
    echo "  $0 --validate peter-project-gathering-expert"
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --list)
            ACTION="list"
            shift
            ;;
        --agent)
            ACTION="load"
            AGENT_NAME="$2"
            shift 2
            ;;
        --format)
            FORMAT="$2"
            shift 2
            ;;
        --validate)
            ACTION="validate"
            AGENT_NAME="$2"
            shift 2
            ;;
        --help|-h)
            usage
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            usage
            exit 1
            ;;
    esac
done

# Check dependencies
check_dependencies

# Execute action
case "$ACTION" in
    list)
        list_agents
        ;;
    load)
        if [ -z "$AGENT_NAME" ]; then
            echo -e "${RED}Error: --agent <name> required${NC}"
            usage
            exit 1
        fi
        load_agent_prompt "$AGENT_NAME" "${FORMAT:-yaml}"
        ;;
    validate)
        if [ -z "$AGENT_NAME" ]; then
            echo -e "${RED}Error: --validate <name> required${NC}"
            usage
            exit 1
        fi
        validate_agent "$AGENT_NAME"
        ;;
    *)
        echo -e "${RED}No action specified${NC}"
        usage
        exit 1
        ;;
esac