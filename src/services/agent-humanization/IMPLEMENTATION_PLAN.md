# 🤖 Agent Humanization Implementation Plan

Stack: PostgreSQL 16/17 + TimescaleDB + Redis  
Target: Full implementation of 8 gaps  
Timeline: 2 weeks

---

## 📊 Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    OpenClaw Agent                        │
└──────────────┬──────────────────────────────────────────┘
               │
               ├─► AgentHumanizationService
               │   ├─ memory-service
               │   ├─ autonomy-service
               │   ├─ learning-service
               │   ├─ relationship-service
               │   ├─ intuition-service
               │   ├─ energy-service
               │   ├─ negotiation-service
               │   └─ reputation-service
               │
               ├─► PostgreSQL (Persistent Storage)
               │   ├─ agent_memory
               │   ├─ agent_relationships
               │   ├─ agent_learning_logs
               │   ├─ agent_autonomy_config
               │   ├─ agent_reputation
               │   └─ [more tables]
               │
               ├─► TimescaleDB (Time-Series)
               │   ├─ agent_behavior_metrics (metrics over time)
               │   ├─ agent_energy_levels (circadian rhythm)
               │   ├─ agent_decision_log (decisions + outcomes)
               │   └─ agent_learning_progress
               │
               └─► Redis (Cache + Fast Lookup)
                   ├─ agent:{id}:memory (current context)
                   ├─ agent:{id}:relationships (trust scores)
                   ├─ agent:{id}:reputation (quick lookup)
                   └─ agent:{id}:energy (current state)
```

---

## 🗄️ PostgreSQL Schema

### 1. Agent Memory Tables

```sql
-- Core memory store
CREATE TABLE agent_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id VARCHAR NOT NULL,
  memory_type VARCHAR NOT NULL, -- 'decision', 'mistake', 'pattern', 'person_insight'
  title VARCHAR NOT NULL,
  content TEXT NOT NULL,
  context JSONB, -- Rich context data
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  importance INTEGER DEFAULT 5, -- 1-10, higher = more important
  retention_score FLOAT DEFAULT 1.0, -- 0-1, how well to remember

  UNIQUE(agent_id, memory_type, title),
  INDEX (agent_id, created_at DESC),
  INDEX (agent_id, importance DESC)
);

-- Decision history
CREATE TABLE agent_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id VARCHAR NOT NULL,
  decision_type VARCHAR NOT NULL, -- 'autonomous', 'proposed', 'asked'
  decision_text TEXT NOT NULL,
  confidence_level INTEGER, -- 1-100
  outcome VARCHAR, -- 'success', 'failure', 'pending'
  lessons_learned TEXT,
  made_at TIMESTAMP DEFAULT NOW(),
  outcome_at TIMESTAMP,

  INDEX (agent_id, made_at DESC)
);

-- Person insights
CREATE TABLE agent_person_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id VARCHAR NOT NULL,
  person_id VARCHAR NOT NULL,
  insight_type VARCHAR NOT NULL, -- 'reliability', 'communication', 'preference'
  insight_text TEXT NOT NULL,
  confidence FLOAT, -- 0-1
  evidence_count INTEGER DEFAULT 0,
  last_updated TIMESTAMP DEFAULT NOW(),

  UNIQUE(agent_id, person_id, insight_type),
  INDEX (agent_id, person_id)
);
```

### 2. Relationship Tables

```sql
CREATE TABLE agent_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id VARCHAR NOT NULL,
  other_agent_id VARCHAR NOT NULL,
  trust_score FLOAT DEFAULT 0.5, -- 0-1
  collaboration_quality VARCHAR, -- 'excellent', 'good', 'neutral', 'poor'
  interaction_count INTEGER DEFAULT 0,
  last_interaction TIMESTAMP,
  notes TEXT,

  UNIQUE(agent_id, other_agent_id),
  INDEX (agent_id, trust_score DESC)
);

CREATE TABLE agent_team_chemistry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id_1 VARCHAR NOT NULL,
  agent_id_2 VARCHAR NOT NULL,
  chemistry_score FLOAT, -- 0-1
  works_well BOOLEAN,
  conflicts BOOLEAN,
  notes TEXT,
  last_assessed TIMESTAMP DEFAULT NOW(),

  UNIQUE(agent_id_1, agent_id_2)
);
```

### 3. Learning Tables

```sql
CREATE TABLE agent_learning_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id VARCHAR NOT NULL,
  date DATE NOT NULL,
  learned_today TEXT[], -- Array of lessons
  mistakes JSONB, -- Mistakes made + lessons
  improvements JSONB, -- Process improvements discovered
  skill_progress JSONB, -- Skills improved

  UNIQUE(agent_id, date),
  INDEX (agent_id, date DESC)
);

