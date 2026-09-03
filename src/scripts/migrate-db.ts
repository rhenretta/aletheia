import fs from "fs";
import path from "path";
import pg from "pg";
import { SEED_DATA_STATE } from "../core/storage/seed-state";

const { Pool } = pg;

async function runMigration() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("❌ DATABASE_URL environment variable is missing!");
    process.exit(1);
  }

  console.log("🗄️ Connecting to PostgreSQL to run schema migrations...");
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes("amazonaws.com") ? { rejectUnauthorized: false } : undefined,
  });

  try {
    const client = await pool.connect();
    const schemaPath = path.resolve(process.cwd(), "src", "core", "storage", "schema.sql");
    const sql = fs.readFileSync(schemaPath, "utf8");

    console.log("📦 Applying schema alterations for app_users and user_usage_metrics...");
    await client.query(`
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
      ALTER TABLE app_users ADD COLUMN IF NOT EXISTS tier VARCHAR(32) NOT NULL DEFAULT 'free';
      ALTER TABLE app_users ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(128);
      ALTER TABLE app_users ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(128);
      ALTER TABLE app_users ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(32) NOT NULL DEFAULT 'none';
      ALTER TABLE app_users ADD COLUMN IF NOT EXISTS subscription_period_end TIMESTAMPTZ;

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
      ALTER TABLE user_usage_metrics ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
      ALTER TABLE user_usage_metrics ADD COLUMN IF NOT EXISTS period_tokens_used BIGINT NOT NULL DEFAULT 0;
      ALTER TABLE user_usage_metrics ADD COLUMN IF NOT EXISTS period_cost_usd NUMERIC(8, 4) NOT NULL DEFAULT 0.0000;
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

      CREATE TABLE IF NOT EXISTS direct_sources (
        id VARCHAR(128) PRIMARY KEY,
        topic TEXT NOT NULL,
        source_type VARCHAR(32) NOT NULL,
        url TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        publisher_name TEXT NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'pending_validation',
        reliability_score NUMERIC(4, 3) NOT NULL DEFAULT 1.000,
        platform VARCHAR(64),
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        last_crawled_at TIMESTAMPTZ,
        last_successful_content_at TIMESTAMPTZ,
        etag TEXT,
        last_modified TEXT,
        consecutive_failures INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      ALTER TABLE direct_sources ADD COLUMN IF NOT EXISTS platform VARCHAR(64);
      ALTER TABLE direct_sources ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
    `);

    console.log("📦 Applying schema.sql DDL...");
    await client.query(sql);
    await client.query("ALTER TABLE unified_topic_nodes ADD COLUMN IF NOT EXISTS recent_topic_diffs JSONB DEFAULT '[]'::jsonb;");
    await client.query("ALTER TABLE unified_topic_nodes ADD COLUMN IF NOT EXISTS harmonization_runs JSONB DEFAULT '[]'::jsonb;");
    console.log("✅ Database schema migration successfully applied!");

    // Seed and restore all persistent state into RDS PostgreSQL
    console.log("📥 Seeding persistent user topics and history into RDS PostgreSQL...");
    const data = SEED_DATA_STATE as any;
    if (data.topicNodes) {
        for (const [userId, node] of Object.entries(data.topicNodes) as [string, any][]) {
          if (userId && node && Object.keys(node.topics || {}).length > 0) {
            console.log(`   Seeding unified topic node for ${userId} (${Object.keys(node.topics).length} topics)...`);
            await client.query(
              `INSERT INTO unified_topic_nodes (user_id, topics, psychological_profile, discovery_parameters, historical_anchors, interest_intersections, adjacent_curiosity_frontiers, recent_topic_diffs, harmonization_runs, dwell_history, last_updated)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
               ON CONFLICT (user_id) DO UPDATE SET
                 topics = EXCLUDED.topics,
                 psychological_profile = EXCLUDED.psychological_profile,
                 discovery_parameters = EXCLUDED.discovery_parameters,
                 historical_anchors = EXCLUDED.historical_anchors,
                 interest_intersections = EXCLUDED.interest_intersections,
                 adjacent_curiosity_frontiers = EXCLUDED.adjacent_curiosity_frontiers,
                 recent_topic_diffs = EXCLUDED.recent_topic_diffs,
                 harmonization_runs = EXCLUDED.harmonization_runs,
                 dwell_history = EXCLUDED.dwell_history,
                 last_updated = EXCLUDED.last_updated`,
              [
                node.user_id || userId,
                JSON.stringify(node.topics || {}),
                JSON.stringify(node.psychological_profile || {}),
                JSON.stringify(node.discovery_parameters || {}),
                JSON.stringify(node.historical_anchors || []),
                JSON.stringify(node.interest_intersections || []),
                JSON.stringify(node.adjacent_curiosity_frontiers || []),
                JSON.stringify(node.recent_topic_diffs || []),
                JSON.stringify(node.harmonization_runs || []),
                JSON.stringify(node.dwell_history || []),
                node.last_updated || new Date().toISOString(),
              ]
            );

            // Also seed user_knowledge_graphs
            const topicWeights: Record<string, number> = {};
            for (const [topic, meta] of Object.entries(node.topics as Record<string, any>)) {
              topicWeights[topic] = meta.weight;
            }
            await client.query(
              `INSERT INTO user_knowledge_graphs (user_id, topic_weights, cognitive_load_state, historical_anchors, dwell_history, last_updated)
               VALUES ($1, $2, $3, $4, $5, $6)
               ON CONFLICT (user_id) DO UPDATE SET
                 topic_weights = EXCLUDED.topic_weights,
                 cognitive_load_state = EXCLUDED.cognitive_load_state,
                 historical_anchors = EXCLUDED.historical_anchors,
                 dwell_history = EXCLUDED.dwell_history,
                 last_updated = EXCLUDED.last_updated`,
              [
                node.user_id || userId,
                JSON.stringify(topicWeights),
                "balanced",
                JSON.stringify(node.historical_anchors || []),
                JSON.stringify(node.dwell_history || []),
                node.last_updated || new Date().toISOString(),
              ]
            );
          }
        }
      }

      if (data.chatSessions) {
        for (const [userId, chat] of Object.entries(data.chatSessions) as [string, any][]) {
          if (userId && chat && (chat.messages?.length > 0 || chat.extracted_topics?.length > 0)) {
            console.log(`   Seeding chat session for ${userId} (${chat.messages?.length || 0} msgs)...`);
            await client.query(
              `INSERT INTO chat_sessions (user_id, messages, extracted_topics, last_updated)
               VALUES ($1, $2, $3, $4)
               ON CONFLICT (user_id) DO UPDATE SET
                 messages = EXCLUDED.messages,
                 extracted_topics = EXCLUDED.extracted_topics,
                 last_updated = EXCLUDED.last_updated`,
              [
                userId,
                JSON.stringify(chat.messages || []),
                JSON.stringify(chat.extracted_topics || []),
                new Date().toISOString(),
              ]
            );
          }
        }
      }
      console.log("✅ Persistent user data successfully restored in RDS PostgreSQL!");

      client.release();
    } catch (err) {
      console.error("❌ Database migration failed:", err);
      process.exit(1);
    } finally {
      await pool.end();
    }
  }

runMigration();
