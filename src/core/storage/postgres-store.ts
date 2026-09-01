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
} from "../types/contracts";
import { DataPersistenceStore } from "./persistence";

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
      if (fs.existsSync(this.diskFilePath)) {
        const raw = fs.readFileSync(this.diskFilePath, "utf-8");
        const parsed = JSON.parse(raw);
        if (parsed.userGraphs) {
          this.memoryUserGraphs = new Map(Object.entries(parsed.userGraphs));
        }
        if (parsed.topicNodes) {
          this.memoryTopicNodes = new Map(Object.entries(parsed.topicNodes));
        }
        if (parsed.chatSessions) {
          this.memoryChatSessions = new Map(Object.entries(parsed.chatSessions));
        }
        if (parsed.factCache) {
          this.memoryFactCache = new Map(Object.entries(parsed.factCache));
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
          `;
        }

        await client.query(sql);
        this.isConnected = true;
        this.schemaInitialized = true;
        console.log("PostgresStore: Unified Schema initialized successfully.");

        // Automatically seed PostgreSQL from disk/memory state if records are missing
        for (const [userId, node] of this.memoryTopicNodes.entries()) {
          if (userId && node && Object.keys(node.topics || {}).length > 0) {
            try {
              const check = await client.query("SELECT user_id FROM unified_topic_nodes WHERE user_id = $1", [userId]);
              if (check.rows.length === 0) {
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
              const check = await client.query("SELECT user_id FROM chat_sessions WHERE user_id = $1", [userId]);
              if (check.rows.length === 0) {
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
          const node: UnifiedTopicNode = {
            user_id: row.user_id,
            topics: typeof row.topics === "string" ? JSON.parse(row.topics) : row.topics || {},
            psychological_profile:
              typeof row.psychological_profile === "string"
                ? JSON.parse(row.psychological_profile)
                : row.psychological_profile || {},
            discovery_parameters:
              typeof row.discovery_parameters === "string"
                ? JSON.parse(row.discovery_parameters)
                : row.discovery_parameters || {},
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
            last_updated: row.last_updated?.toISOString() || new Date().toISOString(),
          };
          this.memoryTopicNodes.set(userId, node);
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
}

export const postgresStore = PostgresStore.getInstance();
