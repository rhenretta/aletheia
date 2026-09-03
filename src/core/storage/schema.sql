-- Project Aletheia PostgreSQL + pgvector Unified Schema

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- 1. Raw Articles Table
CREATE TABLE IF NOT EXISTS raw_articles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_url TEXT NOT NULL UNIQUE,
    source_name TEXT NOT NULL,
    title TEXT NOT NULL,
    raw_text TEXT NOT NULL,
    author_bias_rating VARCHAR(32) NOT NULL,
    published_at TIMESTAMPTZ,
    author TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. Pure Fact Objects Table (Sanitized Epistemology Node Outputs)
CREATE TABLE IF NOT EXISTS pure_fact_objects (
    event_id VARCHAR(128) PRIMARY KEY,
    topic TEXT NOT NULL,
    verified_entities JSONB NOT NULL DEFAULT '[]'::jsonb,
    timeline JSONB NOT NULL DEFAULT '[]'::jsonb,
    agreed_facts JSONB NOT NULL DEFAULT '[]'::jsonb,
    disputed_claims JSONB NOT NULL DEFAULT '[]'::jsonb,
    adjective_density_score NUMERIC(6, 4) NOT NULL DEFAULT 0.0,
    sanitized_timestamp TIMESTAMPTZ NOT NULL,
    embedding vector(384),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pure_facts_topic ON pure_fact_objects(topic);
CREATE INDEX IF NOT EXISTS idx_pure_facts_entities ON pure_fact_objects USING GIN(verified_entities);

-- 3. User Knowledge Graphs (Behavioral Revealed Preferences)
CREATE TABLE IF NOT EXISTS user_knowledge_graphs (
    user_id VARCHAR(128) PRIMARY KEY,
    topic_weights JSONB NOT NULL DEFAULT '{}'::jsonb,
    cognitive_load_state VARCHAR(32) NOT NULL DEFAULT 'balanced',
    historical_anchors JSONB NOT NULL DEFAULT '[]'::jsonb,
    dwell_history JSONB NOT NULL DEFAULT '[]'::jsonb,
    last_updated TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    user_embedding vector(384)
);

CREATE INDEX IF NOT EXISTS idx_user_graphs_weights ON user_knowledge_graphs USING GIN(topic_weights);

-- 4. Passive Behavioral Telemetry Stream
CREATE TABLE IF NOT EXISTS behavioral_telemetry (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id VARCHAR(128) NOT NULL,
    article_id VARCHAR(128) NOT NULL,
    topic TEXT NOT NULL,
    dwell_time_ms BIGINT NOT NULL,
    scroll_depth_pct INTEGER NOT NULL,
    session_abandoned BOOLEAN NOT NULL DEFAULT FALSE,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_telemetry_session ON behavioral_telemetry(session_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_topic ON behavioral_telemetry(topic);

-- 5. Structured Agent Observability Traces
CREATE TABLE IF NOT EXISTS agent_trace_logs (
    trace_id VARCHAR(128) PRIMARY KEY,
    session_id VARCHAR(128) NOT NULL,
    node_name VARCHAR(64) NOT NULL,
    input_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
    output_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
    reasoning_rationale TEXT NOT NULL,
    latency_ms INTEGER NOT NULL,
    llm_tokens_used INTEGER DEFAULT 0,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_trace_logs_session ON agent_trace_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_trace_logs_node ON agent_trace_logs(node_name);

-- 6. Conversational Chat Sessions & Active Dialogue
CREATE TABLE IF NOT EXISTS chat_sessions (
    user_id VARCHAR(128) PRIMARY KEY,
    messages JSONB NOT NULL DEFAULT '[]'::jsonb,
    extracted_topics JSONB NOT NULL DEFAULT '[]'::jsonb,
    last_updated TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 7. Unified Topic Nodes (The Mind-State Memory Architecture Single Source of Truth)
CREATE TABLE IF NOT EXISTS unified_topic_nodes (
    user_id VARCHAR(128) PRIMARY KEY,
    topics JSONB NOT NULL DEFAULT '{}'::jsonb,
    psychological_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
    discovery_parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
    historical_anchors JSONB NOT NULL DEFAULT '[]'::jsonb,
    interest_intersections JSONB NOT NULL DEFAULT '[]'::jsonb,
    adjacent_curiosity_frontiers JSONB NOT NULL DEFAULT '[]'::jsonb,
    recent_topic_diffs JSONB NOT NULL DEFAULT '[]'::jsonb,
    harmonization_runs JSONB NOT NULL DEFAULT '[]'::jsonb,
    dwell_history JSONB NOT NULL DEFAULT '[]'::jsonb,
    last_updated TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    embedding vector(384)
);

CREATE INDEX IF NOT EXISTS idx_unified_topic_nodes_topics ON unified_topic_nodes USING GIN(topics);
CREATE INDEX IF NOT EXISTS idx_unified_topic_nodes_psych ON unified_topic_nodes USING GIN(psychological_profile);

-- Safe Alterations for backwards-compatible schema upgrades
ALTER TABLE unified_topic_nodes ADD COLUMN IF NOT EXISTS recent_topic_diffs JSONB DEFAULT '[]'::jsonb;
ALTER TABLE unified_topic_nodes ADD COLUMN IF NOT EXISTS harmonization_runs JSONB DEFAULT '[]'::jsonb;

-- 8. Application Users Table (User levels: user, admin; Tiers: free, subscriber)
CREATE TABLE IF NOT EXISTS app_users (
    id VARCHAR(128) PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255),
    image TEXT,
    role VARCHAR(32) NOT NULL DEFAULT 'user',
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    tier VARCHAR(32) NOT NULL DEFAULT 'free',
    stripe_customer_id VARCHAR(128),
    stripe_subscription_id VARCHAR(128),
    subscription_status VARCHAR(32) NOT NULL DEFAULT 'none',
    subscription_period_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    last_active_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Safe Alterations for backwards-compatible upgrades to app_users
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS tier VARCHAR(32) NOT NULL DEFAULT 'free';
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(128);
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(128);
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(32) NOT NULL DEFAULT 'none';
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS subscription_period_end TIMESTAMPTZ;

-- Indexes on app_users (applied after columns are ensured to exist)
CREATE INDEX IF NOT EXISTS idx_app_users_email ON app_users(email);
CREATE INDEX IF NOT EXISTS idx_app_users_role ON app_users(role);
CREATE INDEX IF NOT EXISTS idx_app_users_tier ON app_users(tier);

-- 9. User Usage Metrics Table
CREATE TABLE IF NOT EXISTS user_usage_metrics (
    user_id VARCHAR(128) PRIMARY KEY,
    total_chat_messages INTEGER NOT NULL DEFAULT 0,
    total_pipeline_runs INTEGER NOT NULL DEFAULT 0,
    total_tokens_used BIGINT NOT NULL DEFAULT 0,
    total_dwell_time_ms BIGINT NOT NULL DEFAULT 0,
    current_period_start TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    period_tokens_used BIGINT NOT NULL DEFAULT 0,
    period_cost_usd NUMERIC(8, 4) NOT NULL DEFAULT 0.0000,
    lifetime_cost_usd NUMERIC(8, 4) NOT NULL DEFAULT 0.0000,
    last_active_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    recent_events JSONB NOT NULL DEFAULT '[]'::jsonb
);

-- Safe Alterations for backwards-compatible upgrades to user_usage_metrics
ALTER TABLE user_usage_metrics ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE user_usage_metrics ADD COLUMN IF NOT EXISTS period_tokens_used BIGINT NOT NULL DEFAULT 0;
ALTER TABLE user_usage_metrics ADD COLUMN IF NOT EXISTS period_cost_usd NUMERIC(8, 4) NOT NULL DEFAULT 0.0000;
ALTER TABLE user_usage_metrics ADD COLUMN IF NOT EXISTS lifetime_cost_usd NUMERIC(8, 4) NOT NULL DEFAULT 0.0000;

-- 10. Support Tickets Table
CREATE TABLE IF NOT EXISTS support_tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(128),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    category VARCHAR(64) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    status VARCHAR(32) NOT NULL DEFAULT 'open',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_email ON support_tickets(email);
CREATE INDEX IF NOT EXISTS idx_support_tickets_category ON support_tickets(category);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created_at ON support_tickets(created_at);
