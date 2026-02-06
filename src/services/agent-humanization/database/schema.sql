-- Agent Humanization System - PostgreSQL Schema
-- Created: 2026-02-06
-- Stack: PostgreSQL 16/17 + TimescaleDB + Redis

-- ============================================================================
-- 1. AGENT MEMORY TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id VARCHAR(255) NOT NULL,
  memory_type VARCHAR(50) NOT NULL, -- 'decision', 'mistake', 'pattern', 'person_insight', 'project_pattern'
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  context JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  importance INTEGER DEFAULT 5, -- 1-10, higher = more important
  retention_score FLOAT DEFAULT 1.0, -- 0-1, how well to remember
  
  CONSTRAINT agent_memory_unique_per_agent UNIQUE (agent_id, memory_type, title),
  INDEX (agent_id, created_at DESC),
  INDEX (agent_id, importance DESC),
  INDEX (memory_type)
);

CREATE TABLE IF NOT EXISTS agent_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id VARCHAR(255) NOT NULL,
  decision_type VARCHAR(50), -- 'autonomous', 'proposed', 'asked', 'escalated'
  decision_text TEXT NOT NULL,
  confidence_level INTEGER, -- 1-100
  outcome VARCHAR(50), -- 'success', 'failure', 'pending', 'partial'
  lessons_learned TEXT,
  made_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  outcome_at TIMESTAMP,
  
  INDEX (agent_id, made_at DESC),
  INDEX (agent_id, outcome),
  INDEX (decision_type)
);

CREATE TABLE IF NOT EXISTS agent_person_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id VARCHAR(255) NOT NULL,
  person_id VARCHAR(255) NOT NULL,
  insight_type VARCHAR(100), -- 'reliability', 'communication_style', 'preference', 'skill_level', 'working_hours'
  insight_text TEXT NOT NULL,
  confidence FLOAT DEFAULT 0.5, -- 0-1
  evidence_count INTEGER DEFAULT 1,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_confirmed TIMESTAMP,
  
  CONSTRAINT person_insights_unique UNIQUE (agent_id, person_id, insight_type),
  INDEX (agent_id, person_id),
  INDEX (agent_id, confidence DESC),
  INDEX (insight_type)
);

-- ============================================================================
-- 2. RELATIONSHIP TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id VARCHAR(255) NOT NULL,
  other_agent_id VARCHAR(255) NOT NULL,
  trust_score FLOAT DEFAULT 0.5, -- 0-1
  collaboration_quality VARCHAR(50), -- 'excellent', 'good', 'neutral', 'poor', 'unknown'
  interaction_count INTEGER DEFAULT 0,
  positive_interactions INTEGER DEFAULT 0,
  negative_interactions INTEGER DEFAULT 0,
  last_interaction TIMESTAMP,
  notes TEXT,
  
  CONSTRAINT relationships_unique UNIQUE (agent_id, other_agent_id),
  INDEX (agent_id, trust_score DESC),
  INDEX (agent_id, collaboration_quality)
);

CREATE TABLE IF NOT EXISTS agent_team_chemistry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id_1 VARCHAR(255) NOT NULL,
  agent_id_2 VARCHAR(255) NOT NULL,
  chemistry_score FLOAT DEFAULT 0.5, -- 0-1
  works_well BOOLEAN DEFAULT FALSE,
  conflicts BOOLEAN DEFAULT FALSE,
  conflict_type VARCHAR(100), -- 'personality', 'style', 'priority', 'communication'
  notes TEXT,
  last_assessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT team_chemistry_unique UNIQUE (agent_id_1, agent_id_2),
  INDEX (chemistry_score DESC),
  INDEX (works_well),
  INDEX (conflicts)
);

-- ============================================================================
-- 3. LEARNING & IMPROVEMENT TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_learning_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id VARCHAR(255) NOT NULL,
  log_date DATE NOT NULL,
  what_worked TEXT[],
  what_failed TEXT[],
  lessons_learned TEXT[],
  process_improvements TEXT[],
  skills_improved JSONB, -- {skill: improvement_rate}
  mistakes JSONB DEFAULT '{}',
  
  CONSTRAINT learning_logs_unique UNIQUE (agent_id, log_date),
  INDEX (agent_id, log_date DESC)
);

