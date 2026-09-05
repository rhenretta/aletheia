import { RawArticle } from "../../types/contracts";
import { deepseekProvider } from "../../llm/deepseek-provider";
import { FreeNewsFetcher } from "../../ingestion/rss-search";
import { traceLogger } from "../../observability/trace-logger";

export interface EpistemicEvaluationResult {
  topic: string;
  source_breadth: number;
  distinct_publishers: string[];
  is_sufficient: boolean;
  needs_deep_research: boolean;
  unresolved_facets: string[];
  follow_up_queries: string[];
  rationale: string;
}

export class EpistemicEvaluator {
  /**
   * Evaluates information sufficiency and multi-source corroboration for a topic.
   * If new developments are discovered or source diversity is sparse (< 3 distinct publishers),
   * autonomously formulates targeted follow-up research queries.
   */
  public static async evaluateTopic(
    topic: string,
    articles: RawArticle[]
  ): Promise<EpistemicEvaluationResult> {
    const publishers = Array.from(
      new Set(articles.map((a) => a.source_name.trim()).filter((s) => s.length > 0))
    );
    const sourceBreadth = publishers.length;

    // Fast-path for empty or completely missing topics
    if (articles.length === 0) {
      return {
        topic,
        source_breadth: 0,
        distinct_publishers: [],
        is_sufficient: false,
        needs_deep_research: true,
        unresolved_facets: ["No articles currently available on the wire for this topic"],
        follow_up_queries: [topic, `${topic} news`, `${topic} latest developments`],
        rationale: "Zero articles retrieved; comprehensive multi-wire research required.",
      };
    }

    // Prepare context for LLM Epistemic Evaluation
    const articleSnippets = articles.slice(0, 5).map((a, idx) => {
      const headline = a.title || "Untitled";
      const publisher = a.source_name || "Unknown Source";
      const snippet = (a.raw_text || "").slice(0, 200).replace(/\s+/g, " ");
      return `[Source ${idx + 1}] (${publisher}) ${headline}: "${snippet}"`;
    }).join("\n");

    const systemPrompt = `You are the Epistemic Sufficiency Evaluator in an autonomous intelligence agent.
Your mission is to evaluate whether a collection of ingested news articles provides sufficient, well-corroborated, multi-perspective coverage of the topic, or if newly discovered developments require targeted follow-up research.

EVALUATION CRITERIA:
1. Source Diversity: Are there at least 3 distinct, independent reporting outlets/publishers?
2. Epistemic Sufficiency: Are key facts corroborated, or is there only a single-source claim / unverified rumor?
3. Newly Discovered Facets: Did the articles reveal new technical developments, breaking events, regulatory updates, or specific sub-topics that require dedicated follow-up research?

OUTPUT FORMAT:
Respond with ONLY a JSON object matching this schema:
{
  "is_sufficient": boolean,
  "needs_deep_research": boolean,
  "unresolved_facets": string[],
  "follow_up_queries": string[],
  "rationale": string
}

Guidelines for follow_up_queries:
- Provide 1 to 3 highly specific, objective search queries to investigate unresolved facets or corroborate claims.
- If coverage is already rich, balanced, and multi-source (3+ distinct reputable outlets corroborating facts), set needs_deep_research to false and follow_up_queries to [].
- Never include boolean operators or punctuation in follow_up_queries; use clean, search-friendly terminology.`;

    const userPrompt = `Topic: "${topic}"
Distinct Publishers (${publishers.length}): ${publishers.join(", ")}
Ingested Articles:
${articleSnippets}`;

    if (deepseekProvider.isConfigured()) {
      try {
        const result = await deepseekProvider.generateCompletion(userPrompt, {
          systemPrompt,
          temperature: 0.1,
          response_format: { type: "json_object" },
        });

        if (result && result.text) {
          const cleanJson = result.text.replace(/```json\n?|\n?```/g, "").trim();
          const parsed = JSON.parse(cleanJson);
          if (parsed && typeof parsed.is_sufficient === "boolean") {
            return {
              topic,
              source_breadth: sourceBreadth,
              distinct_publishers: publishers,
              is_sufficient: parsed.is_sufficient ?? (sourceBreadth >= 3),
              needs_deep_research: parsed.needs_deep_research ?? (sourceBreadth < 3),
              unresolved_facets: Array.isArray(parsed.unresolved_facets) ? parsed.unresolved_facets : [],
              follow_up_queries: Array.isArray(parsed.follow_up_queries)
                ? parsed.follow_up_queries.slice(0, 3)
                : [],
              rationale: parsed.rationale || `Evaluated ${sourceBreadth} distinct sources.`,
            };
          }
        }
      } catch (err) {
        console.warn(`EpistemicEvaluator LLM evaluation error for topic "${topic}":`, err);
      }
    }

    // Deterministic fallback if LLM is unavailable or offline
    const needsResearch = sourceBreadth < 3 || articles.length < 3;
    const fallbackQueries: string[] = [];

    if (needsResearch) {
      fallbackQueries.push(`${topic} latest`);
      fallbackQueries.push(`${topic} news developments`);
    }

    return {
      topic,
      source_breadth: sourceBreadth,
      distinct_publishers: publishers,
      is_sufficient: !needsResearch,
      needs_deep_research: needsResearch,
      unresolved_facets: needsResearch
        ? [`Limited source diversity (${sourceBreadth} outlets); additional corroboration required.`]
        : [],
      follow_up_queries: fallbackQueries,
      rationale: `Deterministic evaluation: ${sourceBreadth} distinct publishers identified across ${articles.length} articles.`,
    };
  }

