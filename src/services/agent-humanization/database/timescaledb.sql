-- TimescaleDB Hypertables for Time-Series Data
-- Created: 2026-02-06
-- Run AFTER main schema.sql

-- ============================================================================
-- CREATE EXTENSION (if not already installed)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- ============================================================================
-- AGENT BEHAVIOR METRICS (Time-Series)
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_behavior_metrics (
  time TIMESTAMP NOT NULL,
  agent_id VARCHAR(255) NOT NULL,
  metric_type VARCHAR(100) NOT NULL, -- 'decision_quality', 'collaboration', 'output_quality', 'autonomy_level'
  metric_value FLOAT NOT NULL,
  context JSONB DEFAULT '{}',
  
  PRIMARY KEY (time, agent_id, metric_type)
);

SELECT create_hypertable(
  'agent_behavior_metrics',
  'time',
  if_not_exists => TRUE
);

CREATE INDEX IF NOT EXISTS idx_agent_behavior_lookup 
  ON agent_behavior_metrics (agent_id, time DESC);
CREATE INDEX IF NOT EXISTS idx_behavior_metric_type 
  ON agent_behavior_metrics (metric_type, time DESC);

-- ============================================================================
-- AGENT ENERGY HISTORY (Time-Series)
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_energy_history (
  time TIMESTAMP NOT NULL,
  agent_id VARCHAR(255) NOT NULL,
  energy_level FLOAT NOT NULL, -- 0-1
  focus_level FLOAT NOT NULL, -- 0-1
  quality_output FLOAT, -- 0-1, quality of work at this time
  context_switches INTEGER DEFAULT 0,
  deep_work_minutes INTEGER DEFAULT 0,
  
  PRIMARY KEY (time, agent_id)
);

SELECT create_hypertable(
  'agent_energy_history',
  'time',
  if_not_exists => TRUE
);

CREATE INDEX IF NOT EXISTS idx_agent_energy_lookup 
  ON agent_energy_history (agent_id, time DESC);
CREATE INDEX IF NOT EXISTS idx_energy_by_hour 
  ON agent_energy_history (agent_id, date_trunc('hour', time));

-- ============================================================================
-- AGENT DECISION LOG (Time-Series)
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_decision_log (
  time TIMESTAMP NOT NULL,
  agent_id VARCHAR(255) NOT NULL,
  decision_type VARCHAR(50) NOT NULL, -- 'autonomous', 'proposed', 'asked', 'escalated'
  decision_quality VARCHAR(50) NOT NULL, -- 'excellent', 'good', 'acceptable', 'poor'
  outcome VARCHAR(50), -- 'success', 'failure', 'pending', 'partial'
  confidence_level INTEGER, -- 1-100
  impact_score FLOAT, -- 0-1
  context JSONB DEFAULT '{}',
  
  PRIMARY KEY (time, agent_id)
);

SELECT create_hypertable(
  'agent_decision_log',
  'time',
  if_not_exists => TRUE
);

CREATE INDEX IF NOT EXISTS idx_agent_decision_lookup 
  ON agent_decision_log (agent_id, time DESC);
CREATE INDEX IF NOT EXISTS idx_decision_quality 
  ON agent_decision_log (agent_id, decision_quality, time DESC);
CREATE INDEX IF NOT EXISTS idx_decision_autonomy 
  ON agent_decision_log (agent_id, decision_type, time DESC);

-- ============================================================================
-- AGENT LEARNING PROGRESS (Time-Series)
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_learning_progress (
  time TIMESTAMP NOT NULL,
  agent_id VARCHAR(255) NOT NULL,
  skill_name VARCHAR(255) NOT NULL,
  proficiency FLOAT NOT NULL, -- 0-1
  improvement_rate FLOAT, -- positive = improving, negative = declining
  practice_hours INTEGER DEFAULT 0,
  
  PRIMARY KEY (time, agent_id, skill_name)
);

SELECT create_hypertable(
  'agent_learning_progress',
  'time',
  if_not_exists => TRUE
);

CREATE INDEX IF NOT EXISTS idx_agent_skill_lookup 
  ON agent_learning_progress (agent_id, time DESC);
CREATE INDEX IF NOT EXISTS idx_skill_proficiency 
  ON agent_learning_progress (agent_id, skill_name, proficiency DESC);

