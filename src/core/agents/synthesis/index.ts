import {
  NewsStateContext,
  PresentationPayload,
  PresentationPayloadSchema,
  PureFactObject,
  SynthesizedEventCard,
  UserKnowledgeGraph,
  RawArticle,
  EventSourceArticle,
} from "../../types/contracts";
import { traceLogger } from "../../observability/trace-logger";
import { FreeNewsFetcher } from "../../ingestion/rss-search";
import { ArticleImageResolver } from "../../ingestion/article-image-resolver";
import { deepseekProvider } from "../../llm/deepseek-provider";

export class SynthesisEngine {
  /**
   * Generates a multi-topic personalized news feed tailored to the user's psychological and intellectual profile
   */
  public static async synthesizeMultiTopicFeed(
    facts: PureFactObject[],
    userGraph?: UserKnowledgeGraph,
    cognitiveLoad: "low" | "balanced" | "deep_dive" = "balanced",
    rawArticles: RawArticle[] = []
  ): Promise<SynthesizedEventCard[]> {
    const userThemes = userGraph
      ? `User revealed topics: ${Object.keys(userGraph.topic_weights).join(", ")}.
Key values & mindset: Seeks autonomy, reduction of friction, sanctuary/isolation, engineering elegance, and high-agency technology.`
      : "General factual intelligence seeker.";

    const usedFeedImages = new Set<string>();

    // Synthesize all atomic cards in parallel
    const rawCards = await Promise.all(
      facts.map(async (fact): Promise<SynthesizedEventCard | null> => {
        let cleanTopic = FreeNewsFetcher.cleanHtml(fact.topic)
          .replace(/\bsite:[^\s]+/gi, "")
          .replace(/\bwhen:[^\s]+/gi, "")
          .replace(/\binurl:[^\s]+/gi, "")
          .replace(/\bsource:[^\s]+/gi, "")
          .replace(/\bfiletype:[^\s]+/gi, "")
          .replace(/\s+/g, " ")
          .trim();
        if (!cleanTopic) cleanTopic = fact.topic;
        const cleanFacts = (fact.agreed_facts || [])
          .map((f) => FreeNewsFetcher.cleanHtml(f))
          .filter((f) => f.length > 15);

        // Use the exact source articles clustered for this event, with zero arbitrary cross-topic fallback
        const effectiveArticles =
          fact.source_articles && fact.source_articles.length > 0
            ? fact.source_articles
            : rawArticles.filter(
                (a) =>
                  a.title.toLowerCase().includes(cleanTopic.toLowerCase()) ||
                  a.raw_text.toLowerCase().includes(cleanTopic.toLowerCase())
              );

        if (effectiveArticles.length === 0) {
          return null;
        }

        let headline = effectiveArticles[0]?.title || `Breaking: Latest Developments in ${cleanTopic}`;
        let personalizedFraming = `Curated report for ${cleanTopic}.`;
        let summary = effectiveArticles[0]?.raw_text.slice(0, 200) || cleanFacts.slice(0, 2).join(" ");
        let expansionText = cleanFacts.slice(2).join(" ") || cleanFacts.join(" ");

        // If DeepSeek is configured, generate dynamic journalistic news story
        if (deepseekProvider.isConfigured()) {
          try {
            const userProfilePrompt = userGraph && Object.keys(userGraph.topic_weights).length > 0
              ? `READER INTELLECTUAL PROFILE & VALUES:
- Key Topic Interests: ${Object.keys(userGraph.topic_weights).join(", ")}
- Known Historical Anchors: ${userGraph.historical_anchors?.join(", ") || "General Inquiry"}
- Intersectional Themes: ${userGraph.interest_intersections?.map((i) => `${i.interest_a} & ${i.interest_b} (${i.intersection_theme})`).join("; ") || "None"}
- Adjacent Curiosities: ${userGraph.adjacent_curiosity_frontiers?.map((f) => f.topic).join(", ") || "None"}`
              : "General intellectual reader focused on empirical evidence, factual accuracy, and structural implications.";

            const systemPrompt = `You are a premier investigative journalist crafting a concise, compelling news story tailored for a discerning reader.

CRITICAL EDITORIAL PRINCIPLES:
1. 100% SUBSTANTIATED FACTS (ZERO FABRICATION):
   - Every single claim, entity, statistic, and quote in your headline, summary, and expansion_text MUST be directly substantiated by the provided source wire excerpts and agreed facts.
   - NEVER fabricate events, numbers, or technological capabilities.
   - NEVER inject unmentioned concepts or topics (e.g. do not insert AI into an energy, agriculture, or military conflict report unless the source text explicitly discusses AI).

2. TEMPORAL & MODAL CERTAINTY PRESERVATION:
   - Your headline, summary, and expansion text MUST faithfully preserve the temporal tense and epistemic certainty of the verified facts.
   - If an event is scheduled for the future or represents an upcoming milestone, write about it strictly in future or conditional framing (e.g. "Targeted For", "Slated to", "Scheduled For"). NEVER report unflown or uncompleted milestones as accomplished past facts.
   - If reporting is based on a single source or contains disputed/unconfirmed claims, explicitly attribute the claim to the reporting publisher (e.g. "According to [Source]...", "[Source] reports that..."), never presenting an uncorroborated single-source claim as broad consensus fact.

3. USER-TARGETED PRESENTATION (EDITORIAL LENS):
   - Present the SUBSTANTIATED facts through a lens that emphasizes the dimensions most relevant to the reader (e.g. technical architecture, operational friction, supply chain resilience, autonomy, or regulatory trade-offs).
   - INVISIBLE STEERING: Write naturally and authoritatively. NEVER mention the reader or say "As someone interested in X..." or "For readers of Y...". Let the curated selection and flow of real facts speak for itself.

4. JOURNALISTIC STRUCTURE:
   - "headline": Specific, gripping news headline capturing the latest real-world development while preserving temporal truth.
   - "summary": A punchy 2-sentence opening hook stating the core development and its immediate consequence.
   - "expansion_text": 2-3 engaging paragraphs detailing the substantiated evidence, real-world stakes, and stakeholder tensions.
   - "personalized_framing": A 1-sentence internal editorial note explaining why this event is significant from the reader's perspective.

Output strict JSON:
{
  "personalized_framing": "A 1-2 sentence internal editorial rationale explaining why this event is significant from the reader's perspective",
  "headline": string,
  "summary": string,
  "expansion_text": string
}`;

            const articlesContext = effectiveArticles
              .map((a, i) => `[Source ${i + 1}: ${a.source_name}]\nHeadline: ${a.title}\nReporting Excerpt: ${a.raw_text.slice(0, 500)}`)
              .join("\n\n");

            const prompt = `NEWS TOPIC: ${cleanTopic}

${userProfilePrompt}

SUBSTANTIATED SOURCE WIRE REPORTING:
${articlesContext}

VERIFIED AGREED FACTS:
${cleanFacts.map((f, i) => `${i + 1}. ${f}`).join("\n")}

Task: Write a captivating, authentic news story using ONLY the substantiated facts above, framed to highlight the structural and technical dimensions most relevant to the reader.`;

            const res = await deepseekProvider.generateCompletion(prompt, {
              systemPrompt,
              temperature: 0.4,
              maxTokens: 800,
            });

            const parsed = JSON.parse(res.text);
            if (parsed.headline) headline = FreeNewsFetcher.cleanHtml(parsed.headline);
            if (parsed.summary) summary = FreeNewsFetcher.cleanHtml(parsed.summary);
            if (parsed.expansion_text) expansionText = FreeNewsFetcher.cleanHtml(parsed.expansion_text);
            if (parsed.personalized_framing) personalizedFraming = FreeNewsFetcher.cleanHtml(parsed.personalized_framing);
          } catch (e) {
            // Keep deterministic framing
          }
        }

        // Classify discovery origin: Direct Revealed Preference vs Thematic Intersection vs Curiosity Frontier
        let discoveryCategory: "revealed_preference" | "thematic_intersection" | "curiosity_frontier" = "revealed_preference";

        const isFrontier =
          (userGraph?.adjacent_curiosity_frontiers || []).some(
            (f) =>
              f.topic.toLowerCase().includes(cleanTopic.toLowerCase()) ||
              cleanTopic.toLowerCase().includes(f.topic.toLowerCase())
          ) ||
          cleanTopic.toLowerCase().includes("battery") ||
          cleanTopic.toLowerCase().includes("satellite") ||
          cleanTopic.toLowerCase().includes("frontier") ||
          cleanTopic.toLowerCase().includes("mesh");

        const isIntersection =
          (userGraph?.interest_intersections || []).some(
            (i) =>
              i.intersection_theme.toLowerCase().includes(cleanTopic.toLowerCase()) ||
              cleanTopic.toLowerCase().includes(i.intersection_theme.toLowerCase())
          );

        if (isFrontier) {
          discoveryCategory = "curiosity_frontier";
        } else if (isIntersection) {
          discoveryCategory = "thematic_intersection";
        } else {
          discoveryCategory = "revealed_preference";
        }

        // Check if this topic matches an exploration anchor
        const isExploration = discoveryCategory === "curiosity_frontier" || (userGraph?.topic_weights[cleanTopic] || 0) < 0.75;
        const anchorConcept = userGraph?.historical_anchors?.[0] || cleanTopic;

        const dataPoints = [
          { label: "Agreed Facts", value: Math.max(cleanFacts.length, 1), category: "Consensus" },
          { label: "Disputed Claims", value: fact.disputed_claims.length, category: "Partisan Divergence" },
          { label: "Verified Entities", value: Math.max(fact.verified_entities.length, 1), category: "Grounding" },
          { label: "Bias Removal %", value: Math.round((1 - fact.adjective_density_score) * 100), category: "Purity" },
        ];

        // Build rich EventSourceArticle objects with raw text and passage highlights
        const sources: EventSourceArticle[] = effectiveArticles.map((art) => {
          const cleanText = FreeNewsFetcher.cleanHtml(art.raw_text);
          const sents = cleanText.split(/(?<=[.!?])\s+/).filter((s) => s.length > 20);

          // Extract key passage that provided factual evidence
          const highlighted = sents.filter((s) =>
            cleanFacts.some(
              (f) =>
                f.toLowerCase().includes(s.slice(0, 25).toLowerCase()) ||
                s.toLowerCase().includes(f.slice(0, 25).toLowerCase())
            )
          );

          return {
            name: FreeNewsFetcher.cleanHtml(art.source_name),
            url: art.source_url,
            bias: art.author_bias_rating,
            title: FreeNewsFetcher.cleanHtml(art.title),
            raw_text: cleanText,
            published_at: art.published_at,
            highlighted_passages: highlighted.length > 0 ? highlighted : [sents[0] || cleanText.slice(0, 150)],
          };
        });

        // Calculate recency string & latest publish timestamp
        const newestPublished = effectiveArticles.reduce((latest, art) => {
          let t = new Date(art.published_at || "").getTime();
          if (isNaN(t) || t === 0) {
            // Try extracting date from article raw text or title (e.g. "April 2026", "2026-04-15", etc.)
            const textMatch = (art.raw_text + " " + art.title).match(
              /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+(202\d)\b/i
            );
            if (textMatch) {
              const parsed = new Date(textMatch[0]).getTime();
              if (!isNaN(parsed)) t = parsed;
            }
          }
          return t > latest ? t : latest;
        }, 0);

        const hasExplicitDate = newestPublished > 0;
        const pubIso = hasExplicitDate ? new Date(newestPublished).toISOString() : new Date().toISOString();
        let recencyLabel = "Recent";

        if (hasExplicitDate) {
          const diffHours = Math.max(0, (Date.now() - newestPublished) / (1000 * 60 * 60));
          if (diffHours < 1) {
            recencyLabel = "⚡ Breaking";
          } else if (diffHours < 24) {
            recencyLabel = `${Math.max(1, Math.round(diffHours))}h ago`;
          } else if (diffHours < 48) {
            recencyLabel = "Yesterday";
          } else if (diffHours < 24 * 7) {
            recencyLabel = `${Math.round(diffHours / 24)}d ago`;
          } else if (diffHours < 24 * 30) {
            recencyLabel = `${Math.round(diffHours / 24)}d ago`;
          } else if (diffHours < 24 * 365) {
            recencyLabel = `${Math.max(1, Math.round(diffHours / (24 * 30)))}mo ago`;
          } else {
            recencyLabel = `${Math.max(1, Math.round(diffHours / (24 * 365)))}y ago`;
          }
        } else {
          recencyLabel = "Recent";
        }

        // If headline was generic placeholder, use the primary breaking article headline
        if (headline.startsWith("Verified Brief:") && effectiveArticles.length > 0 && effectiveArticles[0].title) {
          headline = effectiveArticles[0].title;
        }

        // 1. First priority: Genuine publisher image already attached to ingested article
        let cardImageUrl: string | undefined = effectiveArticles.find(
          (a) => a.image_url && ArticleImageResolver.isValidEditorialImage(a.image_url)
        )?.image_url;

        // 2. Second priority: Scrape authentic OpenGraph / Twitter editorial photo from corroborating source web pages
        if (!cardImageUrl) {
          for (const art of effectiveArticles.slice(0, 2)) {
            if (art.source_url && art.source_url.startsWith("http")) {
              const ogImg = await ArticleImageResolver.fetchOpenGraphImage(art.source_url);
              if (ogImg) {
                cardImageUrl = ogImg;
                break;
              }
            }
          }
        }

        // 3. Third priority: Specific named entity photography (bypassing generic flags/logos)
        if (!cardImageUrl) {
          const entityImg = await ArticleImageResolver.fetchSpecificEntityImage(
            fact.verified_entities,
            headline
          );
          if (entityImg) {
            cardImageUrl = entityImg;
          }
        }

        // 4. Fourth priority: Story-tailored unique visual archetype (guaranteed zero duplicates)
        if (!cardImageUrl || usedFeedImages.has(cardImageUrl)) {
          cardImageUrl = ArticleImageResolver.resolveUniqueFallbackImage(cleanTopic, headline, usedFeedImages);
        } else {
          usedFeedImages.add(cardImageUrl);
        }

        return {
          event_id: fact.event_id,
          topic: cleanTopic,
          headline,
          personalized_framing: personalizedFraming,
          summary,
          expansion_text: expansionText,
          fact_bullets: cleanFacts.map((f) => `• ${f}`),
          disputed_claims: fact.disputed_claims,
          verified_entities: fact.verified_entities,
          sources: sources.length > 0 ? sources : [{ name: "Verified Multi-Source Wire", url: `https://news.google.com/search?q=${encodeURIComponent(cleanTopic)}`, bias: "center", raw_text: summary }],
          format: cognitiveLoad === "low" ? "bulleted_distillation" : cognitiveLoad === "deep_dive" ? "structured_narrative" : "generative_widget",
          discovery_category: discoveryCategory,
          published_at: pubIso,
          recency_label: recencyLabel,
          is_exploration: isExploration,
          anchor_concept: isExploration ? anchorConcept : undefined,
          image_url: cardImageUrl,
          widget_data: {
            chart_type: "delta_bar",
            data_points: dataPoints,
          },
        };
      })
    );

    const validCards = rawCards.filter((c): c is SynthesizedEventCard => c !== null);

    // Deduplicate cards by normalized headline and event story overlap
    const seenHeadlines = new Set<string>();
    const uniqueCards: SynthesizedEventCard[] = [];

    for (const card of validCards) {
      // Normalize headline (alphanumeric only, lowercase)
      const norm = card.headline.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 45);
      if (!seenHeadlines.has(norm) && norm.length > 10) {
        seenHeadlines.add(norm);
        uniqueCards.push(card);
      }
    }

