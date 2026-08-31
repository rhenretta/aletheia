import fs from "fs";
import path from "path";
import {
  UserKnowledgeGraph,
  PureFactObject,
  BehavioralTelemetry,
  UnifiedTopicNode,
} from "../types/contracts";

export class DataPersistenceStore {
  private static instance: DataPersistenceStore;
  private dataDir: string;
  private userGraphFile: string;
  private topicNodeFile: string;
  private factCacheFile: string;
  private telemetryLogFile: string;

  private userGraphs: Map<string, UserKnowledgeGraph> = new Map();
  private topicNodes: Map<string, UnifiedTopicNode> = new Map();
  private factCache: Map<string, PureFactObject> = new Map();

  private constructor() {
    this.dataDir = path.resolve(process.cwd(), "data");
    this.userGraphFile = path.join(this.dataDir, "user_graphs.json");
    this.topicNodeFile = path.join(this.dataDir, "unified_topic_nodes.json");
    this.factCacheFile = path.join(this.dataDir, "fact_cache.json");
    this.telemetryLogFile = path.join(this.dataDir, "telemetry_events.jsonl");

    this.ensureDirectory();
    this.loadFromDisk();
  }

  public static getInstance(): DataPersistenceStore {
    if (!DataPersistenceStore.instance) {
      DataPersistenceStore.instance = new DataPersistenceStore();
    }
    return DataPersistenceStore.instance;
  }

  public static createDefaultUnifiedTopicNode(userId: string = "usr_default"): UnifiedTopicNode {
    return {
      user_id: userId,
      topics: {},
      psychological_profile: {
        emotional_trajectory: "Open, curious, and exploratory",
        sensitivities: [],
        boundaries: [
          "Never speak out of turn or hallucinate facts",
          "Strict adherence to verifiable evidence",
          "No moralizing or patronizing meta-commentary",
        ],
        communication_style: "Direct, concise, rigorous peer",
      },
      discovery_parameters: {
        signal_threshold: 0.70,
        anti_preferences: [
          "clickbait",
          "partisan outrage",
          "sensationalism",
        ],
        exploration_rate: 0.20,
        depth_requirement: "practitioner",
      },
      historical_anchors: [],
      interest_intersections: [],
      adjacent_curiosity_frontiers: [],
      dwell_history: [],
      last_updated: new Date().toISOString(),
    };
  }

  private ensureDirectory(): void {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }
    } catch {
      // ignore
    }
  }

  private loadFromDisk(): void {
    try {
      if (fs.existsSync(this.userGraphFile)) {
        const raw = fs.readFileSync(this.userGraphFile, "utf-8");
        const parsed = JSON.parse(raw) as Record<string, UserKnowledgeGraph>;
        this.userGraphs = new Map(Object.entries(parsed));
      }
      if (fs.existsSync(this.topicNodeFile)) {
        const raw = fs.readFileSync(this.topicNodeFile, "utf-8");
        const parsed = JSON.parse(raw) as Record<string, UnifiedTopicNode>;
        this.topicNodes = new Map(Object.entries(parsed));
      }
      if (fs.existsSync(this.factCacheFile)) {
        const raw = fs.readFileSync(this.factCacheFile, "utf-8");
        const parsed = JSON.parse(raw) as Record<string, PureFactObject>;
        this.factCache = new Map(Object.entries(parsed));
      }
    } catch (err) {
      console.warn("DataPersistenceStore: Failed to load from disk:", err);
    }
  }

  private saveUserGraphs(): void {
    try {
      this.ensureDirectory();
      const obj = Object.fromEntries(this.userGraphs);
      fs.writeFileSync(this.userGraphFile, JSON.stringify(obj, null, 2), "utf-8");
    } catch (err) {
      console.warn("DataPersistenceStore: Failed to save user graphs to disk:", err);
    }
  }

  private saveTopicNodes(): void {
    try {
      this.ensureDirectory();
      const obj = Object.fromEntries(this.topicNodes);
      fs.writeFileSync(this.topicNodeFile, JSON.stringify(obj, null, 2), "utf-8");
    } catch (err) {
      console.warn("DataPersistenceStore: Failed to save topic nodes to disk:", err);
    }
  }

  private saveFactCache(): void {
    try {
      this.ensureDirectory();
      const obj = Object.fromEntries(this.factCache);
      fs.writeFileSync(this.factCacheFile, JSON.stringify(obj, null, 2), "utf-8");
    } catch (err) {
      console.warn("DataPersistenceStore: Failed to save fact cache to disk:", err);
    }
  }

  // --- Unified Topic Nodes ---
  public getUnifiedTopicNode(userId: string): UnifiedTopicNode {
    let node = this.topicNodes.get(userId);
    if (!node) {
      // Create and persist default
      node = DataPersistenceStore.createDefaultUnifiedTopicNode(userId);
      this.topicNodes.set(userId, node);
      this.saveTopicNodes();
    }
    return node;
  }

  public saveUnifiedTopicNode(node: UnifiedTopicNode): void {
    this.topicNodes.set(node.user_id, node);
    this.saveTopicNodes();

    // Sync to UserKnowledgeGraph for backwards compatibility
    const topicWeights: Record<string, number> = {};
    for (const [topic, meta] of Object.entries(node.topics)) {
      topicWeights[topic] = meta.weight;
    }
    this.userGraphs.set(node.user_id, {
      user_id: node.user_id,
      topic_weights: topicWeights,
      cognitive_load_state: "balanced",
      historical_anchors: node.historical_anchors,
      interest_intersections: node.interest_intersections,
      adjacent_curiosity_frontiers: node.adjacent_curiosity_frontiers,
      dwell_history: node.dwell_history || [],
      last_updated: node.last_updated,
    });
    this.saveUserGraphs();
  }

  // --- User Knowledge Graphs ---
  public getUserGraph(userId: string): UserKnowledgeGraph | undefined {
    return this.userGraphs.get(userId);
  }

  public saveUserGraph(graph: UserKnowledgeGraph): void {
    this.userGraphs.set(graph.user_id, graph);
    this.saveUserGraphs();
  }

  // --- Pure Fact Object Cache ---
  public getFact(eventId: string): PureFactObject | undefined {
    return this.factCache.get(eventId);
  }

  public saveFact(fact: PureFactObject): void {
    this.factCache.set(fact.event_id, fact);
    this.saveFactCache();
  }

  public getAllFacts(): PureFactObject[] {
    return Array.from(this.factCache.values());
  }

  // --- Behavioral Telemetry Append ---
  public appendTelemetry(telemetry: BehavioralTelemetry): void {
    try {
      this.ensureDirectory();
      const line = JSON.stringify(telemetry) + "\n";
      fs.appendFileSync(this.telemetryLogFile, line, "utf-8");
    } catch (err) {
      console.warn("DataPersistenceStore: Failed to append telemetry:", err);
    }
  }
}

export const dataStore = DataPersistenceStore.getInstance();
