import fs from "fs";
import path from "path";
import pg from "pg";

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

    console.log("📦 Applying schema.sql DDL...");
    await client.query(sql);
    console.log("✅ Database schema migration successfully applied!");

    // Seed and restore all persistent state from data/storage_state.json into RDS PostgreSQL
    const diskPath = path.resolve(process.cwd(), "data", "storage_state.json");
    if (fs.existsSync(diskPath)) {
      console.log("📥 Seeding persistent user topics and history into RDS PostgreSQL...");
      const raw = fs.readFileSync(diskPath, "utf8");
      const data = JSON.parse(raw);
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
    }

    client.release();
  } catch (err) {
    console.error("❌ Database migration failed:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
