---
name: mem0-memory
description: 4-scope memory system using Mem0 (Customer, Agent, Team, Org).
user-invocable: false
requires.env:
  - MEM0_API_KEY
---

# Mem0 Memory Manager

This skill integrates Mem0 to provide a persistent, multi-level memory system for the agent.

## Usage

This skill is intended to be used by other skills or the system router, rather than directly by users via chat commands, though testing commands can be added.

## Scopes

1. **Customer**: Specific to a client (phone number).
2. **Agent**: Specific to the AI agent personality/preferences.
3. **Team**: Shared across a team of agents.
4. **Organization**: Global company knowledge.

## Setup

Ensure `MEM0_API_KEY` is set in the environment.
