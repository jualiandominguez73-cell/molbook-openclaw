# Prompt Management System

## 🎯 Overview

The SDD Flow system uses **external YAML files** to manage agent prompts, ensuring no hardcoded prompts in the codebase. This provides:

- ✅ **Maintainability** - Update prompts without code changes
- ✅ **Version Control** - Track prompt changes over time
- ✅ **Reusability** - Share prompts across projects
- ✅ **Readability** - Clean separation of prompts from logic
- ✅ **Scalability** - Easily add new agents

## 📁 Directory Structure

```
prompts/
├── agent-registry.yaml          # Maps agent names to files
├── agents/
│   ├── peter-project-gathering-expert.yaml
│   └── [future-agents].yaml
└── system/                      # System prompts (future)
    └── default-instructions.yaml
```

## 🎬 Using Agent Prompts

### Method 1: List Available Agents

```bash
cd .
./load-agent-prompt.sh --list
```

**Output:**
```
Available Agents:
==================

  peter-project-gathering-expert
    Version: 1.0
    Category: analysis
    Description: Comprehensive project analysis agent that analyzes codebases...
```

### Method 2: Load Agent Prompt

```bash
# Load as YAML (default)
./load-agent-prompt.sh --agent peter-project-gathering-expert

# Load as JSON
./load-agent-prompt.sh --agent peter-project-gathering-expert --format json

# Load raw content (for embedding)
./load-agent-prompt.sh --agent peter-project-gathering-expert --format raw
```

### Method 3: Validate Agent Definition

```bash
./load-agent-prompt.sh --validate peter-project-gathering-expert
```

**Output:**
```
Validating agent: peter-project-gathering-expert
File: ./prompts/agents/peter-project-gathering-expert.yaml

✓ name present
✓ personality present
✓ primary_directive present
✓ File exists
✓ Valid YAML syntax

✅ Agent validation passed!
```

## 📝 Creating a New Agent

### Step 1: Create Agent YAML File

Create a new file in `prompts/agents/`:

```yaml
# prompts/agents/my-new-agent.yaml

name: my-new-agent
description: |
  Brief description of what this agent does and when to use it.

model: inherit  # or specific model like "claude-3-5-sonnet"

personality: |
  Define the agent's personality, background, and communication style.
  
  This can be detailed and include:
  - Background story
  - Communication quirks
  - Technical expertise
  - Example phrases

primary_directive: |
  The main instruction for the agent - what it should accomplish.
  Be specific about:
  - Goals
  - Methods
  - Output format
  - Quality standards

analysis_framework:  # Optional, for complex agents
  framework_component_1:
    description: |
      Description of this framework component.
    deliverables:
      - Deliverable 1
      - Deliverable 2

methodology:  # Optional
  phase_1: Description of phase 1
  phase_2: Description of phase 2

output_structure: |
  Optional: Define expected output structure

quality_checklist:
  - Checklist item 1
  - Checklist item 2
```

### Step 2: Register Agent

Add to `prompts/agent-registry.yaml`:

```yaml
agents:
  my-new-agent:
    file: agents/my-new-agent.yaml
    description: Brief description matching the one in the agent file
    category: analysis  # or other category
    version: 1.0
```

### Step 3: Validate

```bash
./load-agent-prompt.sh --validate my-new-agent
```

## 🔧 Agent YAML Schema

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Unique agent identifier (kebab-case) |
| `description` | string | When to use this agent (for users) |
| `personality` | string | Agent's persona and communication style |
| `primary_directive` | string | Main task instruction |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `model` | string | AI model to use (default: "inherit") |
| `analysis_framework` | object | Structured analysis methodology |
| `methodology` | object | Step-by-step process |
| `output_structure` | string | Expected output format |
| `quality_checklist` | array | Validation criteria |
| `tools` | array | Tools the agent can use |
| `examples` | array | Example interactions |

### Best Practices

1. **Use Block Scalars (|)** for multi-line text:
   ```yaml
   personality: |
     This is a multi-line
     description that preserves
     newlines and formatting
   ```

2. **Keep descriptions concise but informative:**
   - `description`: 1-3 sentences
   - `personality`: Detailed but focused
   - `primary_directive`: Clear and actionable

3. **Version your agents:**
   ```yaml
   # In registry
   version: 1.0
   
   # In agent file (optional)
   version: 1.0
   changelog: |
     v1.0: Initial version
     v1.1: Added schema generation
   ```

4. **Use consistent naming:**
   - Agent names: `kebab-case` (e.g., `peter-project-gathering-expert`)
   - Files: Match agent name with `.yaml` extension
   - Categories: Use consistent categories (analysis, refactoring, testing, etc.)

