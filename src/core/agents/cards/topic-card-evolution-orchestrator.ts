import {
  SynthesizedEventCard,
  EventSourceArticle,
  LLMTopicBriefDesign,
  CardEvolutionDecision,
  LayoutArchitectPlan,
  EvolvedTopicCardResult,
  RawArticle,
  DynamicBriefSection,
} from "../../types/contracts";
import { LiveSearchEngine } from "../../ingestion/live-search-engine";
import { FreeNewsFetcher } from "../../ingestion/rss-search";
import { StoryDiscoveryEngine } from "../../ingestion/story-discovery-engine";
import { deepseekProvider } from "../../llm/deepseek-provider";
import {
  TopicBriefSynthesizer,
  cleanArticleSnippet,
  synthesizeCleanExecutiveTake,
  isForwardLookingCatalyst,
  enrichSectionSourceUrls,
} from "../../matching/topic-brief-synthesizer";

export interface EvolveTopicCardOptions {
  topic: string;
  previousCards?: SynthesizedEventCard[];
  previousSources?: EventSourceArticle[];
  previousDesign?: LLMTopicBriefDesign | null;
  technicalDepth?: string;
  curiosityVectors?: string[];
}

export class TopicCardEvolutionOrchestrator {
  /**
   * Main Agentic Orchestrator:
   * 1. Live Data Refresh: searches for latest wire/web news on the topic
   * 2. Evolutionary Decision Agent: update in place vs. redesign
   * 3. Layout Architect Agent: designs new layout and identifies information gaps (if redesign)
   * 4. Targeted Research Agent: performs targeted search queries to fill gaps
   * 5. Synthesis Agent: synthesizes the final evolved card
   */
  public static async evolveCard(options: EvolveTopicCardOptions): Promise<EvolvedTopicCardResult> {
    const {
      topic,
      previousCards = [],
      previousSources = [],
      previousDesign = null,
      technicalDepth = "practitioner",
      curiosityVectors = [],
    } = options;

    // -------------------------------------------------------------
    // PHASE 1: Live Data Discovery on the Topic
    // -------------------------------------------------------------
    const { refreshedCards, refreshedSources } = await this.searchRefreshedTopicData(
      topic,
      previousCards,
      previousSources
    );

    const mergedCards = this.mergeCards(previousCards, refreshedCards);
    const mergedSources = this.mergeSources(previousSources, refreshedSources);

    // -------------------------------------------------------------
    // PHASE 2: Evolutionary Decision Agent (Update vs. Redesign)
    // -------------------------------------------------------------
    const decisionResult = await this.decideEvolution(
      topic,
      mergedCards,
      mergedSources,
      previousDesign
    );

    // -------------------------------------------------------------
    // PHASE 3 & 4: If Redesign, Layout Architect & Targeted Research
    // -------------------------------------------------------------
    let targetedQueriesExecuted: string[] = [];
    let layoutPlan: LayoutArchitectPlan | null = null;
    let finalSources = mergedSources;
    let finalCards = mergedCards;

    if (decisionResult.decision === "redesign" || !previousDesign) {
      // Phase 3: Layout Architect Agent
      layoutPlan = await this.architectNewLayout(
        topic,
        mergedCards,
        mergedSources,
        previousDesign,
        technicalDepth
      );

      // Phase 4: Targeted Information Retrieval Agent (if gaps identified)
      if (layoutPlan.information_gaps && layoutPlan.information_gaps.length > 0) {
        const { gapCards, gapSources, executedQueries } = await this.executeTargetedResearch(
          topic,
          layoutPlan.information_gaps
        );
        targetedQueriesExecuted = executedQueries;
        finalCards = this.mergeCards(mergedCards, gapCards);
        finalSources = this.mergeSources(mergedSources, gapSources);
      }
    }

    // -------------------------------------------------------------
    // PHASE 5: Card Synthesis Agent
    // -------------------------------------------------------------
    const finalDesign = await this.synthesizeCard(
      topic,
      finalCards,
      finalSources,
      decisionResult.decision,
      previousDesign,
      layoutPlan,
      technicalDepth,
      curiosityVectors
    );

    return {
      topic,
      decision: decisionResult.decision,
      decision_rationale: decisionResult.rationale,
      design: finalDesign,
      new_cards: finalCards,
      all_sources: finalSources,
      targeted_queries_executed: targetedQueriesExecuted,
    };
  }

