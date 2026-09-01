import { describe, it, expect } from "vitest";
import {
  calculateSemanticAffinity,
  filterFeedBySemanticAffinity,
  buildTopicSemanticSphere,
} from "../core/matching/semantic-matcher";
import { SynthesizedEventCard, UnifiedTopicNode } from "../core/types/contracts";

describe("Semantic Matcher & Concept Relevance Engine", () => {
  const mockUserNode: UnifiedTopicNode = {
    user_id: "usr_test",
    topics: {
      "SpaceX Starship": {
        weight: 0.9,
        technical_depth: "expert",
        why_they_care: "Heavy-lift launch architecture and rapid reusability telemetry",
        curiosity_vectors: ["Raptor 3 engine chamber pressure", "Flight 7 booster catch at Starbase"],
      },
      "Spaceflight Regulation": {
        weight: 0.6,
        technical_depth: "practitioner",
        why_they_care: "FAA environmental launch licensing and national airspace coordination",
        curiosity_vectors: ["FAA Part 450 streamline", "Boca Chica water deluge permit"],
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
      depth_requirement: "expert",
    },
    historical_anchors: [],
    interest_intersections: [
      {
        interest_a: "SpaceX Starship",
        interest_b: "Spaceflight Regulation",
        intersection_theme: "FAA Starbase Launch Authorizations",
        hypothesis: "Regulatory pacing is the primary critical path item for launch cadence",
      },
    ],
    adjacent_curiosity_frontiers: [
      {
        topic: "Orbital Refueling Cryogenics",
        connected_to: ["SpaceX Starship"],
        rationale: "Required for lunar Artemis missions",
      },
    ],
    dwell_history: [],
    last_updated: new Date().toISOString(),
  };

  const starshipCard: SynthesizedEventCard = {
    event_id: "evt_1",
    topic: "Commercial Aerospace",
    headline: "Super Heavy Booster 14 Completes 33-Raptor Static Fire at Starbase",
    summary: "Engineers in Boca Chica verified full duration firing ahead of upcoming orbital test flight.",
    personalized_framing: "Direct milestone for the Starship vehicle architecture.",
    fact_bullets: ["33 Raptor engines ignited simultaneously", "No damage reported to orbital launch mount"],
    disputed_claims: [],
    verified_entities: ["SpaceX", "Starbase", "Raptor Engine", "Boca Chica"],
    sources: [{ name: "SpaceNews", url: "https://spacenews.com", bias: "center" }],
    format: "bulleted_distillation",
    discovery_category: "revealed_preference",
  };

  const regulatoryCard: SynthesizedEventCard = {
    event_id: "evt_2",
    topic: "Spaceflight Regulation",
    headline: "FAA Approves Environmental Review for Increased Starbase Launch Cadence",
    summary: "The Federal Aviation Administration concluded its assessment of the water deluge system and sonic boom mitigation.",
    personalized_framing: "Direct regulatory authorization impacting Starship launch frequency.",
    fact_bullets: ["FAA completed environmental assessment", "Authorized up to 25 annual launches from Boca Chica"],
    disputed_claims: [],
    verified_entities: ["FAA", "Federal Aviation Administration", "SpaceX", "Boca Chica"],
    sources: [{ name: "Reuters", url: "https://reuters.com", bias: "center" }],
    format: "bulleted_distillation",
    discovery_category: "thematic_intersection",
  };

  const biotechCard: SynthesizedEventCard = {
    event_id: "evt_3",
    topic: "Biotechnology",
    headline: "FDA Grants Accelerated Approval for Novel CRISPR In Vivo Gene Therapy",
    summary: "Clinical trial demonstrates 90% reduction in target biomarkers for hereditary amyloidosis.",
    personalized_framing: "Breakthrough in precision genomic medicine.",
    fact_bullets: ["Phase 3 trial completed with 300 patients", "Zero off-target cleavage detected"],
    disputed_claims: [],
    verified_entities: ["FDA", "Intellia Therapeutics", "CRISPR"],
    sources: [{ name: "BioPharma Dive", url: "https://biopharmadive.com", bias: "center" }],
    format: "bulleted_distillation",
    discovery_category: "curiosity_frontier",
  };

  it("constructs a rich semantic sphere from topic and knowledge graph", () => {
    const sphere = buildTopicSemanticSphere("SpaceX Starship", mockUserNode);
    expect(sphere.primary_tokens.has("spacex")).toBe(true);
    expect(sphere.primary_tokens.has("starship")).toBe(true);
    expect(sphere.expanded_concepts.has("raptor")).toBe(true);
    expect(sphere.expanded_concepts.has("starbase")).toBe(true);
    expect(sphere.expanded_concepts.has("boca chica")).toBe(true);
  });

  it("semantically matches a Starship article tagged with different topic label", () => {
    // Note: starshipCard has topic "Commercial Aerospace", not "SpaceX Starship"
    const match = calculateSemanticAffinity(starshipCard, "SpaceX Starship", mockUserNode);
    expect(match.is_match).toBe(true);
    expect(match.score).toBeGreaterThanOrEqual(0.3);
    expect(match.matched_concepts.length).toBeGreaterThan(0);
  });

  it("semantically matches regulatory news that directly impacts Starship", () => {
    const match = calculateSemanticAffinity(regulatoryCard, "SpaceX Starship", mockUserNode);
    expect(match.is_match).toBe(true);
    expect(match.score).toBeGreaterThanOrEqual(0.2);
    expect(match.matched_concepts).toContain("SpaceX");
  });

  it("correctly rejects unrelated domain stories", () => {
    const match = calculateSemanticAffinity(biotechCard, "SpaceX Starship", mockUserNode);
    expect(match.is_match).toBe(false);
    expect(match.score).toBeLessThan(0.15);
  });

  it("filters and ranks feed cards by semantic relevance score", () => {
    const cards = [biotechCard, regulatoryCard, starshipCard];
    const filtered = filterFeedBySemanticAffinity(cards, "SpaceX Starship", mockUserNode);

    expect(filtered.length).toBe(2);
    expect(filtered[0].event_id).toBe("evt_1"); // Highest semantic relevance (Starship vehicle static fire)
    expect(filtered[1].event_id).toBe("evt_2"); // Second highest (FAA Starbase authorization)
    expect(filtered.find((c) => c.event_id === "evt_3")).toBeUndefined(); // Biotech excluded
  });

  it("prioritizes fresh unseen stories over previously seen/passed-over stories", () => {
    const cards = [starshipCard, regulatoryCard];
    
    // Simulate user having already seen starshipCard (evt_1) 3 times recently
    const mockSeenState = {
      seen_story_ids: {
        evt_1: { last_seen_at: new Date().toISOString(), impressions: 3 },
      },
      seen_topics: {
        "commercial aerospace": { last_seen_at: new Date().toISOString(), impressions: 3 },
      },
    };

    const filtered = filterFeedBySemanticAffinity(cards, "all", mockUserNode, "all", mockSeenState);

    // Unseen regulatoryCard (evt_2) must surface ahead of previously seen starshipCard (evt_1)
    expect(filtered.length).toBe(2);
    expect(filtered[0].event_id).toBe("evt_2");
    expect(filtered[0].is_fresh).toBe(true);
    expect(filtered[1].event_id).toBe("evt_1");
    expect(filtered[1].is_fresh).toBe(false);
  });
});
