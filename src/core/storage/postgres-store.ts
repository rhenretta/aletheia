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
  UserUsageMetrics,
  UsageEvent,
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
          created_at: "2026-08-31T00:00:00.000Z",
          last_active_at: new Date().toISOString(),
        },
        {
          id: "usr_default",
          email: "guest@ciclops.io",
          name: "Default Guest",
          role: "user",
          status: "active",
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
        lastUpdated: new Date().toISOString(),
      };
      fs.writeFileSync(this.diskFilePath, JSON.stringify(payload, null, 2), "utf-8");
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
              created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
              last_active_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS user_usage_metrics (
              user_id VARCHAR(128) PRIMARY KEY,
              total_chat_messages INTEGER NOT NULL DEFAULT 0,
              total_pipeline_runs INTEGER NOT NULL DEFAULT 0,
              total_tokens_used BIGINT NOT NULL DEFAULT 0,
              total_dwell_time_ms BIGINT NOT NULL DEFAULT 0,
              last_active_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
              recent_events JSONB NOT NULL DEFAULT '[]'::jsonb
            );
          `;
        }

        await client.query(sql);
        this.isConnected = true;
        this.schemaInitialized = true;
        console.log("PostgresStore: Unified Schema initialized successfully.");

        // Automatically seed PostgreSQL from disk/memory state if records are missing or empty
        for (const [userId, user] of this.memoryUsers.entries()) {
          try {
            const check = await client.query("SELECT id FROM app_users WHERE id = $1", [userId]);
            if (check.rows.length === 0) {
              await client.query(
                `INSERT INTO app_users (id, email, name, image, role, status, created_at, last_active_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                 ON CONFLICT (id) DO NOTHING`,
                [user.id, user.email, user.name, user.image || null, user.role, user.status, user.created_at, user.last_active_at]
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
                `INSERT INTO user_usage_metrics (user_id, total_chat_messages, total_pipeline_runs, total_tokens_used, total_dwell_time_ms, last_active_at, recent_events)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 ON CONFLICT (user_id) DO NOTHING`,
                [usage.user_id, usage.total_chat_messages, usage.total_pipeline_runs, usage.total_tokens_used, usage.total_dwell_time_ms, usage.last_active_at, JSON.stringify(usage.recent_events)]
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
          `INSERT INTO agent_trace_logs (trace_id, session_id, node_name, input_summary, output_summary, reasoning_rationale, latency_ms, llm_tokens_used, metadata, timestamp)
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
          `SELECT trace_id, session_id, node_name, input_summary, output_summary, reasoning_rationale, latency_ms, llm_tokens_used, metadata, timestamp
           FROM agent_trace_logs ORDER BY timestamp DESC LIMIT $1`,
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
          timestamp: row.timestamp?.toISOString() || new Date().toISOString(),
        }));
      } catch (err) {
        console.warn("PostgresStore: Error querying traces:", err);
      }
    }
    return [...this.memoryTraces].reverse().slice(0, limit);
  }

  // --- User Management (User Levels: user, admin) ---
  public async getOrCreateUser(userData: {
    id?: string;
    email: string;
    name?: string;
    image?: string;
    role?: UserRole;
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
      existing.last_active_at = now;
      this.memoryUsers.set(existing.id, existing);
      this.saveToDisk();

      if (this.pool && this.isConnected) {
        try {
          await this.pool.query(
            `UPDATE app_users SET name = $1, image = $2, last_active_at = $3 WHERE id = $4`,
            [existing.name, existing.image || null, now, existing.id]
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
      created_at: now,
      last_active_at: now,
    };

    this.memoryUsers.set(newUser.id, newUser);
    this.saveToDisk();

    if (this.pool && this.isConnected) {
      try {
        await this.pool.query(
          `INSERT INTO app_users (id, email, name, image, role, status, created_at, last_active_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (id) DO UPDATE SET
             name = EXCLUDED.name,
             image = EXCLUDED.image,
             last_active_at = EXCLUDED.last_active_at`,
          [newUser.id, newUser.email, newUser.name, newUser.image || null, newUser.role, newUser.status, newUser.created_at, newUser.last_active_at]
        );
      } catch (err) {
        console.warn("PostgresStore: Error inserting new user:", err);
      }
    }

    // Also initialize baseline usage metrics
    await this.getUserUsage(newUser.id);

    return newUser;
  }

  public async getUser(userId: string): Promise<AppUser | undefined> {
    await this.ensureInitialized();
    if (this.pool && this.isConnected) {
      try {
        const res = await this.pool.query(
          `SELECT id, email, name, image, role, status, created_at, last_active_at FROM app_users WHERE id = $1`,
          [userId]
        );
        if (res.rows.length > 0) {
          const row = res.rows[0];
          const user: AppUser = {
            id: row.id,
            email: row.email,
            name: row.name,
            image: row.image,
            role: row.role as UserRole,
            status: row.status,
            created_at: row.created_at?.toISOString() || new Date().toISOString(),
            last_active_at: row.last_active_at?.toISOString() || new Date().toISOString(),
          };
          this.memoryUsers.set(user.id, user);
          return user;
        }
      } catch (err) {
        console.warn("PostgresStore: Error querying user:", err);
      }
    }
    return this.memoryUsers.get(userId);
  }

  public async getUserByEmail(email: string): Promise<AppUser | undefined> {
    await this.ensureInitialized();
    const normalized = email.toLowerCase().trim();
    if (this.pool && this.isConnected) {
      try {
        const res = await this.pool.query(
          `SELECT id, email, name, image, role, status, created_at, last_active_at FROM app_users WHERE LOWER(email) = $1`,
          [normalized]
        );
        if (res.rows.length > 0) {
          const row = res.rows[0];
          const user: AppUser = {
            id: row.id,
            email: row.email,
            name: row.name,
            image: row.image,
            role: row.role as UserRole,
            status: row.status,
            created_at: row.created_at?.toISOString() || new Date().toISOString(),
            last_active_at: row.last_active_at?.toISOString() || new Date().toISOString(),
          };
          this.memoryUsers.set(user.id, user);
          return user;
        }
      } catch (err) {
        console.warn("PostgresStore: Error querying user by email:", err);
      }
    }
    for (const u of this.memoryUsers.values()) {
      if (u.email.toLowerCase().trim() === normalized) {
        return u;
      }
    }
    return undefined;
  }

  public async getAllUsers(): Promise<AppUser[]> {
    await this.ensureInitialized();
    if (this.pool && this.isConnected) {
      try {
        const res = await this.pool.query(
          `SELECT id, email, name, image, role, status, created_at, last_active_at FROM app_users ORDER BY created_at ASC`
        );
        if (res.rows.length > 0) {
          const users: AppUser[] = res.rows.map((row) => ({
            id: row.id,
            email: row.email,
            name: row.name,
            image: row.image,
            role: row.role as UserRole,
            status: row.status,
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
      user = await this.getOrCreateUser({ id: userId, email: `${userId}@ciclops.io`, role });
    }

    user.role = role;
    this.memoryUsers.set(userId, user);
    this.saveToDisk();

    if (this.pool && this.isConnected) {
      try {
        await this.pool.query(`UPDATE app_users SET role = $1 WHERE id = $2`, [role, userId]);
      } catch (err) {
        console.warn("PostgresStore: Error updating user role:", err);
      }
    }

    return user;
  }

  // --- User Usage Tracking ---
  public async getUserUsage(userId: string): Promise<UserUsageMetrics> {
    await this.ensureInitialized();
    if (this.pool && this.isConnected) {
      try {
        const res = await this.pool.query(
          `SELECT user_id, total_chat_messages, total_pipeline_runs, total_tokens_used, total_dwell_time_ms, last_active_at, recent_events
           FROM user_usage_metrics WHERE user_id = $1`,
          [userId]
        );
        if (res.rows.length > 0) {
          const row = res.rows[0];
          const metrics: UserUsageMetrics = {
            user_id: row.user_id,
            total_chat_messages: Number(row.total_chat_messages || 0),
            total_pipeline_runs: Number(row.total_pipeline_runs || 0),
            total_tokens_used: Number(row.total_tokens_used || 0),
            total_dwell_time_ms: Number(row.total_dwell_time_ms || 0),
            last_active_at: row.last_active_at?.toISOString() || new Date().toISOString(),
            recent_events: typeof row.recent_events === "string" ? JSON.parse(row.recent_events) : row.recent_events || [],
          };
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
        last_active_at: new Date().toISOString(),
        recent_events: [],
      };
      this.memoryUserUsage.set(userId, usage);
      this.saveToDisk();
    }
    return usage;
  }

  public async getAllUserUsage(): Promise<Record<string, UserUsageMetrics>> {
    await this.ensureInitialized();
    const result: Record<string, UserUsageMetrics> = {};

    if (this.pool && this.isConnected) {
      try {
        const res = await this.pool.query(
          `SELECT user_id, total_chat_messages, total_pipeline_runs, total_tokens_used, total_dwell_time_ms, last_active_at, recent_events FROM user_usage_metrics`
        );
        for (const row of res.rows) {
          result[row.user_id] = {
            user_id: row.user_id,
            total_chat_messages: Number(row.total_chat_messages || 0),
            total_pipeline_runs: Number(row.total_pipeline_runs || 0),
            total_tokens_used: Number(row.total_tokens_used || 0),
            total_dwell_time_ms: Number(row.total_dwell_time_ms || 0),
            last_active_at: row.last_active_at?.toISOString() || new Date().toISOString(),
            recent_events: typeof row.recent_events === "string" ? JSON.parse(row.recent_events) : row.recent_events || [],
          };
          this.memoryUserUsage.set(row.user_id, result[row.user_id]);
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

    current.total_chat_messages += delta.chatMessages || 0;
    current.total_pipeline_runs += delta.pipelineRuns || 0;
    current.total_tokens_used += delta.tokensUsed || 0;
    current.total_dwell_time_ms += delta.dwellTimeMs || 0;
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
          `INSERT INTO user_usage_metrics (user_id, total_chat_messages, total_pipeline_runs, total_tokens_used, total_dwell_time_ms, last_active_at, recent_events)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (user_id) DO UPDATE SET
             total_chat_messages = user_usage_metrics.total_chat_messages + EXCLUDED.total_chat_messages,
             total_pipeline_runs = user_usage_metrics.total_pipeline_runs + EXCLUDED.total_pipeline_runs,
             total_tokens_used = user_usage_metrics.total_tokens_used + EXCLUDED.total_tokens_used,
             total_dwell_time_ms = user_usage_metrics.total_dwell_time_ms + EXCLUDED.total_dwell_time_ms,
             last_active_at = EXCLUDED.last_active_at,
             recent_events = EXCLUDED.recent_events`,
          [
            userId,
            delta.chatMessages || 0,
            delta.pipelineRuns || 0,
            delta.tokensUsed || 0,
            delta.dwellTimeMs || 0,
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
}

export const postgresStore = PostgresStore.getInstance();