    // Composite Scoring System (Recency + Prolific Coverage + Epistemic User Affinity)
    const now = Date.now();
    const scoredCards = uniqueCards.map((card) => {
      // 1. Recency Score (Exponential decay based on hours elapsed)
      const pubTime = new Date(card.published_at || now).getTime() || now;
      const hoursAgo = Math.max(0, (now - pubTime) / (1000 * 60 * 60));
      const recencyScore = Math.max(0.1, Math.exp(-hoursAgo / 36));

      // 2. Prolific Coverage Score (How widely reported across distinct sources)
      const numSources = (card.sources || []).length;
      const prolificScore = Math.min(1.0, 0.40 + 0.15 * Math.min(4, numSources));

      // 3. User Beliefs & Interest Affinity Score
      let affinityScore = 0.5;
      if (userGraph && userGraph.topic_weights) {
        const directWeight = userGraph.topic_weights[card.topic];
        if (typeof directWeight === "number") {
          affinityScore = directWeight;
        } else {
          // Check partial match in topic keys
          const matchedKey = Object.keys(userGraph.topic_weights).find(
            (k) => card.topic.toLowerCase().includes(k.toLowerCase()) || k.toLowerCase().includes(card.topic.toLowerCase())
          );
          affinityScore = matchedKey ? userGraph.topic_weights[matchedKey] : 0.4;
        }
      }

      // Bonus for intersection or curiosity frontiers
      if (card.discovery_category === "thematic_intersection") {
        affinityScore = Math.min(1.0, affinityScore + 0.15);
      } else if (card.discovery_category === "curiosity_frontier") {
        affinityScore = Math.min(1.0, affinityScore + 0.10);
      }

      // Bonus for matching historical anchors
      if (
        userGraph?.historical_anchors?.some((a) =>
          card.headline.toLowerCase().includes(a.toLowerCase()) ||
          card.topic.toLowerCase().includes(a.toLowerCase())
        )
      ) {
        affinityScore = Math.min(1.0, affinityScore + 0.10);
      }

      // Composite Rank: 35% Recency, 35% User Affinity, 30% Prolific Multi-Source Weight
      const compositeScore = Number(
        (0.35 * recencyScore + 0.35 * affinityScore + 0.30 * prolificScore).toFixed(4)
      );

      return {
        card,
        compositeScore,
        recencyScore,
        prolificScore,
        affinityScore,
      };
    });

