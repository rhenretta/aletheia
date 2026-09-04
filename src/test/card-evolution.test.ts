import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  TopicCardEvolutionOrchestrator,
} from "../core/agents/cards/topic-card-evolution-orchestrator";
import {
  TopicBriefSynthesizer,
  isForwardLookingCatalyst,
} from "../core/matching/topic-brief-synthesizer";
import {
  SynthesizedEventCard,
  EventSourceArticle,
  LLMTopicBriefDesign,
} from "../core/types/contracts";
import { LiveSearchEngine } from "../core/ingestion/live-search-engine";
import { deepseekProvider } from "../core/llm/deepseek-provider";

describe("TopicCardEvolutionOrchestrator", () => {
  const mockSources: EventSourceArticle[] = [
    {
      name: "TechWire",
      title: "New developments announced today",
      url: "https://example.com/1",
      bias: "center",
      raw_text: "Engineers confirmed successful stage testing with high efficiency.",
      highlighted_passages: ["Engineers confirmed successful stage testing."],
      published_at: new Date().toISOString(),
    },
  ];

  const mockCards: SynthesizedEventCard[] = [
    {
      event_id: "evt_test_1",
      topic: "Clean Energy Tech",
      headline: "Grid Storage Breaks Battery Density Milestone",
      personalized_framing: "Directly relates to battery density and grid storage.",
      summary: "Next-generation solid-state cells achieve 400 Wh/kg in utility pilot.",
      fact_bullets: ["400 Wh/kg measured in field trials", "Grid connection expected next quarter"],
      disputed_claims: [],
      verified_entities: ["Grid Storage", "Battery Density"],
      sources: mockSources,
      format: "bulleted_distillation",
      published_at: new Date().toISOString(),
    },
  ];

  const mockPreviousDesign: LLMTopicBriefDesign = {
    executive_take: "Solid-state batteries are advancing rapidly toward commercial grid deployment.",
    presentation_archetype: "technical_deep_dive",
    design_rationale: "Initial technical deep dive into cell chemistry",
    sections: [
      {
        id: "sec_overview",
        section_type: "key_developments",
        title: "Key Developments",
        layout_style: "bullets",
        content: {
          bullets: [{ text: "Solid-state cells pass utility trial", source: "TechWire" }],
        },
      },
    ],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("Phase 2: decideEvolution", () => {
    it("should decide 'redesign' when no previous design is provided", async () => {
      const decision = await TopicCardEvolutionOrchestrator.decideEvolution(
        "Clean Energy Tech",
        mockCards,
        mockSources,
        null
      );

      expect(decision.decision).toBe("redesign");
      expect(decision.rationale).toContain("No previous design found");
    });

    it("should decide 'redesign' via deterministic fallback when disputed claims arise without a tension section", async () => {
      vi.spyOn(deepseekProvider, "isConfigured").mockReturnValue(false);

      const cardsWithDisputes: SynthesizedEventCard[] = [
        {
          ...mockCards[0],
          disputed_claims: [
            {
              claim: "Mass production will begin next month",
              asserted_by: ["TechWire"],
              contested_by: ["IndustryAudit"],
              divergence_reason: "Supply chain delays push date to 2027",
            },
          ],
        },
      ];

      const decision = await TopicCardEvolutionOrchestrator.decideEvolution(
        "Clean Energy Tech",
        cardsWithDisputes,
        mockSources,
        mockPreviousDesign
      );

      expect(decision.decision).toBe("redesign");
      expect(decision.rationale).toContain("disputed");
    });

    it("should decide 'update_in_place' via deterministic fallback when updates are incremental", async () => {
      vi.spyOn(deepseekProvider, "isConfigured").mockReturnValue(false);

      const decision = await TopicCardEvolutionOrchestrator.decideEvolution(
        "Clean Energy Tech",
        mockCards,
        mockSources,
        mockPreviousDesign
      );

      expect(decision.decision).toBe("update_in_place");
      expect(decision.rationale).toContain("Existing layout cleanly accommodates");
    });
  });

  describe("Phase 3 & 4: architectNewLayout & targeted research", () => {
    it("should generate a valid layout plan and detect information gaps", async () => {
      vi.spyOn(deepseekProvider, "isConfigured").mockReturnValue(false);

      const plan = await TopicCardEvolutionOrchestrator.architectNewLayout(
        "Clean Energy Tech",
        mockCards,
        mockSources,
        mockPreviousDesign,
        "practitioner"
      );

      expect(plan).toBeDefined();
      expect(plan.archetype).toBeDefined();
      expect(plan.planned_section_types.length).toBeGreaterThan(0);
      expect(plan.design_rationale).toBeTruthy();
    });

    it("should execute targeted research queries without errors", async () => {
      const mockSearchResults = [
        {
          source_name: "Community",
          title: "Public reaction to battery breakthrough",
          source_url: "https://example.com/reaction",
          raw_text: "Engineers on Reddit and Hacker News discuss the cycle life implications.",
          author_bias_rating: "center" as const,
          published_at: new Date().toISOString(),
        },
      ];

      vi.spyOn(LiveSearchEngine, "search").mockResolvedValue(mockSearchResults as any);

      const result = await TopicCardEvolutionOrchestrator.executeTargetedResearch("Clean Energy Tech", [
        {
          gap_type: "community_quotes",
          query: "Clean Energy Tech public reactions discussion",
          rationale: "Explore engineer sentiment",
          target_section: "community_pulse",
        },
      ]);

      expect(result.executedQueries.length).toBe(1);
      expect(result.gapSources.length).toBe(1);
      expect(result.gapCards.length).toBe(1);
      expect(result.gapCards[0].headline).toBe("Public reaction to battery breakthrough");
    });
  });

  describe("End-to-End: evolveCard & TopicBriefSynthesizer.evolveBrief", () => {
    it("should orchestrate complete card evolution for initial build", async () => {
      vi.spyOn(LiveSearchEngine, "search").mockResolvedValue([]);
      vi.spyOn(deepseekProvider, "isConfigured").mockReturnValue(false);

      const result = await TopicCardEvolutionOrchestrator.evolveCard({
        topic: "Clean Energy Tech",
        previousCards: mockCards,
        previousSources: mockSources,
        previousDesign: null,
      });

      expect(result.topic).toBe("Clean Energy Tech");
      expect(result.decision).toBe("redesign");
      expect(result.design).toBeDefined();
      expect(result.design.sections.length).toBeGreaterThan(0);
      expect(result.all_sources.length).toBeGreaterThan(0);
    });

    it("should delegate to TopicBriefSynthesizer.evolveBrief seamlessly", async () => {
      vi.spyOn(LiveSearchEngine, "search").mockResolvedValue([]);
      vi.spyOn(deepseekProvider, "isConfigured").mockReturnValue(false);

      const result = await TopicBriefSynthesizer.evolveBrief(
        "Clean Energy Tech",
        mockCards,
        mockSources,
        mockPreviousDesign
      );

      expect(result.topic).toBe("Clean Energy Tech");
      expect(result.design).toBeDefined();
      expect(result.decision).toBeDefined();
    });
  });

  describe("Chronological & Temporal Integrity: isForwardLookingCatalyst", () => {
    // September 4, 2026 (Q3)
    const septDate = new Date(2026, 8, 4);

    it("should reject past quarters of current year (e.g. Q1, Q2 when in September)", () => {
      expect(isForwardLookingCatalyst("Tesla Q1 2026 earnings call", "Upcoming", septDate)).toBe(false);
      expect(isForwardLookingCatalyst("Q2 2026 financial report", "Upcoming", septDate)).toBe(false);
      expect(isForwardLookingCatalyst("First quarter 2026 results", "Upcoming", septDate)).toBe(false);
      expect(isForwardLookingCatalyst("Q1 earnings call", "Upcoming", septDate)).toBe(false);
    });

    it("should reject past years", () => {
      expect(isForwardLookingCatalyst("Developer summit in 2025", "Upcoming", septDate)).toBe(false);
      expect(isForwardLookingCatalyst("Initial rollout in 2024", "Upcoming", septDate)).toBe(false);
    });

    it("should reject past months of current year", () => {
      expect(isForwardLookingCatalyst("Industry symposium June 2026", "Upcoming", septDate)).toBe(false);
    });

    it("should accept valid future quarters, future years, and ongoing processes", () => {
      expect(isForwardLookingCatalyst("Tesla Q3 2026 earnings call", "Upcoming", septDate)).toBe(true);
      expect(isForwardLookingCatalyst("Tesla Q4 2026 earnings call", "Upcoming", septDate)).toBe(true);
      expect(isForwardLookingCatalyst("Major platform release Q1 2027", "Upcoming", septDate)).toBe(true);
      expect(isForwardLookingCatalyst("NHTSA investigation outcome", "Ongoing", septDate)).toBe(true);
      expect(isForwardLookingCatalyst("Cybercab deployment timeline", "Near-term", septDate)).toBe(true);
      expect(isForwardLookingCatalyst("European regulatory vote October 2026", "Upcoming", septDate)).toBe(true);
    });

    it("should filter out anachronistic catalysts during update in place", async () => {
      const designWithPastCatalyst: LLMTopicBriefDesign = {
        ...mockPreviousDesign,
        sections: [
          {
            id: "sec_catalysts",
            section_type: "catalysts_outlook",
            title: "What to Watch",
            layout_style: "grid",
            content: {
              catalysts: [
                { timeframe: "Ongoing", event: "NHTSA investigation outcome", significance: "Potential regulatory impact" },
                { timeframe: "Upcoming", event: "Tesla Q1 2026 earnings call", significance: "Outdated past earnings" },
                { timeframe: "Near-term", event: "Cybercab deployment timeline", significance: "Forward-looking" },
              ],
            },
          },
        ],
      };

      const result = await TopicCardEvolutionOrchestrator.synthesizeCard(
        "Clean Energy Tech",
        mockCards,
        mockSources,
        "update_in_place",
        designWithPastCatalyst
      );

      const catalystsSection = result.sections.find((s) => s.section_type === "catalysts_outlook");
      expect(catalystsSection).toBeDefined();
      expect(catalystsSection?.content.catalysts?.length).toBe(2);
      expect(
        catalystsSection?.content.catalysts?.some((c) => c.event.includes("Q1 2026"))
      ).toBe(false);
    });
  });
});
