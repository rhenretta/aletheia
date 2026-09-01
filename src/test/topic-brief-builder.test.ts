import { describe, it, expect } from "vitest";
import { buildTopicBriefs } from "../core/matching/topic-brief-builder";
import { SynthesizedEventCard, UnifiedTopicNode } from "../core/types/contracts";

describe("TopicBriefBuilder & Dual-View Aggregator", () => {
  const mockNode: UnifiedTopicNode = {
    user_id: "usr_test",
    topics: {
      "US involvement in world conflicts": {
        weight: 0.9,
        why_they_care: "Deeply interested in military strategy and deterrence.",
        technical_depth: "practitioner",
        curiosity_vectors: ["naval doctrine", "air defense"],
      },
      "SpaceX Starship": {
        weight: 0.85,
        why_they_care: "Follows orbital rocketry and Raptor engine development.",
        technical_depth: "practitioner",
        curiosity_vectors: ["orbital mechanics"],
      },
      "Factorio & Automation": {
        weight: 0.7,
        why_they_care: "Enjoys systems engineering and factory optimization.",
        technical_depth: "practitioner",
        curiosity_vectors: ["automation"],
      },
    },
    psychological_profile: {
      emotional_trajectory: "curious and analytical",
      sensitivities: [],
      boundaries: [],
      communication_style: "direct_peer",
    },
    discovery_parameters: {
      signal_threshold: 0.8,
      anti_preferences: [],
      exploration_rate: 0.2,
      depth_requirement: "practitioner",
    },
    historical_anchors: [],
    interest_intersections: [],
    adjacent_curiosity_frontiers: [],
    recent_topic_diffs: [],
    harmonization_runs: [],
    dwell_history: [],
    last_updated: new Date().toISOString(),
  };

  const mockCards: SynthesizedEventCard[] = [
    {
      event_id: "evt_1",
      topic: "US involvement in world conflicts",
      headline: "Naval Strike Groups Position Near Strait of Hormuz",
      personalized_framing: "Strategic maritime positioning.",
      summary: "US Navy redeploys guided missile destroyers to protect shipping lanes.",
      fact_bullets: ["Destroyers positioned in Hormuz", "Commercial tanker escorts planned"],
      disputed_claims: [],
      verified_entities: ["US Navy", "Strait of Hormuz"],
      sources: [{ name: "Reuters", url: "https://reuters.com/1", bias: "center", raw_text: "..." }],
      format: "bulleted_distillation",
      published_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(), // 1h ago
      recency_label: "1h ago",
    },
    {
      event_id: "evt_2",
      topic: "US involvement in world conflicts",
      headline: "Air Defense Radar Upgrades Deployed Across Red Sea",
      personalized_framing: "Air defense kinetic upgrades.",
      summary: "Small drone interception systems upgraded on carrier strike fleet.",
      fact_bullets: ["Radar systems upgraded", "New kinetic interceptors active"],
      disputed_claims: [],
      verified_entities: ["Red Sea", "Air Defense"],
      sources: [{ name: "CBS News", url: "https://cbs.com/1", bias: "center", raw_text: "..." }],
      format: "bulleted_distillation",
      published_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2h ago
      recency_label: "2h ago",
    },
    {
      event_id: "evt_3",
      topic: "SpaceX Starship",
      headline: "Starship Flight 7 Booster Returns to Launch Mount",
      personalized_framing: "Orbital rocketry test preparation.",
      summary: "Super Heavy completed mechanical checkout on orbital pad.",
      fact_bullets: ["Booster 14 moved to pad", "Static fire scheduled next week"],
      disputed_claims: [],
      verified_entities: ["SpaceX", "Starship", "Super Heavy"],
      sources: [{ name: "NASASpaceflight", url: "https://nasaspaceflight.com/1", bias: "center", raw_text: "..." }],
      format: "bulleted_distillation",
      published_at: new Date(Date.now() - 1000 * 60 * 60 * 20).toISOString(), // 20h ago
      recency_label: "20h ago",
    },
  ];

  it("groups cards into canonical topic briefs and computes update velocity", () => {
    const briefs = buildTopicBriefs(mockCards, mockNode);

    expect(briefs).toBeDefined();
    expect(briefs.length).toBeGreaterThanOrEqual(3);

    // US involvement in world conflicts should have 2 stories and breaking velocity
    const conflictBrief = briefs.find((b) => b.topic === "US involvement in world conflicts");
    expect(conflictBrief).toBeDefined();
    expect(conflictBrief!.story_count).toBe(2);
    expect(conflictBrief!.velocity_status).toBe("breaking");
    expect(conflictBrief!.key_highlights.length).toBe(2);
    expect(conflictBrief!.all_sources.length).toBe(2);

    // SpaceX Starship should have 1 story and active velocity
    const spaceXBrief = briefs.find((b) => b.topic === "SpaceX Starship");
    expect(spaceXBrief).toBeDefined();
    expect(spaceXBrief!.story_count).toBe(1);
    expect(spaceXBrief!.velocity_status).toBe("active");

    // Factorio should have 0 stories and dormant/quiet status
    const factorioBrief = briefs.find((b) => b.topic === "Factorio & Automation");
    expect(factorioBrief).toBeDefined();
    expect(factorioBrief!.story_count).toBe(0);
    expect(factorioBrief!.velocity_status).toBe("dormant");
  });
});