    // Topic Interleaving & Diversity Mixer:
    // Prevents topic clumping while maintaining composite rank order
    const remaining = [...scoredCards];
    const blendedFeed: SynthesizedEventCard[] = [];
    const topicRecentCounters: Record<string, number> = {};

    while (remaining.length > 0) {
      let bestIndex = 0;
      let highestEffectiveScore = -Infinity;

      for (let i = 0; i < remaining.length; i++) {
        const item = remaining[i];
        const recentCount = topicRecentCounters[item.card.topic] || 0;
        // Apply exponential anti-clumping penalty if this topic was placed recently
        const diversityMultiplier = Math.pow(0.60, recentCount);
        const effectiveScore = item.compositeScore * diversityMultiplier;

        if (effectiveScore > highestEffectiveScore) {
          highestEffectiveScore = effectiveScore;
          bestIndex = i;
        }
      }

      const [selected] = remaining.splice(bestIndex, 1);
      blendedFeed.push(selected.card);

      // Decay previous topic weights and elevate selected topic counter
      for (const t in topicRecentCounters) {
        topicRecentCounters[t] = Math.max(0, topicRecentCounters[t] - 1);
      }
      topicRecentCounters[selected.card.topic] = (topicRecentCounters[selected.card.topic] || 0) + 2;
    }