CREATE TABLE IF NOT EXISTS agent_mistake_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id VARCHAR(255) NOT NULL,
  mistake_type VARCHAR(255) NOT NULL,
  description TEXT,
  occurrences INTEGER DEFAULT 1,
  last_occurrence TIMESTAMP,
  recommended_action TEXT,
  fix_applied BOOLEAN DEFAULT FALSE,
  
  CONSTRAINT mistake_patterns_unique UNIQUE (agent_id, mistake_type),
  INDEX (agent_id, occurrences DESC),
  INDEX (agent_id, last_occurrence DESC)
);

-- ============================================================================
-- 4. AUTONOMY CONFIGURATION TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_autonomy_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id VARCHAR(255) NOT NULL,
  risk_level VARCHAR(50), -- 'low', 'medium', 'high'
  definition TEXT,
  autonomy_type VARCHAR(50), -- 'FULL', 'PROPOSE_THEN_DECIDE', 'ASK_THEN_WAIT'
  conditions JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT autonomy_config_unique UNIQUE (agent_id, risk_level),
  INDEX (agent_id),
  INDEX (risk_level)
);

CREATE TABLE IF NOT EXISTS agent_decisions_made (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id VARCHAR(255) NOT NULL,
  decision_type VARCHAR(50),
  task_id VARCHAR(255),
  decision_made BOOLEAN DEFAULT true,
  decision_quality VARCHAR(50), -- 'excellent', 'good', 'acceptable', 'poor'
  decision_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  outcome TEXT,
  impact_score FLOAT, -- 0-1, how much impact the decision had
  
  INDEX (agent_id, decision_time DESC),
  INDEX (agent_id, decision_quality),
  INDEX (decision_type)
);

-- ============================================================================
-- 5. REPUTATION TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_reputation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id VARCHAR(255) UNIQUE NOT NULL,
  reliability_score FLOAT DEFAULT 0.5, -- 0-1, on-time delivery rate
  speed_rating VARCHAR(50) DEFAULT 'unknown', -- 'fast', 'on_track', 'slow', 'very_slow'
  quality_rating VARCHAR(50) DEFAULT 'unknown', -- 'excellent', 'good', 'average', 'poor'
  accountability_score FLOAT DEFAULT 0.5, -- 0-1, acknowledges mistakes
  communication_score FLOAT DEFAULT 0.5, -- 0-1
  collaboration_score FLOAT DEFAULT 0.5, -- 0-1
  trend VARCHAR(50) DEFAULT 'stable', -- 'improving', 'declining', 'stable'
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX (reliability_score DESC),
  INDEX (quality_rating),
  INDEX (trend)
);

CREATE TABLE IF NOT EXISTS agent_track_record (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id VARCHAR(255) NOT NULL,
  task_id VARCHAR(255) NOT NULL,
  task_name VARCHAR(255),
  category VARCHAR(100), -- 'feature', 'bugfix', 'refactor', 'infrastructure'
  planned_days INTEGER,
  actual_days INTEGER,
  quality_rating VARCHAR(50), -- 'excellent', 'good', 'average', 'poor'
  delivered_status VARCHAR(50), -- 'early', 'on_time', 'late', 'failed', 'partial'
  completed_at TIMESTAMP,
  notes TEXT,
  
  INDEX (agent_id, completed_at DESC),
  INDEX (agent_id, delivered_status),
  INDEX (delivered_status)
);