-- ============================================================================
-- AGENT RELIABILITY HISTORY (Time-Series)
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_reliability_history (
  time TIMESTAMP NOT NULL,
  agent_id VARCHAR(255) NOT NULL,
  on_time_rate FLOAT, -- 0-1
  quality_score FLOAT, -- 0-1
  accountability_score FLOAT, -- 0-1
  communication_score FLOAT, -- 0-1
  overall_reputation_score FLOAT, -- 0-1
  
  PRIMARY KEY (time, agent_id)
);

SELECT create_hypertable(
  'agent_reliability_history',
  'time',
  if_not_exists => TRUE
);

CREATE INDEX IF NOT EXISTS idx_agent_reliability_lookup 
  ON agent_reliability_history (agent_id, time DESC);
CREATE INDEX IF NOT EXISTS idx_reputation_trends 
  ON agent_reliability_history (agent_id, overall_reputation_score, time DESC);

-- ============================================================================
-- AGENT COLLABORATION HISTORY (Time-Series)
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_collaboration_history (
  time TIMESTAMP NOT NULL,
  agent_id_1 VARCHAR(255) NOT NULL,
  agent_id_2 VARCHAR(255) NOT NULL,
  interaction_quality FLOAT, -- 0-1
  trust_change FLOAT, -- -1 to +1, change in trust
  conflict_level FLOAT, -- 0-1, 0 = no conflict, 1 = high conflict
  
  PRIMARY KEY (time, agent_id_1, agent_id_2)
);

SELECT create_hypertable(
  'agent_collaboration_history',
  'time',
  if_not_exists => TRUE
);

CREATE INDEX IF NOT EXISTS idx_collaboration_agents 
  ON agent_collaboration_history (agent_id_1, agent_id_2, time DESC);
CREATE INDEX IF NOT EXISTS idx_collaboration_quality 
  ON agent_collaboration_history (agent_id_1, interaction_quality, time DESC);

-- ============================================================================
-- MATERIALIZED VIEWS FOR ANALYTICS
-- ============================================================================

-- Continuous aggregate for daily behavior summary
CREATE MATERIALIZED VIEW IF NOT EXISTS agent_daily_behavior AS
SELECT 
  time_bucket('1 day', time) as day,
  agent_id,
  AVG(metric_value) as avg_decision_quality,
  MAX(metric_value) as peak_performance,
  MIN(metric_value) as lowest_performance
FROM agent_behavior_metrics
WHERE metric_type = 'decision_quality'
GROUP BY day, agent_id;

CREATE INDEX IF NOT EXISTS idx_daily_behavior_agent_day 
  ON agent_daily_behavior (agent_id, day DESC);

-- Continuous aggregate for hourly energy patterns
CREATE MATERIALIZED VIEW IF NOT EXISTS agent_hourly_energy_pattern AS
SELECT 
  date_trunc('hour', time) as hour,
  agent_id,
  AVG(energy_level) as avg_energy,
  AVG(focus_level) as avg_focus,
  AVG(quality_output) as avg_quality
FROM agent_energy_history
GROUP BY hour, agent_id;

CREATE INDEX IF NOT EXISTS idx_hourly_energy_agent_hour 
  ON agent_hourly_energy_pattern (agent_id, hour DESC);

-- Weekly learning progress aggregate
CREATE MATERIALIZED VIEW IF NOT EXISTS agent_weekly_learning AS
SELECT 
  time_bucket('1 week', time) as week,
  agent_id,
  skill_name,
  AVG(proficiency) as avg_proficiency,
  MAX(improvement_rate) as max_improvement,
  SUM(practice_hours) as total_practice_hours
FROM agent_learning_progress
GROUP BY week, agent_id, skill_name;

CREATE INDEX IF NOT EXISTS idx_weekly_learning_agent_skill 
  ON agent_weekly_learning (agent_id, skill_name, week DESC);

-- Monthly reputation trend
CREATE MATERIALIZED VIEW IF NOT EXISTS agent_monthly_reputation AS
SELECT 
  time_bucket('1 month', time) as month,
  agent_id,
  AVG(on_time_rate) as on_time_rate,
  AVG(quality_score) as quality_score,
  AVG(overall_reputation_score) as overall_score
FROM agent_reliability_history
GROUP BY month, agent_id;

CREATE INDEX IF NOT EXISTS idx_monthly_reputation_agent 
  ON agent_monthly_reputation (agent_id, month DESC);

-- ============================================================================
-- FUNCTIONS FOR COMMON OPERATIONS
-- ============================================================================

