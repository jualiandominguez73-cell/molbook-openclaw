---
summary: "Step-by-step checklist for implementing token optimization"
read_when:
  - You want a quick implementation guide
  - You need to apply optimizations in order
  - You want to track optimization progress
---
# Token Optimization Implementation Checklist

Follow this checklist to implement token optimizations in priority order.

## Phase 1: Immediate Wins (10 minutes)

### ☐ 1.1 Enable Minimal Prompt Mode

**Impact: 40-60% system prompt reduction**

```bash
# Test it first
openclaw agent --prompt minimal
```

If it works well, make it default:
```json5
// ~/.config/openclaw/config.json
{
  "agents": {
    "defaults": {
      "prompt": "minimal"
    }
  }
}
```

**Verify**:
```bash
/context detail
# Check "System prompt" size decreased
```

### ☐ 1.2 Enable Cache-TTL Pruning

**Impact: 20-40% reduction in cache write costs**

```json5
{
  "agents": {
    "defaults": {
      "contextPruning": {
        "mode": "cache-ttl",
        "ttl": "5m"
      }
    }
  }
}
```

**Verify**:
```bash
# After 5+ minutes of inactivity, check logs for pruning
export CLAWDBOT_LOG_LEVEL=debug
# Look for "pruning" messages
```

### ☐ 1.3 Enable Heartbeat

**Impact: 10-20% savings by avoiding cache expiry**

```json5
{
  "agents": {
    "defaults": {
      "heartbeat": {
        "enabled": true,
        "interval": "4m"
      }
    }
  }
}
```

**Verify**:
```bash
# Check heartbeat in logs
# Look for periodic "heartbeat" messages
```

### ☐ 1.4 Enable Auto-Compaction

**Impact: Prevents context overflow, maintains efficiency**

```json5
{
  "agents": {
    "defaults": {
      "compaction": {
        "auto": true,
        "targetRatio": 0.6
      }
    }
  }
}
```

**Verify**:
```bash
/status
# Should show "Compactions: N" when triggered
```

---

## Phase 2: Configuration Tuning (30 minutes)

### ☐ 2.1 Reduce Bootstrap Max Chars

**Impact: 10-20% system prompt reduction**

```json5
{
  "agents": {
    "defaults": {
      "bootstrapMaxChars": 10000    // Down from 20000
    }
  }
}
```

**Test first**: Run with reduced limit, ensure model still has necessary context.

### ☐ 2.2 Configure Extended Cache TTL (Anthropic)

**Impact: Fewer cache writes for infrequent use**

```json5
{
  "models": {
    "providers": {
      "anthropic": {
        "cacheControlTtl": "1h"
      }
    }
  }
}
```

**Note**: Only works with certain Anthropic plans/features.

### ☐ 2.3 Disable Unused Tools

**Impact: 5-15% system prompt reduction**

Review which tools you actually use:
```bash
/context detail
# Note "Top tools (schema size)"
```

Disable unused ones:
```json5
{
  "tools": {
    "disabled": [
      "browser",        // ~2,450 tokens saved
      "image_gen",      // ~500 tokens saved
      "voice"           // ~300 tokens saved
    ]
  }
}
```

### ☐ 2.4 Tune Pruning Aggressiveness

**Impact: Better context efficiency for heavy tool users**

```json5
{
  "agents": {
    "defaults": {
      "contextPruning": {
        "mode": "cache-ttl",
        "ttl": "5m",
        "keepLastAssistants": 3,      // Adjust based on needs
        "softTrim": {
          "maxChars": 3000,           // More aggressive
          "headChars": 1200,
          "tailChars": 1200
        }
      }
    }
  }
}
```

---

## Phase 3: Bootstrap File Optimization (1-2 hours)

### ☐ 3.1 Audit Current Bootstrap Files

```bash
/context list
# Note sizes of AGENTS.md, SOUL.md, TOOLS.md, etc.
```

### ☐ 3.2 Trim AGENTS.md

Current typical size: 5,000-10,000 chars

**Optimization strategies**:
1. Remove verbose examples
2. Condense multi-line bullets to single lines
3. Move deployment/release docs to separate files
4. Remove sections the model rarely needs