  /**
   * Phase 1: Live Data Discovery for the topic
   */
  public static async searchRefreshedTopicData(
    topic: string,
    existingCards: SynthesizedEventCard[] = [],
    existingSources: EventSourceArticle[] = []
  ): Promise<{ refreshedCards: SynthesizedEventCard[]; refreshedSources: EventSourceArticle[] }> {
    try {
      const refreshedCards: SynthesizedEventCard[] = [];
      const refreshedSources: EventSourceArticle[] = [];
      const candidateArticles: RawArticle[] = [];
      const seenUrls = new Set<string>();

      // 1. Direct news wire search (Google News RSS: authentic journalistic stories)
      try {
        const wireArticles = await FreeNewsFetcher.fetchRssForQuery(topic);
        for (const art of wireArticles.slice(0, 8)) {
          if (!seenUrls.has(art.source_url)) {
            seenUrls.add(art.source_url);
            candidateArticles.push(art);
          }
        }
      } catch (err) {
        console.warn(`[TopicCardEvolutionOrchestrator] News wire search failed for "${topic}":`, err);
      }

      // 2. Open web search via multi-provider mesh (DDG & Bing)
      try {
        const query = `${topic} news updates`;
        const webArticles = await LiveSearchEngine.search(query, 6);
        for (const art of webArticles) {
          if (!seenUrls.has(art.source_url)) {
            seenUrls.add(art.source_url);
            candidateArticles.push(art);
          }
        }
      } catch (err) {
        console.warn(`[TopicCardEvolutionOrchestrator] Web search failed for "${topic}":`, err);
      }

      // 3. Process candidate items: classify into source hubs vs actual stories
      const concreteStories: RawArticle[] = [];

      for (const art of candidateArticles) {
        const kind = StoryDiscoveryEngine.classifyWebResource(art.source_url, art.title, art.raw_text);

        // Always register in refreshedSources for attribution and discovery provenance
        const sourceEntry: EventSourceArticle = {
          name: art.source_name || "Wire",
          title: art.title,
          url: art.source_url,
          bias: art.author_bias_rating || "center",
          raw_text: art.raw_text || art.title,
          highlighted_passages: art.raw_text ? [art.raw_text.slice(0, 200)] : [],
          published_at: art.published_at || new Date().toISOString(),
        };
        refreshedSources.push(sourceEntry);

        if (kind === "source_hub") {
          // When encountering a source hub (directory, portal, product page):
          // Use it for discovery! Explore the hub to discover actual stories within it.
          try {
            const hubStories = await StoryDiscoveryEngine.discoverStoriesFromSource(art.source_url, topic, 3);
            for (const story of hubStories) {
              if (!seenUrls.has(story.source_url)) {
                seenUrls.add(story.source_url);
                concreteStories.push(story);
                refreshedSources.push({
                  name: story.source_name || art.source_name || "Wire",
                  title: story.title,
                  url: story.source_url,
                  bias: story.author_bias_rating || "center",
                  raw_text: story.raw_text || story.title,
                  highlighted_passages: story.raw_text ? [story.raw_text.slice(0, 200)] : [],
                  published_at: story.published_at || new Date().toISOString(),
                });
              }
            }
          } catch (hubErr) {
            console.warn(`[TopicCardEvolutionOrchestrator] Hub discovery error on ${art.source_url}:`, hubErr);
          }
        } else {
          // It is an actual story
          concreteStories.push(art);
        }
      }

      // 4. Transform discovered stories into clean SynthesizedEventCards
      // Guarantee that only concrete reporting stories are presented as event cards
      concreteStories.forEach((art, idx) => {
        const cleanSummary = cleanArticleSnippet(art.title, art.raw_text);

        const cardSource: EventSourceArticle = {
          name: art.source_name || "Wire",
          title: art.title,
          url: art.source_url,
          bias: art.author_bias_rating || "center",
          raw_text: art.raw_text || art.title,
          highlighted_passages: art.raw_text ? [art.raw_text.slice(0, 200)] : [],
          published_at: art.published_at || new Date().toISOString(),
        };

        const card: SynthesizedEventCard = {
          event_id: `evt_${topic.toLowerCase().replace(/[^a-z0-9]/g, "_")}_${Date.now()}_${idx}`,
          topic,
          headline: art.title,
          personalized_framing: `Latest reporting on ${topic}.`,
          summary: cleanSummary,
          fact_bullets: [cleanSummary.slice(0, 150)],
          disputed_claims: [],
          verified_entities: [topic],
          sources: [cardSource],
          format: "bulleted_distillation",
          published_at: art.published_at || new Date().toISOString(),
          recency_label: "Recent",
          image_url: art.image_url,
          is_fresh: true,
        };
        refreshedCards.push(card);
      });

      return { refreshedCards, refreshedSources };
    } catch (err) {
      console.warn(`[TopicCardEvolutionOrchestrator] Live search failed for "${topic}":`, err);
      return { refreshedCards: [], refreshedSources: [] };
    }
  }

