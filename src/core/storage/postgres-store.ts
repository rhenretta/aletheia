import pg from "pg";
import fs from "fs";
import path from "path";
import {
  UserKnowledgeGraph,
  PureFactObject,
  RawArticle,
  BehavioralTelemetry,
  AgentTraceLog,
  UnifiedTopicNode,
  AppUser,
  UserRole,
  UserTier,
  SubscriptionStatus,
  UserUsageMetrics,
  UsageEvent,
  UsageLimitStatus,
  SupportTicket,
  DirectSource,
  DirectSourceStatus,
} from "../types/contracts";
import { DataPersistenceStore } from "./persistence";
import { SEED_DATA_STATE } from "./seed-state";

const { Pool } = pg;

export class PostgresStore {
  private static instance: PostgresStore;
  private pool: pg.Pool | null = null;
  private isConnected: boolean = false;
  private schemaInitialized: boolean = false;

  // In-memory mirror for fast lookup
  private memoryUserGraphs: Map<string, UserKnowledgeGraph> = new Map();
  private memoryTopicNodes: Map<string, UnifiedTopicNode> = new Map();
  private memoryFactCache: Map<string, PureFactObject> = new Map();
  private memoryChatSessions: Map<string, { messages: any[]; extracted_topics: any[] }> = new Map();
  private memoryTraces: AgentTraceLog[] = [];
  private memoryUsers: Map<string, AppUser> = new Map();
  private memoryUserUsage: Map<string, UserUsageMetrics> = new Map();
  private memorySupportTickets: Map<string, SupportTicket> = new Map();
  private memoryDirectSources: Map<string, DirectSource> = new Map();

  private diskFilePath: string;

  private constructor() {
    this.diskFilePath = path.resolve(process.cwd(), "data", "storage_state.json");
    this.ensureDataDirectory();
    this.loadFromDisk();

    const databaseUrl = process.env.DATABASE_URL;
    if (databaseUrl) {
      try {
        const isRemoteDb =
          databaseUrl.includes("amazonaws.com") ||
          databaseUrl.includes("rds") ||
          !databaseUrl.includes("localhost");

        this.pool = new Pool({
          connectionString: databaseUrl,
          max: 20,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 5000,
          ssl: isRemoteDb ? { rejectUnauthorized: false } : undefined,
        });
        console.log("PostgresStore: Initialized database pool (SSL:", isRemoteDb, ")");
      } catch (err) {
        console.warn("PostgresStore: Could not initialize pool:", err);
      }
    }
  }

  public static getInstance(): PostgresStore {
    if (!PostgresStore.instance) {
      PostgresStore.instance = new PostgresStore();
    }
    return PostgresStore.instance;
  }

  public isPostgresConnected(): boolean {
    return this.isConnected;
  }

  private ensureDataDirectory(): void {
    const dataDir = path.resolve(process.cwd(), "data");
    if (!fs.existsSync(dataDir)) {
      try {
        fs.mkdirSync(dataDir, { recursive: true });
      } catch (e) {
        // Ignore if directory exists
      }
    }
  }

  private loadFromDisk(): void {
    try {
      // Seed default baseline from SEED_DATA_STATE
      const seed = SEED_DATA_STATE as any;
      if (seed.userGraphs) {
        this.memoryUserGraphs = new Map(Object.entries(seed.userGraphs));
      }
      if (seed.topicNodes) {
        this.memoryTopicNodes = new Map(Object.entries(seed.topicNodes));
      }
      if (seed.chatSessions) {
        this.memoryChatSessions = new Map(Object.entries(seed.chatSessions));
      }
      if (seed.factCache) {
        this.memoryFactCache = new Map(Object.entries(seed.factCache));
      }

      // Seed baseline registered users
      const defaultUsers: AppUser[] = [
        {
          id: "usr_rhenretta_gmail_com",
          email: "rhenretta@gmail.com",
          name: "R. Henretta",
          image: "https://lh3.googleusercontent.com/a/default-user",
          role: "admin",
          status: "active",
          tier: "subscriber",
          subscription_status: "active",
          created_at: "2026-08-30T00:00:00.000Z",
          last_active_at: new Date().toISOString(),
        },
        {
          id: "usr_alex",
          email: "alex@ciclops.io",
          name: "Alex Mercer",
          image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80",
          role: "user",
          status: "active",
          tier: "free",
          subscription_status: "none",
          created_at: "2026-08-31T00:00:00.000Z",
          last_active_at: new Date().toISOString(),
        },
        {
          id: "usr_default",
          email: "guest@ciclops.io",
          name: "Default Guest",
          role: "user",
          status: "active",
          tier: "free",
          subscription_status: "none",
          created_at: "2026-08-30T00:00:00.000Z",
          last_active_at: new Date().toISOString(),
        },
      ];

      for (const u of defaultUsers) {
        this.memoryUsers.set(u.id, u);
      }

      // Seed baseline usage
      const defaultUsage: UserUsageMetrics[] = [
        {
          user_id: "usr_rhenretta_gmail_com",
          total_chat_messages: 24,
          total_pipeline_runs: 8,
          total_tokens_used: 18450,
          total_dwell_time_ms: 342000,
          current_period_start: new Date(Date.now() - 7 * 86400000).toISOString(),
          period_tokens_used: 18450,
          period_cost_usd: 0.0437,
          lifetime_cost_usd: 0.0437,
          last_active_at: new Date().toISOString(),
          recent_events: [
            { type: "login", timestamp: new Date(Date.now() - 3600000).toISOString(), detail: "User signed in" },
            { type: "chat", timestamp: new Date(Date.now() - 2400000).toISOString(), detail: "Dialogue turn analyzed" },
            { type: "pipeline", timestamp: new Date(Date.now() - 1200000).toISOString(), detail: "Feed curation pipeline executed" },
          ],
        },
        {
          user_id: "usr_alex",
          total_chat_messages: 12,
          total_pipeline_runs: 4,
          total_tokens_used: 9200,
          total_dwell_time_ms: 184000,
          current_period_start: new Date(Date.now() - 7 * 86400000).toISOString(),
          period_tokens_used: 9200,
          period_cost_usd: 0.0218,
          lifetime_cost_usd: 0.0218,
          last_active_at: new Date(Date.now() - 86400000).toISOString(),
          recent_events: [
            { type: "chat", timestamp: new Date(Date.now() - 86400000).toISOString(), detail: "Discussed quantum computing" },
          ],
        },
        {
          user_id: "usr_default",
          total_chat_messages: 5,
          total_pipeline_runs: 2,
          total_tokens_used: 3100,
          total_dwell_time_ms: 65000,
          current_period_start: new Date(Date.now() - 7 * 86400000).toISOString(),
          period_tokens_used: 3100,
          period_cost_usd: 0.0087,
          lifetime_cost_usd: 0.0087,
          last_active_at: new Date(Date.now() - 172800000).toISOString(),
          recent_events: [],
        },
      ];

      for (const m of defaultUsage) {
        this.memoryUserUsage.set(m.user_id, m);
      }

      if (fs.existsSync(this.diskFilePath)) {
        const raw = fs.readFileSync(this.diskFilePath, "utf-8");
        const parsed = JSON.parse(raw);
        if (parsed.userGraphs) {
          for (const [k, v] of Object.entries(parsed.userGraphs)) this.memoryUserGraphs.set(k, v as any);
        }
        if (parsed.topicNodes) {
          for (const [k, v] of Object.entries(parsed.topicNodes)) this.memoryTopicNodes.set(k, v as any);
        }
        if (parsed.chatSessions) {
          for (const [k, v] of Object.entries(parsed.chatSessions)) this.memoryChatSessions.set(k, v as any);
        }
        if (parsed.factCache) {
          for (const [k, v] of Object.entries(parsed.factCache)) this.memoryFactCache.set(k, v as any);
        }
        if (parsed.users) {
          for (const [k, v] of Object.entries(parsed.users)) this.memoryUsers.set(k, v as any);
        }
        if (parsed.userUsage) {
          for (const [k, v] of Object.entries(parsed.userUsage)) this.memoryUserUsage.set(k, v as any);
        }
        if (parsed.supportTickets) {
          for (const [k, v] of Object.entries(parsed.supportTickets)) this.memorySupportTickets.set(k, v as any);
        }
        if (parsed.directSources) {
          for (const [k, v] of Object.entries(parsed.directSources)) this.memoryDirectSources.set(k, v as any);
        }
      }
    } catch (err) {
      console.warn("PostgresStore: Could not load disk cache:", err);
    }
  }

  private saveToDisk(): void {
    try {
      this.ensureDataDirectory();
      const payload = {
        userGraphs: Object.fromEntries(this.memoryUserGraphs),
        topicNodes: Object.fromEntries(this.memoryTopicNodes),
        chatSessions: Object.fromEntries(this.memoryChatSessions),
        factCache: Object.fromEntries(this.memoryFactCache),
        users: Object.fromEntries(this.memoryUsers),
        userUsage: Object.fromEntries(this.memoryUserUsage),
        supportTickets: Object.fromEntries(this.memorySupportTickets),
        directSources: Object.fromEntries(this.memoryDirectSources),
        lastUpdated: new Date().toISOString(),
      };
      const tmpPath = `${this.diskFilePath}.${process.pid}.${Date.now()}.tmp`;
      fs.writeFileSync(tmpPath, JSON.stringify(payload, null, 2), "utf-8");
      fs.renameSync(tmpPath, this.diskFilePath);
    } catch (err) {
      console.warn("PostgresStore: Could not write disk cache:", err);
    }
  }