**Target**: 3,000-5,000 chars

### ☐ 3.3 Optimize TOOLS.md

If you have a large TOOLS.md:
1. Keep only essential tool descriptions
2. Move detailed usage examples to skills
3. Remove redundant information

### ☐ 3.4 Review SOUL.md and IDENTITY.md

These should be concise:
- SOUL.md: Core personality traits (500-1000 chars)
- IDENTITY.md: Basic identity (200-500 chars)

### ☐ 3.5 Split Large Context Files

If AGENTS.md is huge, split it:
```
AGENTS.md           # Core guidelines (3000 chars)
AGENTS-DEPLOY.md    # Deployment (read on demand)
AGENTS-RELEASE.md   # Release process (read on demand)
```

---

## Phase 4: Advanced Optimization (Optional)

### ☐ 4.1 Create Task-Specific Profiles

```bash
# For code review (read-heavy)
openclaw agent --profile code-review

# For simple Q&A
openclaw agent --profile minimal-qa
```

Profile configs:
```json5
// ~/.config/openclaw/profiles/code-review.json
{
  "prompt": "minimal",
  "tools": ["read", "grep_search"],
  "bootstrapMaxChars": 5000
}

// ~/.config/openclaw/profiles/minimal-qa.json
{
  "prompt": "none",
  "tools": []
}
```

### ☐ 4.2 Implement Custom Skills

Move specialized knowledge from bootstrap files to skills:

```yaml
# ~/.config/openclaw/skills/deployment.yaml
name: deployment
description: "Project deployment procedures"
read: |
  ## Deployment Guide
  ...
```

Skills are listed (small overhead) but content loads on-demand.

### ☐ 4.3 Monitor and Iterate

Set up usage tracking:
```bash
# Enable usage footer
/usage tokens

# Regular checks
/status
/context detail
```

Track these metrics weekly:
- Average session cost
- Cache hit rate
- Context usage at typical session length

---

## Verification Checklist

After implementing, verify each optimization:

| Optimization | Verification Command | Expected Result |
|--------------|---------------------|-----------------|
| Minimal prompt | `/context detail` | System prompt < 8,000 tokens |
| Cache-TTL pruning | Debug logs | "pruning" messages after TTL |
| Heartbeat | Debug logs | Periodic heartbeat messages |
| Auto-compaction | `/status` | Compaction count > 0 for long sessions |
| Reduced bootstrap | `/context list` | Bootstrap < 5,000 tokens |
| Disabled tools | `/context detail` | Missing from tool list |

---

## Quick Reference: Complete Optimal Config

```json5
// ~/.config/openclaw/config.json
{
  "agents": {
    "defaults": {
      // Prompt optimization
      "prompt": "minimal",
      "bootstrapMaxChars": 10000,
      
      // Context management
      "compaction": {
        "auto": true,
        "targetRatio": 0.6
      },
      
      // Pruning
      "contextPruning": {
        "mode": "cache-ttl",
        "ttl": "5m",
        "keepLastAssistants": 3,
        "softTrim": {
          "maxChars": 3000,
          "headChars": 1200,
          "tailChars": 1200
        },
        "hardClear": {
          "enabled": true
        }
      },
      
      // Cache warmth
      "heartbeat": {
        "enabled": true,
        "interval": "4m"
      }
    }
  },
  
  // Provider-specific
  "models": {
    "providers": {
      "anthropic": {
        "cacheControlTtl": "1h"
      }
    }
  },
  
  // Disable unused tools (customize this list)
  "tools": {
    "disabled": ["browser", "image_gen", "voice"]
  }
}
```

---

## Expected Savings Summary

| Phase | Effort | Token Reduction | Cost Reduction |
|-------|--------|-----------------|----------------|
| Phase 1 | 10 min | 30-50% | 50-70% |
| Phase 2 | 30 min | +10-20% | +10-15% |
| Phase 3 | 1-2 hrs | +10-15% | +5-10% |
| Phase 4 | Ongoing | +5-10% | +5-10% |
| **Total** | **~3 hrs** | **55-85%** | **70-90%** |

**Target achieved**: 50%+ token reduction ✅