CREATE TABLE agent_mistake_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id VARCHAR NOT NULL,
  mistake_type VARCHAR NOT NULL,
  occurrences INTEGER DEFAULT 1,
  last_occurrence TIMESTAMP,
  recommended_action TEXT,

  UNIQUE(agent_id, mistake_type),
  INDEX (agent_id, occurrences DESC)
);
```

### 4. Autonomy Tables

```sql
CREATE TABLE agent_autonomy_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id VARCHAR NOT NULL,
  risk_level VARCHAR NOT NULL, -- 'low', 'medium', 'high'
  definition TEXT,
  autonomy_type VARCHAR, -- 'FULL', 'PROPOSE_THEN_DECIDE', 'ASK_THEN_WAIT'
  conditions JSONB,
  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(agent_id, risk_level)
);

CREATE TABLE agent_decisions_made (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id VARCHAR NOT NULL,
  decision_type VARCHAR,
  task_id VARCHAR,
  decision_made BOOLEAN DEFAULT true,
  decision_quality VARCHAR, -- 'excellent', 'good', 'poor'
  decision_time TIMESTAMP DEFAULT NOW(),
  outcome TEXT,

  INDEX (agent_id, decision_time DESC),
  INDEX (agent_id, decision_quality)
);
```

### 5. Reputation Tables

```sql
CREATE TABLE agent_reputation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id VARCHAR UNIQUE NOT NULL,
  reliability_score FLOAT DEFAULT 0.5, -- 0-1
  speed_rating VARCHAR, -- 'fast', 'on_track', 'slow'
  quality_rating VARCHAR, -- 'excellent', 'good', 'average', 'poor'
  accountability_score FLOAT DEFAULT 0.5,
  trend VARCHAR DEFAULT 'stable', -- 'improving', 'declining', 'stable'
  last_updated TIMESTAMP DEFAULT NOW(),

  INDEX (agent_id),
  INDEX (reliability_score DESC),
  INDEX (trend)
);

CREATE TABLE agent_track_record (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id VARCHAR NOT NULL,
  task_id VARCHAR NOT NULL,
  task_name VARCHAR,
  planned_days INTEGER,
  actual_days INTEGER,
  quality_rating VARCHAR,
  delivered_status VARCHAR, -- 'early', 'on_time', 'late', 'failed'
  completed_at TIMESTAMP,

  INDEX (agent_id, completed_at DESC),
  INDEX (agent_id, delivered_status)
);
```

### 6. Intuition Tables

```sql
CREATE TABLE agent_intuition_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id VARCHAR NOT NULL,
  pattern_name VARCHAR NOT NULL,
  pattern_description TEXT,
  trigger_conditions JSONB,
  recommended_action TEXT,
  confidence FLOAT, -- 0-1
  times_triggered INTEGER DEFAULT 0,
  times_correct INTEGER DEFAULT 0,

  INDEX (agent_id, times_correct DESC)
);

CREATE TABLE agent_pattern_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id VARCHAR NOT NULL,
  pattern_id UUID REFERENCES agent_intuition_rules(id),
  matched_context JSONB,
  action_taken TEXT,
  outcome VARCHAR, -- 'correct', 'incorrect'
  matched_at TIMESTAMP DEFAULT NOW(),

  INDEX (agent_id, matched_at DESC),
  INDEX (pattern_id)
);
```

### 7. Energy Management Tables

```sql
CREATE TABLE agent_energy_baseline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id VARCHAR UNIQUE NOT NULL,
  peak_hours VARCHAR[], -- ['09:00', '12:00']
  low_hours VARCHAR[],
  max_deep_work_hours INTEGER DEFAULT 4,
  break_needed_after_hours INTEGER DEFAULT 3,
  recovery_break_minutes INTEGER DEFAULT 15,

  INDEX (agent_id)
);

CREATE TABLE agent_energy_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id VARCHAR NOT NULL,
  current_hour VARCHAR,
  energy_level FLOAT, -- 0-1
  focus_level FLOAT, -- 0-1
  context_switches_today INTEGER DEFAULT 0,
  deep_work_minutes INTEGER DEFAULT 0,
  last_break TIMESTAMP,
  quality_variance FLOAT, -- 0-1, how much quality varies

  INDEX (agent_id)
);
```

### 8. Negotiation/Conflict Tables

```sql
CREATE TABLE agent_assertiveness_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id VARCHAR NOT NULL,
  concern_type VARCHAR, -- 'deadline', 'scope', 'design', 'metric'
  concern_level VARCHAR, -- 'critical', 'high', 'medium', 'low'
  recommended_response TEXT,
  alternatives JSONB,
  escalation_path TEXT,

  INDEX (agent_id, concern_level)
);

CREATE TABLE agent_conflict_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id VARCHAR NOT NULL,
  other_agent_id VARCHAR,
  conflict_type VARCHAR,
  resolution VARCHAR,
  outcome VARCHAR,
  resolved_at TIMESTAMP,

  INDEX (agent_id, resolved_at DESC),
  INDEX (agent_id, other_agent_id)
);
```

---

## ⏱️ TimescaleDB Hypertables (Time-Series)

```sql
-- Agent behavior metrics over time
CREATE TABLE agent_behavior_metrics (
  time TIMESTAMP NOT NULL,
  agent_id VARCHAR NOT NULL,
  metric_type VARCHAR, -- 'decision_quality', 'collaboration', 'output'
  metric_value FLOAT,
  context JSONB
);