  private async ensureInitialized(): Promise<boolean> {
    if (!this.pool) return false;
    if (this.isConnected && this.schemaInitialized) return true;
    return await this.initializeSchema();
  }

  /**
   * Initializes the PostgreSQL database schema from schema.sql
   */
  public async initializeSchema(): Promise<boolean> {
    if (!this.pool) return false;
    if (this.isConnected && this.schemaInitialized) return true;

    try {
      const client = await this.pool.connect();
      try {
        const schemaPath = path.resolve(__dirname, "schema.sql");
        let sql = "";
        if (fs.existsSync(schemaPath)) {
          sql = fs.readFileSync(schemaPath, "utf-8");
        } else {
          sql = `
            CREATE TABLE IF NOT EXISTS pure_fact_objects (
              event_id VARCHAR(128) PRIMARY KEY,
              topic TEXT NOT NULL,
              verified_entities JSONB NOT NULL DEFAULT '[]'::jsonb,
              timeline JSONB NOT NULL DEFAULT '[]'::jsonb,
              agreed_facts JSONB NOT NULL DEFAULT '[]'::jsonb,
              disputed_claims JSONB NOT NULL DEFAULT '[]'::jsonb,
              adjective_density_score FLOAT NOT NULL,
              sanitized_timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS user_knowledge_graphs (
              user_id VARCHAR(128) PRIMARY KEY,
              topic_weights JSONB NOT NULL DEFAULT '{}'::jsonb,
              cognitive_load_state VARCHAR(32) NOT NULL DEFAULT 'balanced',
              historical_anchors JSONB NOT NULL DEFAULT '[]'::jsonb,
              dwell_history JSONB NOT NULL DEFAULT '[]'::jsonb,
              last_updated TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
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
              last_updated TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS chat_sessions (
              user_id VARCHAR(128) PRIMARY KEY,
              messages JSONB NOT NULL DEFAULT '[]'::jsonb,
              extracted_topics JSONB NOT NULL DEFAULT '[]'::jsonb,
              last_updated TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
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
          `;
        }

        await client.query(sql);
        try {
          await client.query(`
            ALTER TABLE app_users ADD COLUMN IF NOT EXISTS tier VARCHAR(32) NOT NULL DEFAULT 'free';
            ALTER TABLE app_users ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(128);
            ALTER TABLE app_users ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(128);
            ALTER TABLE app_users ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(32) NOT NULL DEFAULT 'none';
            ALTER TABLE app_users ADD COLUMN IF NOT EXISTS subscription_period_end TIMESTAMPTZ;
            ALTER TABLE user_usage_metrics ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
            ALTER TABLE user_usage_metrics ADD COLUMN IF NOT EXISTS period_tokens_used BIGINT NOT NULL DEFAULT 0;
            ALTER TABLE user_usage_metrics ADD COLUMN IF NOT EXISTS period_cost_usd NUMERIC(8, 4) NOT NULL DEFAULT 0.0000;
            ALTER TABLE user_usage_metrics ADD COLUMN IF NOT EXISTS lifetime_cost_usd NUMERIC(8, 4) NOT NULL DEFAULT 0.0000;
          `);
        } catch {}
        this.isConnected = true;
        this.schemaInitialized = true;
        console.log("PostgresStore: Unified Schema initialized successfully.");

        // Automatically seed PostgreSQL from disk/memory state if records are missing or empty
        for (const [userId, user] of this.memoryUsers.entries()) {
          try {
            const check = await client.query("SELECT id FROM app_users WHERE id = $1", [userId]);
            if (check.rows.length === 0) {
              await client.query(
                `INSERT INTO app_users (id, email, name, image, role, status, tier, stripe_customer_id, stripe_subscription_id, subscription_status, subscription_period_end, created_at, last_active_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                 ON CONFLICT (id) DO NOTHING`,
                [
                  user.id,
                  user.email,
                  user.name,
                  user.image || null,
                  user.role,
                  user.status,
                  user.tier || "free",
                  user.stripe_customer_id || null,
                  user.stripe_subscription_id || null,
                  user.subscription_status || "none",
                  user.subscription_period_end || null,
                  user.created_at,
                  user.last_active_at,
                ]
              );
            }
          } catch (uErr) {
            console.warn("PostgresStore: Seeding error for user:", uErr);
          }
        }

        for (const [userId, usage] of this.memoryUserUsage.entries()) {
          try {
            const check = await client.query("SELECT user_id FROM user_usage_metrics WHERE user_id = $1", [userId]);
            if (check.rows.length === 0) {
              await client.query(
                `INSERT INTO user_usage_metrics (user_id, total_chat_messages, total_pipeline_runs, total_tokens_used, total_dwell_time_ms, current_period_start, period_tokens_used, period_cost_usd, lifetime_cost_usd, last_active_at, recent_events)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                 ON CONFLICT (user_id) DO NOTHING`,
                [
                  usage.user_id,
                  usage.total_chat_messages,
                  usage.total_pipeline_runs,
                  usage.total_tokens_used,
                  usage.total_dwell_time_ms,
                  usage.current_period_start || new Date().toISOString(),
                  usage.period_tokens_used || 0,
                  usage.period_cost_usd || 0,
                  usage.lifetime_cost_usd || 0,
                  usage.last_active_at,
                  JSON.stringify(usage.recent_events),
                ]
              );
            }
          } catch (mErr) {
            console.warn("PostgresStore: Seeding error for usage:", mErr);
          }
        }

        // Automatically seed PostgreSQL from disk/memory state if records are missing or empty
        for (const [userId, node] of this.memoryTopicNodes.entries()) {
          if (userId && node && Object.keys(node.topics || {}).length > 0) {
            try {
              const check = await client.query("SELECT user_id, topics FROM unified_topic_nodes WHERE user_id = $1", [userId]);
              const dbTopics = check.rows.length > 0 ? (typeof check.rows[0].topics === "string" ? JSON.parse(check.rows[0].topics) : check.rows[0].topics) : null;
              if (!dbTopics || Object.keys(dbTopics).length === 0) {
                console.log(`PostgresStore: Seeding topic node for ${userId} into PostgreSQL...`);
                await this.saveUnifiedTopicNode(node);
              }
            } catch (seedErr) {
              console.warn("PostgresStore: Seeding error for topic node:", seedErr);
            }
          }
        }
        for (const [userId, chat] of this.memoryChatSessions.entries()) {
          if (userId && chat && (chat.messages?.length > 0 || chat.extracted_topics?.length > 0)) {
            try {
              const check = await client.query("SELECT user_id, messages FROM chat_sessions WHERE user_id = $1", [userId]);
              const dbMessages = check.rows.length > 0 ? (typeof check.rows[0].messages === "string" ? JSON.parse(check.rows[0].messages) : check.rows[0].messages) : null;
              if (!dbMessages || dbMessages.length === 0) {
                console.log(`PostgresStore: Seeding chat session for ${userId} into PostgreSQL...`);
                await this.saveChatSession(userId, chat.messages, chat.extracted_topics || []);
              }
            } catch (seedErr) {
              console.warn("PostgresStore: Seeding error for chat session:", seedErr);
            }
          }
        }

        return true;
      } finally {
        client.release();
      }
    } catch (err) {
      console.warn("PostgresStore: Postgres connection unavailable. Running in persistent disk mode.", (err as Error).message);
      this.isConnected = false;
      return false;
    }
  }

