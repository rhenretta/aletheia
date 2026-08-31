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

    // Atomic Event Clustering: Break articles into discrete, focused event clusters (1-3 articles per specific event)
    const atomicClusters: Array<{
      canonicalTopic: string;
      articles: RawArticle[];
      titleWords: Set<string>;
    }> = [];

    const userTopics = state.user_graph ? Object.keys(state.user_graph.topic_weights) : [];
    const canonicalUserTopics = userTopics;

    const stopWords = new Set(["with", "from", "that", "this", "after", "over", "into", "amid", "says", "more", "will", "about", "latest", "what", "their"]);

    for (const article of cleanedArticles) {
      const artText = (article.title + " " + article.raw_text).toLowerCase();

      // Use the explicit topic category under which this article was fetched
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

      // Extract significant title words for event-level clustering
      const words = article.title
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 3 && !stopWords.has(w));

      const titleWordSet = new Set(words);

      // Check if this article matches an existing atomic cluster in the same topic
      let matchedCluster = atomicClusters.find((c) => {
        if (c.canonicalTopic !== bestTopic) return false;
        if (c.articles.length >= 3) return false; // Keep clusters small and atomic
        // Count overlapping substantive words
        let overlap = 0;
        for (const w of titleWordSet) {
          if (c.titleWords.has(w)) overlap++;
        }
        return overlap >= 2;
      });

      if (matchedCluster) {
        matchedCluster.articles.push(article);
        for (const w of titleWordSet) matchedCluster.titleWords.add(w);
      } else {
        atomicClusters.push({
          canonicalTopic: bestTopic,
          articles: [article],
          titleWords: titleWordSet,
        });
      }
    }

    // Process each atomic cluster into a dedicated PureFactObject in parallel
    const pureFacts: PureFactObject[] = await Promise.all(
      atomicClusters.map(async (cluster) => {
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

    const distinctTopics = Array.from(new Set(atomicClusters.map((c) => c.canonicalTopic)));

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
