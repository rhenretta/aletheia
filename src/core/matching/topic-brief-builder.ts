import { SynthesizedEventCard, UnifiedTopicNode, EventSourceArticle, TopicEvolutionEntry } from "../types/contracts";
import { calculateSemanticAffinity } from "./semantic-matcher";

export interface TopicBriefHighlight {
  event_id: string;
  headline: string;
  summary: string;
  facts: string[];
  recency_label: string;
  published_at: string;
  image_url?: string;
  sources: EventSourceArticle[];
}

export interface TopicBrief {
  topic: string;
  weight: number;
  technical_depth?: string;
  why_they_care?: string;
  living_narrative?: string;
  likes_and_angles?: string[];
  dislikes_and_critiques?: string[];
  curiosity_vectors?: string[];
  evolution_timeline?: TopicEvolutionEntry[];
  last_updated: string;
  time_ago_label: string;
  velocity_status: "breaking" | "active" | "recent" | "steady" | "dormant";
  velocity_label: string;
  story_count: number;
  stories: SynthesizedEventCard[];
  key_highlights: TopicBriefHighlight[];
  all_sources: EventSourceArticle[];
}

/**
 * Builds aggregated Topic Briefs grouping stories, verified development highlights,
 * update velocity indicators, and source citations by user interest topics.
 */
export function buildTopicBriefs(
  cards: SynthesizedEventCard[] = [],
  userNode?: UnifiedTopicNode | null
): TopicBrief[] {
  const userTopics = userNode?.topics || {};
  const topicMap = new Map<string, SynthesizedEventCard[]>();

  // 1. Initialize buckets for all explicit user topics
  Object.keys(userTopics).forEach((topic) => {
    topicMap.set(topic, []);
  });

  // 2. Map feed cards into their most relevant topic buckets
  cards.forEach((card) => {
    let matchedBucket: string | null = null;
    let highestScore = 0;

    // Check direct matching first
    for (const [topic] of topicMap.entries()) {
      if (card.topic.toLowerCase() === topic.toLowerCase()) {
        matchedBucket = topic;
        break;
      }
    }

    // If no direct bucket match, run semantic affinity scoring
    if (!matchedBucket) {
      for (const [topic] of topicMap.entries()) {
        const match = calculateSemanticAffinity(card, topic, userNode);
        if (match.is_match && match.score > highestScore) {
          highestScore = match.score;
          matchedBucket = topic;
        }
      }
    }

    // Fallback: If card belongs to a new topic not yet in user topics, create dynamic bucket
    const targetKey = matchedBucket || card.topic;
    if (!topicMap.has(targetKey)) {
      topicMap.set(targetKey, []);
    }
    topicMap.get(targetKey)!.push(card);
  });

  const now = Date.now();
  const briefs: TopicBrief[] = [];

  for (const [topic, matchedCards] of topicMap.entries()) {
    const topicMeta = userTopics[topic];
    const weight = topicMeta?.weight !== undefined ? topicMeta.weight : 0.65;

    // Sort cards in this topic by publication date descending
    const sortedCards = [...matchedCards].sort((a, b) => {
      const timeA = new Date(a.published_at || 0).getTime();
      const timeB = new Date(b.published_at || 0).getTime();
      return timeB - timeA;
    });

    const latestPubTime = sortedCards[0]?.published_at
      ? new Date(sortedCards[0].published_at).getTime()
      : topicMeta?.last_discussed_at
      ? new Date(topicMeta.last_discussed_at).getTime()
      : now - 1000 * 60 * 60 * 24 * 7;

    const diffHours = (now - latestPubTime) / (1000 * 60 * 60);

    let velocityStatus: TopicBrief["velocity_status"] = "steady";
    let velocityLabel = "⏸ Steady · No updates in days";
    let timeAgoLabel = "Quiet";

    if (sortedCards.length > 0) {
      if (diffHours < 3) {
        velocityStatus = "breaking";
        velocityLabel = `⚡ Breaking · ${sortedCards.length} update${sortedCards.length > 1 ? "s" : ""} today`;
        timeAgoLabel = `${Math.max(1, Math.round(diffHours))}h ago`;
      } else if (diffHours < 24) {
        velocityStatus = "active";
        velocityLabel = `📈 Active · ${sortedCards.length} update${sortedCards.length > 1 ? "s" : ""} in 24h`;
        timeAgoLabel = `${Math.round(diffHours)}h ago`;
      } else if (diffHours < 72) {
        velocityStatus = "recent";
        velocityLabel = `🗓 Recent · ${sortedCards.length} update${sortedCards.length > 1 ? "s" : ""} this week`;
        timeAgoLabel = `${Math.round(diffHours / 24)}d ago`;
      } else {
        velocityStatus = "steady";
        const days = Math.round(diffHours / 24);
        velocityLabel = `⏸ Steady · ${days}d since major shift`;
        timeAgoLabel = `${days}d ago`;
      }
    } else {
      velocityStatus = "dormant";
      velocityLabel = "⏳ Quiet · Monitoring wire for updates";
      timeAgoLabel = "No recent stories";
    }

    // Build key development highlights
    const keyHighlights: TopicBriefHighlight[] = sortedCards.slice(0, 4).map((card) => ({
      event_id: card.event_id,
      headline: card.headline,
      summary: card.summary,
      facts: card.fact_bullets || [],
      recency_label: card.recency_label || "Recent",
      published_at: card.published_at || new Date().toISOString(),
      image_url: card.image_url,
      sources: card.sources || [],
    }));

    // Collect all distinct corroborating sources
    const sourceMap = new Map<string, EventSourceArticle>();
    sortedCards.forEach((c) => {
      c.sources?.forEach((s) => {
        if (!sourceMap.has(s.name)) {
          sourceMap.set(s.name, s);
        }
      });
    });

    briefs.push({
      topic,
      weight,
      technical_depth: topicMeta?.technical_depth || "practitioner",
      why_they_care: topicMeta?.why_they_care || "Tracked interest from conversation and reading telemetry.",
      living_narrative: topicMeta?.living_narrative || topicMeta?.why_they_care || `Developing ongoing perspective on ${topic}.`,
      likes_and_angles: topicMeta?.likes_and_angles || [],
      dislikes_and_critiques: topicMeta?.dislikes_and_critiques || [],
      curiosity_vectors: topicMeta?.curiosity_vectors || [topic],
      evolution_timeline: topicMeta?.evolution_timeline || [],
      last_updated: new Date(latestPubTime).toISOString(),
      time_ago_label: timeAgoLabel,
      velocity_status: velocityStatus,
      velocity_label: velocityLabel,
      story_count: sortedCards.length,
      stories: sortedCards,
      key_highlights: keyHighlights,
      all_sources: Array.from(sourceMap.values()),
    });
  }

  // Sort briefs:
  // 1. Topics with breaking/active stories first
  // 2. Then by user interest weight descending
  // 3. Then by story count descending
  return briefs.sort((a, b) => {
    const velocityRank = { breaking: 5, active: 4, recent: 3, steady: 2, dormant: 1 };
    const rankDiff = velocityRank[b.velocity_status] - velocityRank[a.velocity_status];
    if (rankDiff !== 0) return rankDiff;

    const weightDiff = b.weight - a.weight;
    if (Math.abs(weightDiff) > 0.1) return weightDiff;

    return b.story_count - a.story_count;
  });
}
