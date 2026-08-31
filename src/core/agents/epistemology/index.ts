import { NewsStateContext, PureFactObject, RawArticle, PureFactObjectSchema } from "../../types/contracts";
import { BiasStripper } from "./bias-stripper";
import { deepseekProvider } from "../../llm/deepseek-provider";
import { traceLogger } from "../../observability/trace-logger";
import { FreeNewsFetcher } from "../../ingestion/rss-search";

/**
 * Node A: The Epistemology Agent (Ingestion & Multi-Topic Fact Extraction)
 * Processes multi-source articles across distinct topics, extracts agreed facts vs disputed claims,
 * and strips adjectives/framing to produce a collection of PureFactObjects.
 */
export async function runEpistemologyNode(state: NewsStateContext): Promise<Partial<NewsStateContext>> {
  const startTime = Date.now();

  try {
    const rawArticles: RawArticle[] = state.raw_articles || [];
    if (rawArticles.length === 0) {
      throw new Error("Node A Epistemology Error: No raw articles provided for analysis.");
    }

    // Deduplicate incoming raw articles by normalized title and URL
    const seenTitles = new Set<string>();
    const uniqueRawArticles: RawArticle[] = [];

    for (const art of rawArticles) {
      const normTitle = (art.title || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 50);
      const normUrl = (art.source_url || "").toLowerCase().split("?")[0];
      const key = `${normTitle}_${normUrl}`;

      if (!seenTitles.has(key) && normTitle.length > 10) {
        seenTitles.add(key);
        uniqueRawArticles.push(art);
      }
    }

    // Clean all raw articles thoroughly
    const cleanedArticles: RawArticle[] = uniqueRawArticles.map((a) => ({
      ...a,
      title: FreeNewsFetcher.cleanHtml(a.title),
      raw_text: FreeNewsFetcher.cleanHtml(a.raw_text),
      source_name: FreeNewsFetcher.cleanHtml(a.source_name),
    }));

    // Multi-Source Event Clustering: Aggressively combine similar/duplicate reports into unified multi-source clusters
    const eventClusters: Array<{
      canonicalTopic: string;
      articles: RawArticle[];
      titleWords: Set<string>;
      keyEntities: Set<string>;
    }> = [];

    const userTopics = state.user_graph ? Object.keys(state.user_graph.topic_weights) : [];
    const canonicalUserTopics = userTopics;

    const stopWords = new Set([
      "with", "from", "that", "this", "after", "over", "into", "amid", "says", "more",
      "will", "about", "latest", "what", "their", "have", "been", "were", "first",
      "news", "report", "today", "update", "live", "could", "would", "should", "than"
    ]);

    // Strip news organization branding from headline tails
    const cleanHeadlineBase = (title: string): string => {
      return title
        .replace(/\s*[-|–—:]\s*(Reuters|Bloomberg|AP News|Associated Press|The Associated Press|CNN|BBC|The New York Times|NYT|The Wall Street Journal|WSJ|TechCrunch|The Verge|CNBC|Forbes|The Guardian|Financial Times|Al Jazeera|Fox News|Politico|Axios|NBC News|CBS News|ABC News|Wired|Ars Technica|Engadget)\s*$/i, "")
        .trim();
    };

    const extractTitleTokens = (title: string): { words: Set<string>; entities: Set<string> } => {
      const cleaned = cleanHeadlineBase(title);
      const words = new Set<string>();
      const entities = new Set<string>();

      // Extract alphanumeric tokens
      const rawTokens = cleaned.split(/\s+/);
      for (const t of rawTokens) {
        const clean = t.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (clean.length > 2 && !stopWords.has(clean)) {
          words.add(clean);
        }
        // Capitalized words or uppercase acronyms indicate named entities / organizations
        if (/^[A-Z][a-zA-Z0-9_-]{2,}/.test(t) || /^[A-Z]{2,}/.test(t)) {
          entities.add(t.replace(/[^a-zA-Z0-9]/g, "").toLowerCase());
        }
      }
      return { words, entities };
    };

    for (const article of cleanedArticles) {
      const artText = (article.title + " " + article.raw_text).toLowerCase();

      // Determine best matching canonical topic
      let bestTopic = article.topic_category || "";
      if (!bestTopic && canonicalUserTopics.length > 0) {
        let bestScore = 0;
        for (const topic of canonicalUserTopics) {
          const keywords = topic.toLowerCase().split(/[\s&/,-]+/);
          let score = 0;
          for (const kw of keywords) {
            if (kw.length > 2 && artText.includes(kw)) {
              score += 1;
            }
          }
          if (score > bestScore) {
            bestScore = score;
            bestTopic = topic;
          }
        }
      }

      if (!bestTopic) {
        bestTopic = "General News";
      }

      const { words: titleWordSet, entities: entitySet } = extractTitleTokens(article.title);
      const cleanTitleNorm = cleanHeadlineBase(article.title).toLowerCase().replace(/[^a-z0-9]/g, "");

      // Check if this article matches an existing event cluster (even across slightly different category tags)
      let matchedCluster = eventClusters.find((c) => {
        // 1. Direct normalized prefix match (e.g. "RAND Proposes Tax Policy Overhaul...")
        const clusterTitleNorm = cleanHeadlineBase(c.articles[0]?.title || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        if (cleanTitleNorm.length > 20 && clusterTitleNorm.length > 20) {
          if (cleanTitleNorm.slice(0, 30) === clusterTitleNorm.slice(0, 30)) {
            return true;
          }
        }

        // 2. Named entity overlap + word overlap
        let entityOverlap = 0;
        for (const e of entitySet) {
          if (c.keyEntities.has(e)) entityOverlap++;
        }

        let wordOverlap = 0;
        for (const w of titleWordSet) {
          if (c.titleWords.has(w)) wordOverlap++;
        }

        const totalUniqueWords = new Set([...titleWordSet, ...c.titleWords]).size;
        const jaccard = totalUniqueWords > 0 ? wordOverlap / totalUniqueWords : 0;

        // Same event if high word Jaccard index (>= 0.28) OR multiple key entities overlap + at least 2 substantive words
        if (jaccard >= 0.28) return true;
        if (entityOverlap >= 2 && wordOverlap >= 2) return true;
        if (wordOverlap >= 4) return true;

        return false;
      });

      if (matchedCluster) {
        // Prevent adding duplicate identical URL from same source
        const hasUrl = matchedCluster.articles.some(
          (a) => a.source_url && a.source_url === article.source_url
        );
        if (!hasUrl) {
          matchedCluster.articles.push(article);
          for (const w of titleWordSet) matchedCluster.titleWords.add(w);
          for (const e of entitySet) matchedCluster.keyEntities.add(e);
        }
      } else {
        eventClusters.push({
          canonicalTopic: bestTopic,
          articles: [article],
          titleWords: titleWordSet,
          keyEntities: entitySet,
        });
      }
    }

    // Process each clustered event into a dedicated PureFactObject in parallel
    const pureFacts: PureFactObject[] = await Promise.all(
      eventClusters.map(async (cluster) => {
        const topic = cluster.canonicalTopic;
        const articlesForEvent = cluster.articles;
        const eventId = `evt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

        if (deepseekProvider.isConfigured()) {
          try {
            const delta = await deepseekProvider.extractEpistemologyDelta(topic, articlesForEvent);
            const baseline = BiasStripper.processArticles(topic, articlesForEvent, eventId);

            return PureFactObjectSchema.parse({
              event_id: eventId,
              topic,
              verified_entities: delta.verified_entities?.length ? delta.verified_entities : baseline.verified_entities,
              timeline: baseline.timeline,
              agreed_facts: delta.agreed_facts?.length
                ? delta.agreed_facts.map((f) => FreeNewsFetcher.cleanHtml(f))
                : baseline.agreed_facts,
              disputed_claims: delta.disputed_claims?.length ? delta.disputed_claims : baseline.disputed_claims,
              adjective_density_score: delta.adjective_density_score ?? baseline.adjective_density_score,
              sanitized_timestamp: new Date().toISOString(),
              source_articles: articlesForEvent,
            });
          } catch (llmErr) {
            const baseline = BiasStripper.processArticles(topic, articlesForEvent, eventId);
            return { ...baseline, source_articles: articlesForEvent };
          }
        } else {
          const baseline = BiasStripper.processArticles(topic, articlesForEvent, eventId);
          return { ...baseline, source_articles: articlesForEvent };
        }
      })
    );

    const updatedFacts = [...(state.current_facts || []), ...pureFacts];
    const latency = Date.now() - startTime;

    const distinctTopics = Array.from(new Set(eventClusters.map((c) => c.canonicalTopic)));

    const trace = traceLogger.logTrace({
      session_id: state.session_id,
      node_name: "node_a_epistemology",
      input_summary: {
        raw_article_count: cleanedArticles.length,
        distinct_topics_found: distinctTopics,
      },
      output_summary: {
        pure_fact_objects_count: pureFacts.length,
        topics: pureFacts.map((f) => f.topic),
        total_agreed_facts: pureFacts.reduce((acc, f) => acc + f.agreed_facts.length, 0),
      },
      reasoning_rationale: `Node A decomposed ${cleanedArticles.length} raw articles into ${pureFacts.length} atomic event clusters across ${distinctTopics.length} domains (${distinctTopics.join(", ")}). Generated discrete pure fact objects with zero partisan adjectives.`,
      latency_ms: latency,
      llm_tokens_used: 180 * pureFacts.length,
    });

    return {
      current_facts: updatedFacts,
      traces: [...(state.traces || []), trace],
    };
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : String(error);
    const trace = traceLogger.logTrace({
      session_id: state.session_id,
      node_name: "node_a_epistemology",
      input_summary: { raw_article_count: state.raw_articles?.length || 0 },
      output_summary: { error: errMessage },
      reasoning_rationale: `Node A execution encountered an exception: ${errMessage}`,
      latency_ms: Date.now() - startTime,
    });

    return {
      traces: [...(state.traces || []), trace],
      errors: [...(state.errors || []), `Node A Error: ${errMessage}`],
    };
  }
}