  // --- Unified Topic Nodes (The Mind-State Single Source of Truth) ---
  public async getUnifiedTopicNode(userId: string = "usr_default"): Promise<UnifiedTopicNode> {
    await this.ensureInitialized();
    if (this.pool && this.isConnected) {
      try {
        const res = await this.pool.query(
          `SELECT user_id, topics, psychological_profile, discovery_parameters, historical_anchors, interest_intersections, adjacent_curiosity_frontiers, recent_topic_diffs, harmonization_runs, dwell_history, last_updated
           FROM unified_topic_nodes WHERE user_id = $1`,
          [userId]
        );
        if (res.rows.length > 0) {
          const row = res.rows[0];
          const dbTopics = typeof row.topics === "string" ? JSON.parse(row.topics) : row.topics || {};
          const diskNode = this.memoryTopicNodes.get(userId);
          const diskTopics = diskNode?.topics || {};
          const mergedTopics = { ...diskTopics, ...dbTopics };

          const node: UnifiedTopicNode = {
            user_id: row.user_id,
            topics: mergedTopics,
            psychological_profile:
              typeof row.psychological_profile === "string"
                ? JSON.parse(row.psychological_profile)
                : row.psychological_profile || (diskNode?.psychological_profile || {}),
            discovery_parameters:
              typeof row.discovery_parameters === "string"
                ? JSON.parse(row.discovery_parameters)
                : row.discovery_parameters || (diskNode?.discovery_parameters || {}),
            historical_anchors:
              typeof row.historical_anchors === "string"
                ? JSON.parse(row.historical_anchors)
                : row.historical_anchors || (diskNode?.historical_anchors || []),
            interest_intersections:
              typeof row.interest_intersections === "string"
                ? JSON.parse(row.interest_intersections)
                : row.interest_intersections || (diskNode?.interest_intersections || []),
            adjacent_curiosity_frontiers:
              typeof row.adjacent_curiosity_frontiers === "string"
                ? JSON.parse(row.adjacent_curiosity_frontiers)
                : row.adjacent_curiosity_frontiers || (diskNode?.adjacent_curiosity_frontiers || []),
            recent_topic_diffs:
              typeof row.recent_topic_diffs === "string"
                ? JSON.parse(row.recent_topic_diffs)
                : row.recent_topic_diffs || [],
            harmonization_runs:
              typeof row.harmonization_runs === "string"
                ? JSON.parse(row.harmonization_runs)
                : row.harmonization_runs || [],
            dwell_history:
              typeof row.dwell_history === "string"
                ? JSON.parse(row.dwell_history)
                : row.dwell_history || [],
            last_updated: row.last_updated?.toISOString() || new Date().toISOString(),
          };
          this.memoryTopicNodes.set(userId, node);
          if (Object.keys(mergedTopics).length > Object.keys(dbTopics).length) {
            await this.saveUnifiedTopicNode(node);
          }
          return node;
        }
      } catch (err) {
        console.warn("PostgresStore: Error querying unified topic node:", err);
      }
    }

    let node = this.memoryTopicNodes.get(userId);
    if (!node) {
      node = DataPersistenceStore.createDefaultUnifiedTopicNode(userId);
      this.memoryTopicNodes.set(userId, node);
      this.saveToDisk();
    } else if (this.pool && this.isConnected) {
      // Seed PostgreSQL from memory / disk if missing in Postgres
      await this.saveUnifiedTopicNode(node);
    }
    return node;
  }

