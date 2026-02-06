# 🤖 Agent Humanization System

Complete implementation of 8 humanization gaps for AI agents in OpenClaw, enabling them to behave like humans in big tech environments.

**Stack:** PostgreSQL 16/17 + TimescaleDB + Redis  
**Language:** TypeScript  
**Status:** 🟢 Ready for Implementation

---

## 📊 What It Does

Bridges 8 critical gaps between AI agent behavior and human behavior in tech companies:

1. **Contexto Persistente (95% gap)** — Agents remember decisions, patterns, people
2. **Autonomia com Risco (75% gap)** — Agents make autonomous decisions
3. **Aprendizado Contínuo (90% gap)** — Agents improve from experience
4. **Relacionamentos (85% gap)** — Agents build trust and prefer partners
5. **Intuição & Julgamento (90% gap)** — Agents match patterns and improvise
6. **Gestão de Energia (80% gap)** — Agents respect energy and focus cycles
7. **Conflito & Negociação (80% gap)** — Agents push back respectfully
8. **Reputação & Accountability (95% gap)** — Agents build track records

---

## 🗂️ File Structure

```
agent-humanization/
├── README.md (this file)
├── IMPLEMENTATION_PLAN.md (detailed architecture)
│
├── database/
│   ├── schema.sql (8 core tables + views)
│   ├── timescaledb.sql (time-series hypertables)
│   └── [migrations/]
│
├── models/
│   └── types.ts (complete TypeScript models)
│
├── services/
│   ├── humanization-service.ts (main orchestrator)
│   ├── memory-service.ts (Gap 1)
│   ├── autonomy-service.ts (Gap 2)
│   ├── learning-service.ts (Gap 3)
│   ├── relationship-service.ts (Gap 4)
│   ├── intuition-service.ts (Gap 5)
│   ├── energy-service.ts (Gap 6)
│   ├── negotiation-service.ts (Gap 7)
│   └── reputation-service.ts (Gap 8)
│
├── cache/
│   ├── redis-client.ts (Redis wrapper)
│   └── cache-manager.ts (cache strategies)
│
├── tools/
│   ├── memory-tool.ts (agent-callable)
│   ├── autonomy-tool.ts
│   ├── learning-tool.ts
│   ├── reputation-tool.ts
│   ├── relationship-tool.ts
│   ├── energy-tool.ts
│   ├── intuition-tool.ts
│   └── negotiation-tool.ts
│
└── tests/
    ├── humanization.test.ts
    ├── memory.test.ts
    ├── autonomy.test.ts
    └── [more tests]
```

---

## 🚀 Quick Start

### 1. Prerequisites

```bash
# Check PostgreSQL
psql --version  # Need 16+

# Check Redis
redis-cli ping  # Should return PONG

# Check TimescaleDB installed
psql -c "CREATE EXTENSION IF NOT EXISTS timescaledb;"
```

### 2. Database Setup

```bash
# Create database
createdb agent_humanization

# Apply schema
psql agent_humanization < database/schema.sql

# Apply TimescaleDB setup
psql agent_humanization < database/timescaledb.sql

# Verify tables
psql agent_humanization -c "\dt"
```

### 3. Install Dependencies

```bash
npm install pg ioredis
npm install --save-dev @types/pg @types/ioredis
```

### 4. Initialize Service

```typescript
import { HumanizationService } from "./humanization-service";

const service = new HumanizationService(
  {
    host: "localhost",
    port: 5432,
    database: "agent_humanization",
    user: "postgres",
    password: "password",
  },
  {
    host: "localhost",
    port: 6379,
  },
);

await service.initialize();
```

### 5. Process Agent Requests

```typescript
const response = await service.processRequest({
  agentId: "backend-architect",
  context: "decision",
  details: {
    riskLevel: "medium",
    decisionType: "autonomous",
    context: { projectSize: "large" },
  },
  timestamp: new Date(),
});

console.log(response.recommendation);
// Output: "💭 **Propose your approach**, then decide if you don't get objections within 2 hours..."
```

---

## 📋 Data Model Overview

### Core Tables

```sql
-- Memory (Gap 1)
agent_memory
agent_decisions
agent_person_insights

-- Relationships (Gap 4)
agent_relationships
agent_team_chemistry

-- Learning (Gap 3)
agent_learning_logs
agent_mistake_patterns

-- Autonomy (Gap 2)
agent_autonomy_config
agent_decisions_made

-- Reputation (Gap 8)
agent_reputation
agent_track_record

-- Intuition (Gap 5)
agent_intuition_rules
agent_pattern_matches

-- Energy (Gap 6)
agent_energy_baseline
agent_energy_state

-- Negotiation (Gap 7)
agent_assertiveness_rules
agent_conflict_history
```

### Time-Series Tables (TimescaleDB)

```sql
agent_behavior_metrics       -- Decision quality over time
agent_energy_history         -- Energy levels (circadian rhythm)
agent_decision_log           -- All decisions + outcomes
agent_learning_progress      -- Skill proficiency over time
agent_reliability_history    -- Reputation trends
agent_collaboration_history  -- Team dynamics over time
```

