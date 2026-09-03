import { RawArticle, DirectSource } from "../../types/contracts";
import { FreeNewsFetcher } from "../../ingestion/rss-search";
import { traceLogger } from "../../observability/trace-logger";
import { postgresStore } from "../../storage/postgres-store";
import { DirectContentCrawler } from "../../ingestion/direct-crawler";
import { SocialContentCrawler } from "../../ingestion/social-crawler";
import { DirectSourceScoutAgent } from "../scout/direct-source-scout";
import { SocialSourceScoutAgent } from "../scout/social-source-scout";

export interface CollectorResult {
  topic: string;
  articles: RawArticle[];
  source_perspectives: string[];
  ingestion_channel?: string;
}

export class NewsCollector {
  /**
   * Autonomously collects live real-world news and facts across canonical direct sources and open web wires.
   * Prioritizes Direct RSS/WWW and Social sources; uses search engines judiciously as fallback.
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
        const cleanQuery = topic.replace(/[()[\]{}]/g, "").trim();

        let articles: RawArticle[] = [];
        let channel = "Live Multi-Source Open Feeds (Bing RSS / Google News)";

        // 1. DIRECT-FIRST INGESTION: Check registered canonical direct & social sources for this topic
        try {
          const directSources = await postgresStore.getDirectSourcesForTopic(topic);
          const activeSources = directSources.filter((s) => s.status === "active");

          if (activeSources.length > 0) {
            const directArticles: RawArticle[] = [];
            for (const src of activeSources) {
              const isSocial =
                src.source_type === "reddit_community" ||
                src.source_type === "bluesky_profile" ||
                src.source_type === "social_feed" ||
                src.platform === "reddit" ||
                src.platform === "bluesky";

              const crawlRes = isSocial
                ? await SocialContentCrawler.crawl(src, 3)
                : await DirectContentCrawler.crawl(src, 3);

              if (crawlRes.articles.length > 0) {
                for (const a of crawlRes.articles) {
                  directArticles.push({
                    ...a,
                    topic_category: topic,
                  });
                }
                // Update source freshness
                postgresStore.updateDirectSourceStatus(src.id, {
                  lastCrawledAt: new Date().toISOString(),
                  lastSuccessfulContentAt: new Date().toISOString(),
                  etag: crawlRes.etag,
                  lastModified: crawlRes.lastModified,
                  consecutiveFailures: 0,
                }).catch(() => {});
              } else if (crawlRes.errorMessage) {
                postgresStore.updateDirectSourceStatus(src.id, {
                  lastCrawledAt: new Date().toISOString(),
                  lastSuccessfulContentAt: undefined,
                  consecutiveFailures: (src.consecutive_failures || 0) + 1,
                  status: (src.consecutive_failures || 0) >= 2 ? "failing" : "active",
                }).catch(() => {});
              }
            }

            if (directArticles.length >= 2) {
              articles = directArticles.slice(0, 6);
              channel = `Direct Canonical Sources (${activeSources.map((s) => s.publisher_name).join(", ")})`;
            }
          } else {
            // Trigger background scouts to discover and register canonical feeds & social hubs for this topic
            DirectSourceScoutAgent.scoutForTopic(topic).catch((err) =>
              console.warn(`Background Scout error for "${topic}":`, err)
            );
            SocialSourceScoutAgent.scoutForTopic(topic).catch((err) =>
              console.warn(`Background Social Scout error for "${topic}":`, err)
            );
          }
        } catch (err) {
          console.warn(`Direct source check error for "${topic}":`, err);
        }

        // 2. JUDICIOUS FALLBACK: If direct sources yielded insufficient items, query live search engine
        if (articles.length < 2) {
          const searchArticles = await FreeNewsFetcher.searchNews(cleanQuery, 6);
          if (searchArticles.length > 0) {
            // Merge direct and search results
            const seenUrls = new Set(articles.map((a) => a.source_url));
            for (const a of searchArticles) {
              if (!seenUrls.has(a.source_url)) {
                seenUrls.add(a.source_url);
                articles.push({
                  ...a,
                  topic_category: topic,
                });
              }
            }
          }
        }

        if (articles.length === 0) {
          throw new Error(`Zero articles found for ${topic}`);
        }

        const sources = articles.map((a: RawArticle) => `${a.source_name} [${a.author_bias_rating}]`);
        const latency = Date.now() - startTime;

        traceLogger.logTrace({
          node_name: "node_a_epistemology",
          input_summary: {
            topic,
            ingestion_channel: channel,
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
          reasoning_rationale: `Ingestion Engine pulled ${articles.length} live articles for "${topic}" via ${channel}. Ready for Epistemology delta analysis.`,
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
          ingestion_channel: channel,
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
