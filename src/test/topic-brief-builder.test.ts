import { describe, it, expect } from "vitest";
import { buildTopicBriefs } from "../core/matching/topic-brief-builder";
import {
  enrichSectionSourceUrls,
  cleanArticleSnippet,
  cleanDevelopmentTitle,
  synthesizeCleanDevelopments,
  synthesizeCleanExecutiveTake,
} from "../core/matching/topic-brief-synthesizer";
import { SynthesizedEventCard, UnifiedTopicNode, DynamicBriefSection, generateTopicId } from "../core/types/contracts";

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
            { quote: "Major deterrence upgrade", speaker_or_community: "Reddit r/geopolitics", platform: "reddit" },
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
      { name: "Reddit r/geopolitics", url: "https://reddit.com/r/geopolitics/comments/naval-1", bias: "center" as const },
    ];

    const enriched = enrichSectionSourceUrls(rawSections, mockCards, sources);

    // Verify key_developments
    expect(enriched[0].content.bullets?.[0].source_url).toBe("https://reuters.com/article/naval-1");
    expect(enriched[0].content.bullets?.[1].source_url).toBe("https://cbsnews.com/article/redsea-2");

    // Verify real_world_chronology
    expect(enriched[1].content.milestones?.[0].source_url).toBe("https://reuters.com/article/naval-1");

    // Verify community_pulse
    expect(enriched[2].content.quotes?.[0].url).toBe("https://reddit.com/r/geopolitics/comments/naval-1");

    // Verify critical_tensions
    expect(enriched[3].content.tensions?.[0].source_url).toBe("https://cbsnews.com/article/redsea-2");

    // Verify catalysts_outlook
    expect(enriched[4].content.catalysts?.[0].source_url).toBe("https://reuters.com/article/naval-1");
  });

  it("safely cleans article snippets without breaking decimal numbers or abbreviations", () => {
    const raw = "That is not just media criticism. NHTSA opened investigation PE25012 covering approximately 2.88 million vehicles equipped with FSD. What the 4.1x crash reduction claim actually measures is same-fleet data.";
    const cleaned = cleanArticleSnippet("Investigation Update", raw);
    expect(cleaned).toContain("2.88 million");
    expect(cleaned).toContain("4.1x");
    expect(cleaned).not.toContain("2. 88");
    expect(cleaned).not.toContain("4. 1x");
  });

  it("synthesizes clean key developments with clean titles and substantive text", () => {
    const cards: SynthesizedEventCard[] = [
      {
        event_id: "evt_1",
        topic: "Autonomous Driving",
        headline: "Manufacturer Drops Massive Fleet Safety Dataset Ahead of Vote | Source",
        personalized_framing: "Fleet safety telemetry.",
        summary: "The new evidence dashboard compares fleet crash rates across identical road segments.",
        fact_bullets: [],
        disputed_claims: [],
        verified_entities: [],
        sources: [{ name: "Source", title: "Article", url: "https://source.com/article1", bias: "center" }],
        format: "bulleted_distillation",
        published_at: new Date().toISOString(),
        recency_label: "Recent",
      },
    ];

    const developments = synthesizeCleanDevelopments(cards);
    expect(developments).toHaveLength(1);
    expect(developments[0].title).toBe("Manufacturer Drops Massive Fleet Safety Dataset Ahead of Vote");
    expect(developments[0].text).toContain("compares fleet crash rates");
    expect(developments[0].source_url).toBe("https://source.com/article1");
  });

  it("synthesizes an overarching executive take summarizing all recent developments across the topic", () => {
    const cards: SynthesizedEventCard[] = [
      {
        event_id: "evt_1",
        topic: "Autonomous Driving",
        headline: "Fleet Safety Dataset Released | Source",
        personalized_framing: "Fleet safety data release.",
        summary: "The new evidence dashboard evaluates crash rates.",
        fact_bullets: [],
        disputed_claims: [],
        verified_entities: [],
        sources: [{ name: "Source", title: "Article", url: "https://source.com/1", bias: "center" }],
        format: "bulleted_distillation",
        published_at: new Date().toISOString(),
        recency_label: "Recent",
      },
      {
        event_id: "evt_2",
        topic: "Autonomous Driving",
        headline: "European Regulatory Approval Vote Scheduled | Source",
        personalized_framing: "European regulatory vote.",
        summary: "Regulators prepare to review self-driving telemetry.",
        fact_bullets: [],
        disputed_claims: [],
        verified_entities: [],
        sources: [{ name: "Source", title: "Article", url: "https://source.com/2", bias: "center" }],
        format: "bulleted_distillation",
        published_at: new Date().toISOString(),
        recency_label: "Recent",
      },
      {
        event_id: "evt_3",
        topic: "Autonomous Driving",
        headline: "Safety Investigation Progress Report | Source",
        personalized_framing: "Safety investigation progress.",
        summary: "Agency monitors driver assistance performance metrics.",
        fact_bullets: [],
        disputed_claims: [],
        verified_entities: [],
        sources: [{ name: "Source", title: "Article", url: "https://source.com/3", bias: "center" }],
        format: "bulleted_distillation",
        published_at: new Date().toISOString(),
        recency_label: "Recent",
      },
    ];

    const executiveTake = synthesizeCleanExecutiveTake("Autonomous Driving", cards);
    expect(executiveTake).toContain("The new evidence dashboard evaluates crash rates.");
    expect(executiveTake).toContain("regulators prepare to review self-driving telemetry.");
    expect(executiveTake).toContain("agency monitors driver assistance performance metrics.");
    expect(executiveTake).not.toContain("Fleet Safety Dataset Released | Source");
  });

  it("preserves hyphenated compound words in cleanDevelopmentTitle and strips publisher suffixes", () => {
    // Should never cut off hyphenated terms like Self-Driving or AI-Powered
    expect(cleanDevelopmentTitle("Tesla's 'Full Self-Driving' [Reddit (r/TeslaFSD)]")).toBe("Tesla's 'Full Self-Driving'");
    expect(cleanDevelopmentTitle("AI-Powered Robotaxi Testing Approved - Reuters")).toBe("AI-Powered Robotaxi Testing Approved");
    expect(cleanDevelopmentTitle("Next-Gen Hardware Emerges | Electrek")).toBe("Next-Gen Hardware Emerges");
    expect(cleanDevelopmentTitle("Real-Time Telemetry Updates — The Verge")).toBe("Real-Time Telemetry Updates");
  });

  it("prioritizes recent journalistic stories in key_highlights and excludes stale social media posts", () => {
    const mixedCards: SynthesizedEventCard[] = [
      // 1. Stale X post from 5 months ago
      {
        event_id: "evt_social_old",
        topic: "Autonomous Driving",
        headline: "Tesla Rolls Out FSD v14.3: 20% Faster Reaction Time",
        personalized_framing: "Historical software update tweet.",
        summary: "Elon Musk posted on X about early reaction time improvements.",
        fact_bullets: ["20% faster reaction time claimed"],
        disputed_claims: [],
        verified_entities: ["Tesla"],
        sources: [{ name: "x.com", title: "Post on X", url: "https://x.com/elonmusk/status/12345", bias: "center" }],
        format: "bulleted_distillation",
        published_at: new Date(Date.now() - 150 * 24 * 60 * 60 * 1000).toISOString(), // 150 days ago (April)
        recency_label: "5mo ago",
      },
      // 2. Recent journalistic news article
      {
        event_id: "evt_news_recent",
        topic: "Autonomous Driving",
        headline: "Safety Investigation Opens Into Driver Assistance Telemetry",
        personalized_framing: "Regulatory oversight.",
        summary: "Federal regulators launch investigation into intersection performance.",
        fact_bullets: ["Regulators launch probe"],
        disputed_claims: [],
        verified_entities: ["Tesla", "NHTSA"],
        sources: [{ name: "Reuters", title: "Article", url: "https://reuters.com/business/autos/investigation-fsd-2026", bias: "center" }],
        format: "bulleted_distillation",
        published_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2h ago
        recency_label: "2h ago",
      },
    ];

    const briefs = buildTopicBriefs(mixedCards, mockNode);
    const brief = briefs.find((b) => b.topic === "Autonomous Driving");

    expect(brief).toBeDefined();
    // Key highlights (Recent Stories) should only feature the recent news article
    expect(brief!.key_highlights.length).toBe(1);
    expect(brief!.key_highlights[0].event_id).toBe("evt_news_recent");
    expect(brief!.key_highlights[0].headline).toBe("Safety Investigation Opens Into Driver Assistance Telemetry");

    // But all stories (including the historical X post) are retained for agent and timeline context
    expect(brief!.stories.length).toBe(2);
    expect(brief!.all_sources.some((s) => s.name === "x.com")).toBe(true);
  });

  it("consolidates cards with acronym variants into a single canonical topic brief", () => {
    const nodeWithCanonicalTopic: UnifiedTopicNode = {
      user_id: "usr_canonical_test",
      topics: {
        "Fleet Electric Vehicle": {
          weight: 0.85,
          technical_depth: "practitioner",
          why_they_care: "Transition to commercial electric transport",
          curiosity_vectors: ["Fleet charging infrastructure", "Battery cycle endurance"],
        },
      },
      psychological_profile: {
        emotional_trajectory: "Curious",
        sensitivities: [],
        boundaries: [],
        communication_style: "Direct",
      },
      dwell_history: [],
      last_updated: new Date().toISOString(),
    } as any;

    const cards: SynthesizedEventCard[] = [
      {
        event_id: "evt_canon_1",
        topic: "Fleet Electric Vehicle",
        headline: "National Carrier Deploys 500 Heavy Electric Trucks",
        summary: "Commercial logistics carrier operationalizes heavy EV transport corridors.",
        fact_bullets: ["500 trucks deployed", "Mega-watt charging hubs activated"],
        verified_entities: ["Fleet Logistics"],
        published_at: new Date().toISOString(),
      },
      {
        event_id: "evt_acronym_1",
        topic: "Fleet EV",
        headline: "High-Power Depots Open Along Major Freight Arteries",
        summary: "New high-voltage fast chargers operational for heavy commercial haulers.",
        fact_bullets: ["1 MW charging capability verified"],
        verified_entities: ["Depot Network"],
        published_at: new Date().toISOString(),
      },
      {
        event_id: "evt_acronym_2",
        topic: "Fleet EV",
        headline: "Municipal Logistics Fleet Reaches 10 Million Zero-Emission Miles",
        summary: "City delivery trucks report 40% operating cost decrease.",
        fact_bullets: ["Cost reduction confirmed across fleet data"],
        verified_entities: ["City Logistics"],
        published_at: new Date().toISOString(),
      },
    ] as any;

    const briefs = buildTopicBriefs(cards, nodeWithCanonicalTopic);

    // Should create exactly 1 brief for "Fleet Electric Vehicle" containing all 3 stories
    expect(briefs.length).toBe(1);
    expect(briefs[0].topic).toBe("Fleet Electric Vehicle");
    expect(briefs[0].stories.length).toBe(3);
    // Should NOT create a separate "Fleet EV" bucket
    expect(briefs.find((b) => b.topic === "Fleet EV")).toBeUndefined();
  });

  it("consolidates cards with matching topic_id into a single unified brief with stable briefId = topic_id", () => {
    const topicId = "top_autonomous_driving_systems";
    const nodeWithTargetTopic: UnifiedTopicNode = {
      ...mockNode,
      topics: {
        "Autonomous Driving Systems": {
          topic_id: topicId,
          weight: 0.9,
          technical_depth: "practitioner",
          why_they_care: "Core interest in autonomy and neural vision models",
          curiosity_vectors: ["vision-only architectures"],
        },
      },
    };

    const cards: SynthesizedEventCard[] = [
      {
        event_id: "evt_fsd_1",
        topic: "Autonomous Driving Systems",
        topic_id: topicId,
        headline: "Next-Gen Vision Model Achieves Zero Interventions in Highway Trials",
        summary: "Autonomous driving system completes 50,000 miles without safety disconnects.",
        fact_bullets: ["Zero disengagements recorded"],
        verified_entities: ["Highway Safety Board"],
        published_at: new Date().toISOString(),
      },
      {
        event_id: "evt_fsd_2",
        topic: "ADS Hardware 5",
        topic_id: topicId,
        headline: "Compute Platform Enters Volume Production with High-Efficiency AI Chips",
        summary: "Automotive-grade inference processors roll off fabrication lines.",
        fact_bullets: ["500 TOPS compute at 150 Watts"],
        verified_entities: ["Chip Foundry"],
        published_at: new Date().toISOString(),
      },
      {
        event_id: "evt_fsd_3",
        topic: "Autonomous Driving Fleet",
        topic_id: topicId,
        headline: "Commercial Robotaxi Service Launches in Three Major Metro Areas",
        summary: "Driverless rides open to the general public across 200 square miles.",
        fact_bullets: ["24/7 commercial operations licensed"],
        verified_entities: ["Transit Authority"],
        published_at: new Date().toISOString(),
      },
    ] as any;

    const briefs = buildTopicBriefs(cards, nodeWithTargetTopic);

    // Should create exactly 1 consolidated brief for the GUID
    expect(briefs.length).toBe(1);
    const brief = briefs[0];
    expect(brief.topic_id).toBe(topicId);
    expect(brief.id).toBe(topicId);
    expect(brief.stories.length).toBe(3);
    expect(brief.stories.map((s) => s.event_id)).toEqual(["evt_fsd_1", "evt_fsd_2", "evt_fsd_3"]);
  });

  it("guarantees briefId determinism across successive calls without Date.now() jitter", () => {
    const singleTopicNode: UnifiedTopicNode = {
      ...mockNode,
      topics: {
        "Quantum Supercomputing": {
          topic_id: "top_quantum_supercomputing",
          weight: 0.9,
          technical_depth: "practitioner",
          why_they_care: "Fault-tolerant computing",
          curiosity_vectors: ["qubit fidelity"],
        },
      },
    };

    const card: SynthesizedEventCard = {
      event_id: "evt_stable_1",
      topic: "Quantum Supercomputing",
      topic_id: "top_quantum_supercomputing",
      headline: "Logical Qubit Breakthrough Reaches 99.99% Gate Fidelity",
      summary: "Error-corrected quantum computer demonstrates continuous fault-tolerant circuits.",
      fact_bullets: ["100 logical qubits achieved"],
      verified_entities: ["Physics Lab"],
      published_at: new Date().toISOString(),
    } as any;

    const run1 = buildTopicBriefs([card], singleTopicNode);
    const run2 = buildTopicBriefs([card], singleTopicNode);

    expect(run1.length).toBe(1);
    expect(run2.length).toBe(1);
    expect(run1[0].id).toBe("top_quantum_supercomputing");
    expect(run2[0].id).toBe("top_quantum_supercomputing");
    expect(run1[0].id).toBe(run2[0].id);
    expect(run1[0].topic_id).toBe(run2[0].topic_id);
  });
});
