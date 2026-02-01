# SMRP (Smart Model Routing Protocol)

## 1. Overview

The Smart Model Routing Protocol (SMRP) is a strategy designed to optimize AI Agent performance by dynamically allocating tasks to different model tiers based on computational complexity, creative requirements, and cost efficiency.

## 2. Model Tiers

### Tier 1: Edge Gateway (Flash)

- **Example Models**: `Gemini 3 Flash`, `GPT-4o mini`, `Claude 3.5 Haiku`
- **Use Cases**:
  - Real-time chat interaction
  - Simple file CRUD operations
  - Web searches and data retrieval
  - Basic shell command execution
- **Objective**: Minimal latency and maximum throughput.

### Tier 2: Logic Core (Pro)

- **Example Models**: `Gemini 3 Pro`, `GPT-4o`, `Claude 3.5 Sonnet`
- **Use Cases**:
  - Complex coding and multi-file debugging
  - Planning and orchestration of sub-tasks
  - Data analysis and pattern recognition
- **Objective**: High reasoning capability for engineering tasks.

### Tier 3: Creative & Audit (Opus)

- **Example Models**: `Claude 4.5 Opus`, `OpenAI o1`
- **Use Cases**:
  - High-stakes creative writing (e.g., long-form articles)
  - Security audits and architectural reviews
  - Final decision-making in ambiguous scenarios
- **Objective**: Unmatched creative quality and rigorous logical checking.

## 3. Escalation Logic

If a task fails at a lower tier more than twice, the protocol dictates an automatic escalation to the next higher tier to ensure reliability and task completion.

## 4. Implementation in OpenClaw

SMRP is implemented using the [`sessions_spawn`](../tools/subagents.md) tool to trigger specialized sub-agents while maintaining a responsive primary session.