  /**
   * Autonomous Deep Research Multi-Hop Ingestion Loop:
   * Evaluates all topic batches, executes follow-up queries for under-supported topics,
   * and returns an enriched article collection.
   */
  public static async evaluateAndEnrich(
    topics: string[],
    initialArticles: RawArticle[]
  ): Promise<{
    enriched_articles: RawArticle[];
    evaluations: EpistemicEvaluationResult[];
  }> {
    const startTime = Date.now();
    const topicArticleMap = new Map<string, RawArticle[]>();

    topics.forEach((t) => topicArticleMap.set(t, []));

    // Group initial articles by matching topic
    initialArticles.forEach((art) => {
      const artTopic = art.topic_category || "";
      let matched = false;
      for (const t of topics) {
        if (
          artTopic.toLowerCase() === t.toLowerCase() ||
          art.title.toLowerCase().includes(t.toLowerCase()) ||
          t.toLowerCase().includes(artTopic.toLowerCase())
        ) {
          topicArticleMap.get(t)?.push(art);
          matched = true;
          break;
        }
      }
      if (!matched && topics.length > 0) {
        topicArticleMap.get(topics[0])?.push(art);
      }
    });

    const evaluations: EpistemicEvaluationResult[] = [];
    const followUpArticles: RawArticle[] = [];
    const seenUrls = new Set(initialArticles.map((a) => a.source_url));

    for (const topic of topics) {
      const topicArts = topicArticleMap.get(topic) || [];
      const evaluation = await this.evaluateTopic(topic, topicArts);
      evaluations.push(evaluation);

      if (evaluation.needs_deep_research && evaluation.follow_up_queries.length > 0) {
        // Execute follow-up research queries concurrently
        const searchPromises = evaluation.follow_up_queries.map(async (query) => {
          try {
            return await FreeNewsFetcher.searchNews(query, 4);
          } catch (err) {
            console.warn(`Epistemic deep search error for query "${query}":`, err);
            return [];
          }
        });

        const searchResults = await Promise.all(searchPromises);
        for (const batch of searchResults) {
          for (const art of batch) {
            if (!seenUrls.has(art.source_url)) {
              seenUrls.add(art.source_url);
              followUpArticles.push({
                ...art,
                topic_category: topic,
              });
            }
          }
        }
      }
    }

    const enriched = [...initialArticles, ...followUpArticles];

    traceLogger.logTrace({
      node_name: "node_discovery",
      input_summary: {
        topics,
        initial_articles_count: initialArticles.length,
      },
      output_summary: {
        evaluations_count: evaluations.length,
        follow_up_queries_executed: evaluations.flatMap((e) => e.follow_up_queries).length,
        newly_discovered_articles: followUpArticles.length,
        total_enriched_articles: enriched.length,
      },
      reasoning_rationale: `Epistemic Evaluator reviewed ${topics.length} topics. Executed deep research for topics requiring multi-source corroboration, adding ${followUpArticles.length} newly discovered articles.`,
      latency_ms: Date.now() - startTime,
      llm_tokens_used: 0,
      metadata: {
        evaluations,
      },
    });

    return {
      enriched_articles: enriched,
      evaluations,
    };
  }
}
