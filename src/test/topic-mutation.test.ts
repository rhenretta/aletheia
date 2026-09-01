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

  it("cumulatively evolves living topic dossier and timeline across multiple turns", () => {
    const node = createMockNode();
    
    // Initial creation
    TopicMutationEngine.executeCreateTopic(node, {
      topic: "Tesla FSD Safety",
      weight: 0.6,
      what_they_care_about: "Autonomous driving disengagement rates and fleet mileage telemetry.",
      why_they_care: "Concerns over real-world deployment safety compared to human driving baselines.",
      living_narrative: "Focuses on verified empirical safety milestones and disengagement data in autonomous systems.",
      curiosity_vectors: ["disengagements", "fleet data"],
    });

    const initial = node.topics["Tesla FSD Safety"];
    expect(initial).toBeDefined();
    expect(initial.what_they_care_about).toBe("Autonomous driving disengagement rates and fleet mileage telemetry.");
    expect(initial.evolution_timeline?.length).toBe(1);

    // Follow-up turn: evolving with edge case analysis
    TopicMutationEngine.executeUpdateTopic(node, {
      topic: "Tesla FSD Safety",
      weight_delta: 0.1,
      what_they_care_about: "Autonomous driving disengagement rates, fleet mileage telemetry, and edge-case fatality investigations.",
      why_they_care: "Evaluates how rare edge-case fatalities and regulatory scrutiny balance against aggregate statistical safety claims.",
      living_narrative: "Tracks empirical safety milestones, comparing aggregate fleet miles per incident against regulatory scrutiny of severe edge-case disengagements.",
      curiosity_vectors_to_add: ["edge cases", "nhtsa investigations"],
      evolution_insight: "Expanded focus to investigate how catastrophic edge cases are weighted by regulators vs aggregate safety numbers.",
      evidence: "How do regulators weigh single edge cases vs aggregate stats?",
    });

    const updated = node.topics["Tesla FSD Safety"];
    expect(updated.weight).toBe(0.7);
    expect(updated.what_they_care_about).toContain("edge-case fatality investigations");
    expect(updated.why_they_care).toContain("rare edge-case fatalities");
    expect(updated.curiosity_vectors).toContain("edge cases");
    expect(updated.curiosity_vectors).toContain("disengagements");
    expect(updated.evolution_timeline?.length).toBe(2);
    expect(updated.evolution_timeline?.[1].insight).toContain("Expanded focus to investigate how catastrophic edge cases");
  });

  it("sanitizes third-person conversational meta-commentary into declarative prose", () => {
    const node = createMockNode();
    
    TopicMutationEngine.executeCreateTopic(node, {
      topic: "Robotics",
      what_they_care_about: "User's question about humanoid actuators reflects an interest in gearboxes vs direct drive.",
      why_they_care: "The user wants to understand torque density trade-offs.",
      living_narrative: "The user is exploring harmonic drive reliability.",
    });

    const robotTopic = node.topics["Robotics"];
    expect(robotTopic.what_they_care_about).not.toMatch(/User's question about/i);
    expect(robotTopic.why_they_care).not.toMatch(/The user wants to understand/i);
    expect(robotTopic.why_they_care).toMatch(/^Seeks to understand/i);
  });
});