SELECT create_hypertable('agent_behavior_metrics', 'time', if_not_exists => TRUE);
CREATE INDEX idx_agent_behavior_time ON agent_behavior_metrics (agent_id, time DESC);

-- Energy levels over time
CREATE TABLE agent_energy_history (
  time TIMESTAMP NOT NULL,
  agent_id VARCHAR NOT NULL,
  energy_level FLOAT, -- 0-1
  focus_level FLOAT,
  quality_output FLOAT,
  context_switches INTEGER
);

SELECT create_hypertable('agent_energy_history', 'time', if_not_exists => TRUE);
CREATE INDEX idx_agent_energy_time ON agent_energy_history (agent_id, time DESC);

-- Decision log
CREATE TABLE agent_decision_log (
  time TIMESTAMP NOT NULL,
  agent_id VARCHAR NOT NULL,
  decision_type VARCHAR,
  decision_quality VARCHAR,
  outcome VARCHAR,
  context JSONB
);

SELECT create_hypertable('agent_decision_log', 'time', if_not_exists => TRUE);
CREATE INDEX idx_agent_decision_time ON agent_decision_log (agent_id, time DESC);

-- Learning progress
CREATE TABLE agent_learning_progress (
  time TIMESTAMP NOT NULL,
  agent_id VARCHAR NOT NULL,
  skill_name VARCHAR,
  proficiency FLOAT, -- 0-1
  improvement_rate FLOAT
);

SELECT create_hypertable('agent_learning_progress', 'time', if_not_exists => TRUE);
CREATE INDEX idx_agent_learning_time ON agent_learning_progress (agent_id, time DESC);
```

---

## 📦 Redis Cache Layer

```
Key Patterns:

# Agent Current State (fast lookup)
agent:{agent_id}:memory -> JSON (current session context)
agent:{agent_id}:relationships -> JSON (trust scores, chemistry)
agent:{agent_id}:reputation -> JSON (current scores)
agent:{agent_id}:energy -> JSON (current energy/focus state)

# Lookup Tables
person:{person_id}:insights:{agent_id} -> JSON
relationship:{agent_id}:{other_id}:score -> FLOAT
autonomy:{agent_id}:{risk_level} -> JSON

# Cache Expiry
- Current state: 1 hour (fresh)
- Relationships: 6 hours (semi-persistent)
- Reputation: 1 day (relatively stable)
- Energy state: 15 min (real-time)

# Invalidation
- On decision made: invalidate memory + decision log
- On interaction: invalidate relationships
- On task completion: invalidate reputation + track record
```

---

## 📂 File Structure

```
openclawdev/src/services/agent-humanization/
├── IMPLEMENTATION_PLAN.md (this file)
├── database/
│   ├── schema.sql
│   ├── migrations/
│   │   ├── 001-core-tables.sql
│   │   ├── 002-timescaledb-setup.sql
│   │   ├── 003-indexes.sql
│   │   └── 004-initial-data.sql
│   └── seed.ts
├── services/
│   ├── memory-service.ts
│   ├── autonomy-service.ts
│   ├── learning-service.ts
│   ├── relationship-service.ts
│   ├── intuition-service.ts
│   ├── energy-service.ts
│   ├── negotiation-service.ts
│   ├── reputation-service.ts
│   └── humanization-service.ts (orchestrator)
├── cache/
│   ├── redis-client.ts
│   └── cache-manager.ts
├── models/
│   ├── memory.ts
│   ├── relationship.ts
│   ├── reputation.ts
│   ├── learning.ts
│   ├── autonomy.ts
│   ├── intuition.ts
│   ├── energy.ts
│   └── negotiation.ts
├── tools/
│   ├── memory-tool.ts (reads/writes memory)
│   ├── autonomy-tool.ts (checks autonomy level for decision)
│   ├── learning-tool.ts (logs lessons learned)
│   ├── reputation-tool.ts (gets reputation score)
│   ├── relationship-tool.ts (gets person insights)
│   ├── energy-tool.ts (checks energy state)
│   ├── intuition-tool.ts (matches patterns)
│   └── negotiation-tool.ts (suggests assertiveness level)
├── middleware/
│   └── humanization-middleware.ts (integrates all services)
└── tests/
    └── [unit tests]
```

---

## 🔄 Implementation Timeline

### Week 1: Core Infrastructure

- [ ] Database schema creation (PG + TimescaleDB)
- [ ] Redis cache layer setup
- [ ] Models & TypeScript types
- [ ] Database migrations

### Week 2: Services Implementation

- [ ] Memory service
- [ ] Relationship service
- [ ] Reputation service
- [ ] Autonomy service

### Week 3: Advanced Services

- [ ] Learning service
- [ ] Intuition service
- [ ] Energy management service
- [ ] Negotiation service

### Week 4: Integration & Testing

- [ ] Humanization orchestrator
- [ ] Tool integration with agents
- [ ] Unit & integration tests
- [ ] Documentation

---

## 🚀 Next Steps

1. Create database schema file (schema.sql)
2. Create TypeScript service interfaces
3. Implement services one by one
4. Create tool wrappers for agent integration
5. Test with sample agents

Ready to start? 👉 Which service should we implement first?