-- ============================================================================
-- 6. INTUITION & PATTERN MATCHING TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_intuition_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id VARCHAR(255) NOT NULL,
  pattern_name VARCHAR(255) NOT NULL,
  pattern_description TEXT,
  trigger_conditions JSONB DEFAULT '{}',
  recommended_action TEXT,
  action_confidence FLOAT DEFAULT 0.5, -- 0-1
  times_triggered INTEGER DEFAULT 0,
  times_correct INTEGER DEFAULT 0,
  accuracy_rate FLOAT DEFAULT 0.0, -- times_correct / times_triggered
  
  CONSTRAINT intuition_rules_unique UNIQUE (agent_id, pattern_name),
  INDEX (agent_id, accuracy_rate DESC),
  INDEX (agent_id, times_triggered DESC)
);

CREATE TABLE IF NOT EXISTS agent_pattern_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id VARCHAR(255) NOT NULL,
  rule_id UUID REFERENCES agent_intuition_rules(id),
  matched_context JSONB DEFAULT '{}',
  action_taken TEXT,
  outcome VARCHAR(50), -- 'correct', 'incorrect', 'partial', 'unknown'
  matched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX (agent_id, matched_at DESC),
  INDEX (rule_id, outcome)
);

-- ============================================================================
-- 7. ENERGY MANAGEMENT TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_energy_baseline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id VARCHAR(255) UNIQUE NOT NULL,
  peak_hours VARCHAR(50)[], -- ['09:00-12:00', '14:00-16:00']
  low_hours VARCHAR(50)[],
  max_deep_work_hours INTEGER DEFAULT 4,
  break_needed_after_hours INTEGER DEFAULT 3,
  recovery_break_minutes INTEGER DEFAULT 15,
  max_context_switches_per_day INTEGER DEFAULT 4,
  
  INDEX (agent_id)
);

CREATE TABLE IF NOT EXISTS agent_energy_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id VARCHAR(255) UNIQUE NOT NULL,
  current_hour VARCHAR(10),
  energy_level FLOAT DEFAULT 0.5, -- 0-1
  focus_level FLOAT DEFAULT 0.5, -- 0-1
  context_switches_today INTEGER DEFAULT 0,
  deep_work_minutes INTEGER DEFAULT 0,
  last_break TIMESTAMP,
  quality_variance FLOAT DEFAULT 0.0, -- 0-1
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX (agent_id)
);

-- ============================================================================
-- 8. NEGOTIATION & CONFLICT TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_assertiveness_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id VARCHAR(255) NOT NULL,
  concern_type VARCHAR(100), -- 'deadline', 'scope', 'design', 'metric', 'resources'
  concern_level VARCHAR(50), -- 'critical', 'high', 'medium', 'low'
  trigger_conditions TEXT,
  recommended_response TEXT,
  alternatives JSONB DEFAULT '{}',
  escalation_path TEXT,
  
  INDEX (agent_id, concern_level),
  INDEX (concern_type)
);

CREATE TABLE IF NOT EXISTS agent_conflict_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id VARCHAR(255) NOT NULL,
  other_agent_id VARCHAR(255),
  conflict_type VARCHAR(100),
  description TEXT,
  resolution VARCHAR(50), -- 'agreed', 'escalated', 'waiting', 'resolved'
  outcome VARCHAR(100),
  resolved_at TIMESTAMP,
  resolved_by VARCHAR(255),
  
  INDEX (agent_id, resolved_at DESC),
  INDEX (agent_id, other_agent_id),
  INDEX (conflict_type)
);

-- ============================================================================
-- 9. AUDIT & LOGGING TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_action_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id VARCHAR(255) NOT NULL,
  action_type VARCHAR(100), -- 'decision', 'interaction', 'learning', 'update'
  action_description TEXT,
  action_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  context JSONB DEFAULT '{}',
  
  INDEX (agent_id, action_at DESC),
  INDEX (action_type, action_at DESC)
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_agent_memory_lookup ON agent_memory(agent_id, memory_type);
CREATE INDEX IF NOT EXISTS idx_decisions_recent ON agent_decisions(agent_id, made_at DESC) WHERE outcome = 'success';
CREATE INDEX IF NOT EXISTS idx_relationships_trust ON agent_relationships(agent_id, trust_score DESC);
CREATE INDEX IF NOT EXISTS idx_reputation_all_scores ON agent_reputation(reliability_score, quality_rating, accountability_score);
CREATE INDEX IF NOT EXISTS idx_track_record_status ON agent_track_record(agent_id, delivered_status);
CREATE INDEX IF NOT EXISTS idx_learning_recent ON agent_learning_logs(agent_id, log_date DESC);
CREATE INDEX IF NOT EXISTS idx_intuition_accuracy ON agent_intuition_rules(agent_id, accuracy_rate DESC);
CREATE INDEX IF NOT EXISTS idx_energy_state ON agent_energy_state(agent_id);