  public async saveUnifiedTopicNode(node: UnifiedTopicNode): Promise<void> {
    await this.ensureInitialized();
    this.memoryTopicNodes.set(node.user_id, node);
    this.saveToDisk();

    // Also update memoryUserGraphs for backwards compatibility
    const topicWeights: Record<string, number> = {};
    for (const [topic, meta] of Object.entries(node.topics)) {
      topicWeights[topic] = meta.weight;
    }
    const legacyGraph: UserKnowledgeGraph = {
      user_id: node.user_id,
      topic_weights: topicWeights,
      cognitive_load_state: "balanced",
      historical_anchors: node.historical_anchors,
      interest_intersections: node.interest_intersections,
      adjacent_curiosity_frontiers: node.adjacent_curiosity_frontiers,
      dwell_history: node.dwell_history || [],
      last_updated: node.last_updated,
    };
    this.memoryUserGraphs.set(node.user_id, legacyGraph);

    if (this.pool && this.isConnected) {
      try {
        await this.pool.query(
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
            node.user_id,
            JSON.stringify(node.topics),
            JSON.stringify(node.psychological_profile),
            JSON.stringify(node.discovery_parameters),
            JSON.stringify(node.historical_anchors),
            JSON.stringify(node.interest_intersections || []),
            JSON.stringify(node.adjacent_curiosity_frontiers || []),
            JSON.stringify(node.recent_topic_diffs || []),
            JSON.stringify(node.harmonization_runs || []),
            JSON.stringify(node.dwell_history || []),
            node.last_updated,
          ]
        );

        // Also upsert legacy table
        await this.saveUserGraph(legacyGraph);
      } catch (err) {
        console.warn("PostgresStore: Error saving unified topic node:", err);
      }
    }
  }

  public async getAllUnifiedTopicNodes(): Promise<UnifiedTopicNode[]> {
    await this.ensureInitialized();
    if (this.pool && this.isConnected) {
      try {
        const res = await this.pool.query(
          "SELECT user_id, topics, psychological_profile, discovery_parameters, historical_anchors, interest_intersections, adjacent_curiosity_frontiers, recent_topic_diffs, harmonization_runs, dwell_history, last_updated FROM unified_topic_nodes"
        );
        if (res.rows.length > 0) {
          const nodes: UnifiedTopicNode[] = [];
          for (const row of res.rows) {
            nodes.push({
              user_id: row.user_id,
              topics: typeof row.topics === "string" ? JSON.parse(row.topics) : row.topics || {},
              psychological_profile:
                typeof row.psychological_profile === "string"
                  ? JSON.parse(row.psychological_profile)
                  : row.psychological_profile,
              discovery_parameters:
                typeof row.discovery_parameters === "string"
                  ? JSON.parse(row.discovery_parameters)
                  : row.discovery_parameters,
              historical_anchors:
                typeof row.historical_anchors === "string"
                  ? JSON.parse(row.historical_anchors)
                  : row.historical_anchors || [],
              interest_intersections:
                typeof row.interest_intersections === "string"
                  ? JSON.parse(row.interest_intersections)
                  : row.interest_intersections || [],
              adjacent_curiosity_frontiers:
                typeof row.adjacent_curiosity_frontiers === "string"
                  ? JSON.parse(row.adjacent_curiosity_frontiers)
                  : row.adjacent_curiosity_frontiers || [],
              recent_topic_diffs:
                typeof row.recent_topic_diffs === "string"
                  ? JSON.parse(row.recent_topic_diffs)
                  : row.recent_topic_diffs || [],
              harmonization_runs:
                typeof row.harmonization_runs === "string"
                  ? JSON.parse(row.harmonization_runs)
                  : row.harmonization_runs || [],
              dwell_history:
                typeof row.dwell_history === "string"
                  ? JSON.parse(row.dwell_history)
                  : row.dwell_history || [],
              last_updated: row.last_updated,
            });
          }
          return nodes;
        }
      } catch (err) {
        console.warn("PostgresStore: Error querying all unified topic nodes:", err);
      }
    }
    return Array.from(this.memoryTopicNodes.values());
  }

  // --- User Knowledge Graphs ---
  public async getUserGraph(userId: string): Promise<UserKnowledgeGraph | undefined> {
    await this.ensureInitialized();
    let graph: UserKnowledgeGraph | undefined;

    if (this.pool && this.isConnected) {
      try {
        const res = await this.pool.query(
          `SELECT user_id, topic_weights, cognitive_load_state, historical_anchors, dwell_history, last_updated
           FROM user_knowledge_graphs WHERE user_id = $1`,
          [userId]
        );
        if (res.rows.length > 0) {
          const row = res.rows[0];
          graph = {
            user_id: row.user_id,
            topic_weights: typeof row.topic_weights === "string" ? JSON.parse(row.topic_weights) : row.topic_weights || {},
            cognitive_load_state: row.cognitive_load_state,
            historical_anchors: typeof row.historical_anchors === "string" ? JSON.parse(row.historical_anchors) : row.historical_anchors || [],
            dwell_history: typeof row.dwell_history === "string" ? JSON.parse(row.dwell_history) : row.dwell_history || [],
            last_updated: row.last_updated?.toISOString() || new Date().toISOString(),
          };
        }
      } catch (err) {
        console.warn("PostgresStore: Error querying user graph:", err);
      }
    }

    if (!graph) {
      graph = this.memoryUserGraphs.get(userId);
    }

    // Always merge in all active topics from the UnifiedTopicNode Single Source of Truth
    const node = this.memoryTopicNodes.get(userId);
    if (node && node.topics) {
      if (!graph) {
        graph = {
          user_id: userId,
          topic_weights: {},
          cognitive_load_state: "balanced",
          historical_anchors: node.historical_anchors || [],
          dwell_history: node.dwell_history || [],
          last_updated: node.last_updated || new Date().toISOString(),
        };
      }
      graph.topic_weights = graph.topic_weights || {};
      for (const [topic, meta] of Object.entries(node.topics)) {
        if (graph.topic_weights[topic] === undefined) {
          graph.topic_weights[topic] = meta.weight;
        }
      }
    }

    return graph;
  }

  public async saveUserGraph(graph: UserKnowledgeGraph): Promise<void> {
    await this.ensureInitialized();
    this.memoryUserGraphs.set(graph.user_id, graph);
    this.saveToDisk();

    if (this.pool && this.isConnected) {
      try {
        await this.pool.query(
          `INSERT INTO user_knowledge_graphs (user_id, topic_weights, cognitive_load_state, historical_anchors, dwell_history, last_updated)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (user_id) DO UPDATE SET
             topic_weights = EXCLUDED.topic_weights,
             cognitive_load_state = EXCLUDED.cognitive_load_state,
             historical_anchors = EXCLUDED.historical_anchors,
             dwell_history = EXCLUDED.dwell_history,
             last_updated = EXCLUDED.last_updated`,
          [
            graph.user_id,
            JSON.stringify(graph.topic_weights),
            graph.cognitive_load_state,
            JSON.stringify(graph.historical_anchors),
            JSON.stringify(graph.dwell_history),
            graph.last_updated,
          ]
        );
      } catch (err) {
        console.warn("PostgresStore: Error saving user graph:", err);
      }
    }
  }

  // --- Chat Session Persistence ---
  public async getChatSession(userId: string): Promise<{ messages: any[]; extracted_topics: any[] } | undefined> {
    await this.ensureInitialized();
    if (this.pool && this.isConnected) {
      try {
        const res = await this.pool.query(
          `SELECT messages, extracted_topics FROM chat_sessions WHERE user_id = $1`,
          [userId]
        );
        if (res.rows.length > 0) {
          return {
            messages: typeof res.rows[0].messages === "string" ? JSON.parse(res.rows[0].messages) : res.rows[0].messages,
            extracted_topics: typeof res.rows[0].extracted_topics === "string" ? JSON.parse(res.rows[0].extracted_topics) : res.rows[0].extracted_topics,
          };
        }
      } catch (err) {
        console.warn("PostgresStore: Error fetching chat session:", err);
      }
    }
    return this.memoryChatSessions.get(userId);
  }

  public async saveChatSession(userId: string, messages: any[], extractedTopics: any[]): Promise<void> {
    await this.ensureInitialized();
    // Accumulate extracted topics across conversational history
    let existing = this.memoryChatSessions.get(userId);
    if (!existing && this.pool && this.isConnected) {
      existing = await this.getChatSession(userId);
    }
    const topicMap = new Map<string, any>();
    (existing?.extracted_topics || []).forEach((t: any) => {
      if (t.topic) topicMap.set(t.topic.toLowerCase(), t);
    });
    extractedTopics.forEach((t: any) => {
      if (t.topic) topicMap.set(t.topic.toLowerCase(), t);
    });
    const accumulatedTopics = Array.from(topicMap.values());

    this.memoryChatSessions.set(userId, { messages, extracted_topics: accumulatedTopics });
    this.saveToDisk();

    if (this.pool && this.isConnected) {
      try {
        await this.pool.query(
          `INSERT INTO chat_sessions (user_id, messages, extracted_topics, last_updated)
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT (user_id) DO UPDATE SET
             messages = EXCLUDED.messages,
             extracted_topics = EXCLUDED.extracted_topics,
             last_updated = NOW()`,
          [userId, JSON.stringify(messages), JSON.stringify(accumulatedTopics)]
        );
      } catch (err) {
        console.warn("PostgresStore: Error saving chat session:", err);
      }
    }
  }

  public async setChatSession(userId: string, messages: any[], extractedTopics: any[]): Promise<void> {
    await this.ensureInitialized();
    this.memoryChatSessions.set(userId, { messages, extracted_topics: extractedTopics });
    this.saveToDisk();

    if (this.pool && this.isConnected) {
      try {
        await this.pool.query(
          `INSERT INTO chat_sessions (user_id, messages, extracted_topics, last_updated)
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT (user_id) DO UPDATE SET
             messages = EXCLUDED.messages,
             extracted_topics = EXCLUDED.extracted_topics,
             last_updated = NOW()`,
          [userId, JSON.stringify(messages), JSON.stringify(extractedTopics)]
        );
      } catch (err) {
        console.warn("PostgresStore: Error setting chat session:", err);
      }
    }
  }

  public async clearSession(userId: string): Promise<void> {
    await this.ensureInitialized();
    this.memoryChatSessions.delete(userId);
    this.memoryUserGraphs.delete(userId);
    this.memoryTopicNodes.delete(userId);
    this.saveToDisk();

    if (this.pool && this.isConnected) {
      try {
        await this.pool.query(`DELETE FROM chat_sessions WHERE user_id = $1`, [userId]);
        await this.pool.query(`DELETE FROM user_knowledge_graphs WHERE user_id = $1`, [userId]);
        await this.pool.query(`DELETE FROM unified_topic_nodes WHERE user_id = $1`, [userId]);
      } catch (err) {
        console.warn("PostgresStore: Error clearing session:", err);
      }
    }
  }

  // --- Pure Fact Objects ---
  public async getFact(eventId: string): Promise<PureFactObject | undefined> {
    await this.ensureInitialized();
    if (this.pool && this.isConnected) {
      try {
        const res = await this.pool.query(
          `SELECT event_id, topic, verified_entities, timeline, agreed_facts, disputed_claims, adjective_density_score, sanitized_timestamp
           FROM pure_fact_objects WHERE event_id = $1`,
          [eventId]
        );
        if (res.rows.length > 0) {
          const row = res.rows[0];
          return {
            event_id: row.event_id,
            topic: row.topic,
            verified_entities: typeof row.verified_entities === "string" ? JSON.parse(row.verified_entities) : row.verified_entities,
            timeline: typeof row.timeline === "string" ? JSON.parse(row.timeline) : row.timeline,
            agreed_facts: typeof row.agreed_facts === "string" ? JSON.parse(row.agreed_facts) : row.agreed_facts,
            disputed_claims: typeof row.disputed_claims === "string" ? JSON.parse(row.disputed_claims) : row.disputed_claims,
            adjective_density_score: row.adjective_density_score,
            sanitized_timestamp: row.sanitized_timestamp?.toISOString() || new Date().toISOString(),
          };
        }
      } catch (err) {
        console.warn("PostgresStore: Error querying fact:", err);
      }
    }
    return this.memoryFactCache.get(eventId);
  }

  public async saveFact(fact: PureFactObject): Promise<void> {
    await this.ensureInitialized();
    this.memoryFactCache.set(fact.event_id, fact);
    this.saveToDisk();

    if (this.pool && this.isConnected) {
      try {
        await this.pool.query(
          `INSERT INTO pure_fact_objects (event_id, topic, verified_entities, timeline, agreed_facts, disputed_claims, adjective_density_score, sanitized_timestamp)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (event_id) DO UPDATE SET
             topic = EXCLUDED.topic,
             verified_entities = EXCLUDED.verified_entities,
             timeline = EXCLUDED.timeline,
             agreed_facts = EXCLUDED.agreed_facts,
             disputed_claims = EXCLUDED.disputed_claims,
             adjective_density_score = EXCLUDED.adjective_density_score,
             sanitized_timestamp = EXCLUDED.sanitized_timestamp`,
          [
            fact.event_id,
            fact.topic,
            JSON.stringify(fact.verified_entities),
            JSON.stringify(fact.timeline),
            JSON.stringify(fact.agreed_facts),
            JSON.stringify(fact.disputed_claims),
            fact.adjective_density_score,
            fact.sanitized_timestamp,
          ]
        );
      } catch (err) {
        console.warn("PostgresStore: Error saving fact:", err);
      }
    }
  }

  public async getAllFacts(): Promise<PureFactObject[]> {
    await this.ensureInitialized();
    if (this.pool && this.isConnected) {
      try {
        const res = await this.pool.query(
          `SELECT event_id, topic, verified_entities, timeline, agreed_facts, disputed_claims, adjective_density_score, sanitized_timestamp
           FROM pure_fact_objects ORDER BY sanitized_timestamp DESC LIMIT 50`
        );
        return res.rows.map((row) => ({
          event_id: row.event_id,
          topic: row.topic,
          verified_entities: typeof row.verified_entities === "string" ? JSON.parse(row.verified_entities) : row.verified_entities,
          timeline: typeof row.timeline === "string" ? JSON.parse(row.timeline) : row.timeline,
          agreed_facts: typeof row.agreed_facts === "string" ? JSON.parse(row.agreed_facts) : row.agreed_facts,
          disputed_claims: typeof row.disputed_claims === "string" ? JSON.parse(row.disputed_claims) : row.disputed_claims,
          adjective_density_score: row.adjective_density_score,
          sanitized_timestamp: row.sanitized_timestamp?.toISOString() || new Date().toISOString(),
        }));
      } catch (err) {
        console.warn("PostgresStore: Error querying all facts:", err);
      }
    }
    return Array.from(this.memoryFactCache.values());
  }

  // --- Telemetry ---
  public async logTelemetry(telemetry: BehavioralTelemetry): Promise<void> {
    await this.ensureInitialized();
    if (this.pool && this.isConnected) {
      try {
        await this.pool.query(
          `INSERT INTO behavioral_telemetry (session_id, article_id, topic, dwell_time_ms, scroll_depth_pct, session_abandoned, timestamp)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            telemetry.session_id,
            telemetry.article_id,
            telemetry.topic,
            telemetry.dwell_time_ms,
            telemetry.scroll_depth_pct,
            telemetry.session_abandoned,
            telemetry.timestamp,
          ]
        );
      } catch (err) {
        console.warn("PostgresStore: Error saving telemetry:", err);
      }
    }
  }

  // --- Traces ---
  public async logTrace(trace: AgentTraceLog): Promise<void> {
    await this.ensureInitialized();
    this.memoryTraces.push(trace);
    if (this.memoryTraces.length > 200) {
      this.memoryTraces.shift();
    }

    if (this.pool && this.isConnected) {
      try {
        await this.pool.query(
          `INSERT INTO agent_trace_logs (trace_id, session_id, node_name, input_summary, output_summary, reasoning_rationale, latency_ms, llm_tokens_used, metadata, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            trace.trace_id,
            trace.session_id || null,
            trace.node_name,
            JSON.stringify(trace.input_summary),
            JSON.stringify(trace.output_summary),
            trace.reasoning_rationale,
            trace.latency_ms,
            trace.llm_tokens_used || null,
            JSON.stringify(trace.metadata || {}),
            trace.timestamp,
          ]
        );
      } catch (err) {
        console.warn("PostgresStore: Error saving trace log:", err);
      }
    }
  }

  public async getTraces(limit: number = 50): Promise<AgentTraceLog[]> {
    await this.ensureInitialized();
    if (this.pool && this.isConnected) {
      try {
        const res = await this.pool.query(
          `SELECT trace_id, session_id, node_name, input_summary, output_summary, reasoning_rationale, latency_ms, llm_tokens_used, metadata, created_at
           FROM agent_trace_logs ORDER BY created_at DESC LIMIT $1`,
          [limit]
        );
        return res.rows.map((row) => ({
          trace_id: row.trace_id,
          session_id: row.session_id,
          node_name: row.node_name,
          input_summary: typeof row.input_summary === "string" ? JSON.parse(row.input_summary) : row.input_summary,
          output_summary: typeof row.output_summary === "string" ? JSON.parse(row.output_summary) : row.output_summary,
          reasoning_rationale: row.reasoning_rationale,
          latency_ms: row.latency_ms,
          llm_tokens_used: row.llm_tokens_used,
          metadata: typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata || {},
          timestamp: row.created_at?.toISOString() || new Date().toISOString(),
        }));
      } catch (err) {
        console.warn("PostgresStore: Error querying traces:", err);
      }
    }
    return [...this.memoryTraces].reverse().slice(0, limit);
  }

  // --- User Management (User Levels: user, admin; Tiers: free, subscriber) ---
  public async getOrCreateUser(userData: {
    id?: string;
    email: string;
    name?: string;
    image?: string;
    role?: UserRole;
    tier?: UserTier;
    stripe_customer_id?: string;
    stripe_subscription_id?: string;
    subscription_status?: SubscriptionStatus;
    subscription_period_end?: string;
  }): Promise<AppUser> {
    await this.ensureInitialized();
    const effectiveId = userData.id || `usr_${userData.email.replace(/[^a-zA-Z0-9]/g, "_")}`;
    const now = new Date().toISOString();

    let existing = await this.getUser(effectiveId);
    if (!existing) {
      // Check by email
      existing = await this.getUserByEmail(userData.email);
    }

    if (existing) {
      let changed = false;
      if (userData.name && userData.name !== existing.name) {
        existing.name = userData.name;
        changed = true;
      }
      if (userData.image && userData.image !== existing.image) {
        existing.image = userData.image;
        changed = true;
      }
      if (userData.tier && userData.tier !== existing.tier) {
        existing.tier = userData.tier;
        changed = true;
      }
      if (userData.stripe_customer_id && userData.stripe_customer_id !== existing.stripe_customer_id) {
        existing.stripe_customer_id = userData.stripe_customer_id;
        changed = true;
      }
      if (userData.stripe_subscription_id && userData.stripe_subscription_id !== existing.stripe_subscription_id) {
        existing.stripe_subscription_id = userData.stripe_subscription_id;
        changed = true;
      }
      if (userData.subscription_status && userData.subscription_status !== existing.subscription_status) {
        existing.subscription_status = userData.subscription_status;
        changed = true;
      }
      if (userData.subscription_period_end && userData.subscription_period_end !== existing.subscription_period_end) {
        existing.subscription_period_end = userData.subscription_period_end;
        changed = true;
      }
      existing.last_active_at = now;
      this.memoryUsers.set(existing.id, existing);
      this.saveToDisk();

      if (this.pool && this.isConnected) {
        try {
          await this.pool.query(
            `UPDATE app_users SET name = $1, image = $2, tier = $3, stripe_customer_id = $4, stripe_subscription_id = $5, subscription_status = $6, subscription_period_end = $7, last_active_at = $8 WHERE id = $9`,
            [
              existing.name,
              existing.image || null,
              existing.tier || "free",
              existing.stripe_customer_id || null,
              existing.stripe_subscription_id || null,
              existing.subscription_status || "none",
              existing.subscription_period_end || null,
              now,
              existing.id,
            ]
          );
        } catch (err) {
          console.warn("PostgresStore: Error updating existing user:", err);
        }
      }
      return existing;
    }

    const newUser: AppUser = {
      id: effectiveId,
      email: userData.email,
      name: userData.name || userData.email.split("@")[0],
      image: userData.image,
      role: userData.role || "user",
      status: "active",
      tier: userData.tier || "free",
      stripe_customer_id: userData.stripe_customer_id,
      stripe_subscription_id: userData.stripe_subscription_id,
      subscription_status: userData.subscription_status || "none",
      subscription_period_end: userData.subscription_period_end,
      created_at: now,
      last_active_at: now,
    };

    this.memoryUsers.set(newUser.id, newUser);
    this.saveToDisk();

    if (this.pool && this.isConnected) {
      try {
        await this.pool.query(
          `INSERT INTO app_users (id, email, name, image, role, status, tier, stripe_customer_id, stripe_subscription_id, subscription_status, subscription_period_end, created_at, last_active_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
           ON CONFLICT (id) DO UPDATE SET
             name = EXCLUDED.name,
             image = EXCLUDED.image,
             tier = EXCLUDED.tier,
             stripe_customer_id = EXCLUDED.stripe_customer_id,
             stripe_subscription_id = EXCLUDED.stripe_subscription_id,
             subscription_status = EXCLUDED.subscription_status,
             subscription_period_end = EXCLUDED.subscription_period_end,
             last_active_at = EXCLUDED.last_active_at`,
          [
            newUser.id,
            newUser.email,
            newUser.name,
            newUser.image || null,
            newUser.role,
            newUser.status,
            newUser.tier,
            newUser.stripe_customer_id || null,
            newUser.stripe_subscription_id || null,
            newUser.subscription_status,
            newUser.subscription_period_end || null,
            newUser.created_at,
            newUser.last_active_at,
          ]
        );
      } catch (err) {
        console.warn("PostgresStore: Error inserting new user:", err);
      }
    }

    // Also initialize baseline usage metrics
    await this.getUserUsage(newUser.id);

    return newUser;
  }

  private mapUserRow(row: any): AppUser {
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      image: row.image,
      role: row.role as UserRole,
      status: row.status,
      tier: (row.tier as UserTier) || "free",
      stripe_customer_id: row.stripe_customer_id || undefined,
      stripe_subscription_id: row.stripe_subscription_id || undefined,
      subscription_status: (row.subscription_status as SubscriptionStatus) || "none",
      subscription_period_end: row.subscription_period_end ? new Date(row.subscription_period_end).toISOString() : undefined,
      created_at: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      last_active_at: row.last_active_at ? new Date(row.last_active_at).toISOString() : new Date().toISOString(),
    };
  }

  public async getUser(userId: string): Promise<AppUser | undefined> {
    await this.ensureInitialized();
    if (this.pool && this.isConnected) {
      try {
        const res = await this.pool.query(
          `SELECT id, email, name, image, role, status, tier, stripe_customer_id, stripe_subscription_id, subscription_status, subscription_period_end, created_at, last_active_at FROM app_users WHERE id = $1`,
          [userId]
        );
        if (res.rows.length > 0) {
          const user = this.mapUserRow(res.rows[0]);
          this.memoryUsers.set(user.id, user);
          return this.reconcileSubscriptionState(user);
        }
      } catch (err) {
        console.warn("PostgresStore: Error querying user:", err);
      }
    }

    const memUser = this.memoryUsers.get(userId);
    if (memUser) {
      return this.reconcileSubscriptionState(memUser);
    }

    // Fallback: Check if userId is an email address
    if (userId.includes("@")) {
      const userByEmail = await this.getUserByEmail(userId);
      if (userByEmail) return userByEmail;
    }

    // Fallback: Check if userId is an email slug (usr_name_domain_com)
    if (userId.startsWith("usr_")) {
      const emailSlug = userId.replace(/^usr_/, "").toLowerCase();
      for (const u of this.memoryUsers.values()) {
        if (u.email.toLowerCase().replace(/[^a-zA-Z0-9]/g, "_") === emailSlug) {
          return this.reconcileSubscriptionState(u);
        }
      }
      if (this.pool && this.isConnected) {
        try {
          const res = await this.pool.query(
            `SELECT id, email, name, image, role, status, tier, stripe_customer_id, stripe_subscription_id, subscription_status, subscription_period_end, created_at, last_active_at FROM app_users`
          );
          for (const row of res.rows) {
            const mapped = this.mapUserRow(row);
            if (mapped.email.toLowerCase().replace(/[^a-zA-Z0-9]/g, "_") === emailSlug) {
              this.memoryUsers.set(mapped.id, mapped);
              return this.reconcileSubscriptionState(mapped);
            }
          }
        } catch {}
      }
    }

    return undefined;
  }

  public async getUserByEmail(email: string): Promise<AppUser | undefined> {
    await this.ensureInitialized();
    const normalized = email.toLowerCase().trim();
    if (this.pool && this.isConnected) {
      try {
        const res = await this.pool.query(
          `SELECT id, email, name, image, role, status, tier, stripe_customer_id, stripe_subscription_id, subscription_status, subscription_period_end, created_at, last_active_at FROM app_users WHERE LOWER(email) = $1`,
          [normalized]
        );
        if (res.rows.length > 0) {
          const user = this.mapUserRow(res.rows[0]);
          this.memoryUsers.set(user.id, user);
          return this.reconcileSubscriptionState(user);
        }
      } catch (err) {
        console.warn("PostgresStore: Error querying user by email:", err);
      }
    }
    for (const u of this.memoryUsers.values()) {
      if (u.email.toLowerCase().trim() === normalized) {
        return this.reconcileSubscriptionState(u);
      }
    }
    return undefined;
  }

  /**
   * Reconciles subscription status: If a subscriber's period has expired or is canceled/unpaid/past_due,
   * demotes them back to the free tier and persists the change.
   */
  private reconcileSubscriptionState(user: AppUser): AppUser {
    if (user.tier === "subscriber") {
      const isPastEnd =
        user.subscription_period_end &&
        Date.parse(user.subscription_period_end) < Date.now();
      const isLapsedStatus =
        user.subscription_status === "canceled" ||
        user.subscription_status === "past_due";

      if (isPastEnd || isLapsedStatus) {
        user.tier = "free";
        if (user.subscription_status === "active") {
          user.subscription_status = "past_due";
        }
        if (this.pool && this.isConnected) {
          this.pool.query(
            `UPDATE app_users SET tier = $1, subscription_status = $2 WHERE id = $3`,
            ["free", user.subscription_status, user.id]
          ).catch((err) => console.warn("PostgresStore: Error persisting subscription lapse:", err));
        }
        this.memoryUsers.set(user.id, user);
      }
    }
    return user;
  }

  public async getAllUsers(): Promise<AppUser[]> {
    await this.ensureInitialized();
    if (this.pool && this.isConnected) {
      try {
        const res = await this.pool.query(
          `SELECT id, email, name, image, role, status, tier, stripe_customer_id, stripe_subscription_id, subscription_status, subscription_period_end, created_at, last_active_at FROM app_users ORDER BY created_at ASC`
        );
        if (res.rows.length > 0) {
          const users: AppUser[] = res.rows.map((row) => ({
            id: row.id,
            email: row.email,
            name: row.name,
            image: row.image,
            role: row.role as UserRole,
            status: row.status,
            tier: (row.tier as UserTier) || "free",
            stripe_customer_id: row.stripe_customer_id || undefined,
            stripe_subscription_id: row.stripe_subscription_id || undefined,
            subscription_status: (row.subscription_status as SubscriptionStatus) || "none",
            subscription_period_end: row.subscription_period_end?.toISOString() || undefined,
            created_at: row.created_at?.toISOString() || new Date().toISOString(),
            last_active_at: row.last_active_at?.toISOString() || new Date().toISOString(),
          }));
          for (const u of users) {
            this.memoryUsers.set(u.id, u);
          }
          return users;
        }
      } catch (err) {
        console.warn("PostgresStore: Error querying all users:", err);
      }
    }
    return Array.from(this.memoryUsers.values());
  }

  public async updateUserRole(userId: string, role: UserRole): Promise<AppUser> {
    await this.ensureInitialized();
    let user = await this.getUser(userId);
    if (!user) {
      if (userId.includes("@")) {
        user = await this.getUserByEmail(userId);
      }
    }
    if (!user) {
      throw new Error(`Cannot update user role: user ${userId} not found.`);
    }

    user.role = role;
    this.memoryUsers.set(user.id, user);
    this.saveToDisk();

    if (this.pool && this.isConnected) {
      try {
        await this.pool.query(`UPDATE app_users SET role = $1 WHERE id = $2`, [role, user.id]);
      } catch (err) {
        console.warn("PostgresStore: Error updating user role:", err);
      }
    }

    return user;
  }

  public async updateUserTier(userId: string, tier: UserTier): Promise<AppUser> {
    await this.ensureInitialized();
    let user = await this.getUser(userId);
    if (!user) {
      if (userId.includes("@")) {
        user = await this.getUserByEmail(userId);
      }
    }
    if (!user) {
      throw new Error(`Cannot update user tier: user ${userId} not found.`);
    }

    user.tier = tier;
    this.memoryUsers.set(user.id, user);
    this.saveToDisk();

    if (this.pool && this.isConnected) {
      try {
        await this.pool.query(`UPDATE app_users SET tier = $1 WHERE id = $2`, [tier, user.id]);
      } catch (err) {
        console.warn("PostgresStore: Error updating user tier:", err);
      }
    }

    return user;
  }

  public async updateUserSubscription(
    userId: string,
    sub: {
      tier?: UserTier;
      stripeCustomerId?: string;
      stripeSubscriptionId?: string;
      subscriptionStatus?: SubscriptionStatus;
      subscriptionPeriodEnd?: string;
    }
  ): Promise<AppUser> {
    await this.ensureInitialized();
    let user = await this.getUser(userId);
    if (!user) {
      if (userId.includes("@")) {
        user = await this.getUserByEmail(userId);
      }
    }
    if (!user) {
      throw new Error(`Cannot update user subscription: user ${userId} not found.`);
    }

    if (sub.tier !== undefined) user.tier = sub.tier;
    if (sub.stripeCustomerId !== undefined) user.stripe_customer_id = sub.stripeCustomerId;
    if (sub.stripeSubscriptionId !== undefined) user.stripe_subscription_id = sub.stripeSubscriptionId;
    if (sub.subscriptionStatus !== undefined) user.subscription_status = sub.subscriptionStatus;
    if (sub.subscriptionPeriodEnd !== undefined) user.subscription_period_end = sub.subscriptionPeriodEnd;

    this.memoryUsers.set(user.id, user);
    this.saveToDisk();

    if (this.pool && this.isConnected) {
      try {
        await this.pool.query(
          `UPDATE app_users SET tier = $1, stripe_customer_id = $2, stripe_subscription_id = $3, subscription_status = $4, subscription_period_end = $5 WHERE id = $6`,
          [
            user.tier || "free",
            user.stripe_customer_id || null,
            user.stripe_subscription_id || null,
            user.subscription_status || "none",
            user.subscription_period_end || null,
            user.id,
          ]
        );
      } catch (err) {
        console.warn("PostgresStore: Error updating user subscription:", err);
      }
    }

    return user;
  }

  /**
   * Permanently deletes a user and cascades deletion to their sessions, graphs, and usage metrics.
   */
  public async deleteUser(userId: string): Promise<boolean> {
    await this.ensureInitialized();
    const user = await this.getUser(userId);
    if (!user) {
      return false;
    }

    const effectiveId = user.id;

    // Remove from in-memory cache
    this.memoryUsers.delete(effectiveId);
    this.memoryUserUsage.delete(effectiveId);
    this.memoryUserGraphs.delete(effectiveId);
    this.memoryTopicNodes.delete(effectiveId);
    this.memoryChatSessions.delete(effectiveId);
    this.saveToDisk();

    if (this.pool && this.isConnected) {
      try {
        await this.pool.query(`DELETE FROM chat_sessions WHERE user_id = $1`, [effectiveId]);
        await this.pool.query(`DELETE FROM user_knowledge_graphs WHERE user_id = $1`, [effectiveId]);
        await this.pool.query(`DELETE FROM unified_topic_nodes WHERE user_id = $1`, [effectiveId]);
        await this.pool.query(`DELETE FROM user_usage_metrics WHERE user_id = $1`, [effectiveId]);
        await this.pool.query(`DELETE FROM app_users WHERE id = $1`, [effectiveId]);
      } catch (err) {
        console.error("PostgresStore: Error deleting user from database:", err);
        throw err;
      }
    }

    return true;
  }

  // --- User Usage Tracking & Compute Cost Accounting ---
  public async getUserUsage(userId: string): Promise<UserUsageMetrics> {
    await this.ensureInitialized();
    const now = new Date().toISOString();

    const parseUsageRow = (row: any): UserUsageMetrics => {
      let periodStart = row.current_period_start
        ? typeof row.current_period_start === "string"
          ? row.current_period_start
          : row.current_period_start.toISOString()
        : now;
      let periodCost = Number(row.period_cost_usd || 0);
      let periodTokens = Number(row.period_tokens_used || 0);

      // Monthly 30-day rollover check
      const startMs = Date.parse(periodStart);
      if (!isNaN(startMs) && Date.now() - startMs > 30 * 24 * 60 * 60 * 1000) {
        periodStart = now;
        periodCost = 0;
        periodTokens = 0;
      }

      return {
        user_id: row.user_id,
        total_chat_messages: Number(row.total_chat_messages || 0),
        total_pipeline_runs: Number(row.total_pipeline_runs || 0),
        total_tokens_used: Number(row.total_tokens_used || 0),
        total_dwell_time_ms: Number(row.total_dwell_time_ms || 0),
        current_period_start: periodStart,
        period_tokens_used: periodTokens,
        period_cost_usd: periodCost,
        lifetime_cost_usd: Number(row.lifetime_cost_usd || 0),
        last_active_at: row.last_active_at?.toISOString?.() || row.last_active_at || now,
        recent_events: typeof row.recent_events === "string" ? JSON.parse(row.recent_events) : row.recent_events || [],
      };
    };

    if (this.pool && this.isConnected) {
      try {
        const res = await this.pool.query(
          `SELECT user_id, total_chat_messages, total_pipeline_runs, total_tokens_used, total_dwell_time_ms, current_period_start, period_tokens_used, period_cost_usd, lifetime_cost_usd, last_active_at, recent_events
           FROM user_usage_metrics WHERE user_id = $1`,
          [userId]
        );
        if (res.rows.length > 0) {
          const metrics = parseUsageRow(res.rows[0]);
          this.memoryUserUsage.set(userId, metrics);
          return metrics;
        }
      } catch (err) {
        console.warn("PostgresStore: Error querying user usage:", err);
      }
    }

    let usage = this.memoryUserUsage.get(userId);
    if (!usage) {
      usage = {
        user_id: userId,
        total_chat_messages: 0,
        total_pipeline_runs: 0,
        total_tokens_used: 0,
        total_dwell_time_ms: 0,
        current_period_start: now,
        period_tokens_used: 0,
        period_cost_usd: 0,
        lifetime_cost_usd: 0,
        last_active_at: now,
        recent_events: [],
      };
      this.memoryUserUsage.set(userId, usage);
      this.saveToDisk();
    } else {
      // 30-day rollover check for in-memory mirror
      const startMs = Date.parse(usage.current_period_start || now);
      if (!isNaN(startMs) && Date.now() - startMs > 30 * 24 * 60 * 60 * 1000) {
        usage.current_period_start = now;
        usage.period_tokens_used = 0;
        usage.period_cost_usd = 0;
        this.memoryUserUsage.set(userId, usage);
        this.saveToDisk();
      }
    }
    return usage;
  }

  public async getAllUserUsage(): Promise<Record<string, UserUsageMetrics>> {
    await this.ensureInitialized();
    const result: Record<string, UserUsageMetrics> = {};
    const now = new Date().toISOString();

    if (this.pool && this.isConnected) {
      try {
        const res = await this.pool.query(
          `SELECT user_id, total_chat_messages, total_pipeline_runs, total_tokens_used, total_dwell_time_ms, current_period_start, period_tokens_used, period_cost_usd, lifetime_cost_usd, last_active_at, recent_events FROM user_usage_metrics`
        );
        for (const row of res.rows) {
          const m: UserUsageMetrics = {
            user_id: row.user_id,
            total_chat_messages: Number(row.total_chat_messages || 0),
            total_pipeline_runs: Number(row.total_pipeline_runs || 0),
            total_tokens_used: Number(row.total_tokens_used || 0),
            total_dwell_time_ms: Number(row.total_dwell_time_ms || 0),
            current_period_start: row.current_period_start ? (typeof row.current_period_start === "string" ? row.current_period_start : row.current_period_start.toISOString()) : now,
            period_tokens_used: Number(row.period_tokens_used || 0),
            period_cost_usd: Number(row.period_cost_usd || 0),
            lifetime_cost_usd: Number(row.lifetime_cost_usd || 0),
            last_active_at: row.last_active_at?.toISOString() || new Date().toISOString(),
            recent_events: typeof row.recent_events === "string" ? JSON.parse(row.recent_events) : row.recent_events || [],
          };
          result[row.user_id] = m;
          this.memoryUserUsage.set(row.user_id, m);
        }
      } catch (err) {
        console.warn("PostgresStore: Error querying all user usage:", err);
      }
    }

    // Merge memory cache for any missing users
    for (const [userId, metrics] of this.memoryUserUsage.entries()) {
      if (!result[userId]) {
        result[userId] = metrics;
      }
    }

    return result;
  }

  public async recordUsage(
    userId: string,
    delta: {
      chatMessages?: number;
      pipelineRuns?: number;
      tokensUsed?: number;
      dwellTimeMs?: number;
      eventName?: "chat" | "pipeline" | "telemetry" | "login";
      detail?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<UserUsageMetrics> {
    await this.ensureInitialized();
    const current = await this.getUserUsage(userId);
    const now = new Date().toISOString();

    // Compute estimated USD cost:
    // - LLM Tokens: $0.0000015 per token ($1.50 per 1M tokens)
    // - Pipeline curation overhead: $0.002 per run
    const tokensCost = (delta.tokensUsed || 0) * 0.0000015;
    const pipelineCost = (delta.pipelineRuns || 0) * 0.002;
    const deltaCost = Number((tokensCost + pipelineCost).toFixed(6));

    current.total_chat_messages += delta.chatMessages || 0;
    current.total_pipeline_runs += delta.pipelineRuns || 0;
    current.total_tokens_used += delta.tokensUsed || 0;
    current.total_dwell_time_ms += delta.dwellTimeMs || 0;
    current.period_tokens_used = (current.period_tokens_used || 0) + (delta.tokensUsed || 0);
    current.period_cost_usd = Number(((current.period_cost_usd || 0) + deltaCost).toFixed(4));
    current.lifetime_cost_usd = Number(((current.lifetime_cost_usd || 0) + deltaCost).toFixed(4));
    current.last_active_at = now;

    if (delta.eventName) {
      current.recent_events.unshift({
        type: delta.eventName,
        timestamp: now,
        detail: delta.detail,
        metadata: delta.metadata,
      });
      if (current.recent_events.length > 50) {
        current.recent_events.pop();
      }
    }

    this.memoryUserUsage.set(userId, current);
    this.saveToDisk();

    // Also update user's last_active_at
    const user = this.memoryUsers.get(userId);
    if (user) {
      user.last_active_at = now;
      this.memoryUsers.set(userId, user);
    }

    if (this.pool && this.isConnected) {
      try {
        await this.pool.query(
          `INSERT INTO user_usage_metrics (user_id, total_chat_messages, total_pipeline_runs, total_tokens_used, total_dwell_time_ms, current_period_start, period_tokens_used, period_cost_usd, lifetime_cost_usd, last_active_at, recent_events)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           ON CONFLICT (user_id) DO UPDATE SET
             total_chat_messages = user_usage_metrics.total_chat_messages + EXCLUDED.total_chat_messages,
             total_pipeline_runs = user_usage_metrics.total_pipeline_runs + EXCLUDED.total_pipeline_runs,
             total_tokens_used = user_usage_metrics.total_tokens_used + EXCLUDED.total_tokens_used,
             total_dwell_time_ms = user_usage_metrics.total_dwell_time_ms + EXCLUDED.total_dwell_time_ms,
             period_tokens_used = user_usage_metrics.period_tokens_used + EXCLUDED.period_tokens_used,
             period_cost_usd = user_usage_metrics.period_cost_usd + EXCLUDED.period_cost_usd,
             lifetime_cost_usd = user_usage_metrics.lifetime_cost_usd + EXCLUDED.lifetime_cost_usd,
             last_active_at = EXCLUDED.last_active_at,
             recent_events = EXCLUDED.recent_events`,
          [
            userId,
            delta.chatMessages || 0,
            delta.pipelineRuns || 0,
            delta.tokensUsed || 0,
            delta.dwellTimeMs || 0,
            current.current_period_start,
            delta.tokensUsed || 0,
            deltaCost,
            deltaCost,
            now,
            JSON.stringify(current.recent_events),
          ]
        );

        await this.pool.query(`UPDATE app_users SET last_active_at = $1 WHERE id = $2`, [now, userId]);
      } catch (err) {
        console.warn("PostgresStore: Error recording user usage:", err);
      }
    }

    return current;
  }

  /**
   * Evaluates user compute limits based on tier:
   * - Free / Basic User: ~$0.50 / month
   * - Subscriber: ~$3.00 / month
   * - Admin: Unlimited compute
   */
  public async checkUsageLimit(userId: string): Promise<UsageLimitStatus> {
    await this.ensureInitialized();
    const user = await this.getUser(userId);
    const usage = await this.getUserUsage(userId);

    const tier: UserTier = user?.tier || "free";
    const isAdmin = user?.role === "admin";

    if (isAdmin) {
      return {
        allowed: true,
        tier,
        currentCost: usage.period_cost_usd,
        limit: Infinity,
        percentUsed: 0,
        isNearLimit: false,
      };
    }

    const limit = tier === "subscriber" ? 3.0 : 0.5;
    const currentCost = usage.period_cost_usd;
    const percentUsed = Math.min(100, Math.round((currentCost / limit) * 100));
    const isNearLimit = percentUsed >= 70;
    const allowed = currentCost < limit;

    return {
      allowed,
      tier,
      currentCost,
      limit,
      percentUsed,
      isNearLimit,
      reason: allowed
        ? undefined
        : tier === "free"
        ? `Monthly free compute limit reached ($0.50). Upgrade to Subscriber for 6x compute allowance ($3.00/mo).`
        : `Monthly subscriber compute allowance reached ($3.00).`,
    };
  }

  public async saveSupportTicket(
    ticketData: Omit<SupportTicket, "id" | "created_at" | "status"> & {
      id?: string;
      status?: "open" | "in_progress" | "resolved" | "closed";
    }
  ): Promise<SupportTicket> {
    await this.ensureInitialized();
    const id = ticketData.id || crypto.randomUUID();
    const createdAt = new Date().toISOString();

    const ticket: SupportTicket = {
      id,
      user_id: ticketData.user_id || null,
      name: ticketData.name,
      email: ticketData.email,
      category: ticketData.category,
      subject: ticketData.subject,
      message: ticketData.message,
      metadata: ticketData.metadata || {},
      status: ticketData.status || "open",
      created_at: createdAt,
    };

    // Cache in memory
    this.memorySupportTickets.set(id, ticket);
    this.saveToDisk();

    // Persist to PostgreSQL if connected
    if (this.pool && this.isConnected) {
      try {
        await this.pool.query(
          `INSERT INTO support_tickets (id, user_id, name, email, category, subject, message, metadata, status, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT (id) DO UPDATE SET
             status = EXCLUDED.status,
             metadata = EXCLUDED.metadata`,
          [
            ticket.id,
            ticket.user_id,
            ticket.name,
            ticket.email,
            ticket.category,
            ticket.subject,
            ticket.message,
            JSON.stringify(ticket.metadata),
            ticket.status,
            ticket.created_at,
          ]
        );
      } catch (err) {
        console.warn("PostgresStore: Could not persist support ticket to PostgreSQL, preserved in memory/disk:", err);
      }
    }

    return ticket;
  }

  public async getSupportTickets(limit = 50): Promise<SupportTicket[]> {
    await this.ensureInitialized();

    if (this.pool && this.isConnected) {
      try {
        const res = await this.pool.query(
          `SELECT id, user_id, name, email, category, subject, message, metadata, status, created_at
           FROM support_tickets
           ORDER BY created_at DESC
           LIMIT $1`,
          [limit]
        );
        return res.rows.map((row) => ({
          id: row.id,
          user_id: row.user_id,
          name: row.name,
          email: row.email,
          category: row.category,
          subject: row.subject,
          message: row.message,
          metadata: typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata || {},
          status: row.status,
          created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
        }));
      } catch (err) {
        console.warn("PostgresStore: Error querying support tickets from PostgreSQL, falling back to memory:", err);
      }
    }

    return Array.from(this.memorySupportTickets.values())
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, limit);
  }

  // --- Canonical Direct Sources (RSS Feeds & Authoritative WWW Links) ---
  public async getDirectSourcesForTopic(topic: string): Promise<DirectSource[]> {
    await this.ensureInitialized();
    const cleanTopic = topic.toLowerCase().trim();

    if (this.pool && this.isConnected) {
      try {
        const res = await this.pool.query(
          `SELECT id, topic, source_type, url, title, publisher_name, status, reliability_score, last_crawled_at, last_successful_content_at, etag, last_modified, consecutive_failures, created_at
           FROM direct_sources
           WHERE LOWER(topic) = $1 OR $1 ILIKE '%' || LOWER(topic) || '%' OR LOWER(topic) ILIKE '%' || $1 || '%'
           ORDER BY reliability_score DESC, created_at DESC`,
          [cleanTopic]
        );
        if (res.rows.length > 0) {
          return res.rows.map((r) => ({
            id: r.id,
            topic: r.topic,
            source_type: r.source_type,
            url: r.url,
            title: r.title,
            publisher_name: r.publisher_name,
            status: r.status,
            reliability_score: Number(r.reliability_score),
            last_crawled_at: r.last_crawled_at?.toISOString?.() || r.last_crawled_at,
            last_successful_content_at: r.last_successful_content_at?.toISOString?.() || r.last_successful_content_at,
            etag: r.etag,
            last_modified: r.last_modified,
            consecutive_failures: Number(r.consecutive_failures || 0),
            created_at: r.created_at?.toISOString?.() || r.created_at || new Date().toISOString(),
          }));
        }
      } catch (err) {
        console.warn("PostgresStore: Error querying direct sources:", err);
      }
    }

    // Memory fallback with fuzzy topic matching
    return Array.from(this.memoryDirectSources.values()).filter((s) => {
      const sTopic = s.topic.toLowerCase();
      return sTopic === cleanTopic || sTopic.includes(cleanTopic) || cleanTopic.includes(sTopic);
    });
  }

  public async saveDirectSource(source: DirectSource): Promise<void> {
    await this.ensureInitialized();
    this.memoryDirectSources.set(source.id, source);
    this.saveToDisk();

    if (this.pool && this.isConnected) {
      try {
        await this.pool.query(
          `INSERT INTO direct_sources (id, topic, source_type, url, title, publisher_name, status, reliability_score, last_crawled_at, last_successful_content_at, etag, last_modified, consecutive_failures, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
           ON CONFLICT (url) DO UPDATE SET
             status = EXCLUDED.status,
             reliability_score = EXCLUDED.reliability_score,
             last_crawled_at = EXCLUDED.last_crawled_at,
             last_successful_content_at = EXCLUDED.last_successful_content_at,
             etag = EXCLUDED.etag,
             last_modified = EXCLUDED.last_modified,
             consecutive_failures = EXCLUDED.consecutive_failures`,
          [
            source.id,
            source.topic,
            source.source_type,
            source.url,
            source.title,
            source.publisher_name,
            source.status,
            source.reliability_score,
            source.last_crawled_at || null,
            source.last_successful_content_at || null,
            source.etag || null,
            source.last_modified || null,
            source.consecutive_failures,
            source.created_at,
          ]
        );
      } catch (err) {
        console.warn("PostgresStore: Error saving direct source:", err);
      }
    }
  }

  public async updateDirectSourceStatus(
    id: string,
    update: {
      status?: DirectSourceStatus;
      reliabilityScore?: number;
      lastCrawledAt?: string;
      lastSuccessfulContentAt?: string;
      etag?: string;
      lastModified?: string;
      consecutiveFailures?: number;
    }
  ): Promise<void> {
    await this.ensureInitialized();
    const source = this.memoryDirectSources.get(id);
    if (source) {
      if (update.status !== undefined) source.status = update.status;
      if (update.reliabilityScore !== undefined) source.reliability_score = update.reliabilityScore;
      if (update.lastCrawledAt !== undefined) source.last_crawled_at = update.lastCrawledAt;
      if (update.lastSuccessfulContentAt !== undefined) source.last_successful_content_at = update.lastSuccessfulContentAt;
      if (update.etag !== undefined) source.etag = update.etag;
      if (update.lastModified !== undefined) source.last_modified = update.lastModified;
      if (update.consecutiveFailures !== undefined) source.consecutive_failures = update.consecutiveFailures;
      this.saveToDisk();
    }

    if (this.pool && this.isConnected) {
      try {
        await this.pool.query(
          `UPDATE direct_sources SET
             status = COALESCE($1, status),
             reliability_score = COALESCE($2, reliability_score),
             last_crawled_at = COALESCE($3, last_crawled_at),
             last_successful_content_at = COALESCE($4, last_successful_content_at),
             etag = COALESCE($5, etag),
             last_modified = COALESCE($6, last_modified),
             consecutive_failures = COALESCE($7, consecutive_failures)
           WHERE id = $8`,
          [
            update.status || null,
            update.reliabilityScore ?? null,
            update.lastCrawledAt || null,
            update.lastSuccessfulContentAt || null,
            update.etag || null,
            update.lastModified || null,
            update.consecutiveFailures ?? null,
            id,
          ]
        );
      } catch (err) {
        console.warn("PostgresStore: Error updating direct source status:", err);
      }
    }
  }

  public async getAllDirectSources(): Promise<DirectSource[]> {
    await this.ensureInitialized();
    if (this.pool && this.isConnected) {
      try {
        const res = await this.pool.query(
          `SELECT id, topic, source_type, url, title, publisher_name, status, reliability_score, last_crawled_at, last_successful_content_at, etag, last_modified, consecutive_failures, created_at
           FROM direct_sources ORDER BY created_at DESC`
        );
        return res.rows.map((r) => ({
          id: r.id,
          topic: r.topic,
          source_type: r.source_type,
          url: r.url,
          title: r.title,
          publisher_name: r.publisher_name,
          status: r.status,
          reliability_score: Number(r.reliability_score),
          last_crawled_at: r.last_crawled_at?.toISOString?.() || r.last_crawled_at,
          last_successful_content_at: r.last_successful_content_at?.toISOString?.() || r.last_successful_content_at,
          etag: r.etag,
          last_modified: r.last_modified,
          consecutive_failures: Number(r.consecutive_failures || 0),
          created_at: r.created_at?.toISOString?.() || r.created_at || new Date().toISOString(),
        }));
      } catch (err) {
        console.warn("PostgresStore: Error querying all direct sources:", err);
      }
    }
    return Array.from(this.memoryDirectSources.values());
  }
}

export const postgresStore = PostgresStore.getInstance();