---

## 🔄 Request/Response Flow

```
Agent Request
  ↓
HumanizationService.processRequest()
  ├─ Load Agent Profile (from Cache or DB)
  │   ├─ Memory (what they've learned)
  │   ├─ Relationships (who they trust)
  │   ├─ Reputation (track record)
  │   ├─ Energy (current state)
  │   └─ [8 profile types]
  │
  ├─ Route by Context
  │   ├─ decision → Gap 2: Autonomy + Gap 5: Intuition
  │   ├─ interaction → Gap 4: Relationships
  │   ├─ task → Gap 6: Energy
  │   ├─ learning → Gap 3: Learning
  │   └─ conflict → Gap 7: Negotiation
  │
  ├─ Process through Relevant Gaps
  │   └─ [apply gap-specific logic]
  │
  ├─ Calculate Confidence Score
  │   └─ Based on reputation + intuition accuracy + autonomy level
  │
  ├─ Build Recommendation
  │   └─ Include rationale + alternatives
  │
  ├─ Log Action (for learning)
  │   └─ Insert into time-series (TimescaleDB)
  │
  ├─ Cache Response
  │   └─ Redis (5 min TTL)
  │
  └─ Return HumanizationResponse

HumanizationResponse
  ├─ recommendation: string
  ├─ autonomyLevel?: AutonomyType
  ├─ relevantMemories?: AgentMemory[]
  ├─ relatedPeople?: PersonInsight[]
  ├─ energyFactor?: number
  └─ confidenceScore: number (0-1)
```

---

## 🎯 Gap Implementation Details

### Gap 1: Contexto Persistente (Memory)

**How it works:**

- Agent memories stored in `agent_memory` table
- Indexed by importance + recency
- Loaded when needed via profile lookup
- Cached in Redis for fast re-access

**Usage:**

```typescript
const memories = profile.memory; // Top 50 important memories
const personInsight = await getPersonInsights(agentId, personId);
// Example: "John always delivers 3 days late"
```

---

### Gap 2: Autonomia com Risco (Autonomy)

**How it works:**

- Risk level determined from task/context
- Autonomy config maps risk → autonomy type
- Three levels: FULL, PROPOSE_THEN_DECIDE, ASK_THEN_WAIT
- Logged to track decision-making quality

**Usage:**

```typescript
const autonomyLevel = autonomyConfig[riskLevel].autonomy_type;
// FULL → "You decide"
// PROPOSE_THEN_DECIDE → "Propose then decide if no objections in 2h"
// ASK_THEN_WAIT → "Ask for permission"
```

---

### Gap 3: Aprendizado Contínuo (Learning)

**How it works:**

- Daily learning logs capture what worked/failed
- Mistake patterns tracked with occurrence count
- Skill progression measured over time (TimescaleDB)
- Future decisions improved by learning history

**Usage:**

```typescript
await recordLearning(agentId, {
  lessonType: "mistake",
  lesson: "communication_too_formal",
  outcome: "person_disengaged",
  timestamp: now(),
});
// Next time: Use more casual tone with that person
```

---

### Gap 4: Relacionamentos (Relationships)

**How it works:**

- Trust scores built from interactions
- Person insights capture communication preferences
- Team chemistry maps who works well together
- Recommendations personalized per relationship

**Usage:**

```typescript
const relationship = profile.relationships.find((r) => r.other_agent_id === target);
const insights = await getPersonInsights(agentId, target);
// Example: "Sarah prefers async communication. She gets grumpy if interrupted."
```

---

### Gap 5: Intuição & Julgamento (Intuition)

**How it works:**

- Intuition rules match patterns from past successes
- Accuracy rate tracked (times_correct / times_triggered)
- Pattern matching uses context scoring
- Weights recommendations by pattern reliability

**Usage:**

```typescript
const patterns = matchIntuitionRules(profile.intuitionRules, context);
// Example: "I've seen this pattern before. It ended well."
```

---

### Gap 6: Gestão de Energia (Energy)

**How it works:**

- Circadian rhythm baseline defined per agent
- Energy levels tracked in time-series (hourly)
- Quality adjusted by energy factor
- Peak hours for deep work, low hours for simple tasks

**Usage:**

```typescript
const energyFactor = currentEnergy.energyLevel * currentEnergy.focusLevel;
const qualityAdjustment = taskComplexity * energyFactor;
// Example: "You're tired (0.4 energy). Do simple tasks now."
```

---

### Gap 7: Conflito & Negociação (Negotiation)

**How it works:**

- Assertiveness rules by concern type + level
- CRITICAL → immediate escalation
- HIGH → express respectfully
- MEDIUM → document concern
- LOW → acknowledge but flexible

**Usage:**

```typescript
const rule = assertivenessRules.find(
  (r) => r.concern_type === concernType && r.concern_level === concernLevel,
);
// Example: "This deadline is unrealistic. You need 10 days, not 3."
```

---

### Gap 8: Reputação & Accountability (Reputation)

