import {
  SynthesizedEventCard,
  EventSourceArticle,
  LLMTopicBriefDesign,
  CardEvolutionDecision,
  LayoutArchitectPlan,
  EvolvedTopicCardResult,
  RawArticle,
  DynamicBriefSection,
  generateTopicId,
} from "../../types/contracts";
import { LiveSearchEngine } from "../../ingestion/live-search-engine";
import { FreeNewsFetcher } from "../../ingestion/rss-search";
import { StoryDiscoveryEngine } from "../../ingestion/story-discovery-engine";
import { deepseekProvider } from "../../llm/deepseek-provider";
import {
  TopicBriefSynthesizer,
  cleanArticleSnippet,
  synthesizeCleanExecutiveTake,
  synthesizeCleanDevelopments,
  isForwardLookingCatalyst,
  enrichSectionSourceUrls,
  isStrictSocialMediaSource,
  detectSocialPlatform,
  isAuthenticUserComment,
  isValidTimelineMilestone,
} from "../../matching/topic-brief-synthesizer";
import { traceLogger } from "../../observability/trace-logger";

export interface EvolveTopicCardOptions {
  topic: string;
  topic_id?: string;
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
      topic_id,
      previousCards = [],
      previousSources = [],
      previousDesign = null,
      technicalDepth = "practitioner",
      curiosityVectors = [],
    } = options;

    const resolvedTopicId =
      topic_id ||
      previousDesign?.topic_id ||
      previousCards.find((c) => c.topic_id)?.topic_id ||
      generateTopicId(topic);

    const runId = `run_card_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const flowStartTime = Date.now();

    // Flow Root Trace
    const rootTrace = traceLogger.logTrace({
      run_id: runId,
      node_name: "agent_card_evolution",
      call_type: "flow_root",
      input_summary: {
        topic,
        previous_cards_count: previousCards.length,
        previous_sources_count: previousSources.length,
        has_previous_design: Boolean(previousDesign),
      },
      reasoning_rationale: `Initiating multi-agent topic card evolution workflow for "${topic}"`,
      latency_ms: 0,
      status: "running",
      prompt_details: {
        user_prompt: `Evolve topic briefing card for "${topic}" (depth: ${technicalDepth})`,
      },
      context_details: {
        topic,
        technical_depth: technicalDepth,
        curiosity_vectors: curiosityVectors,
      },
    });

    // -------------------------------------------------------------
    // PHASE 1: Live Data Discovery on the Topic
    // -------------------------------------------------------------
    const p1Start = Date.now();
    const { refreshedCards, refreshedSources } = await this.searchRefreshedTopicData(
      topic,
      previousCards,
      previousSources
    );

    const mergedCards = this.mergeCards(previousCards, refreshedCards);
    const mergedSources = this.mergeSources(previousSources, refreshedSources);

    traceLogger.logTrace({
      run_id: runId,
      parent_trace_id: rootTrace.trace_id,
      node_name: "tool_search",
      call_type: "tool",
      input_summary: { topic, search_type: "live_wire_discovery" },
      output_summary: {
        refreshed_cards: refreshedCards.length,
        refreshed_sources: refreshedSources.length,
        merged_cards_total: mergedCards.length,
      },
      reasoning_rationale: `Retrieved ${refreshedCards.length} fresh stories and ${refreshedSources.length} wire sources for "${topic}"`,
      latency_ms: Date.now() - p1Start,
      status: "success",
      response_details: {
        sources: refreshedSources,
      },
    });

    // -------------------------------------------------------------
    // PHASE 2: Evolutionary Decision Agent (Update vs. Redesign)
    // -------------------------------------------------------------
    const p2Start = Date.now();
    const decisionResult = await this.decideEvolution(
      topic,
      mergedCards,
      mergedSources,
      previousDesign,
      runId
    );

    traceLogger.logTrace({
      run_id: runId,
      parent_trace_id: rootTrace.trace_id,
      node_name: "agent_card_evolution",
      call_type: "agent_step",
      input_summary: { decision: decisionResult.decision },
      output_summary: {
        decision: decisionResult.decision,
        significant_developments: decisionResult.significant_developments,
      },
      reasoning_rationale: decisionResult.rationale,
      latency_ms: Date.now() - p2Start,
      status: "success",
      response_details: {
        parsed_output: decisionResult,
      },
    });

    // -------------------------------------------------------------
    // PHASE 3 & 4: If Redesign, Layout Architect & Targeted Research
    // -------------------------------------------------------------
    let targetedQueriesExecuted: string[] = [];
    let layoutPlan: LayoutArchitectPlan | null = null;
    let finalSources = mergedSources;
    let finalCards = mergedCards;

    if (decisionResult.decision === "redesign" || !previousDesign) {
      // Phase 3: Layout Architect Agent
      const p3Start = Date.now();
      layoutPlan = await this.architectNewLayout(
        topic,
        mergedCards,
        mergedSources,
        previousDesign,
        technicalDepth,
        runId
      );

      traceLogger.logTrace({
        run_id: runId,
        parent_trace_id: rootTrace.trace_id,
        node_name: "agent_card_evolution",
        call_type: "agent_step",
        input_summary: { planned_archetype: layoutPlan.archetype },
        output_summary: {
          sections: layoutPlan.planned_section_types,
          gaps_count: layoutPlan.information_gaps?.length || 0,
        },
        reasoning_rationale: layoutPlan.design_rationale,
        latency_ms: Date.now() - p3Start,
        status: "success",
        response_details: {
          parsed_output: layoutPlan,
        },
      });

      // Phase 4: Targeted Information Retrieval Agent (if gaps identified)
      if (layoutPlan.information_gaps && layoutPlan.information_gaps.length > 0) {
        const p4Start = Date.now();
        const { gapCards, gapSources, executedQueries } = await this.executeTargetedResearch(
          topic,
          layoutPlan.information_gaps
        );
        targetedQueriesExecuted = executedQueries;
        finalCards = this.mergeCards(mergedCards, gapCards);
        finalSources = this.mergeSources(mergedSources, gapSources);

        traceLogger.logTrace({
          run_id: runId,
          parent_trace_id: rootTrace.trace_id,
          node_name: "tool_search",
          call_type: "tool",
          input_summary: { executed_queries: executedQueries },
          output_summary: {
            gap_cards: gapCards.length,
            gap_sources: gapSources.length,
            final_cards_total: finalCards.length,
          },
          reasoning_rationale: `Targeted research executed ${executedQueries.length} query gaps to enrich topic card`,
          latency_ms: Date.now() - p4Start,
          status: "success",
        });
      }
    }

    // -------------------------------------------------------------
    // PHASE 5: Card Synthesis Agent
    // -------------------------------------------------------------
    const p5Start = Date.now();
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

    traceLogger.logTrace({
      run_id: runId,
      parent_trace_id: rootTrace.trace_id,
      node_name: "agent_card_evolution",
      call_type: "agent_step",
      input_summary: {
        topic,
        final_cards_count: finalCards.length,
        final_sources_count: finalSources.length,
      },
      output_summary: {
        archetype: finalDesign.presentation_archetype,
        sections_count: finalDesign.sections.length,
        executive_take: finalDesign.executive_take,
      },
      reasoning_rationale: `Card evolution completed for "${topic}". Presentation archetype: ${finalDesign.presentation_archetype}. ${finalDesign.sections.length} dynamic sections generated.`,
      latency_ms: Date.now() - p5Start,
      status: "success",
      response_details: {
        parsed_output: finalDesign,
      },
    });

    if (finalDesign) {
      finalDesign.topic_id = resolvedTopicId;
      for (const s of finalDesign.sections) {
        s.topic_id = resolvedTopicId;
      }
    }

    const cardsWithTopicId = finalCards.map((c) => ({
      ...c,
      topic_id: c.topic_id || resolvedTopicId,
    }));

    return {
      topic,
      topic_id: resolvedTopicId,
      decision: decisionResult.decision,
      decision_rationale: decisionResult.rationale,
      design: finalDesign,
      new_cards: cardsWithTopicId,
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
    previousDesign?: LLMTopicBriefDesign | null,
    runId?: string
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
          traceOptions: {
            runId,
            agentName: "agent_card_evolution",
            reasoningDetails: {
              primary_rationale: `Evolution Decision for "${topic}" (Update vs Redesign)`,
            },
            contextDetails: {
              topic,
              has_previous_design: true,
              cards_count: cards.length,
            },
          },
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
    technicalDepth: string = "practitioner",
    runId?: string
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
- "real_world_chronology": ONLY plan this section if the available research documents a genuine multi-stage progression spanning distinct calendar dates or historical phases across weeks or months (e.g. Month Year, distinct past dates).
- NEVER plan a timeline for breaking news items or stories that occurred within the same news cycle (e.g. hours ago, today, yesterday).
- If planning "real_world_chronology", you MUST formulate an information gap with query seeking milestone progression (e.g. "[Entity] milestones timeline history roadmap").
- If no milestone articles or historical progression exist, DO NOT plan a timeline.

CRITICAL SOCIAL MEDIA RULES (MANDATORY):
- "community_pulse": ONLY plan this section if seeking authentic social media discussions from Reddit, Bluesky, X/Twitter, Threads, or HN.
- When formulating queries for community quotes, formulate targeted queries like "[Entity] discussion site:reddit.com OR site:bsky.app OR site:x.com".
- Corporate websites and PR landing pages are strictly forbidden.

INFORMATION GAPS & RESEARCH PLAN:
Formulate 1 to 3 targeted search queries to retrieve recent data needed for your layout.
For example:
- If planning community pulse: formulate a query for recent user or practitioner discussions on social platforms.
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
          traceOptions: {
            runId,
            agentName: "agent_card_evolution",
            reasoningDetails: {
              primary_rationale: `Layout Architecture Planning for "${topic}"`,
            },
            contextDetails: {
              topic,
              technical_depth: technicalDepth,
              cards_count: cards.length,
            },
          },
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

    const hasMilestoneSources = sources.some((s) => {
      const t = (s.title || "").toLowerCase();
      return t.includes("timeline") || t.includes("milestones") || t.includes("history") || t.includes("roadmap");
    });

    if (hasMilestoneSources) {
      plannedSections.push("real_world_chronology");
    }

    const gaps: LayoutArchitectPlan["information_gaps"] = [];
    if (!sources.some(isStrictSocialMediaSource)) {
      gaps.push({
        gap_type: "community_quotes",
        query: `${topic} discussion site:reddit.com OR site:bsky.app OR site:x.com`,
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
            // Concrete reporting story
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
        }
      } catch (err) {
        console.warn(`[TopicCardEvolutionOrchestrator] Targeted research failed for query "${gap.query}":`, err);
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
    decision: CardEvolutionDecision["decision"],
    previousDesign?: LLMTopicBriefDesign | null,
    layoutPlan?: LayoutArchitectPlan | null,
    technicalDepth: string = "practitioner",
    curiosityVectors: string[] = []
  ): Promise<LLMTopicBriefDesign> {
    // 1. If redesign or initial card, synthesize fresh design
    if (decision === "redesign" || !previousDesign) {
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

    // 2. If update in place, update executive summary and key developments while preserving overall structure
    const freshExecutiveTake = synthesizeCleanExecutiveTake(topic, cards);
    const synthesizedKeyDevelopments = synthesizeCleanDevelopments(cards);

    const updatedSections = (previousDesign.sections || []).map((sec) => {
      if (sec.section_type === "key_developments" && cards.length > 0) {
        return {
          ...sec,
          content: {
            bullets: synthesizedKeyDevelopments,
          },
        };
      }

      if (sec.section_type === "real_world_chronology") {
        if (!sec.content.milestones || sec.content.milestones.length < 2) {
          return null;
        }
        const validMilestones = sec.content.milestones.filter(isValidTimelineMilestone);
        const distinct = new Set(validMilestones.map((m) => m.time_label));
        if (validMilestones.length < 2 || distinct.size < 2) {
          return null; // Omit timeline if milestones lack distinct calendar progression
        }
        return {
          ...sec,
          content: {
            ...sec.content,
            milestones: validMilestones,
          },
        };
      }

      if (sec.section_type === "community_pulse") {
        if (!sec.content.quotes || sec.content.quotes.length === 0) {
          return null;
        }
        const validQuotes = sec.content.quotes.filter((q) => {
          const matchingSource = q.url ? sources.find((s) => s.url === q.url) : undefined;
          const isSocial = isStrictSocialMediaSource(matchingSource || { url: q.url, name: q.speaker_or_community });
          if (!isSocial) return false;
          if (!isAuthenticUserComment(q.quote)) return false;

          // Reject quotes referencing obsolete years (2020-2024)
          const text = `${q.quote} ${q.speaker_or_community}`;
          if (/\b(201[0-9]|202[0-4])\b/.test(text)) return false;

          // Reject quotes from sources older than 60 days
          if (matchingSource?.published_at) {
            const pubTime = new Date(matchingSource.published_at).getTime();
            if (!isNaN(pubTime) && Date.now() - pubTime > 60 * 24 * 60 * 60 * 1000) {
              return false;
            }
          }
          return true;
        });

        if (validQuotes.length === 0) return null;
        return {
          ...sec,
          content: {
            ...sec.content,
            quotes: validQuotes.map((q) => ({
              ...q,
              platform: detectSocialPlatform(q.url || q.platform || q.speaker_or_community || ""),
            })),
          },
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
        return Boolean(sec.content.quotes && sec.content.quotes.length > 0);
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