-- ============================================================================
-- VIEWS FOR COMMON QUERIES
-- ============================================================================

CREATE OR REPLACE VIEW agent_reputation_summary AS
SELECT 
  ar.agent_id,
  ar.reliability_score,
  ar.speed_rating,
  ar.quality_rating,
  ar.accountability_score,
  ar.communication_score,
  ar.collaboration_score,
  ar.trend,
  COUNT(DISTINCT atr.id) as total_tasks,
  SUM(CASE WHEN atr.delivered_status = 'on_time' THEN 1 ELSE 0 END)::FLOAT / 
    COUNT(DISTINCT atr.id) as on_time_rate,
  AVG(CASE WHEN atr.quality_rating = 'excellent' THEN 1 
           WHEN atr.quality_rating = 'good' THEN 0.75
           WHEN atr.quality_rating = 'average' THEN 0.5
           ELSE 0.25 END) as avg_quality_score
FROM agent_reputation ar
LEFT JOIN agent_track_record atr ON ar.agent_id = atr.agent_id
GROUP BY ar.agent_id, ar.reliability_score, ar.speed_rating, ar.quality_rating,
         ar.accountability_score, ar.communication_score, ar.collaboration_score, ar.trend;

CREATE OR REPLACE VIEW agent_learning_summary AS
SELECT 
  agent_id,
  COUNT(*) as days_logged,
  ARRAY_AGG(DISTINCT (lessons_learned)[1]) as top_lessons,
  ARRAY_AGG(DISTINCT (mistakes->>'type')) as repeated_mistakes,
  array_length(skills_improved::text[], 1) as skills_improved
FROM agent_learning_logs
GROUP BY agent_id;

CREATE OR REPLACE VIEW agent_relationship_network AS
SELECT 
  ar.agent_id,
  ar.other_agent_id,
  ar.trust_score,
  ar.collaboration_quality,
  ar.interaction_count,
  atc.chemistry_score,
  atc.works_well,
  atc.conflicts
FROM agent_relationships ar
LEFT JOIN agent_team_chemistry atc 
  ON (ar.agent_id = atc.agent_id_1 AND ar.other_agent_id = atc.agent_id_2)
  OR (ar.agent_id = atc.agent_id_2 AND ar.other_agent_id = atc.agent_id_1);

-- ============================================================================
-- COMMENTS & DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE agent_memory IS 'Stores persistent memories for agents - decisions, insights, patterns';
COMMENT ON TABLE agent_decisions IS 'Decision history with outcomes and lessons learned';
COMMENT ON TABLE agent_relationships IS 'Trust scores and collaboration quality between agents';
COMMENT ON TABLE agent_learning_logs IS 'Daily learning logs - what worked, what failed, improvements';
COMMENT ON TABLE agent_reputation IS 'Overall reputation scores and trends for agents';
COMMENT ON TABLE agent_track_record IS 'Task delivery history for reputation building';
COMMENT ON TABLE agent_intuition_rules IS 'Pattern-matching rules for intuitive decision-making';
COMMENT ON TABLE agent_energy_state IS 'Current energy and focus levels (time-series in TimescaleDB)';
COMMENT ON TABLE agent_assertiveness_rules IS 'Rules for pushing back and negotiating respectfully';
COMMENT ON TABLE agent_conflict_history IS 'Record of conflicts and resolutions';

-- ============================================================================
-- DONE
-- ============================================================================

-- All tables created. Next: TimescaleDB setup in separate migration.
