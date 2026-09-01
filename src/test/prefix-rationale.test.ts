import { describe, it, expect } from "vitest";
import { TopicMutationEngine, TopicMutationToolCall } from "../core/agents/observer/topic-mutation-engine";
import { UnifiedTopicNode } from "../core/types/contracts";
import { JsonMessageStreamExtractor } from "../core/agents/intake/dialogue-agent";

describe("Prefix-Rationale Decision Ordering Architecture", () => {
  it("executes merge_topics with top-level prefix rationale and propagates it into audit trail", () => {
    const node: UnifiedTopicNode = {
      user_id: "usr_test_prefix",
      topics: {
        "Suborbital Starship Flight 12": {
          weight: 0.8,
          why_they_care: "Telemetry and ascent tracking.",
          technical_depth: "expert",
          curiosity_vectors: ["hot staging", "re-entry"],
          last_discussed_at: new Date().toISOString(),
        },
        "Suborbital Starship Flight 13": {
          weight: 0.75,
          why_they_care: "Booster catch and orbital trajectory tests.",
          technical_depth: "expert",
          curiosity_vectors: ["tower catch", "heat shield"],
          last_discussed_at: new Date().toISOString(),
        },
      },
      psychological_profile: {
        emotional_trajectory: "Rigorous",
        sensitivities: [],
        boundaries: [],
        communication_style: "Technical",
      },
      discovery_parameters: {
        signal_threshold: 0.8,
        anti_preferences: [],
        exploration_rate: 0.2,
        depth_requirement: "expert",
      },
      historical_anchors: [],
      dwell_history: [],
      last_updated: new Date().toISOString(),
    };

    const toolCall: TopicMutationToolCall = {
      rationale: "Both topics represent sequential flight tests of the same vehicle program. Combining them provides unified tracking for ongoing developments.",
      tool: "merge_topics",
      parameters: {
        source_topics: ["Suborbital Starship Flight 12", "Suborbital Starship Flight 13"],
        resulting_topic: "Starship Integrated Flight Tests",
        why_they_care: "Unified tracking of Starship test milestones and reusability evolution.",
        technical_depth: "expert",
        curiosity_vectors: ["hot staging", "tower catch", "heat shield"],
        rationale: "Both topics represent sequential flight tests of the same vehicle program. Combining them provides unified tracking for ongoing developments.",
      },
    };

    const res = TopicMutationEngine.executeMergeTopics(node, toolCall.parameters);
    expect(res.changed).toBe(true);
    expect(res.action).toBeDefined();
    expect(res.action?.rationale).toContain("sequential flight tests");
    expect(res.action?.resulting_topics).toEqual(["Starship Integrated Flight Tests"]);
    expect(node.topics["Starship Integrated Flight Tests"]).toBeDefined();
    expect(node.topics["Suborbital Starship Flight 12"]).toBeUndefined();
    expect(node.topics["Suborbital Starship Flight 13"]).toBeUndefined();

    // Verify topic update diff records causal rationale
    expect(res.diffs.length).toBe(2);
    expect(res.diffs[0].reasoning).toContain("sequential flight tests");
  });

  it("executes split_topic with prefix rationale and records discrete resulting nodes", () => {
    const node: UnifiedTopicNode = {
      user_id: "usr_test_split",
      topics: {
        "AI Policy and Semiconductor Export Controls": {
          weight: 0.85,
          why_they_care: "Regulatory geopolitics and silicon supply chains.",
          technical_depth: "practitioner",
          curiosity_vectors: ["fab subsidies", "frontier AI safety legislation"],
          last_discussed_at: new Date().toISOString(),
        },
      },
      psychological_profile: {
        emotional_trajectory: "Analytical",
        sensitivities: [],
        boundaries: [],
        communication_style: "Direct",
      },
      discovery_parameters: {
        signal_threshold: 0.7,
        anti_preferences: [],
        exploration_rate: 0.2,
        depth_requirement: "practitioner",
      },
      historical_anchors: [],
      dwell_history: [],
      last_updated: new Date().toISOString(),
    };

    const res = TopicMutationEngine.executeSplitTopic(node, {
      source_topic: "AI Policy and Semiconductor Export Controls",
      resulting_topics: [
        {
          topic: "AI Governance & Frontier Model Safety",
          weight: 0.8,
          why_they_care: "Policy frameworks and statutory requirements for frontier AI.",
          technical_depth: "practitioner",
          curiosity_vectors: ["EU AI Act", "executive orders"],
        },
        {
          topic: "Semiconductor Geopolitics & Fab Supply Chains",
          weight: 0.85,
          why_they_care: "Lithography equipment restrictions and foundry resilience.",
          technical_depth: "expert",
          curiosity_vectors: ["EUV lithography", "foundry capacity"],
        },
      ],
      rationale: "Topic covers two distinct regulatory domains with independent reporting velocity; splitting improves feed signal precision.",
    });

    expect(res.changed).toBe(true);
    expect(res.action?.type).toBe("split");
    expect(res.action?.rationale).toContain("independent reporting velocity");
    expect(node.topics["AI Governance & Frontier Model Safety"]).toBeDefined();
    expect(node.topics["Semiconductor Geopolitics & Fab Supply Chains"]).toBeDefined();
    expect(node.topics["AI Policy and Semiconductor Export Controls"]).toBeUndefined();
  });

  it("JsonMessageStreamExtractor seamlessly streams message tokens when agent_internal_rationale is generated first", () => {
    const extractor = new JsonMessageStreamExtractor();
    
    // Simulate LLM streaming chunks with prefix rationale before message
    const chunk1 = '{\n  "agent_internal_rationale": {\n    "user_emotional_state_detected": "Curious",\n';
    const chunk2 = '    "curiosity_focus_identified": "Autonomous systems",\n    "pedagogical_strategy": "Direct technical analysis"\n  },\n';
    const chunk3 = '  "message": "The latest orbital test achieved full second-stage ignition ';
    const chunk4 = 'and verified heat-shield tiles during atmospheric entry.",\n';
    const chunk5 = '  "active_feed_filter": { "is_active": true, "topic": "Space Propulsion" }\n}';

    const t1 = extractor.processChunk(chunk1);
    const t2 = extractor.processChunk(chunk2);
    const t3 = extractor.processChunk(chunk3);
    const t4 = extractor.processChunk(chunk4);
    const t5 = extractor.processChunk(chunk5);

    // Rationale chunks should produce empty stream tokens for user message display
    expect(t1).toBe("");
    expect(t2).toBe("");

    // Message chunks produce text tokens
    const streamedMessage = t3 + t4 + t5;
    expect(streamedMessage).toContain("The latest orbital test achieved full second-stage ignition");
    expect(streamedMessage).toContain("atmospheric entry.");
    expect(streamedMessage).not.toContain("agent_internal_rationale");
    expect(streamedMessage).not.toContain("active_feed_filter");
  });
});
