# Token Optimization Guide

This folder contains comprehensive documentation for reducing LLM token consumption in OpenClaw, based on research from 10+ authoritative sources and deep analysis of the codebase.

## Target

**Goal:** Reduce token consumption by 50% or more.

## Documents

| Document | Purpose |
|----------|---------|
| [Overview](overview.md) | Executive summary of all optimization strategies |
| [Technical Analysis](technical-analysis.md) | Deep code analysis with specific optimizations |
| [Prompt Caching](prompt-caching.md) | Provider-specific caching (Anthropic, OpenAI, Gemini) |
| [System Prompt Optimization](system-prompt-optimization.md) | Reducing system prompt size |
| [Context Management](context-management.md) | Pruning, compaction, and context control |
| [Implementation Checklist](implementation-checklist.md) | Prioritized action items |

## Quick Wins (Immediate Impact)

1. **Enable Prompt Caching** → 50-90% cost reduction
2. **Use `--prompt minimal`** → ~60% system prompt reduction
3. **Configure Cache-TTL Pruning** → Optimal cache efficiency
4. **Enable Heartbeat** → Keep cache warm between requests

## Research Sources

This guide synthesizes findings from:
1. Anthropic Prompt Caching Documentation
2. OpenAI Cookbook - Prompt Caching Guide
3. Google Gemini Context Caching Documentation
4. HuggingFace Transformers Optimization Guide
5. Lilian Weng's LLM Inference Optimization Survey
6. Google Cloud AI Prompt Engineering Guide
7. PromptingGuide.ai Token Optimization
8. OpenAI Best Practices for Prompt Engineering
9. Anthropic Claude Documentation
10. OpenClaw Internal Documentation & Source Code

## Estimated Savings

| Strategy | Potential Reduction | Implementation Effort |
|----------|---------------------|----------------------|
| Prompt Caching (already enabled) | 50-90% | Low (config only) |
| System Prompt Minimal Mode | 40-60% | Low (flag change) |
| Cache-TTL Pruning | 20-40% | Low (config only) |
| Bootstrap File Optimization | 10-30% | Medium (file edits) |
| Tool Schema Reduction | 5-15% | High (code changes) |

**Combined potential: 60-85% token reduction**
