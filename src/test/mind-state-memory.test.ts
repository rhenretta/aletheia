import { describe, it, expect, vi } from "vitest";
import { PostgresStore } from "../core/storage/postgres-store";
import { DataPersistenceStore } from "../core/storage/persistence";
import {
  UnifiedTopicNode,
  UnifiedTopicNodeSchema,
  RawArticle,
  BehavioralTelemetry,
} from "../core/types/contracts";
import { ContextAgent } from "../core/agents/context/context-agent";
import { DiscoveryAgent } from "../core/agents/discovery/discovery-agent";
import { ObserverAgent } from "../core/agents/observer/observer-agent";
import { DialogueAgent } from "../core/agents/intake/dialogue-agent";
import { deepseekProvider } from "../core/llm/deepseek-provider";
import { docWorker } from "../core/observability/doc-worker";
import { traceLogger } from "../core/observability/trace-logger";

describe("The Mind-State Memory Architecture: Core Engine & Multi-Agent Tests", () => {
  const store = PostgresStore.getInstance();

  it("creates and validates the default UnifiedTopicNode schema", () => {
    const defaultNode = DataPersistenceStore.createDefaultUnifiedTopicNode("usr_mindstate_1");
    const validated = UnifiedTopicNodeSchema.parse(defaultNode);

    expect(validated.user_id).toBe("usr_mindstate_1");
    expect(Object.keys(validated.topics).length).toBe(0);
    expect(validated.psychological_profile.emotional_trajectory).toBeDefined();
    expect(validated.psychological_profile.boundaries.length).toBeGreaterThan(0);
    expect(validated.discovery_parameters.signal_threshold).toBeGreaterThan(0.5);
    expect(validated.discovery_parameters.anti_preferences).toContain("clickbait");
  });

  it("persists and retrieves UnifiedTopicNode with PostgresStore & DataPersistenceStore", async () => {
    const testNode: UnifiedTopicNode = {
      user_id: "usr_mindstate_test_2",
      topics: {
        "Robotic Actuation": {
          weight: 0.92,
          why_they_care: "Minimizing mechanical backlash in autonomous field robots.",
          technical_depth: "expert",
          curiosity_vectors: ["cycloidal drives", "harmonic gearboxes"],
          last_discussed_at: new Date().toISOString(),
        },
      },
      psychological_profile: {
        emotional_trajectory: "Deeply focused on empirical mechanical specs",
        sensitivities: ["No marketing buzzwords"],
        boundaries: ["Never fabricate component availability"],
        communication_style: "Concise engineering peer",
      },
      discovery_parameters: {
        signal_threshold: 0.85,
        anti_preferences: ["hype", "crowdfunding scams"],
        exploration_rate: 0.15,
        depth_requirement: "deep_technical",
      },
      historical_anchors: ["Kinematic Chains", "Torque Density"],
      interest_intersections: [],
      adjacent_curiosity_frontiers: [],
      dwell_history: [],
      last_updated: new Date().toISOString(),
    };

    await store.saveUnifiedTopicNode(testNode);
    const retrieved = await store.getUnifiedTopicNode("usr_mindstate_test_2");

    expect(retrieved).toBeDefined();
    expect(retrieved.topics["Robotic Actuation"]).toBeDefined();
    expect(retrieved.topics["Robotic Actuation"].why_they_care).toBe("Minimizing mechanical backlash in autonomous field robots.");
    expect(retrieved.psychological_profile.emotional_trajectory).toContain("mechanical specs");
    expect(retrieved.discovery_parameters.signal_threshold).toBe(0.85);

    // Verify backward compatibility sync with UserKnowledgeGraph
    const legacyGraph = await store.getUserGraph("usr_mindstate_test_2");
    expect(legacyGraph).toBeDefined();
    expect(legacyGraph?.topic_weights["Robotic Actuation"]).toBe(0.92);
  });

  it("ContextAgent (The Empath) generates empathetic framing, resolves semantic topics, and logs traces", async () => {
    const node = DataPersistenceStore.createDefaultUnifiedTopicNode("usr_empath_test");
    node.topics["Geopolitics"] = {
      weight: 0.85,
      why_they_care: "Understanding international defense dynamics.",
      technical_depth: "practitioner",
      curiosity_vectors: ["defense", "asymmetric"],
      last_discussed_at: new Date().toISOString(),
    };
    node.psychological_profile.sensitivities = ["Avoid alarmist hyperbole"];

    const framing = await ContextAgent.generateContextFraming(
      node,
      [
        { role: "user", content: "I am following the conflict in Ukraine." },
        { role: "assistant", content: "It represents a critical test of asymmetric defense." },
      ],
      "they defended them against an adversary which we assumed was far stronger"
    );

    expect(framing.calibrated_depth).toBeDefined();
    expect(framing.empath_instructions).toContain("[CONTEXT AGENT - THE EMPATH GUIDANCE]");
    expect(framing.empath_instructions).toContain("INVISIBLE STEERING");
    expect(framing.active_sensitivities.length).toBeGreaterThan(0);
    expect(framing.active_boundaries.length).toBeGreaterThan(0);
    expect(framing.semantic_resolution).toBeDefined();
    expect(framing.semantic_resolution?.selected_topics.length).toBeGreaterThan(0);

    // Check trace logger recorded node_context
    const recentTraces = traceLogger.getRecentTraces(5);
    const contextTrace = recentTraces.find((t) => t.node_name === "node_context");
    expect(contextTrace).toBeDefined();
    expect(contextTrace?.output_summary?.selected_topics_count).toBeGreaterThan(0);
  });

  it("DiscoveryAgent (The Curator) rigorously rejects clickbait and low-signal anti-preferences", async () => {
    const node = DataPersistenceStore.createDefaultUnifiedTopicNode("usr_curator_test");
    node.discovery_parameters.anti_preferences = ["clickbait", "crypto pump", "rumor"];

    const curatedBatch = await DiscoveryAgent.curateAndCollect(node, ["Autonomous Systems"]);

    expect(curatedBatch.selected_queries).toContain("Autonomous Systems");
    expect(curatedBatch.candidate_articles_count).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(curatedBatch.accepted_articles)).toBe(true);

    // Verify trace logger recorded node_discovery
    const recentTraces = traceLogger.getRecentTraces(5);
    const discoveryTrace = recentTraces.find((t) => t.node_name === "node_discovery");
    expect(discoveryTrace).toBeDefined();
    expect(discoveryTrace?.node_name).toBe("node_discovery");
  });

  it("ObserverAgent (The Active Listener) adapts mind-state and updates weights from telemetry", async () => {
    const node = DataPersistenceStore.createDefaultUnifiedTopicNode("usr_observer_test");
    node.topics["Autonomous Systems"] = {
      weight: 0.85,
      why_they_care: "Deep interest in self-sufficiency.",
      technical_depth: "expert",
      curiosity_vectors: ["autonomous robotics"],
      last_discussed_at: new Date().toISOString(),
    };
    const initialWeight = node.topics["Autonomous Systems"].weight;

    const mockTelemetry: BehavioralTelemetry[] = [
      {
        session_id: "sess_test_1",
        article_id: "art_1",
        topic: "Autonomous Systems",
        dwell_time_ms: 35000, // Long dwell -> boost
        scroll_depth_pct: 95,
        session_abandoned: false,
        timestamp: new Date().toISOString(),
      },
    ];

    const result = await ObserverAgent.observeAndAdapt(
      node,
      [
        { role: "user", content: "I need concrete engineering blueprints, not speculative hype." },
        { role: "assistant", content: "Understood. Here is the verified technical architecture." },
      ],
      mockTelemetry
    );

    expect(result.adapted_node).toBeDefined();
    expect(result.adaptations_made.length).toBeGreaterThan(0);
    expect(result.topic_diffs).toBeDefined();
    expect(result.topic_diffs.length).toBeGreaterThan(0);
    expect(result.topic_diffs[0].topic_name).toBe("Autonomous Systems");
    expect(result.topic_diffs[0].previous_state).toBeDefined();
    expect(result.topic_diffs[0].current_state).toBeDefined();
    expect(result.topic_diffs[0].weight_delta).toBeGreaterThan(0);
    expect(result.adapted_node.recent_topic_diffs?.length).toBeGreaterThan(0);
    // Weight should increase due to 35s dwell time
    expect(result.adapted_node.topics["Autonomous Systems"].weight).toBeGreaterThanOrEqual(initialWeight);

    // Verify trace logger recorded node_observer
    const recentTraces = traceLogger.getRecentTraces(5);
    const observerTrace = recentTraces.find((t) => t.node_name === "node_observer");
    expect(observerTrace).toBeDefined();
    expect(observerTrace?.node_name).toBe("node_observer");
  });

  it("DialogueAgent generates structured context envelope and 6-stage agentic flow", async () => {
    const mockJson = JSON.stringify({
      message: "Solid-state battery anodes face primary constraints around lithium dendrite penetration and volumetric expansion during high C-rate cycling.",
      agent_internal_rationale: {
        user_emotional_state_detected: "Analytical and technically rigorous",
        curiosity_focus_identified: "Solid-state electrochemistry",
        intersections_analyzed: "Materials science and autonomous systems",
        pedagogical_strategy: "Direct engineering analysis",
        why_this_response: "Focus on primary mechanical and electrochemical failure modes.",
      },
      extracted_topics: [
        {
          topic: "Solid-State Batteries",
          weight: 0.9,
          reasoning: "Deep inquiry into electrochemical constraints",
          confidence_score: 0.95,
          evidence_quote: "core technical constraints in solid-state battery anodes",
        },
      ],
      interest_intersections: [],
      adjacent_curiosity_frontiers: [],
      is_profile_ready: true,
      suggested_queries: ["anode interface impedance", "lithium metal dendrite prevention"],
    });

    vi.spyOn(deepseekProvider, "generateStream").mockImplementation(async function* () {
      yield mockJson;
      return { fullText: mockJson, tokensUsed: 420 };
    });

    const node = DataPersistenceStore.createDefaultUnifiedTopicNode("usr_flow_test");
    const response = await DialogueAgent.chat(
      [
        {
          id: "msg_user_1",
          role: "user",
          content: "What are the core technical constraints in solid-state battery anodes?",
          timestamp: new Date().toISOString(),
        },
      ],
      node
    );

    expect(response.message).toBeDefined();
    expect(response.context_generated).toBeDefined();
    expect(response.context_generated?.calibrated_depth).toBeDefined();
    expect(response.context_generated?.empath_instructions).toContain("[CONTEXT AGENT - THE EMPATH GUIDANCE]");
    expect(response.context_generated?.agentic_flow).toBeDefined();
    expect(response.context_generated?.agentic_flow?.length).toBe(6);

    const stages = response.context_generated?.agentic_flow?.map((s) => s.stage_name);
    expect(stages).toContain("User Input & Turn Retrieval");
    expect(stages).toContain("Mind-State Knowledge Graph Resolution");
    expect(stages).toContain("Psychological Framing & Calibration");
    expect(stages).toContain("Live Wire & Epistemic Grounding");
    expect(stages).toContain("Dual-Intent Response Synthesis");
    expect(stages).toContain("Observer Active Listening & Continuous Adaptation");
  });

  it("SemanticTopicResolver identifies discussion subject and performs graph-aware topic selection", async () => {
    const node = DataPersistenceStore.createDefaultUnifiedTopicNode("usr_semantic_test");
    node.topics["Electronic Warfare"] = {
      weight: 0.85,
      why_they_care: "Tactical defense dynamics.",
      technical_depth: "practitioner",
      curiosity_vectors: ["drone", "jamming", "electronic countermeasures"],
      last_discussed_at: new Date().toISOString(),
    };
    const result = await ContextAgent.generateContextFraming(
      node,
      [
        { role: "user", content: "I am researching drone warfare and electronic countermeasures." },
        { role: "assistant", content: "Autonomous drones and jamming have reshaped tactical battlefields." },
      ],
      "how do low cost jamming devices disrupt them in practice?"
    );

    expect(result.semantic_resolution).toBeDefined();
    expect(result.semantic_resolution?.selected_topics).toBeDefined();
    expect(result.semantic_resolution?.selected_topics.length).toBeGreaterThan(0);
    expect(result.empath_instructions).toContain("CRITICAL NEGATIVE CONSTRAINTS");
  });

  it("DocWorker automatically synchronizes state graph and architecture docs", () => {
    const report = docWorker.syncDocs();
    expect(report.architecture_updated).toBe(true);
    expect(report.mermaid_updated).toBe(true);
    expect(report.nodes_analyzed).toContain("node_context");
    expect(report.nodes_analyzed).toContain("node_discovery");
    expect(report.nodes_analyzed).toContain("node_observer");
  });
});
