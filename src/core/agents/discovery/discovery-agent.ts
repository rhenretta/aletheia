import {
  UnifiedTopicNode,
  RawArticle,
  DiscoveryParameters,
  generateTopicId,
} from "../../types/contracts";
import { traceLogger } from "../../observability/trace-logger";
import { NewsCollector } from "../collector/news-collector";
import { TopicRelevanceFilter } from "./topic-relevance-filter";
import { EpistemicEvaluator } from "./epistemic-evaluator";

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
    customQueries?: string[],
    canonicalTopics?: string[],
    topicIds?: string[]
  ): Promise<DiscoveryCuratedBatch> {
    const startTime = Date.now();
    const traceId = `trace_disc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    const params: DiscoveryParameters = unifiedNode.discovery_parameters || {
      signal_threshold: 0.75,
      anti_preferences: ["clickbait", "rumors", "celebrity", "crypto pump"],
      exploration_rate: 0.2,
      depth_requirement: "practitioner",
    };

    // 1. Generate multi-tiered query list and topic descriptors from Unified Topic Node
    const descriptors: Array<{ topic_id?: string; topic: string; searchQuery?: string }> = [];
    const querySet = new Set<string>();

    if (canonicalTopics && canonicalTopics.length > 0) {
      canonicalTopics.forEach((topic, idx) => {
        const query = customQueries?.[idx] || customQueries?.[0] || topic;
        const topicId = topicIds?.[idx] || unifiedNode.topics?.[topic]?.topic_id || generateTopicId(topic);
        descriptors.push({ topic_id: topicId, topic, searchQuery: query });
        querySet.add(query);
      });
    } else if (customQueries && customQueries.length > 0) {
      customQueries.forEach((q, idx) => {
        const topicId = topicIds?.[idx] || generateTopicId(q);
        descriptors.push({ topic_id: topicId, topic: q, searchQuery: q });
        querySet.add(q);
      });
    } else {
      // Add top weighted topics
      const sortedTopics = Object.entries(unifiedNode.topics || {})
        .sort(([, a], [, b]) => b.weight - a.weight)
        .slice(0, 3);

      for (const [topicName, meta] of sortedTopics) {
        const topicId = meta.topic_id || generateTopicId(topicName);
        descriptors.push({ topic_id: topicId, topic: topicName, searchQuery: topicName });
        querySet.add(topicName);
        if (meta.curiosity_vectors && meta.curiosity_vectors.length > 0) {
          descriptors.push({ topic_id: topicId, topic: topicName, searchQuery: meta.curiosity_vectors[0] });
          querySet.add(meta.curiosity_vectors[0]);
        }
      }

      // Add Intersectional themes
      (unifiedNode.interest_intersections || []).slice(0, 2).forEach((i) => {
        const topicId = generateTopicId(i.intersection_theme);
        descriptors.push({ topic_id: topicId, topic: i.intersection_theme, searchQuery: i.intersection_theme });
        querySet.add(i.intersection_theme);
      });

      // Add Curiosity frontiers
      (unifiedNode.adjacent_curiosity_frontiers || []).slice(0, 2).forEach((f) => {
        const topicId = generateTopicId(f.topic);
        descriptors.push({ topic_id: topicId, topic: f.topic, searchQuery: f.topic });
        querySet.add(f.topic);
      });
    }

    const queries = Array.from(querySet).slice(0, 6);

    // 2. Fetch raw wire articles via NewsCollector with canonical topic binding
    const rawResults = await NewsCollector.collectForTopics(descriptors.slice(0, 6));
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

      // Filter out stale content: reject news older than 90 days and social threads older than 60 days
      if (article.published_at) {
        const pubTime = new Date(article.published_at).getTime();
        if (!isNaN(pubTime)) {
          const ageDays = (Date.now() - pubTime) / (1000 * 60 * 60 * 24);
          const maxAllowedAgeDays = (article.platform === "reddit" || article.platform === "bluesky") ? 60 : 90;
          if (ageDays > maxAllowedAgeDays) {
            rejectionReasons.push({
              title: article.title,
              source: article.source_name,
              reason: `Outdated content: published ${Math.round(ageDays)} days ago (exceeds ${maxAllowedAgeDays}-day freshness threshold)`,
            });
            continue;
          }
        }
      }

      acceptedArticles.push(article);
    }

    // 4. Semantic Relevance & Homonym/Acronym Collision Filtering
    const relevanceResult = await TopicRelevanceFilter.filterArticles(acceptedArticles);
    for (const rej of relevanceResult.rejected) {
      rejectionReasons.push({
        title: rej.article.title,
        source: rej.article.source_name,
        reason: rej.reason,
      });
    }

    const filteredInitialArticles = relevanceResult.accepted;

    // 5. Epistemic Sufficiency & Autonomous Deep Research Loop
    // Evaluates whether each topic has adequate multi-source breadth (>= 3 independent outlets)
    // or if newly discovered developments require targeted follow-up research.
    const { enriched_articles: finalCuratedArticles, evaluations } =
      await EpistemicEvaluator.evaluateAndEnrich(queries, filteredInitialArticles);

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
        articles_accepted: finalCuratedArticles.length,
        articles_rejected: rejectionReasons.length,
        epistemic_evaluations: evaluations.length,
        deep_research_queries_triggered: evaluations.flatMap((e) => e.follow_up_queries).length,
        top_rejections: rejectionReasons.slice(0, 3),
      },
      reasoning_rationale: `Curated ${finalCuratedArticles.length} high-signal articles for topics [${queries.join(", ")}]. Epistemic evaluation completed across ${evaluations.length} topics. Enforced strict quality & relevance filter, rejecting ${rejectionReasons.length} low-signal items.`,
      latency_ms: Date.now() - startTime,
      metadata: {
        queries,
        evaluations,
        rejection_reasons: rejectionReasons,
      },
    });

    return {
      selected_queries: queries,
      candidate_articles_count: candidateArticles.length,
      accepted_articles: finalCuratedArticles,
      rejected_articles_count: rejectionReasons.length,
      rejection_reasons: rejectionReasons,
      trace_id: traceId,
    };
  }
}