    return blendedFeed;
  }
}

/**
 * Node D: Synthesis Agent (Multi-Topic Presentation)
 */
export async function runSynthesisNode(state: NewsStateContext): Promise<Partial<NewsStateContext>> {
  const startTime = Date.now();

  const facts = state.current_facts || [];
  if (facts.length === 0) {
    throw new Error("Synthesis Agent Error: No PureFactObject provided in state for synthesis.");
  }

  const cognitiveLoad = state.user_graph?.cognitive_load_state || "balanced";

  // Generate multi-topic personalized feed cards with full raw article references
  const feedCards = await SynthesisEngine.synthesizeMultiTopicFeed(
    facts,
    state.user_graph,
    cognitiveLoad,
    state.raw_articles || []
  );
  const primaryCard = feedCards[0];

  const presentation: PresentationPayload = {
    format: primaryCard.format,
    headline: primaryCard.headline,
    summary: primaryCard.summary,
    fact_bullets: primaryCard.fact_bullets,
    widget_data: primaryCard.widget_data,
    cognitive_load_target: cognitiveLoad,
    anchor_explanation: primaryCard.anchor_concept
      ? `Pedagogical Bridge: Connected to your core anchor "${primaryCard.anchor_concept}".`
      : undefined,
    rendered_at: new Date().toISOString(),
  };

  const latency = Date.now() - startTime;

  const trace = traceLogger.logTrace({
    session_id: state.session_id,
    node_name: "node_d_synthesis",
    input_summary: {
      total_fact_objects: facts.length,
      topics: facts.map((f) => f.topic),
      cognitive_load: cognitiveLoad,
    },
    output_summary: {
      feed_cards_count: feedCards.length,
      topics_synthesized: feedCards.map((c) => c.topic),
      headlines: feedCards.map((c) => c.headline),
    },
    reasoning_rationale: `Synthesized ${feedCards.length} multi-topic event cards tailored to the user's personal values and cognitive load "${cognitiveLoad}". Attached source texts and passage highlights.`,
    latency_ms: latency,
    llm_tokens_used: 350,
  });

  return {
    presentation_payload: PresentationPayloadSchema.parse(presentation),
    feed_cards: feedCards,
    traces: [...(state.traces || []), trace],
  };
}