-- Get agent energy level at specific time
CREATE OR REPLACE FUNCTION get_agent_energy_at_time(
  p_agent_id VARCHAR,
  p_time TIMESTAMP
)
RETURNS TABLE (
  energy_level FLOAT,
  focus_level FLOAT,
  quality_output FLOAT
) AS $$
SELECT 
  energy_level,
  focus_level,
  quality_output
FROM agent_energy_history
WHERE agent_id = p_agent_id
  AND time <= p_time
ORDER BY time DESC
LIMIT 1;
$$ LANGUAGE SQL;

-- Get decision quality trend for agent
CREATE OR REPLACE FUNCTION get_decision_quality_trend(
  p_agent_id VARCHAR,
  p_days INTEGER DEFAULT 7
)
RETURNS TABLE (
  date_bucket TIMESTAMP,
  avg_quality FLOAT,
  total_decisions BIGINT,
  success_rate FLOAT
) AS $$
SELECT 
  time_bucket('1 day', time) as date_bucket,
  AVG(CASE WHEN decision_quality = 'excellent' THEN 1.0
           WHEN decision_quality = 'good' THEN 0.75
           WHEN decision_quality = 'acceptable' THEN 0.5
           ELSE 0.25 END) as avg_quality,
  COUNT(*) as total_decisions,
  SUM(CASE WHEN outcome = 'success' THEN 1 ELSE 0 END)::FLOAT / COUNT(*) as success_rate
FROM agent_decision_log
WHERE agent_id = p_agent_id
  AND time > NOW() - INTERVAL '1 day' * p_days
GROUP BY date_bucket
ORDER BY date_bucket DESC;
$$ LANGUAGE SQL;

-- Get learning velocity for agent
CREATE OR REPLACE FUNCTION get_learning_velocity(
  p_agent_id VARCHAR,
  p_skill_name VARCHAR,
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  skill_name VARCHAR,
  start_proficiency FLOAT,
  current_proficiency FLOAT,
  improvement_percentage FLOAT,
  practice_hours BIGINT
) AS $$
WITH skill_data AS (
  SELECT 
    skill_name,
    proficiency,
    practice_hours,
    ROW_NUMBER() OVER (ORDER BY time ASC) as rn_asc,
    ROW_NUMBER() OVER (ORDER BY time DESC) as rn_desc
  FROM agent_learning_progress
  WHERE agent_id = p_agent_id
    AND skill_name = p_skill_name
    AND time > NOW() - INTERVAL '1 day' * p_days
)
SELECT 
  p_skill_name::VARCHAR as skill_name,
  (SELECT proficiency FROM skill_data WHERE rn_asc = 1) as start_proficiency,
  (SELECT proficiency FROM skill_data WHERE rn_desc = 1) as current_proficiency,
  ((SELECT proficiency FROM skill_data WHERE rn_desc = 1) - 
   (SELECT proficiency FROM skill_data WHERE rn_asc = 1)) * 100 as improvement_percentage,
  SUM(practice_hours)::BIGINT as practice_hours
FROM skill_data
GROUP BY skill_name;
$$ LANGUAGE SQL;

-- ============================================================================
-- RETENTION POLICIES (optional - keep data for performance)
-- ============================================================================

-- Keep detailed metrics for 90 days, aggregated for 1 year
SELECT add_retention_policy(
  'agent_behavior_metrics',
  INTERVAL '90 days',
  if_not_exists => TRUE
);

SELECT add_retention_policy(
  'agent_energy_history',
  INTERVAL '90 days',
  if_not_exists => TRUE
);

SELECT add_retention_policy(
  'agent_decision_log',
  INTERVAL '1 year',
  if_not_exists => TRUE
);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE agent_behavior_metrics IS 'Time-series: agent behavior metrics (decision quality, collaboration, etc.)';
COMMENT ON TABLE agent_energy_history IS 'Time-series: agent energy and focus levels throughout the day';
COMMENT ON TABLE agent_decision_log IS 'Time-series: all decisions made by agents with outcomes';
COMMENT ON TABLE agent_learning_progress IS 'Time-series: skill proficiency progression over time';
COMMENT ON TABLE agent_reliability_history IS 'Time-series: reputation scores over time';
COMMENT ON TABLE agent_collaboration_history IS 'Time-series: interaction quality between agent pairs';

-- ============================================================================
-- DONE
-- ============================================================================

-- TimescaleDB setup complete. Ready for time-series data ingestion.
