import { RawArticle } from "../../types/contracts";
import { FreeNewsFetcher } from "../../ingestion/rss-search";
import { traceLogger } from "../../observability/trace-logger";

export interface CollectorResult {
  topic: string;
  articles: RawArticle[];
  source_perspectives: string[];
}

export class NewsCollector {
  /**
   * Autonomously collects live real-world news across multiple publishers for the requested topics.
   * Free, zero API keys required, fails fast if unable to fetch.
   */
  public static async collectForTopics(topics: string[]): Promise<CollectorResult[]> {
    if (!topics || topics.length === 0) {
      throw new Error("NewsCollector Error: No topics provided for news collection.");
    }

    const uniqueTopics = Array.from(new Set(topics.filter((t) => t && t.trim().length > 0)));
    const results: CollectorResult[] = [];

    // Parallel multi-topic collection
    const settled = await Promise.allSettled(
      uniqueTopics.map(async (topic) => {
        const startTime = Date.now();
        // Clean query: remove complex punctuation for RSS search
        const cleanQuery = topic.replace(/[()[\]{}]/g, "").trim();
        const articles: RawArticle[] = await FreeNewsFetcher.searchNews(cleanQuery, 6);

        if (articles.length === 0) {
          throw new Error(`Zero articles found for ${topic}`);
        }

        const sources = articles.map((a: RawArticle) => `${a.source_name} [${a.author_bias_rating}]`);
        const latency = Date.now() - startTime;

        traceLogger.logTrace({
          node_name: "node_a_epistemology",
          input_summary: {
            topic,
            ingestion_channel: "Live Multi-Source Open Feeds (Google News RSS)",
            articles_requested: 6,
          },
          output_summary: {
            articles_retrieved: articles.length,
            publishers: Array.from(new Set(articles.map((a: RawArticle) => a.source_name))),
            bias_distribution: {
              left: articles.filter((a: RawArticle) => a.author_bias_rating.includes("left")).length,
              center: articles.filter((a: RawArticle) => a.author_bias_rating === "center").length,
              right: articles.filter((a: RawArticle) => a.author_bias_rating.includes("right")).length,
            },
            headlines: articles.map((a: RawArticle) => a.title),
          },
          reasoning_rationale: `Free News Ingestion Engine pulled ${articles.length} live articles for "${topic}" across ${
            new Set(articles.map((a: RawArticle) => a.source_name)).size
          } distinct publications. Ready for Epistemology delta analysis.`,
          latency_ms: latency,
          llm_tokens_used: 0,
          metadata: {
            action: "live_news_feed_ingestion",
            topic,
            sources,
            article_urls: articles.map((a: RawArticle) => a.source_url),
          },
        });

        return {
          topic,
          articles,
          source_perspectives: sources,
        };
      })
    );

    for (const res of settled) {
      if (res.status === "fulfilled") {
        results.push(res.value);
      } else {
        console.warn("Topic news collection warning:", res.reason);
      }
    }

    if (results.length === 0) {
      throw new Error(`NewsCollector Error: Failed to retrieve live articles across all requested topics (${uniqueTopics.join(", ")}).`);
    }

    return results;
  }
}
