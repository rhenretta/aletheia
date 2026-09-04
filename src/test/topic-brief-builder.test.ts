import { describe, it, expect } from "vitest";
import { buildTopicBriefs } from "../core/matching/topic-brief-builder";
import { enrichSectionSourceUrls } from "../core/matching/topic-brief-synthesizer";
import { SynthesizedEventCard, UnifiedTopicNode, DynamicBriefSection } from "../core/types/contracts";

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

    // Executive Narrative Sentences with story citations
    expect(conflictBrief!.narrative_sentences.length).toBe(2);
    expect(conflictBrief!.narrative_sentences[0].citation_index).toBe(1);
    expect(conflictBrief!.narrative_sentences[0].story_id).toBe("evt_1");
  });

  it("deduplicates syndicated articles with overlapping headlines and merges sources", () => {
    const duplicateCards: SynthesizedEventCard[] = [
      {
        event_id: "evt_dup_1",
        topic: "SpaceX Starship",
        headline: "SpaceX Starship Orbital Failure Could Outpace Anti-Satellite Tests in Debris Generation",
        personalized_framing: "Space debris risk analysis.",
        summary: "A recent analysis warns that in-orbit explosion could produce more space debris.",
        fact_bullets: ["Orbital debris analysis"],
        disputed_claims: [],
        verified_entities: ["SpaceX", "Starship"],
        sources: [{ name: "South China Morning Post", url: "https://scmp.com/1", bias: "center", raw_text: "..." }],
        format: "bulleted_distillation",
        published_at: new Date().toISOString(),
        recency_label: "4h ago",
      },
      {
        event_id: "evt_dup_2",
        topic: "SpaceX Starship",
        headline: "Starship's Orbital Failure Could Outpace Anti-Satellite Tests in Debris Generation",
        personalized_framing: "Space debris risk analysis.",
        summary: "A new analysis warns that Starship explosion in orbit could generate more debris.",
        fact_bullets: ["Orbital debris analysis"],
        disputed_claims: [],
        verified_entities: ["SpaceX", "Starship"],
        sources: [{ name: "Yahoo News", url: "https://yahoo.com/1", bias: "center", raw_text: "..." }],
        format: "bulleted_distillation",
        published_at: new Date().toISOString(),
        recency_label: "4h ago",
      },
    ];

    const briefs = buildTopicBriefs(duplicateCards, mockNode);
    const spaceXBrief = briefs.find((b) => b.topic === "SpaceX Starship");

    expect(spaceXBrief).toBeDefined();
    // 2 duplicate cards must be deduplicated to 1 unique event highlight
    expect(spaceXBrief!.key_highlights.length).toBe(1);
    // Sources from both reporting outlets must be merged
    expect(spaceXBrief!.all_sources.length).toBe(2);
    expect(spaceXBrief!.all_sources.some((s) => s.name === "South China Morning Post")).toBe(true);
    expect(spaceXBrief!.all_sources.some((s) => s.name === "Yahoo News")).toBe(true);
  });

  it("prioritizes active recency over dormant topics even if dormant has more unseen cards", () => {
    const cards: SynthesizedEventCard[] = [
      // Ancient topic from 82 days ago with 3 cards
      {
        event_id: "evt_old_1",
        topic: "Ancient Subject",
        headline: "Historical Event A (v1)",
        personalized_framing: "Historical framing",
        summary: "Something from months ago.",
        fact_bullets: ["Old fact"],
        disputed_claims: [],
        verified_entities: ["Ancient Subject"],
        sources: [{ name: "Old Source", url: "https://example.com/1", bias: "center", raw_text: "..." }],
        format: "bulleted_distillation",
        published_at: new Date(Date.now() - 82 * 24 * 60 * 60 * 1000).toISOString(),
        recency_label: "82d ago",
      },
      {
        event_id: "evt_old_2",
        topic: "Ancient Subject",
        headline: "Historical Event B",
        personalized_framing: "Historical framing",
        summary: "Something from months ago.",
        fact_bullets: ["Old fact"],
        disputed_claims: [],
        verified_entities: ["Ancient Subject"],
        sources: [{ name: "Old Source", url: "https://example.com/2", bias: "center", raw_text: "..." }],
        format: "bulleted_distillation",
        published_at: new Date(Date.now() - 85 * 24 * 60 * 60 * 1000).toISOString(),
        recency_label: "85d ago",
      },
      // Fresh active topic from 2 hours ago with 1 card
      {
        event_id: "evt_fresh_1",
        topic: "Active Subject",
        headline: "Breaking Development Today",
        personalized_framing: "Fresh framing",
        summary: "Something happening right now.",
        fact_bullets: ["New fact"],
        disputed_claims: [],
        verified_entities: ["Active Subject"],
        sources: [{ name: "Live Wire", url: "https://example.com/wire", bias: "center", raw_text: "..." }],
        format: "bulleted_distillation",
        published_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        recency_label: "2h ago",
      },
    ];

    const briefs = buildTopicBriefs(cards, null, {
      seen_story_ids: {},
      seen_topics: {},
    });

    const activeBrief = briefs.find((b) => b.topic === "Active Subject")!;
    const ancientBrief = briefs.find((b) => b.topic === "Ancient Subject")!;

    expect(activeBrief.velocity_status).toBe("breaking");
    expect(ancientBrief.velocity_status).toBe("dormant");

    // The fresh active brief MUST rank ahead of the dormant 82-day-old brief
    const activeIndex = briefs.indexOf(activeBrief);
    const ancientIndex = briefs.indexOf(ancientBrief);
    expect(activeIndex).toBeLessThan(ancientIndex);
  });

  it("enriches all dynamic sections with valid original source URLs", () => {
    const rawSections: DynamicBriefSection[] = [
      {
        id: "sec_dev",
        section_type: "key_developments",
        title: "Key Developments",
        layout_style: "bullets",
        content: {
          bullets: [
            { title: "Destroyers Redeployed", text: "Ships stationed at Hormuz.", source: "Reuters" },
            { title: "Air Defense Active", text: "New sensors online.", source: "CBS News" },
          ],
        },
      },
      {
        id: "sec_chrono",
        section_type: "real_world_chronology",
        title: "Chronology",
        layout_style: "timeline",
        content: {
          milestones: [
            { time_label: "Aug 2026", milestone: "Carrier group enters gulf", source_name: "Reuters" },
          ],
        },
      },
      {
        id: "sec_pulse",
        section_type: "community_pulse",
        title: "Reactions",
        layout_style: "quote_cards",
        content: {
          quotes: [
            { quote: "Major deterrence upgrade", speaker_or_community: "Reuters", platform: "news" },
          ],
        },
      },
      {
        id: "sec_tensions",
        section_type: "critical_tensions",
        title: "Tensions",
        layout_style: "callout",
        content: {
          tensions: [
            {
              topic_tension: "Escalation vs Deterrence",
              thesis: "High readiness prevents attack",
              antithesis: "High readiness increases miscalculation risk",
              source: "CBS News",
            },
          ],
        },
      },
      {
        id: "sec_catalysts",
        section_type: "catalysts_outlook",
        title: "What to Watch",
        layout_style: "grid",
        content: {
          catalysts: [
            {
              event: "Joint naval exercises scheduled",
              timeframe: "Next month",
              significance: "Will test response coordination",
              source: "Reuters",
            },
          ],
        },
      },
    ];

    const sources = [
      { name: "Reuters", url: "https://reuters.com/article/naval-1", bias: "center" as const },
      { name: "CBS News", url: "https://cbsnews.com/article/redsea-2", bias: "center" as const },
    ];

    const enriched = enrichSectionSourceUrls(rawSections, mockCards, sources);

    // Verify key_developments
    expect(enriched[0].content.bullets?.[0].source_url).toBe("https://reuters.com/article/naval-1");
    expect(enriched[0].content.bullets?.[1].source_url).toBe("https://cbsnews.com/article/redsea-2");

    // Verify real_world_chronology
    expect(enriched[1].content.milestones?.[0].source_url).toBe("https://reuters.com/article/naval-1");

    // Verify community_pulse
    expect(enriched[2].content.quotes?.[0].url).toBe("https://reuters.com/article/naval-1");

    // Verify critical_tensions
    expect(enriched[3].content.tensions?.[0].source_url).toBe("https://cbsnews.com/article/redsea-2");

    // Verify catalysts_outlook
    expect(enriched[4].content.catalysts?.[0].source_url).toBe("https://reuters.com/article/naval-1");
  });
});
