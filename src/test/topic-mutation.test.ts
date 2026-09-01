import { describe, it, expect } from "vitest";
import { TopicMutationEngine } from "../core/agents/observer/topic-mutation-engine";
import { UnifiedTopicNode } from "../core/types/contracts";

function createMockNode(): UnifiedTopicNode {
  return {
    user_id: "usr_test",
    topics: {
      "AI Policy": {
        weight: 0.7,
        why_they_care: "Governance and regulation.",
        technical_depth: "practitioner",
        curiosity_vectors: ["taxation", "ubi"],
        last_discussed_at: new Date().toISOString(),
      },
      "Space Logistics & Naval Warfare": {
        weight: 0.8,
        why_they_care: "Dual interest in rocketry and maritime strategy.",
        technical_depth: "expert",
        curiosity_vectors: ["starship", "submarines"],
        last_discussed_at: new Date().toISOString(),
      },
    },
    psychological_profile: {
      emotional_trajectory: "Curious",
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
    recent_topic_diffs: [],
    last_updated: new Date().toISOString(),
  };
}

describe("TopicMutationEngine: Discrete Atomic Operations", () => {
  it("creates new topic discretely without touching existing topics", () => {
    const node = createMockNode();
    const res = TopicMutationEngine.executeCreateTopic(node, {
      topic: "Quantum Computing",
      weight: 0.75,
      why_they_care: "Hardware error correction and qubit scaling.",
      technical_depth: "expert",
      curiosity_vectors: ["qubits", "ion traps"],
      evidence: "I am researching superconducting qubits",
    });

    expect(res.changed).toBe(true);
    expect(node.topics["Quantum Computing"]).toBeDefined();
    expect(node.topics["Quantum Computing"].weight).toBe(0.75);
    expect(node.topics["AI Policy"]).toBeDefined();
    expect(node.topics["AI Policy"].weight).toBe(0.7); // Untouched
  });

  it("updates existing topic weight and vectors atomically", () => {
    const node = createMockNode();
    const res = TopicMutationEngine.executeUpdateTopic(node, {
      topic: "AI Policy",
      weight_delta: 0.15,
      curiosity_vectors_to_add: ["antitrust"],
    });

    expect(res.changed).toBe(true);
    expect(node.topics["AI Policy"].weight).toBe(0.85);
    expect(node.topics["AI Policy"].curiosity_vectors).toContain("antitrust");
  });

  it("merges multiple topics into a single canonical entity with unified curiosity vectors", () => {
    const node = createMockNode();
    node.topics["AI Taxation"] = {
      weight: 0.6,
      why_they_care: "Automation offset.",
      technical_depth: "practitioner",
      curiosity_vectors: ["revenue"],
      last_discussed_at: new Date().toISOString(),
    };

    const res = TopicMutationEngine.executeMergeTopics(node, {
      source_topics: ["AI Policy", "AI Taxation"],
      resulting_topic: "AI Economic & Regulatory Policy",
      weight: 0.85,
      rationale: "Consolidated overlapping policy threads.",
    });

    expect(res.changed).toBe(true);
    expect(node.topics["AI Policy"]).toBeUndefined();
    expect(node.topics["AI Taxation"]).toBeUndefined();
    expect(node.topics["AI Economic & Regulatory Policy"]).toBeDefined();
    expect(node.topics["AI Economic & Regulatory Policy"].curiosity_vectors).toContain("taxation");
    expect(node.topics["AI Economic & Regulatory Policy"].curiosity_vectors).toContain("revenue");
    expect(node.topics["Space Logistics & Naval Warfare"]).toBeDefined(); // Untouched
  });

  it("splits a compound topic into distinct focused nodes", () => {
    const node = createMockNode();
    const res = TopicMutationEngine.executeSplitTopic(node, {
      source_topic: "Space Logistics & Naval Warfare",
      resulting_topics: [
        {
          topic: "Space Logistics & Propulsion",
          weight: 0.8,
          why_they_care: "Orbital refueling and propellant transfer.",
          technical_depth: "expert",
          curiosity_vectors: ["starship"],
        },
        {
          topic: "Naval Strategy & Maritime Geopolitics",
          weight: 0.75,
          why_they_care: "Subsurface naval balance and chokepoints.",
          technical_depth: "practitioner",
          curiosity_vectors: ["submarines"],
        },
      ],
      rationale: "Separated aerospace engineering from maritime geopolitics.",
    });

    expect(res.changed).toBe(true);
    expect(node.topics["Space Logistics & Naval Warfare"]).toBeUndefined();
    expect(node.topics["Space Logistics & Propulsion"]).toBeDefined();
    expect(node.topics["Naval Strategy & Maritime Geopolitics"]).toBeDefined();
  });

  it("deletes a topic with rationale and diff tracking", () => {
    const node = createMockNode();
    const res = TopicMutationEngine.executeDeleteTopic(node, {
      topic: "AI Policy",
      rationale: "User explicitly requested to stop tracking policy.",
    });

    expect(res.changed).toBe(true);
    expect(node.topics["AI Policy"]).toBeUndefined();
    expect(node.recent_topic_diffs?.[0]?.topic_name).toBe("AI Policy");
  });
});