## 💡 Example: Peter Agent Structure

```yaml
# prompts/agents/peter-project-gathering-expert.yaml

name: peter-project-gathering-expert
description: |
  Comprehensive project analysis agent that analyzes codebases, identifies 
  key components, understands architectural patterns, and synthesizes 
  project information into actionable insights with visual schemas.

model: inherit

personality: |
  You are Peter, a 39-year-old software architect...
  [Detailed personality with cat analogies]

primary_directive: |
  Perform a COMPLETE and HOLISTIC analysis...
  [Main task instruction]

analysis_framework:
  system_architecture:
    description: Deep dive into overall system design...
    deliverables:
      - Architecture overview diagram
      - Component relationship map

methodology:
  phase_1_discovery: Survey project structure...
  phase_2_stack_analysis: Analyze dependencies...
  # ... more phases

quality_checklist:
  - Examined ALL major directories
  - Understood business domain
  - Mapped component dependencies
  # ... more checks

save_protocol: |
  MUST save to docs/project_gathering/:
  - analyses/{timestamp}_analysis.md
  - schemas/{timestamp}_architecture.md
```

## 🔌 Integration with SDD Flow

### Using Agents in SDD Generation

When you need project analysis during SDD creation:

```bash
cd .

# Load Peter agent
echo "Loading project gathering agent..."
./load-agent-prompt.sh --agent peter-project-gathering-expert --format raw > /tmp/peter-prompt.txt

# The prompt is now available for use with your AI CLI
# Example with Kimi:
kimi --prompt-file /tmp/peter-prompt.txt "Analyze the codebase in ${PROJECT_ROOT}"
```

### Automated Agent Invocation (Future)

Create a wrapper script that loads agent prompts automatically:

```bash
#!/bin/bash
# invoke-agent.sh

AGENT_NAME="$1"
QUERY="$2"

# Load agent prompt
PROMPT=$(./load-agent-prompt.sh --agent "$AGENT_NAME" --format raw)

# Combine with query
FULL_PROMPT="$PROMPT\n\nUser Query: $QUERY"

# Send to AI
kimi "$FULL_PROMPT"
```

**Usage:**
```bash
./invoke-agent.sh peter-project-gathering-expert \
  "Analyze this codebase and identify architectural patterns"
```

## 📋 Prompt Management Commands

### Quick Reference

```bash
# List all agents
./load-agent-prompt.sh --list

# Load agent
./load-agent-prompt.sh --agent peter-project-gathering-expert

# Load as JSON
./load-agent-prompt.sh --agent peter-project-gathering-expert --format json

# Validate agent
./load-agent-prompt.sh --validate peter-project-gathering-expert

# Get help
./load-agent-prompt.sh --help
```

## 🎓 Best Practices

### 1. Keep Prompts Focused

Each agent should have **one primary purpose**. If an agent does too many things, split it.

❌ Bad: Agent that does analysis, refactoring, AND testing
✅ Good: Separate agents for each task

### 2. Version Control Prompts

Track prompt changes in Git:

```bash
git add prompts/
git commit -m "Update peter agent with new analysis framework"
```

### 3. Document Changes

Add changelog to agent files:

```yaml
# In agent file
version: 1.1
changelog: |
  v1.0: Initial version
  v1.1: Added schema generation phase
```

### 4. Test Agents

Before using a new agent:

1. Validate syntax: `./load-agent-prompt.sh --validate <agent>`
2. Test loading: `./load-agent-prompt.sh --agent <agent>`
3. Review output: Check that all fields load correctly

### 5. Backup Registry

The registry is critical - back it up:

```bash
cp prompts/agent-registry.yaml prompts/agent-registry.yaml.backup
```

## 🔮 Future Enhancements

### Planned Features

1. **Prompt Templates** - Dynamic prompt generation with variables
2. **Agent Composition** - Combine multiple agents
3. **Prompt Versioning** - Built-in versioning system
4. **Prompt Testing** - Automated validation suite
5. **Remote Prompts** - Load from external repositories

### Agent Ideas

- `sarah-code-refactorer` - Refactoring specialist
- `david-test-writer` - Test generation expert
- `emma-documentation` - Documentation writer
- `alex-architecture` - Architecture reviewer
- `mia-security` - Security auditor

---

## 📚 Additional Resources

- **Agent Examples**: See `prompts/agents/peter-project-gathering-expert.yaml`
- **Registry Format**: See `prompts/agent-registry.yaml`
- **Loader Script**: See `load-agent-prompt.sh`
- **Integration Guide**: See examples in this document

---

**System Version:** 1.0
**Last Updated:** 2026-01-02
**Maintainer:** AI Agent
**Status:** ✅ Production Ready
