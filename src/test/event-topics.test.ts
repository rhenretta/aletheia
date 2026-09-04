import { describe, it, expect, vi } from "vitest";
import {
  calculateEventGravity,
  synthesizePublicSentiment,
  buildHistoricalArc,
  buildTopicBriefs,
} from "../core/matching/topic-brief-builder";
import {
  SynthesizedEventCard,
  UnifiedTopicNode,
  EventSourceArticle,
  AttachedTopicBriefContext,
} from "../core/types/contracts";
import { ContextAgent } from "../core/agents/context/context-agent";
import { DialogueAgent } from "../core/agents/intake/dialogue-agent";

describe("Event-Driven Topic Briefs Architecture & State Machine", () => {
  const mockSources: EventSourceArticle[] = [
    {
      name: "Global Wire",
      title: "Major Infrastructure Development Announced",
      url: "https://globalwire.example/story-1",
      bias: "center",
      raw_text: "Officials confirmed today that phase two is fully operational.",
      highlighted_passages: ['"Phase two sets a new efficiency benchmark across regional grids."'],
      published_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2h ago
    },
    {
      name: "Reddit r/technology",
      title: "Community discussion on the new grid architecture",
      url: "https://reddit.com/r/technology/comments/example",
      bias: "center",
      raw_text: 'Community members were surprised by the speed of rollout.',
      highlighted_passages: ['"The real bottleneck remains maintenance cost rather than peak throughput."'],
      published_at: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(), // 3h ago
    },
    {
      name: "Field Telemetry News",
      title: "Independent Stress Testing Results",
      url: "https://telemetry.example/report-42",
      bias: "center",
      raw_text: 'Independent observers reported: "Early telemetry confirms 99.4% stability under peak load."',
      published_at: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(), // 4h ago
    },
  ];

  const mockCards: SynthesizedEventCard[] = [
    {
      event_id: "evt_fresh_1",
      topic: "Autonomous Robotics & Automation",
      headline: "Next-Gen Kinematic Actuators Enter Mass Production",
      personalized_framing: "Industrial kinematics milestone.",
      summary: "High-torque precision actuators have completed qualification testing and are rolling out to manufacturing lines.",
      fact_bullets: [
        "Torque density increased by 28%",
        "Thermal dissipation improved under continuous duty cycles",
      ],
      disputed_claims: [],
      verified_entities: ["Kinematics Alliance", "Actuator Series 4"],
      sources: [mockSources[0], mockSources[2]],
      format: "bulleted_distillation",
      published_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2h ago
      recency_label: "2h ago",
    },
    {
      event_id: "evt_fresh_2",
      topic: "Autonomous Robotics & Automation",
      headline: "Benchmarking Independent Actuator Wear Over 10,000 Hours",
      personalized_framing: "Longevity and wear telemetry.",
      summary: "Third-party validation indicates mechanical tolerance holds within nominal limits across accelerated wear simulations.",
      fact_bullets: ["Zero catastrophic gear failures recorded across test fleet"],
      disputed_claims: [
        {
          claim: "Gearbox backlash might degrade prematurely in dusty operating environments.",
          asserted_by: ["Original Equipment Manufacturer"],
          divergence_reason: "Field stress simulations disagree on dust ingress seal reliability.",
          contested_by: ["Field Reliability Lab"],
        },
      ],
      verified_entities: ["Testing Consortium"],
      sources: [mockSources[1]],
      format: "bulleted_distillation",
      published_at: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(), // 3d ago
      recency_label: "3d ago",
    },
  ];

  const mockUnifiedNode: UnifiedTopicNode = {
    user_id: "usr_test_eval",
    topics: {
      "Autonomous Robotics & Automation": {
        weight: 0.9,
        why_they_care: "Tracks mechanical engineering breakthroughs and automation systems.",
        technical_depth: "practitioner",
        curiosity_vectors: ["actuator physics", "gearbox tolerance"],
      },
      "Clean Energy Transition": {
        weight: 0.6,
        why_they_care: "Monitors energy storage systems and grid stability.",
        technical_depth: "practitioner",
        curiosity_vectors: ["battery chemistry"],
      },
    },
    psychological_profile: {
      emotional_trajectory: "objective, analytical, empirical",
      sensitivities: [],
      boundaries: ["Never patronize", "Always substantiate claims with primary telemetry"],
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

  describe("1. Event Gravity Calculation Engine", () => {
    it("computes high gravity score for breaking, multi-source stories with strong user affinity", () => {
      // 2h old, 2 cards, 3 distinct sources including Reddit
      const result = calculateEventGravity(mockCards, 0.9, mockSources, 2);

      expect(result.gravity_score).toBeGreaterThanOrEqual(70);
      expect(result.lifecycle_phase).toBe("escalating");
      expect(result.lifecycle_label).toContain("Rapid Influx");
      expect(result.momentum_trend).toBe("surging");
      expect(result.cross_source_breadth).toBe(3);
    });

    it("transitions to maturing state when event consolidates over 18+ hours", () => {
      const result = calculateEventGravity(mockCards, 0.8, mockSources, 22);

      expect(result.lifecycle_phase).toBe("maturing");
      expect(result.lifecycle_label).toContain("Consolidating Sentiment");
      expect(result.gravity_score).toBeLessThanOrEqual(85);
    });

    it("transitions to cooling state when stories are stale (>72 hours)", () => {
      const result = calculateEventGravity(mockCards, 0.7, mockSources, 76);

      expect(result.lifecycle_phase).toBe("cooling");
      expect(result.lifecycle_label).toContain("Cooling Off");
      expect(result.momentum_trend).toBe("cooling");
      expect(result.gravity_score).toBeLessThan(60);
    });

    it("handles zero-story dormant topics gracefully", () => {
      const result = calculateEventGravity([], 0.5, [], 999);

      expect(result.gravity_score).toBeLessThanOrEqual(25);
      expect(result.lifecycle_phase).toBe("cooling");
      expect(result.cross_source_breadth).toBe(0);
      expect(result.momentum_trend).toBe("cooling");
    });
  });

  describe("2. Public Sentiment & Community Voice Synthesis", () => {
    it("extracts representative quotes from highlighted passages and social sources", () => {
      const sentiment = synthesizePublicSentiment(mockCards, mockSources);

      expect(sentiment).toBeDefined();
      expect(["mixed", "critical", "cautious", "positive"]).toContain(sentiment.tone);
      expect(sentiment.summary.length).toBeGreaterThan(20);
      expect(sentiment.representative_quotes.length).toBeGreaterThan(0);

      // Verify that quotes contain legitimate attribution
      const redditQuote = sentiment.representative_quotes.find((q) => q.platform === "reddit");
      expect(redditQuote).toBeDefined();
      expect(redditQuote?.quote).toContain("bottleneck remains maintenance cost");
    });

    it("returns measured neutral state when no cards or sources are provided", () => {
      const sentiment = synthesizePublicSentiment([], []);
      expect(sentiment.tone).toBe("neutral");
      expect(sentiment.representative_quotes).toEqual([]);
      expect(sentiment.summary).toContain("Monitoring practitioner channels");
    });
  });

  describe("3. Historical Arc Chronological Construction", () => {
    it("builds an ordered milestone progression with relative time labels", () => {
      const arc = buildHistoricalArc(mockCards, undefined, Date.now());

      expect(arc.length).toBeGreaterThanOrEqual(2);
      expect(arc.length).toBeLessThanOrEqual(4);
      expect(arc[0].milestone).toBeDefined();
      expect(arc[0].time_label).toBeDefined();
    });

    it("incorporates topic evolution timeline when provided", () => {
      const topicMeta = {
        evolution_timeline: [
          {
            timestamp: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
            insight: "Initial prototyping tests commenced.",
            trigger_source: "Engineering Pre-print",
          },
        ],
      };

      const arc = buildHistoricalArc(mockCards, topicMeta, Date.now());
      expect(arc.some((m) => m.milestone.includes("Initial prototyping"))).toBe(true);
    });
  });

  describe("4. TopicBriefBuilder Integration & Hierarchy", () => {
    it("synthesizes rich living topic briefs with all state machine attributes", () => {
      const briefs = buildTopicBriefs(mockCards, mockUnifiedNode);

      expect(briefs.length).toBeGreaterThanOrEqual(2);

      const activeBrief = briefs.find((b) => b.parent_interest === "Autonomous Robotics & Automation");
      expect(activeBrief).toBeDefined();
      expect(activeBrief!.id).toBeDefined();
      expect(activeBrief!.parent_interest).toBe("Autonomous Robotics & Automation");
      expect(activeBrief!.title).toBe("Autonomous Robotics & Automation");
      expect(activeBrief!.topic).toBe("Autonomous Robotics & Automation");
      expect(activeBrief!.lifecycle_phase).toBe("escalating");
      expect(activeBrief!.gravity_score).toBeGreaterThan(60);
      expect(activeBrief!.current_focus).toBeDefined();
      expect(activeBrief!.public_sentiment.representative_quotes.length).toBeGreaterThan(0);
      expect(activeBrief!.historical_arc.length).toBeGreaterThan(0);

      // Verify narrative sentence citations map back to source cards
      expect(activeBrief!.narrative_sentences.length).toBeGreaterThan(0);
      expect(activeBrief!.narrative_sentences[0].story_id).toBe("evt_fresh_1");
    });
  });

  describe("5. Aletheia Dialogue Priming & Context Injection", () => {
    it("injects attached living event topic dossier into ContextAgent framing instructions", async () => {
      const mockAttachedBrief: AttachedTopicBriefContext = {
        brief_id: "brief_robotics_1",
        topic_title: "Kinematic Actuator Rollout",
        parent_interest: "Autonomous Robotics & Automation",
        lifecycle_phase: "escalating",
        lifecycle_label: "🔥 Rapid Influx",
        gravity_score: 88,
        current_focus: "Qualification testing completed with initial line deployments.",
        executive_summary: "Next-gen actuators enter mass production with 28% torque increase.",
        public_sentiment: {
          tone: "mixed",
          summary: "Favorable throughput reviews tempered by questions around dust seal durability.",
          representative_quotes: [
            {
              quote: "The real bottleneck remains maintenance cost.",
              speaker_or_community: "Reddit r/technology",
              platform: "reddit",
            },
          ],
        },
        historical_arc: [
          { time_label: "Yesterday", milestone: "Qualification tests passed" },
          { time_label: "Today", milestone: "Mass production rollout begun" },
        ],
        key_facts: ["28% torque increase", "Zero catastrophic gear failures"],
      };

      const framing = await ContextAgent.generateContextFraming(
        mockUnifiedNode,
        [{ role: "user", content: "What is the status of the actuator rollout?" }],
        "What is the status of the actuator rollout?",
        undefined,
        undefined,
        mockAttachedBrief
      );

      expect(framing.empath_instructions).toContain("7. ATTACHED LIVING EVENT TOPIC DOSSIER:");
      expect(framing.empath_instructions).toContain('Event Topic: "Kinematic Actuator Rollout"');
      expect(framing.empath_instructions).toContain("🔥 Rapid Influx");
      expect(framing.empath_instructions).toContain("Current Focus (\"The Now\")");
      expect(framing.empath_instructions).toContain("Public Sentiment: Tone MIXED");
      expect(framing.empath_instructions).toContain("Historical Arc: [Yesterday] Qualification tests passed -> [Today] Mass production rollout begun");
    });
  });

  describe("6. LLM-Designed Dynamic Presentation & Zero User Meta-Commentary", () => {
    it("synthesizes bespoke dynamic sections without formulaic cookie-cutter constraints", async () => {
      const { TopicBriefSynthesizer } = await import("../core/matching/topic-brief-synthesizer");

      const design = TopicBriefSynthesizer.synthesizeLocalDeterministic(
        "Autonomous Robotics & Automation",
        mockCards,
        mockSources,
        "practitioner",
        ["actuator physics", "gearbox tolerance"]
      );

      expect(design).toBeDefined();
      expect(design.presentation_archetype).toBe("regulatory_controversy"); // has disputed claims
      expect(design.executive_take).toBeDefined();
      expect(design.sections.length).toBeGreaterThanOrEqual(2);

      // Should have critical_tensions section because mockCards[1] has a disputed claim
      const tensionSec = design.sections.find((s) => s.section_type === "critical_tensions");
      expect(tensionSec).toBeDefined();
      expect(tensionSec!.content.tensions?.length).toBeGreaterThan(0);

      // Should have key_developments section
      const devSec = design.sections.find((s) => s.section_type === "key_developments");
      expect(devSec).toBeDefined();
      expect(devSec!.content.bullets?.length).toBe(2);

      // Should have real_world_chronology section
      const chronoSec = design.sections.find((s) => s.section_type === "real_world_chronology");
      expect(chronoSec).toBeDefined();
      expect(chronoSec!.content.milestones?.length).toBe(2);

      // Confirm absolute absence of user meta-commentary
      const serialized = JSON.stringify(design);
      expect(serialized).not.toMatch(/\bthe user\b/i);
      expect(serialized).not.toMatch(/\bobserver_agent\b/i);
      expect(serialized).not.toMatch(/user's interest/i);
    });

    it("ensures buildTopicBriefs purges all observer agent diagnostic logs and user introspection", () => {
      // Node with observer agent notes
      const nodeWithObserverNotes: UnifiedTopicNode = {
        ...mockUnifiedNode,
        topics: {
          "Tesla FSD Safety Data and Regulatory Scrutiny": {
            weight: 0.95,
            why_they_care:
              "The user has been tracking the reception of FSD 14.3.7 and 14.3.8, showing a keen interest in how these versions are performing in the real world.",
            living_narrative:
              "The user has been tracking the reception of FSD 14.3.7 and 14.3.8, showing a keen interest in how these versions are performing in the real world.",
            technical_depth: "practitioner",
            curiosity_vectors: ["disengagement metrics", "fleet telemetry"],
            evolution_timeline: [
              {
                timestamp: new Date().toISOString(),
                insight: "User's interest has deepened from general safety data to specific version reception.",
                trigger_source: "observer_agent",
              },
            ],
          },
        },
      };

      const briefs = buildTopicBriefs([], nodeWithObserverNotes);
      expect(briefs.length).toBe(1);

      const brief = briefs[0];
      // 1. Current focus must not contain observer notes
      expect(brief.current_focus).not.toContain("The user has been tracking");
      expect(brief.current_focus).not.toContain("observer_agent");

      // 2. Executive take & narrative must be topic-focused
      expect(brief.executive_take).not.toContain("The user has been tracking");
      expect(brief.living_narrative).not.toContain("The user has been tracking");

      // 3. Historical milestones must not include observer_agent logs
      expect(brief.historical_arc.every((m) => m.source_name !== "observer_agent")).toBe(true);
      expect(brief.historical_arc.every((m) => !m.milestone.includes("User's interest"))).toBe(true);

      // 4. Dynamic sections must be populated and clean
      expect(brief.dynamic_sections).toBeDefined();
      expect(brief.dynamic_sections!.length).toBeGreaterThan(0);
      const sectionsJson = JSON.stringify(brief.dynamic_sections);
      expect(sectionsJson).not.toMatch(/\bthe user has been tracking\b/i);
      expect(sectionsJson).not.toMatch(/\bobserver_agent\b/i);
    });
  });
});