**How it works:**

- Track record built from task delivery
- Multiple scores: reliability, speed, quality, accountability
- Trend calculated (improving/declining/stable)
- Reputation affects future opportunities/trust

**Usage:**

```typescript
const reputation = profile.reputation;
// reliability_score: 0.85 (on-time delivery)
// quality_rating: "good"
// trend: "improving" ⬆️
// This affects autonomy level granted
```

---

## 🔄 Integration with OpenClaw

### As Tools for Agents

Each gap can be exposed as a tool:

```typescript
// Register with agent
agent.registerTool({
  name: "humanization-memory",
  description: "Retrieve agent memories relevant to current context",
  handler: async (context) => {
    return await memoryService.getRelevantMemories(agent.id, context);
  },
});

agent.registerTool({
  name: "humanization-autonomy",
  description: "Determine autonomy level for a decision",
  handler: async (details) => {
    return await autonomyService.determineAutonomyLevel(
      agent.id,
      details.riskLevel,
      details.context,
    );
  },
});
```

### As Middleware

Intercept agent decisions:

```typescript
agent.use(async (request, next) => {
  // Get humanization response
  const humanization = await humanizationService.processRequest({
    agentId: agent.id,
    context: request.type,
    details: request.body,
    timestamp: new Date(),
  });

  // Inject into context
  request.humanizationGuidance = humanization;

  return next(request);
});
```

---

## 📊 Analytics & Monitoring

### Predefined Views & Aggregates

```sql
-- Daily behavior summary
SELECT * FROM agent_daily_behavior WHERE agent_id = 'backend-architect';

-- Hourly energy patterns
SELECT * FROM agent_hourly_energy_pattern WHERE agent_id = 'qa-lead';

-- Weekly learning progress
SELECT * FROM agent_weekly_learning WHERE agent_id = 'devops-engineer';

-- Monthly reputation trends
SELECT * FROM agent_monthly_reputation WHERE agent_id = 'frontend-architect';
```

### Custom Queries

```typescript
// Get agent's learning velocity for a skill
const velocity = await db.query(`SELECT * FROM get_learning_velocity($1, $2, 30)`, [
  agentId,
  "backend-testing",
]);
// Result: { start: 0.6, current: 0.8, improvement: 33% }

// Get decision quality trend
const trend = await db.query(`SELECT * FROM get_decision_quality_trend($1, 7)`, [agentId]);
// Result: Shows daily averages for past 7 days
```

---

## 🧪 Testing

```bash
npm test

# Test individual gaps
npm test -- memory.test.ts
npm test -- autonomy.test.ts
npm test -- learning.test.ts
# ... etc
```

---

## 🚀 Deployment

### Production Setup

1. **Database**: Use RDS PostgreSQL or self-managed PG
2. **Redis**: Use ElastiCache or self-managed Redis
3. **Schema**: Apply migrations in order
4. **Connection Pooling**: PG pool size = 20-50
5. **Cache TTL**: Adjust based on data freshness needs

### Monitoring

```typescript
// Monitor key metrics
setInterval(async () => {
  const dbHealth = await db.query("SELECT NOW()");
  const redisHealth = await redis.ping();
  const cacheHitRate = await getRedisStats();

  console.log({
    db: dbHealth ? "ok" : "failed",
    redis: redisHealth ? "ok" : "failed",
    cacheHitRate: `${cacheHitRate}%`,
  });
}, 60000); // Every minute
```

---

## 📈 Success Metrics

Track these to measure humanization improvement:

| Metric                 | Target  | Current |
| ---------------------- | ------- | ------- |
| % autonomous decisions | 60%     | 5%      |
| Escalations needed     | 20%     | 80%     |
| Planning accuracy      | 85%     | 60%     |
| Collaboration friction | Low     | High    |
| Reputation clarity     | Clear   | None    |
| Learning visibility    | Evident | None    |

---

## 🔧 Troubleshooting

### "PostgreSQL connection failed"

```bash
# Check if running
psql -U postgres -c "SELECT version();"

# Check config
cat /Users/juliocezar/Library/LaunchAgents/homebrew.mxcl.postgresql@16.plist
```

### "Redis connection failed"

```bash
# Check if running
redis-cli ping

# Restart
brew services restart redis
```

### "TimescaleDB extension not found"

```sql
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;
-- Should output: "TimescaleDB loaded"
```

---

## 📚 Further Reading

- **IMPLEMENTATION_PLAN.md** — Detailed architecture & schema design
- **models/types.ts** — Complete TypeScript type definitions
- **AGENT_HUMANIZATION_GAPS.md** (parent dir) — Gap analysis & rationale

---

## 👥 Contributing

To add new gap logic:

1. Create `{gap}-service.ts` in `services/`
2. Define types in `models/types.ts`
3. Add database tables/views as needed
4. Create tests in `tests/{gap}.test.ts`
5. Document in this README

---

## 📝 License

Same as OpenClaw project

---

**Ready to launch agent humanization!** 🚀

Next: Implement individual services one by one.