  /**
   * Phase 2: Evolutionary Decision Agent (Update vs. Redesign)
   */
  public static async decideEvolution(
    topic: string,
    cards: SynthesizedEventCard[],
    sources: EventSourceArticle[],
    previousDesign?: LLMTopicBriefDesign | null
  ): Promise<CardEvolutionDecision> {
    // If no previous design exists, it must be designed from scratch
    if (!previousDesign || !previousDesign.sections || previousDesign.sections.length === 0) {
      return {
        decision: "redesign",
        rationale: "No previous design found. Initial layout architecture required.",
      };
    }

    // If LLM is available, delegate decision to LLM per AGENTS.md rule 2
    if (deepseekProvider.isConfigured()) {
      try {
        const prompt = `You are the Card Evolution Decision Agent at Aletheia.
We are refreshing a topic card for everyday readers keeping up on their interests.

TOPIC: "${topic}"

PREVIOUS CARD DESIGN:
- Archetype: ${previousDesign.presentation_archetype}
- Previous Executive Take: "${previousDesign.executive_take}"
- Existing Sections: ${previousDesign.sections.map((s) => `[${s.section_type}: "${s.title}"]`).join(", ")}

CURRENT REFRESHED STORIES & DATA (${cards.length} stories, ${sources.length} sources):
${cards.slice(0, 5).map((c, i) => `${i + 1}. "${c.headline}" - ${c.summary.slice(0, 140)}...`).join("\n")}

DECISION TASK:
Determine whether this card should:
1. "update_in_place": The existing layout still fits the state of the story well. We just need to refresh the stories, numbers, and "The Big Picture" take in-place.
2. "redesign": The nature, phase, or depth of the story has meaningfully shifted. For example:
   - A major debate/dispute or regulatory pushback emerged (warrants comparative claim cards).
   - An event concluded or progressed through multiple sequential stages (warrants a chronological timeline).
   - Real-world numbers, specs, or benchmark test results became prominent (warrants a stats grid).
   - Community/user discourse or public reactions became the central story (warrants quote cards).

Respond STRICTLY with valid JSON:
{
  "decision": "update_in_place" | "redesign",
  "rationale": "1-2 sentence friendly rationale explaining why",
  "significant_developments": ["Specific development that influenced this decision"]
}`;

        const res = await deepseekProvider.generateCompletion(prompt, {
          temperature: 0.2,
          maxTokens: 300,
        });

        const jsonMatch = res.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]) as CardEvolutionDecision;
          if (parsed.decision === "update_in_place" || parsed.decision === "redesign") {
            return parsed;
          }
        }
      } catch (err) {
        console.warn(`[TopicCardEvolutionOrchestrator] LLM decision failed, using deterministic evaluation:`, err);
      }
    }

    // Deterministic fallback decision:
    // Redesign if newly arrived cards have genuine multi-source disputed claims not covered in previous sections,
    // or if the story count expanded significantly (> 2 new stories)
    const hasDisputes = cards.some((c) =>
      (c.disputed_claims || []).some((d) => {
        const reason = (d.divergence_reason || "").toLowerCase();
        return (
          d.contested_by &&
          d.contested_by.length > 0 &&
          !reason.includes("single-source") &&
          !reason.includes("only one source") &&
          !reason.includes("no contesting source")
        );
      })
    );
    const hadTensionSection = previousDesign.sections.some((s) => s.section_type === "critical_tensions");

    if (hasDisputes && !hadTensionSection) {
      return {
        decision: "redesign",
        rationale: "New disputed assertions and differing reports emerged, warranting a debate structure.",
        significant_developments: ["Divergent claims and pushback identified."],
      };
    }

    const pubTimes = cards.map((c) => new Date(c.published_at || 0).getTime()).filter((t) => t > 0);
    const latestCardTime = pubTimes.length > 0 ? Math.max(...pubTimes) : Date.now();
    const earliestCardTime = pubTimes.length > 0 ? Math.min(...pubTimes) : latestCardTime;
    const timeSpanDays = (latestCardTime - earliestCardTime) / (1000 * 60 * 60 * 24);

    const distinctDates = new Set(
      cards.map((c) => (c.published_at ? new Date(c.published_at).toISOString().slice(0, 10) : ""))
    );
    distinctDates.delete("");

    // A real multi-stage chronology requires at least 3 distinct calendar dates spanning at least 5 days.
    // If stories all broke within 48-72 hours, they are concurrent breaking stories, NOT a timeline!
    if (
      distinctDates.size >= 3 &&
      timeSpanDays >= 5 &&
      !previousDesign.sections.some((s) => s.section_type === "real_world_chronology")
    ) {
      return {
        decision: "redesign",
        rationale: "Story progression spans multiple distinct real-world dates across days/weeks, warranting a chronological timeline.",
        significant_developments: ["Multi-stage sequence across separate dates detected."],
      };
    }

    return {
      decision: "update_in_place",
      rationale: "Existing layout cleanly accommodates current updates without structural shifts.",
    };
  }

  /**
   * Phase 3: Layout Architect Agent (designs new layout & identifies information gaps)
   */
  public static async architectNewLayout(
    topic: string,
    cards: SynthesizedEventCard[],
    sources: EventSourceArticle[],
    previousDesign?: LLMTopicBriefDesign | null,
    technicalDepth: string = "practitioner"
  ): Promise<LayoutArchitectPlan> {
    if (deepseekProvider.isConfigured()) {
      try {
        const prompt = `You are the Layout Architect Agent at Aletheia.
Your task is to design a friendly, intuitive presentation layout for a topic card, and create an explicit RESEARCH PLAN for recent data needed to execute this layout at the highest quality.

TOPIC: "${topic}"

PREVIOUS LAYOUT (if any):
${previousDesign ? `- Archetype: ${previousDesign.presentation_archetype}\n- Sections: ${previousDesign.sections.map((s) => s.section_type).join(", ")}` : "None (New Card)"}

AVAILABLE DATA:
${cards.slice(0, 6).map((c, i) => `Story ${i + 1}: "${c.headline}"\nSummary: ${c.summary}`).join("\n\n")}

AVAILABLE SOURCES:
${sources.slice(0, 4).map((s) => `[${s.name}] ${s.title}`).join("\n")}

ARCHITECTURAL CHOICES:
- presentation_archetype: "regulatory_controversy" | "technical_deep_dive" | "breaking_chronology" | "field_synthesis" | "empirical_investigation"
- planned_section_types: 2 to 4 of ("critical_tensions" | "telemetry_metrics" | "real_world_chronology" | "community_pulse" | "key_developments" | "catalysts_outlook" | "deep_dive_inquiries")

CRITICAL TIMELINE RULES (MANDATORY):
- "real_world_chronology": ONLY plan this section if the available research documents a genuine multi-stage progression spanning distinct dates or historical phases across weeks or months.
- NEVER plan a timeline for breaking news items or stories that occurred within the same 48-72 hour window or where items would all be labeled "Just now" or "Today".
- If all events or articles occurred on the same day or within the same news cycle, DO NOT plan a timeline.

CRITICAL RECENCY & RELEVANCE RULES (MANDATORY):
- The user requires RECENT, high-signal data.
- When formulating information gaps and search queries, formulate queries that explicitly seek recent data within the active news window (e.g. current year or recent practitioner discussions).
- NEVER plan generic queries that might return multi-year-old forum threads or obsolete blog posts.

INFORMATION GAPS & RESEARCH PLAN:
Formulate 1 to 3 targeted search queries to retrieve recent data needed for your layout.
For example:
- If planning community pulse: formulate a query for recent user or practitioner discussions within the active news cycle.
- If planning critical tensions: formulate a query for latest regulatory or technical pushback.
- If planning telemetry metrics: formulate a query for latest benchmark specs or testing data.
If available data is already completely sufficient, information_gaps can be empty [].

Respond STRICTLY with valid JSON:
{
  "archetype": "regulatory_controversy" | "technical_deep_dive" | "breaking_chronology" | "field_synthesis" | "empirical_investigation",
  "design_rationale": "Short friendly note on what this card focuses on",
  "planned_section_types": ["key_developments", "critical_tensions"],
  "information_gaps": [
    {
      "gap_type": "timeline" | "community_quotes" | "metrics" | "opposing_claims" | "general_context",
      "query": "concise targeted search query seeking recent data",
      "rationale": "why this recent data is needed for the layout",
      "target_section": "critical_tensions"
    }
  ]
}`;

        const res = await deepseekProvider.generateCompletion(prompt, {
          temperature: 0.3,
          maxTokens: 500,
        });

        const jsonMatch = res.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]) as LayoutArchitectPlan;
          if (parsed.archetype && Array.isArray(parsed.planned_section_types)) {
            return parsed;
          }
        }
      } catch (err) {
        console.warn(`[TopicCardEvolutionOrchestrator] Layout architect LLM failed, using deterministic plan:`, err);
      }
    }

    // Deterministic fallback plan
    const hasDisputes = cards.some((c) => c.disputed_claims && c.disputed_claims.length > 0);
    const plannedSections: LayoutArchitectPlan["planned_section_types"] = ["key_developments"];

    if (hasDisputes) {
      plannedSections.push("critical_tensions");
    }
    const pubTimes = cards.map((c) => new Date(c.published_at || 0).getTime()).filter((t) => t > 0);
    const latestCardTime = pubTimes.length > 0 ? Math.max(...pubTimes) : Date.now();
    const earliestCardTime = pubTimes.length > 0 ? Math.min(...pubTimes) : latestCardTime;
    const timeSpanHours = (latestCardTime - earliestCardTime) / (1000 * 60 * 60);

    const recentProgression = cards.filter((c) => {
      const pub = new Date(c.published_at || 0).getTime();
      return latestCardTime - pub < 60 * 24 * 60 * 60 * 1000;
    });

    const distinctDates = new Set(
      recentProgression.map((c) => (c.published_at ? new Date(c.published_at).toISOString().slice(0, 10) : ""))
    );
    distinctDates.delete("");

    // A real timeline requires at least 3 distinct calendar dates spanning at least 5 days (120 hours)
    if (recentProgression.length >= 3 && timeSpanHours >= 120 && distinctDates.size >= 3) {
      plannedSections.push("real_world_chronology");
    }

    const gaps: LayoutArchitectPlan["information_gaps"] = [];
    if (!sources.some((s) => s.name.toLowerCase().includes("reddit") || s.name.toLowerCase().includes("bluesky"))) {
      gaps.push({
        gap_type: "community_quotes",
        query: `${topic} latest discussion reaction`,
        rationale: "Gather recent practitioner and community reactions within the active news cycle.",
        target_section: "community_pulse",
      });
    }

    return {
      archetype: hasDisputes ? "regulatory_controversy" : cards.length >= 2 ? "breaking_chronology" : "field_synthesis",
      design_rationale: "Curated digest tailored to the latest updates.",
      planned_section_types: plannedSections,
      information_gaps: gaps,
    };
  }

  /**
   * Phase 4: Targeted Information Retrieval Agent (executes targeted queries to fill gaps)
   */
  public static async executeTargetedResearch(
    topic: string,
    gaps: LayoutArchitectPlan["information_gaps"]
  ): Promise<{ gapCards: SynthesizedEventCard[]; gapSources: EventSourceArticle[]; executedQueries: string[] }> {
    const gapCards: SynthesizedEventCard[] = [];
    const gapSources: EventSourceArticle[] = [];
    const executedQueries: string[] = [];

    // Limit to top 2 most critical queries to keep latency crisp
    const queriesToRun = gaps.slice(0, 2);

    for (const gap of queriesToRun) {
      try {
        executedQueries.push(gap.query);
        const results: RawArticle[] = await LiveSearchEngine.search(gap.query, {
          maxResults: 4,
          timeWindow: "month",
          maxAgeDays: 60,
        });

        for (const art of results) {
          if (art.published_at) {
            const pubTime = new Date(art.published_at).getTime();
            if (!isNaN(pubTime) && (Date.now() - pubTime) > 60 * 24 * 60 * 60 * 1000) {
              continue; // Skip stale search results older than 60 days
            }
          }
          const kind = StoryDiscoveryEngine.classifyWebResource(art.source_url, art.title, art.raw_text);

          const source: EventSourceArticle = {
            name: art.source_name || "Research Wire",
            title: art.title,
            url: art.source_url,
            bias: art.author_bias_rating || "center",
            raw_text: art.raw_text || art.title,
            highlighted_passages: art.raw_text ? [art.raw_text.slice(0, 200)] : [],
            published_at: art.published_at || new Date().toISOString(),
          };
          gapSources.push(source);

          if (kind === "source_hub") {
            let foundStoriesCount = 0;
            try {
              const discovered = await StoryDiscoveryEngine.discoverStoriesFromSource(art.source_url, topic, 2);
              foundStoriesCount = discovered.length;
              for (const story of discovered) {
                const cleanSummary = cleanArticleSnippet(story.title, story.raw_text);
                const storySource: EventSourceArticle = {
                  name: story.source_name || art.source_name || "Research Wire",
                  title: story.title,
                  url: story.source_url,
                  bias: story.author_bias_rating || "center",
                  raw_text: story.raw_text || story.title,
                  highlighted_passages: story.raw_text ? [story.raw_text.slice(0, 200)] : [],
                  published_at: story.published_at || new Date().toISOString(),
                };
                gapSources.push(storySource);
                gapCards.push({
                  event_id: `evt_gap_${Date.now()}_${gapCards.length}`,
                  topic,
                  headline: story.title,
                  personalized_framing: `Targeted investigation into ${topic}.`,
                  summary: cleanSummary,
                  fact_bullets: [cleanSummary.slice(0, 150)],
                  disputed_claims: [],
                  verified_entities: [topic],
                  sources: [storySource],
                  format: "bulleted_distillation",
                  published_at: story.published_at || new Date().toISOString(),
                  recency_label: "Targeted Research",
                  image_url: story.image_url,
                });
              }
            } catch {}

            // If hub exploration returned no sub-articles but the snippet has substantive research text, fallback gracefully
            if (foundStoriesCount === 0 && art.raw_text && art.raw_text.length >= 30) {
              const cleanSummary = cleanArticleSnippet(art.title, art.raw_text);
              gapCards.push({
                event_id: `evt_gap_${Date.now()}_${gapCards.length}`,
                topic,
                headline: art.title,
                personalized_framing: `Targeted investigation into ${topic}.`,
                summary: cleanSummary,
                fact_bullets: [cleanSummary.slice(0, 150)],
                disputed_claims: [],
                verified_entities: [topic],
                sources: [source],
                format: "bulleted_distillation",
                published_at: art.published_at || new Date().toISOString(),
                recency_label: "Targeted Research",
                image_url: art.image_url,
              });
            }
          } else {
            const cleanSummary = cleanArticleSnippet(art.title, art.raw_text);
            const card: SynthesizedEventCard = {
              event_id: `evt_gap_${Date.now()}_${gapCards.length}`,
              topic,
              headline: art.title,
              personalized_framing: `Targeted investigation into ${topic}.`,
              summary: cleanSummary,
              fact_bullets: [cleanSummary.slice(0, 150)],
              disputed_claims: [],
              verified_entities: [topic],
              sources: [source],
              format: "bulleted_distillation",
              published_at: art.published_at || new Date().toISOString(),
              recency_label: "Targeted Research",
              image_url: art.image_url,
            };
            gapCards.push(card);
          }
        }
      } catch (err) {
        console.warn(`[TopicCardEvolutionOrchestrator] Targeted research query "${gap.query}" failed:`, err);
      }
    }

    return { gapCards, gapSources, executedQueries };
  }

  /**
   * Phase 5: Card Synthesis Agent
   */
  public static async synthesizeCard(
    topic: string,
    cards: SynthesizedEventCard[],
    sources: EventSourceArticle[],
    mode: "update_in_place" | "redesign",
    previousDesign?: LLMTopicBriefDesign | null,
    layoutPlan?: LayoutArchitectPlan | null,
    technicalDepth: string = "practitioner",
    curiosityVectors: string[] = []
  ): Promise<LLMTopicBriefDesign> {
    // If update_in_place and previousDesign exists, refresh the content while preserving sections
    if (mode === "update_in_place" && previousDesign && previousDesign.sections.length > 0) {
      return await this.synthesizeUpdateInPlace(
        topic,
        cards,
        sources,
        previousDesign,
        technicalDepth
      );
    }

    // Otherwise, perform full synthesis based on the architect plan and all enriched data
    return TopicBriefSynthesizer.synthesizeBrief(
      topic,
      cards,
      sources,
      {
        technical_depth: technicalDepth,
        curiosity_vectors: curiosityVectors,
      }
    );
  }

  /**
   * In-place synthesis: updates existing sections and "The Big Picture" take
   * while keeping the layout structure stable.
   */
  private static async synthesizeUpdateInPlace(
    topic: string,
    cards: SynthesizedEventCard[],
    sources: EventSourceArticle[],
    previousDesign: LLMTopicBriefDesign,
    technicalDepth: string
  ): Promise<LLMTopicBriefDesign> {
    // Generate fresh 2-sentence executive take using LLM if available, otherwise clean deterministic synthesis
    let freshExecutiveTake = "";
    if (deepseekProvider.isConfigured() && cards.length > 0) {
      try {
        const prompt = `You are a clear, engaging editor at Aletheia writing a "What's Happening Now" update for the topic "${topic}".
Write a warm, clear, 2-sentence executive summary of the current situation based on these recent reports:
${cards.slice(0, 4).map((c, i) => `${i + 1}. ${c.headline}: ${c.summary}`).join("\n")}

Editorial Requirements:
- Explain what is happening right now in natural, engaging language for everyday readers.
- Do NOT repeat headlines verbatim.
- Do NOT use mechanical em-dash patterns like "Headline — Headline" or "Meanwhile,".
- Must be 1 to 2 complete, well-formed sentences ending in punctuation.

Respond ONLY with the 1-2 sentences:`;

        const res = await deepseekProvider.generateCompletion(prompt, {
          temperature: 0.3,
          maxTokens: 160,
        });
        const clean = res.text.trim().replace(/^["']|["']$/g, "").trim();
        if (clean.length > 25 && (clean.endsWith(".") || clean.endsWith("!"))) {
          freshExecutiveTake = clean;
        }
      } catch (err) {
        console.warn("[TopicCardEvolutionOrchestrator] LLM executive take generation failed, using clean fallback:", err);
      }
    }

    if (!freshExecutiveTake) {
      freshExecutiveTake = synthesizeCleanExecutiveTake(topic, cards);
    }

    // Refresh contents of each existing section without changing the structural types
    const updatedSections = previousDesign.sections.map((sec) => {
      if (sec.section_type === "key_developments" && cards.length > 0) {
        return {
          ...sec,
          content: {
            bullets: cards.slice(0, 3).map((c) => ({
              title: c.headline,
              text: c.summary,
              source: c.sources?.[0]?.name || "Reporting",
              source_url: c.sources?.[0]?.url,
            })),
          },
        };
      }

      if (sec.section_type === "real_world_chronology") {
        // 1. Preserve LLM/agent-researched milestones if valid and free of ancient historical trivia
        if (sec.content.milestones && sec.content.milestones.length >= 2) {
          const freshResearched = sec.content.milestones.filter(
            (m) => !m.time_label?.includes("2024") && !m.time_label?.includes("2023")
          );
          if (freshResearched.length >= 2) {
            return {
              ...sec,
              content: { ...sec.content, milestones: freshResearched },
            };
          }
        }

        // 2. Otherwise, only generate progression if there is genuine multi-day progression (>= 48h span)
        const pubTimes = cards.map((c) => new Date(c.published_at || 0).getTime()).filter((t) => t > 0);
        const latestTime = pubTimes.length > 0 ? Math.max(...pubTimes) : Date.now();
        const earliestTime = pubTimes.length > 0 ? Math.min(...pubTimes) : latestTime;
        const spanHours = (latestTime - earliestTime) / (1000 * 60 * 60);

        if (spanHours < 48) {
          return null; // Same-day articles are not a timeline
        }

        const recentCards = cards.filter((c) => {
          const pub = new Date(c.published_at || 0).getTime();
          return latestTime - pub < 60 * 24 * 60 * 60 * 1000;
        });

        // If there are fewer than 2 recent cards, drop the timeline section completely
        if (recentCards.length < 2) {
          return null;
        }

        const sorted = [...recentCards].sort(
          (a, b) => new Date(a.published_at || 0).getTime() - new Date(b.published_at || 0).getTime()
        );

        // Take the recent progression leading up to now (at most 4)
        const timelineCards = sorted.slice(-4);
        const milestones = timelineCards.map((c) => {
          const pubTime = new Date(c.published_at || 0).getTime();
          const diffH = Math.round((Date.now() - pubTime) / (1000 * 60 * 60));
          const timeLabel =
            diffH <= 2
              ? "Just now"
              : diffH < 24
              ? `${diffH}h ago`
              : diffH < 48
              ? "Yesterday"
              : diffH < 24 * 30
              ? `${Math.round(diffH / 24)}d ago`
              : new Date(pubTime).toLocaleDateString("en-US", { month: "short", year: "numeric" });
          return {
            time_label: timeLabel,
            milestone: c.headline,
            source_name: c.sources?.[0]?.name,
            source_url: c.sources?.[0]?.url,
          };
        });

        // Genuine timeline check: if all items are labeled "Just now" or labels collapsed into same day, drop section
        const distinctLabels = new Set(milestones.map((m) => m.time_label));
        const justNowCount = milestones.filter((m) => m.time_label === "Just now").length;
        if (milestones.length < 2 || distinctLabels.size < 2 || justNowCount >= 2) {
          return null;
        }

        return {
          ...sec,
          content: { milestones },
        };
      }

      if (sec.section_type === "catalysts_outlook" && sec.content.catalysts) {
        const validCatalysts = sec.content.catalysts.filter((cat) =>
          isForwardLookingCatalyst(cat.event, cat.timeframe)
        );
        return {
          ...sec,
          content: {
            ...sec.content,
            catalysts: validCatalysts,
          },
        };
      }

      return sec;
    });

    const sanitizedSections = updatedSections.filter((sec): sec is DynamicBriefSection => {
      if (!sec) return false;
      if (sec.section_type === "catalysts_outlook") {
        return Boolean(sec.content.catalysts && sec.content.catalysts.length > 0);
      }
      if (sec.section_type === "community_pulse") {
        const validQuotes = (sec.content.quotes || []).filter((q) => {
          const plat = (q.platform || "").toLowerCase();
          const speaker = (q.speaker_or_community || "").toLowerCase();
          const isSocial =
            plat === "reddit" ||
            plat === "bluesky" ||
            speaker.includes("reddit") ||
            speaker.includes("forum") ||
            speaker.includes("community");
          if (!isSocial) return false;

          // Reject quotes containing obsolete years (2020-2024)
          const text = `${q.quote} ${q.speaker_or_community}`;
          if (/\b(201[0-9]|202[0-4])\b/.test(text)) return false;

          // Reject quotes from sources older than 60 days
          if (q.url) {
            const matchingSource = sources.find((s) => s.url === q.url);
            if (matchingSource?.published_at) {
              const pubTime = new Date(matchingSource.published_at).getTime();
              if (!isNaN(pubTime) && Date.now() - pubTime > 60 * 24 * 60 * 60 * 1000) {
                return false;
              }
            }
          }
          return true;
        });
        return validQuotes.length > 0;
      }
      if (sec.section_type === "real_world_chronology") {
        return Boolean(sec.content.milestones && sec.content.milestones.length >= 2);
      }
      if (sec.section_type === "critical_tensions") {
        const valid = (sec.content.tensions || []).filter(
          (t) =>
            t.thesis &&
            t.antithesis &&
            t.thesis.trim().toLowerCase() !== "the claim" &&
            t.antithesis.trim().toLowerCase() !== "the pushback"
        );
        return valid.length > 0;
      }
      return true;
    });

    return {
      ...previousDesign,
      executive_take: freshExecutiveTake,
      sections: enrichSectionSourceUrls(sanitizedSections, cards, sources),
    };
  }

  /**
   * Deduplicates and merges cards by headline/event_id
   */
  private static mergeCards(
    existing: SynthesizedEventCard[],
    fresh: SynthesizedEventCard[]
  ): SynthesizedEventCard[] {
    const map = new Map<string, SynthesizedEventCard>();
    const normalize = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 40);

    // Fresh first
    fresh.forEach((c) => {
      const key = normalize(c.headline);
      if (!map.has(key)) map.set(key, c);
    });

    existing.forEach((c) => {
      const key = normalize(c.headline);
      if (!map.has(key)) map.set(key, c);
    });

    return Array.from(map.values());
  }

  /**
   * Deduplicates sources by URL or name
   */
  private static mergeSources(
    existing: EventSourceArticle[],
    fresh: EventSourceArticle[]
  ): EventSourceArticle[] {
    const map = new Map<string, EventSourceArticle>();

    [...fresh, ...existing].forEach((s) => {
      const key = s.url || s.name.toLowerCase().trim();
      if (!map.has(key)) map.set(key, s);
    });

    return Array.from(map.values());
  }
}
