import {
  UnifiedTopicNode,
  RawArticle,
  DiscoveryParameters,
} from "../../types/contracts";
import { traceLogger } from "../../observability/trace-logger";
import { NewsCollector } from "../collector/news-collector";

export interface DiscoveryCuratedBatch {
  selected_queries: string[];
  candidate_articles_count: number;
  accepted_articles: RawArticle[];
  rejected_articles_count: number;
  rejection_reasons: Array<{ title: string; source: string; reason: string }>;
  trace_id: string;
}

export class DiscoveryAgent {
  /**
   * Translates deep intent in the Unified Topic Node into rigorous search queries and curated high-signal articles
   */
  public static async curateAndCollect(
    unifiedNode: UnifiedTopicNode,
    customQueries?: string[]
  ): Promise<DiscoveryCuratedBatch> {
    const startTime = Date.now();
    const traceId = `trace_disc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    const params: DiscoveryParameters = unifiedNode.discovery_parameters || {
      signal_threshold: 0.75,
      anti_preferences: ["clickbait", "rumors", "celebrity", "crypto pump"],
      exploration_rate: 0.2,
      depth_requirement: "practitioner",
    };

    // 1. Generate multi-tiered query list from Unified Topic Node
    const querySet = new Set<string>();

    if (customQueries && customQueries.length > 0) {
      customQueries.forEach((q) => querySet.add(q));
    } else {
      // Add top weighted topics
      const sortedTopics = Object.entries(unifiedNode.topics || {})
        .sort(([, a], [, b]) => b.weight - a.weight)
        .slice(0, 3);

      for (const [topicName, meta] of sortedTopics) {
        querySet.add(topicName);
        if (meta.curiosity_vectors && meta.curiosity_vectors.length > 0) {
          querySet.add(meta.curiosity_vectors[0]);
        }
      }

      // Add Intersectional themes
      (unifiedNode.interest_intersections || []).slice(0, 2).forEach((i) => {
        querySet.add(i.intersection_theme);
      });

      // Add Curiosity frontiers
      (unifiedNode.adjacent_curiosity_frontiers || []).slice(0, 2).forEach((f) => {
        querySet.add(f.topic);
      });
    }

    const queries = Array.from(querySet).slice(0, 6);

    // 2. Fetch raw wire articles via NewsCollector
    const rawResults = await NewsCollector.collectForTopics(queries);
    const candidateArticles = rawResults.flatMap((r) => r.articles);

    // 3. Rigorous Quality & Anti-Preference Filtering (The Curator Filter)
    const acceptedArticles: RawArticle[] = [];
    const rejectionReasons: Array<{ title: string; source: string; reason: string }> = [];

    const antiKeywords = (params.anti_preferences || []).map((k) => k.toLowerCase());

    for (const article of candidateArticles) {
      const textToScan = `${article.title} ${article.raw_text}`.toLowerCase();

      // Check anti-preference keywords
      const matchedAnti = antiKeywords.find((anti) => textToScan.includes(anti));
      if (matchedAnti) {
        rejectionReasons.push({
          title: article.title,
          source: article.source_name,
          reason: `Violates anti-preference filter: contains '${matchedAnti}'`,
        });
        continue;
      }

      // Filter out overly short or shallow snippets (low information density)
      if (article.raw_text.length < 80) {
        rejectionReasons.push({
          title: article.title,
          source: article.source_name,
          reason: `Insufficient information density (length: ${article.raw_text.length} chars)`,
        });
        continue;
      }

      // Filter out sensationalist exclamation or all-caps clickbait
      const uppercaseWordCount = (article.title.match(/\b[A-Z]{3,}\b/g) || []).length;
      if (uppercaseWordCount > 2 || article.title.includes("!")) {
        rejectionReasons.push({
          title: article.title,
          source: article.source_name,
          reason: `Sensationalist/clickbait formatting detected`,
        });
        continue;
      }

      acceptedArticles.push(article);
    }

    const latency = Date.now() - startTime;

    // Log structured trace for Observability
    traceLogger.logTrace({
      trace_id: traceId,
      session_id: `disc_${unifiedNode.user_id}`,
      timestamp: new Date().toISOString(),
      node_name: "node_discovery",
      input_summary: {
        target_queries: queries,
        signal_threshold: params.signal_threshold,
        anti_preferences_count: antiKeywords.length,
        depth_requirement: params.depth_requirement,
      },
      output_summary: {
        candidates_scanned: candidateArticles.length,
        articles_accepted: acceptedArticles.length,
        articles_rejected: rejectionReasons.length,
        top_rejections: rejectionReasons.slice(0, 3),
      },
      reasoning_rationale: `Curated ${acceptedArticles.length} high-signal articles for topics [${queries.join(", ")}]. Enforced strict quality filter, rejecting ${rejectionReasons.length} low-signal/sensationalist items.`,
      latency_ms: latency,
      metadata: {
        queries,
        rejection_reasons: rejectionReasons,
      },
    });

    return {
      selected_queries: queries,
      candidate_articles_count: candidateArticles.length,
      accepted_articles: acceptedArticles,
      rejected_articles_count: rejectionReasons.length,
      rejection_reasons: rejectionReasons,
      trace_id: traceId,
    };
  }
}
