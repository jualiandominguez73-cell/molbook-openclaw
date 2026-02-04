-- OpenClaw PostgreSQL Database Initialization
-- This script runs on first database creation

--==============================================================================
-- Extensions
--==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

--==============================================================================
-- Schemas
--==============================================================================

CREATE SCHEMA IF NOT EXISTS openclaw;
CREATE SCHEMA IF NOT EXISTS audit;

--==============================================================================
-- Core Tables
--==============================================================================

-- Sessions table for conversation history
CREATE TABLE IF NOT EXISTS openclaw.sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id VARCHAR(255) NOT NULL,
    channel VARCHAR(100),
    user_id VARCHAR(255),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Messages table
CREATE TABLE IF NOT EXISTS openclaw.messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES openclaw.sessions(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL, -- 'user', 'assistant', 'system', 'tool'
    content TEXT,
    tool_calls JSONB,
    tool_results JSONB,
    tokens_input INTEGER,
    tokens_output INTEGER,
    model VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Agents table
CREATE TABLE IF NOT EXISTS openclaw.agents (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255),
    description TEXT,
    system_prompt TEXT,
    model VARCHAR(100),
    temperature DECIMAL(3,2),
    max_tokens INTEGER,
    tools JSONB DEFAULT '[]',
    config JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Credentials table (encrypted)
CREATE TABLE IF NOT EXISTS openclaw.credentials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    encrypted_value BYTEA NOT NULL,
    iv BYTEA NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Skills table
CREATE TABLE IF NOT EXISTS openclaw.skills (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    version VARCHAR(50),
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Channels table
CREATE TABLE IF NOT EXISTS openclaw.channels (
    id VARCHAR(255) PRIMARY KEY,
    type VARCHAR(100) NOT NULL, -- 'telegram', 'discord', 'whatsapp', etc.
    name VARCHAR(255),
    agent_id VARCHAR(255) REFERENCES openclaw.agents(id),
    config JSONB DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'inactive',
    last_active_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

--==============================================================================
-- Audit Tables
--==============================================================================

-- Security audit log
CREATE TABLE IF NOT EXISTS audit.security_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL, -- 'info', 'warning', 'critical'
    source VARCHAR(255),
    user_id VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    action VARCHAR(255),
    resource VARCHAR(255),
    details JSONB DEFAULT '{}',
    success BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- API access log
CREATE TABLE IF NOT EXISTS audit.api_access (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    method VARCHAR(10) NOT NULL,
    path VARCHAR(500) NOT NULL,
    status_code INTEGER,
    response_time_ms INTEGER,
    request_size INTEGER,
    response_size INTEGER,
    user_id VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Data access audit
CREATE TABLE IF NOT EXISTS audit.data_access (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name VARCHAR(100) NOT NULL,
    operation VARCHAR(20) NOT NULL, -- 'SELECT', 'INSERT', 'UPDATE', 'DELETE'
    record_id VARCHAR(255),
    user_id VARCHAR(255),
    old_data JSONB,
    new_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

--==============================================================================
-- Indexes
--==============================================================================

-- Sessions indexes
CREATE INDEX IF NOT EXISTS idx_sessions_agent_id ON openclaw.sessions(agent_id);
CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON openclaw.sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_sessions_channel ON openclaw.sessions(channel);

-- Messages indexes
CREATE INDEX IF NOT EXISTS idx_messages_session_id ON openclaw.messages(session_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON openclaw.messages(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_role ON openclaw.messages(role);

-- Channels indexes
CREATE INDEX IF NOT EXISTS idx_channels_type ON openclaw.channels(type);
CREATE INDEX IF NOT EXISTS idx_channels_agent_id ON openclaw.channels(agent_id);

-- Audit indexes
CREATE INDEX IF NOT EXISTS idx_security_events_type ON audit.security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON audit.security_events(created_at);
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON audit.security_events(severity);

CREATE INDEX IF NOT EXISTS idx_api_access_path ON audit.api_access(path);
CREATE INDEX IF NOT EXISTS idx_api_access_created_at ON audit.api_access(created_at);
CREATE INDEX IF NOT EXISTS idx_api_access_status_code ON audit.api_access(status_code);

--==============================================================================
-- Functions
--==============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to relevant tables
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN 
        SELECT table_name 
        FROM information_schema.columns 
        WHERE table_schema = 'openclaw' 
        AND column_name = 'updated_at'
    LOOP
        EXECUTE format('
            DROP TRIGGER IF EXISTS update_%I_updated_at ON openclaw.%I;
            CREATE TRIGGER update_%I_updated_at
                BEFORE UPDATE ON openclaw.%I
                FOR EACH ROW
                EXECUTE FUNCTION update_updated_at_column();
        ', t, t, t, t);
    END LOOP;
END;
$$ LANGUAGE plpgsql;

--==============================================================================
-- Retention Policy (Partitioning for large tables)
--==============================================================================

-- Create partition function for audit tables (optional, for high-volume deployments)
-- Uncomment if needed:

-- CREATE TABLE audit.security_events_partitioned (
--     LIKE audit.security_events INCLUDING ALL
-- ) PARTITION BY RANGE (created_at);

--==============================================================================
-- Initial Data
--==============================================================================

-- Insert default agent
INSERT INTO openclaw.agents (id, name, description, model, temperature, max_tokens)
VALUES (
    'default',
    'Default Agent',
    'Default OpenClaw agent',
    'claude-3-5-sonnet-20241022',
    0.7,
    4096
) ON CONFLICT (id) DO NOTHING;

--==============================================================================
-- Grants
--==============================================================================

-- Grant permissions to openclaw user
GRANT USAGE ON SCHEMA openclaw TO openclaw;
GRANT USAGE ON SCHEMA audit TO openclaw;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA openclaw TO openclaw;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA audit TO openclaw;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA openclaw TO openclaw;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA audit TO openclaw;

-- Grant default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA openclaw GRANT ALL ON TABLES TO openclaw;
ALTER DEFAULT PRIVILEGES IN SCHEMA audit GRANT ALL ON TABLES TO openclaw;
ALTER DEFAULT PRIVILEGES IN SCHEMA openclaw GRANT ALL ON SEQUENCES TO openclaw;
ALTER DEFAULT PRIVILEGES IN SCHEMA audit GRANT ALL ON SEQUENCES TO openclaw;

--==============================================================================
-- Complete
--==============================================================================

-- Log initialization
INSERT INTO audit.security_events (event_type, severity, source, action, details, success)
VALUES ('database_init', 'info', 'init-db.sql', 'initialize', '{"version": "1.0.0"}', true);
