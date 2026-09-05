import {
  SynthesizedEventCard,
  UnifiedTopicNode,
  EventSourceArticle,
  TopicEvolutionEntry,
  EventTopicLifecyclePhase,
  EventTopicSentiment,
  EventTopicHistoricalMilestone,
  DynamicBriefSection,
  LLMTopicBriefDesign,
} from "../types/contracts";
import { calculateSemanticAffinity, SeenInteractionState } from "./semantic-matcher";
import { TopicBriefSynthesizer } from "./topic-brief-synthesizer";
import { StoryDiscoveryEngine } from "../ingestion/story-discovery-engine";

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

export interface BriefNarrativeSentence {
  sentence_id: string;
  text: string;
  citation_index: number;
  story_id: string;
  story_headline: string;
  story_summary: string;
  sources: EventSourceArticle[];
}

export interface TopicBrief {
  id: string;
  topic: string;
  title: string;
  parent_interest: string;
  weight: number;
  technical_depth: string;
  why_they_care: string;
  living_narrative?: string;
  likes_and_angles?: string[];
  dislikes_and_critiques?: string[];
  curiosity_vectors: string[];
  evolution_timeline: Array<{ timestamp: string; insight: string; trigger_source?: string; evidence?: string }>;
  last_updated: string;
  time_ago_label: string;
  velocity_status: "breaking" | "active" | "recent" | "steady" | "dormant";
  velocity_label: string;
  lifecycle_phase: EventTopicLifecyclePhase;
  lifecycle_label: string;
  gravity_score: number;
  momentum_trend: "surging" | "rising" | "steady" | "cooling";
  cross_source_breadth: number;
  current_focus: string;
  public_sentiment: EventTopicSentiment;
  historical_arc: EventTopicHistoricalMilestone[];
  llm_design?: LLMTopicBriefDesign;
  dynamic_sections?: DynamicBriefSection[];
  executive_take?: string;
  story_count: number;
  unseen_count?: number;
  stories: SynthesizedEventCard[];
  key_highlights: Array<{
    event_id: string;
    headline: string;
    summary: string;
    recency_label: string;
    facts: string[];
    sources: EventSourceArticle[];
    is_fresh?: boolean;
  }>;
  narrative_sentences: BriefNarrativeSentence[];
  narrative_full_text: string;
  all_sources: EventSourceArticle[];
}


/**
 * Deduplicate syndicated news coverage covering the identical event
 */
export function deduplicateStories(cards: SynthesizedEventCard[]): SynthesizedEventCard[] {
  const uniqueCards: SynthesizedEventCard[] = [];

  for (const card of cards) {
    const headline = card.headline || card.topic || "";
    const tokensA = new Set(
      headline
        .toLowerCase()
        .replace(/[^\w\s]/g, "")
        .split(/\s+/)
        .filter((w) => w.length > 3)
    );

    let isDuplicate = false;
    for (let i = 0; i < uniqueCards.length; i++) {
      const existing = uniqueCards[i];
      const tokensB = new Set(
        existing.headline
          .toLowerCase()
          .replace(/[^\w\s]/g, "")
          .split(/\s+/)
          .filter((w) => w.length > 3)
      );

      let intersection = 0;
      tokensA.forEach((t) => {
        if (tokensB.has(t)) intersection++;
      });

      const minLen = Math.min(tokensA.size, tokensB.size);
      const similarity = minLen > 0 ? intersection / minLen : 0;

      // Duplicate threshold: >55% token overlap or identical event cluster
      if (similarity >= 0.55 || (existing.event_id && card.event_id && existing.event_id === card.event_id)) {
        // Merge sources from duplicate reporting
        const existingSources = existing.sources || [];
        const newSources = card.sources || [];
        const mergedSourcesMap = new Map<string, EventSourceArticle>();

        existingSources.forEach((s) => mergedSourcesMap.set(s.name, s));
        newSources.forEach((s) => {
          if (!mergedSourcesMap.has(s.name)) {
            mergedSourcesMap.set(s.name, s);
          }
        });

        existing.sources = Array.from(mergedSourcesMap.values());
        if ((card.fact_bullets?.length || 0) > (existing.fact_bullets?.length || 0)) {
          existing.fact_bullets = card.fact_bullets;
        }
        isDuplicate = true;
        break;
      }
    }

    if (!isDuplicate) {
      uniqueCards.push({ ...card, sources: [...(card.sources || [])] });
    }
  }

  return uniqueCards;
}

/**
 * Synthesizes a flowing narrative update with sentence-level story mappings
 */
export function synthesizeBriefNarrative(
  topic: string,
  cards: SynthesizedEventCard[],
  topicMeta?: any
): { sentences: BriefNarrativeSentence[]; fullText: string } {
  if (!cards || cards.length === 0) {
    const fallbackText = `Things have been relatively quiet for ${topic} recently. We're keeping an eye out for updates as new stories break.`;
    return {
      sentences: [
        {
          sentence_id: `sent_0`,
          text: fallbackText,
          citation_index: 1,
          story_id: "",
          story_headline: topic,
          story_summary: fallbackText,
          sources: [],
        },
      ],
      fullText: fallbackText,
    };
  }

  const sentences: BriefNarrativeSentence[] = [];

  cards.slice(0, 4).forEach((card, idx) => {
    // Extract substantive sentence from summary or headline
    let sentenceText = card.summary.trim();
    if (sentenceText.includes(".")) {
      const parts = sentenceText.split(/(?<=[.?!])\s+/);
      sentenceText = parts.slice(0, 2).join(" ");
    }
    if (!sentenceText.endsWith(".")) {
      sentenceText += ".";
    }

    sentences.push({
      sentence_id: `sent_${idx + 1}`,
      text: sentenceText,
      citation_index: idx + 1,
      story_id: card.event_id,
      story_headline: card.headline,
      story_summary: card.summary,
      sources: card.sources || [],
    });
  });

  const fullText = sentences.map((s) => s.text).join(" ");
  return { sentences, fullText };
}

/**
 * Synthesizes public and community sentiment from social discourse, discussions,
 * and reported stakeholder feedback across corroborating articles.
 */
export function synthesizePublicSentiment(
  cards: SynthesizedEventCard[],
  sources: EventSourceArticle[]
): EventTopicSentiment {
  if (!cards || cards.length === 0) {
    return {
      tone: "neutral",
      summary: "Monitoring practitioner channels and public feeds for emerging feedback.",
      representative_quotes: [],
    };
  }

  const quotes: EventTopicSentiment["representative_quotes"] = [];
  let disputeCount = 0;
  let critiqueScore = 0;
  let endorsementScore = 0;

  // 1. Scan cards for disputed claims & fact bullets
  cards.forEach((card) => {
    if (card.disputed_claims && card.disputed_claims.length > 0) {
      disputeCount += card.disputed_claims.length;
      card.disputed_claims.slice(0, 2).forEach((claim) => {
        critiqueScore += 2;
        quotes.push({
          quote: claim.claim,
          speaker_or_community: claim.contested_by?.[0] || "Community Observer",
          platform: "open_web",
        });
      });
    }
  });

  // 2. Scan sources for social posts, Reddit threads, or discussion quotes
  sources.forEach((src) => {
    const isReddit = src.name.toLowerCase().includes("reddit") || (src.url && src.url.includes("reddit.com"));
    const isSocial = isReddit || (src.url && src.url.includes("bsky.app"));

    if (src.highlighted_passages && src.highlighted_passages.length > 0) {
      src.highlighted_passages.slice(0, 2).forEach((p) => {
        const cleanP = p.trim().replace(/^["']|["']$/g, "");
        if (cleanP.length > 25 && cleanP.length < 240 && quotes.length < 3) {
          quotes.push({
            quote: cleanP,
            speaker_or_community: isReddit ? src.name : src.name || "Reporting Outlet",
            platform: isReddit ? "reddit" : isSocial ? "bluesky" : "open_web",
            url: src.url,
          });
        }
      });
    }

    // Check raw_text for quotes or community commentary
    if (quotes.length < 3 && src.raw_text) {
      const quoteMatches = src.raw_text.match(/"([^"]{30,200})"/g);
      if (quoteMatches) {
        quoteMatches.slice(0, 2).forEach((q) => {
          const textOnly = q.replace(/^"|"$/g, "").trim();
          if (quotes.length < 3 && !quotes.some((existing) => existing.quote === textOnly)) {
            quotes.push({
              quote: textOnly,
              speaker_or_community: src.name,
              platform: isReddit ? "reddit" : isSocial ? "bluesky" : "open_web",
              url: src.url,
            });
          }
        });
      }
    }
  });

  // 3. Determine sentiment polarity
  let tone: EventTopicSentiment["tone"] = "neutral";
  if (disputeCount > 1 || critiqueScore > 3) {
    tone = "critical";
  } else if (disputeCount === 1 || (critiqueScore > 0 && endorsementScore > 0)) {
    tone = "mixed";
  } else if (cards.some((c) => (c.sources?.length || 0) >= 2)) {
    tone = "positive";
  } else {
    tone = "cautious";
  }

  // 4. Summarize reception
  let summary = "Consensus sentiment reflects active interest across field observers and domain reporting.";
  if (tone === "critical") {
    summary = "Community reception highlights notable friction points, critical reports, or contested claims.";
  } else if (tone === "mixed") {
    summary = "Reactions are divergent, balancing enthusiasm for developments against operational caveats.";
  } else if (tone === "cautious") {
    summary = "Initial feedback remains measured as practitioner telemetry and independent testing continue.";
  } else if (tone === "positive") {
    summary = "Early feedback and reporting indicate strong alignment, successful validation, and positive reception.";
  }

  return {
    tone,
    summary,
    representative_quotes: quotes.slice(0, 3),
  };
}

/**
 * Builds an anchored chronological historical arc (2–4 key milestones)
 */
export function buildHistoricalArc(
  cards: SynthesizedEventCard[],
  topicMeta?: any,
  now: number = Date.now()
): EventTopicHistoricalMilestone[] {
  const milestones: EventTopicHistoricalMilestone[] = [];

  // A. Use topicMeta evolution timeline if available and strictly related to verified events (never observer notes)
  if (topicMeta?.evolution_timeline && Array.isArray(topicMeta.evolution_timeline)) {
    topicMeta.evolution_timeline.slice(-3).forEach((entry: any) => {
      const isObserverLog =
        entry.trigger_source === "observer_agent" ||
        (entry.insight && /user('s)?\s+(interest|preference|history|mindset)/i.test(entry.insight));
      if (!isObserverLog && entry.insight) {
        const entryTime = new Date(entry.timestamp || 0).getTime();
        const diffDays = Math.round((now - entryTime) / (1000 * 60 * 60 * 24));
        const timeLabel = diffDays <= 0 ? "Today" : diffDays === 1 ? "Yesterday" : `${diffDays}d ago`;
        milestones.push({
          time_label: timeLabel,
          milestone: entry.insight,
          source_name: entry.trigger_source,
        });
      }
    });
  }

  // B. Sort cards chronologically (oldest to newest) to show development trajectory
  const chronologicalCards = [...cards].sort((a, b) => {
    const timeA = new Date(a.published_at || 0).getTime();
    const timeB = new Date(b.published_at || 0).getTime();
    return timeA - timeB;
  });

  chronologicalCards.slice(0, 3).forEach((card) => {
    const pubTime = new Date(card.published_at || 0).getTime();
    const diffHours = (now - pubTime) / (1000 * 60 * 60);
    let timeLabel = "Recent";
    if (diffHours < 3) timeLabel = "Just now";
    else if (diffHours < 24) timeLabel = `${Math.round(diffHours)}h ago`;
    else if (diffHours < 48) timeLabel = "Yesterday";
    else timeLabel = `${Math.round(diffHours / 24)}d ago`;

    // Only add if not duplicate milestone
    const desc = card.headline;
    if (!milestones.some((m) => m.milestone.toLowerCase() === desc.toLowerCase())) {
      milestones.push({
        time_label: timeLabel,
        milestone: desc,
        source_name: card.sources?.[0]?.name,
        source_url: card.sources?.[0]?.url,
      });
    }
  });

  if (milestones.length === 0) {
    milestones.push({
      time_label: "Baseline",
      milestone: "Continuous empirical intelligence tracking established across wire reporting.",
    });
  }

  return milestones.slice(-4);
}

/**
 * Calculates Dynamic Event Gravity Score:
 * Gravity = (Velocity * Cross-Source Breadth) + User Affinity - Decay
 */
export function calculateEventGravity(
  sortedCards: SynthesizedEventCard[],
  weight: number,
  allSources: EventSourceArticle[],
  diffHours: number
): {
  gravity_score: number;
  lifecycle_phase: EventTopicLifecyclePhase;
  lifecycle_label: string;
  momentum_trend: "surging" | "rising" | "steady" | "cooling";
  cross_source_breadth: number;
} {
  const storyCount = sortedCards.length;

  if (storyCount === 0) {
    const gravity = Math.max(8, Math.round(weight * 25));
    return {
      gravity_score: gravity,
      lifecycle_phase: "cooling",
      lifecycle_label: "💤 Cooling Off",
      momentum_trend: "cooling",
      cross_source_breadth: 0,
    };
  }

  // 1. Velocity (0 - 35 points): Rate of fresh influx
  let freshnessMultiplier = 1.0;
  if (diffHours < 3) freshnessMultiplier = 1.5;
  else if (diffHours < 12) freshnessMultiplier = 1.25;
  else if (diffHours < 24) freshnessMultiplier = 1.0;
  else if (diffHours < 48) freshnessMultiplier = 0.65;
  else freshnessMultiplier = 0.35;

  const velocityPoints = Math.min(35, Math.round(storyCount * 10 * freshnessMultiplier));

  // 2. Cross-Source Breadth (0 - 35 points): Outlets & multi-platform spread
  const uniquePublishers = new Set<string>();
  let hasSocial = false;
  allSources.forEach((s) => {
    if (s.name) uniquePublishers.add(s.name.toLowerCase());
    if (s.name?.toLowerCase().includes("reddit") || s.url?.includes("reddit.com") || s.url?.includes("bsky.app")) {
      hasSocial = true;
    }
  });

  const breadthCount = uniquePublishers.size;
  const breadthPoints = Math.min(
    35,
    Math.round(breadthCount * 7 + (hasSocial ? 8 : 0))
  );

  // 3. User Affinity (0 - 30 points)
  const affinityPoints = Math.round(weight * 30);

  // 4. Decay (0 - 25 points deducted)
  const decayPoints = diffHours > 24 ? Math.min(25, Math.round((diffHours - 24) * 0.45)) : 0;

  // Composite Event Gravity Score (0 - 100)
  const gravity_score = Math.max(
    10,
    Math.min(100, Math.round(velocityPoints + breadthPoints + affinityPoints - decayPoints))
  );

  // Determine Lifecycle Phase
  let lifecycle_phase: EventTopicLifecyclePhase = "spawning";
  let lifecycle_label = "🚀 Spawning";

  if (diffHours >= 72 || (diffHours >= 48 && storyCount <= 1)) {
    lifecycle_phase = "cooling";
    lifecycle_label = "💤 Cooling Off";
  } else if (diffHours >= 18 || (storyCount >= 2 && breadthCount >= 2 && diffHours >= 8 && gravity_score < 75)) {
    lifecycle_phase = "maturing";
    lifecycle_label = "📊 Consolidating Sentiment";
  } else if (diffHours < 18 && (storyCount >= 2 || breadthCount >= 2 || gravity_score >= 70)) {
    lifecycle_phase = "escalating";
    lifecycle_label = "🔥 Rapid Influx";
  } else {
    lifecycle_phase = "spawning";
    lifecycle_label = "🚀 Spawning";
  }

  // Momentum Trend
  let momentum_trend: "surging" | "rising" | "steady" | "cooling" = "steady";
  if (gravity_score >= 75 && (lifecycle_phase === "escalating" || diffHours < 6)) {
    momentum_trend = "surging";
  } else if (gravity_score >= 50 || lifecycle_phase === "spawning") {
    momentum_trend = "rising";
  } else if (lifecycle_phase === "cooling" || gravity_score < 30) {
    momentum_trend = "cooling";
  } else {
    momentum_trend = "steady";
  }

  return {
    gravity_score,
    lifecycle_phase,
    lifecycle_label,
    momentum_trend,
    cross_source_breadth: breadthCount,
  };
}

/**
 * Builds aggregated Topic Briefs grouping stories, verified development highlights,
 * update velocity indicators, and source citations by user interest topics.
 */
export function buildTopicBriefs(
  cards: SynthesizedEventCard[] = [],
  userNode?: UnifiedTopicNode | null,
  seenState?: SeenInteractionState
): TopicBrief[] {
  const userTopics = userNode?.topics || {};
  const topicMap = new Map<string, SynthesizedEventCard[]>();

  // 1. Group raw user topics into canonical entities so splinter/synonym topics don't produce duplicate cards
  const canonicalUserTopicMap = new Map<string, string>(); // alias -> canonical
  const canonicalTopics: string[] = [];

  const rawUserTopicKeys = Object.keys(userTopics);
  for (const key of rawUserTopicKeys) {
    let matchedCanonical: string | null = null;
    for (const c of canonicalTopics) {
      const t1 = key.toLowerCase().replace(/[^a-z0-9]/g, " ").trim().split(/\s+/).filter((w) => w.length > 2);
      const t2 = c.toLowerCase().replace(/[^a-z0-9]/g, " ").trim().split(/\s+/).filter((w) => w.length > 2);
      const intersection = t1.filter((w) => t2.includes(w)).length;
      const overlap = intersection / Math.min(t1.length, t2.length);
      if (overlap >= 0.5) {
        matchedCanonical = c;
        break;
      }
    }
    if (matchedCanonical) {
      canonicalUserTopicMap.set(key, matchedCanonical);
    } else {
      canonicalTopics.push(key);
      canonicalUserTopicMap.set(key, key);
    }
  }

  // Initialize buckets for all canonical user topics
  canonicalTopics.forEach((topic) => {
    topicMap.set(topic, []);
  });

  // 2. Map feed cards into their most relevant topic buckets
  cards.forEach((card) => {
    if (!card || !card.topic) return;
    const cardTopicLower = card.topic.toLowerCase().trim();

    // Reject epistemic / cognitive reasoning meta-topics
    if (
      cardTopicLower.includes("evidence evaluation") ||
      cardTopicLower.includes("critical thinking") ||
      cardTopicLower.includes("methodology")
    ) {
      return;
    }

    let matchedBucket: string | null = null;

    // Check alias map first
    for (const [rawKey, canon] of canonicalUserTopicMap.entries()) {
      if (cardTopicLower === rawKey.toLowerCase().trim()) {
        matchedBucket = canon;
        break;
      }
    }

    // Check direct matching against canonical topics
    if (!matchedBucket) {
      for (const topic of canonicalTopics) {
        if (cardTopicLower === topic.toLowerCase()) {
          matchedBucket = topic;
          break;
        }
      }
    }

    // If no direct match, run semantic affinity scoring against canonical topics
    if (!matchedBucket && canonicalTopics.length > 0) {
      let highestScore = 0;
      for (const topic of canonicalTopics) {
        const match = calculateSemanticAffinity(card, topic, userNode);
        if (match.is_match && match.score > highestScore) {
          highestScore = match.score;
          matchedBucket = topic;
        }
      }
    }

    // Check existing dynamic buckets (if any)
    if (!matchedBucket) {
      let highestScore = 0;
      for (const [bucketTopic] of topicMap.entries()) {
        if (canonicalTopics.includes(bucketTopic)) continue;
        if (cardTopicLower === bucketTopic.toLowerCase()) {
          matchedBucket = bucketTopic;
          break;
        }
        const match = calculateSemanticAffinity(card, bucketTopic, userNode);
        if (match.is_match && match.score > highestScore) {
          highestScore = match.score;
          matchedBucket = bucketTopic;
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
    // Only keep buckets with stories or explicit user topics
    if (matchedCards.length === 0 && !canonicalTopics.includes(topic)) continue;

    // Filter out dynamic buckets with low count if user has active topics
    if (canonicalTopics.length > 0 && !canonicalTopics.includes(topic) && matchedCards.length < 2) {
      continue;
    }

    const topicMeta = userTopics[topic];
    let weight = topicMeta?.weight !== undefined ? topicMeta.weight : 0.65;
    for (const [alias, canon] of canonicalUserTopicMap.entries()) {
      if (canon === topic && userTopics[alias]?.weight !== undefined) {
        weight = Math.max(weight, userTopics[alias].weight);
      }
    }

    // Step A: Deduplicate syndicated stories covering identical events
    const deduplicatedCards = deduplicateStories(matchedCards);

    // Step B: Sort deduplicated cards by publication date descending
    const sortedCards = [...deduplicatedCards].sort((a, b) => {
      const timeA = new Date(a.published_at || 0).getTime();
      const timeB = new Date(b.published_at || 0).getTime();
      return timeB - timeA;
    });

    // Step B2: Count unseen stories in this topic
    const unseenCards = sortedCards.filter((c) => !seenState?.seen_story_ids?.[c.event_id]);
    const unseenCount = unseenCards.length;

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
        velocityLabel = `🔥 Trending · ${sortedCards.length} update${sortedCards.length > 1 ? "s" : ""} in 24h`;
        timeAgoLabel = `${Math.round(diffHours)}h ago`;
      } else if (diffHours < 72) {
        velocityStatus = "recent";
        velocityLabel = `📈 Developing · ${sortedCards.length} update${sortedCards.length > 1 ? "s" : ""} this week`;
        timeAgoLabel = `${Math.round(diffHours / 24)}d ago`;
      } else if (diffHours < 24 * 7) {
        velocityStatus = "steady";
        const days = Math.round(diffHours / 24);
        velocityLabel = `☕ Quiet lately · ${days}d since last update`;
        timeAgoLabel = `${days}d ago`;
      } else {
        velocityStatus = "dormant";
        const days = Math.round(diffHours / 24);
        velocityLabel = `💤 Dormant · ${days}d since last update`;
        timeAgoLabel = `${days}d ago`;
      }
    } else {
      velocityStatus = "dormant";
      velocityLabel = "☕ Quiet lately · Checking for updates";
      timeAgoLabel = "No recent stories";
    }

    // Step C: Build deduplicated development highlights ("Recent Stories")
    // Prioritize genuine journalistic reporting stories over generic portal or source hubs,
    // and exclude raw microblogging / social media posts (X, Reddit, Bluesky, Threads)
    // from the primary "Recent Stories" feed unless no journalistic coverage exists.
    const journalisticCards = sortedCards.filter((card) => {
      const primaryUrl = card.sources?.[0]?.url || "";
      const isStory = StoryDiscoveryEngine.classifyWebResource(primaryUrl, card.headline) === "story";
      const isSocial = StoryDiscoveryEngine.isSocialMediaResource(primaryUrl);
      return isStory && !isSocial;
    });

    // Filter for actual recency (< 45 days old) relative to current time or latest topic update
    const recentJournalisticCards = journalisticCards.filter((card) => {
      const pubTime = new Date(card.published_at || "").getTime();
      if (isNaN(pubTime) || pubTime === 0) return true;
      const ageDays = (now - pubTime) / (1000 * 60 * 60 * 24);
      return ageDays <= 45;
    });

    const cardsForHighlights =
      recentJournalisticCards.length > 0
        ? recentJournalisticCards
        : journalisticCards.length > 0
        ? journalisticCards
        : sortedCards.filter((c) => {
            const pub = new Date(c.published_at || "").getTime();
            if (isNaN(pub) || pub === 0) return true;
            return (now - pub) / (1000 * 60 * 60 * 24) <= 45;
          });

    const keyHighlights = cardsForHighlights.slice(0, 4).map((card) => ({
      event_id: card.event_id,
      headline: card.headline,
      summary: card.summary,
      facts: card.fact_bullets || [],
      recency_label: card.recency_label || "Recent",
      published_at: card.published_at || new Date().toISOString(),
      image_url: card.image_url,
      sources: card.sources || [],
      is_fresh: !seenState?.seen_story_ids?.[card.event_id],
    }));

    // Step D: Synthesize narrative update with sentence-level story links
    const { sentences: narrativeSentences, fullText: narrativeFullText } = synthesizeBriefNarrative(
      topic,
      sortedCards,
      topicMeta
    );

    // Step E: Collect all distinct corroborating sources
    const sourceMap = new Map<string, EventSourceArticle>();
    sortedCards.forEach((c) => {
      c.sources?.forEach((s) => {
        if (!sourceMap.has(s.name)) {
          sourceMap.set(s.name, s);
        }
      });
    });
    const allSources = Array.from(sourceMap.values());

    // Step F: Calculate Event Gravity Score & Lifecycle State Machine
    const {
      gravity_score,
      lifecycle_phase,
      lifecycle_label,
      momentum_trend,
      cross_source_breadth,
    } = calculateEventGravity(sortedCards, weight, allSources, diffHours);

    // Step G: Extract Narrative Layers (Sentiment, Historical Arc, Dynamic Sections)
    const publicSentiment = synthesizePublicSentiment(sortedCards, allSources);
    const historicalArc = buildHistoricalArc(sortedCards, topicMeta, now);

    // Step H: Synthesize Dynamic Presentation Sections (LLM-Designed / Deterministic Fallback)
    const localDesign = TopicBriefSynthesizer.synthesizeLocalDeterministic(
      topic,
      sortedCards,
      allSources,
      topicMeta?.technical_depth || "practitioner",
      topicMeta?.curiosity_vectors || []
    );

    // Clean, natural executive summary ("What's Happening Now")
    const currentFocus = localDesign.executive_take;

    // The brief title represents the monitored topic/subject, NEVER an individual news article headline.
    const monitoredTopicTitle = deriveMonitoredTopicTitle(topic, sortedCards);
    const parentInterest = deriveParentInterest(topic, sortedCards, userNode);

    const briefId = `brief_${topic.toLowerCase().replace(/[^a-z0-9]/g, "_")}_${now}`;

    briefs.push({
      id: briefId,
      topic,
      title: monitoredTopicTitle,
      parent_interest: parentInterest,
      weight,
      technical_depth: topicMeta?.technical_depth || "practitioner",
      why_they_care: "Core domain interest tracked in epistemic model.",
      living_narrative: localDesign.executive_take,
      likes_and_angles: topicMeta?.likes_and_angles || [],
      dislikes_and_critiques: topicMeta?.dislikes_and_critiques || [],
      curiosity_vectors: topicMeta?.curiosity_vectors || [topic],
      evolution_timeline: [],
      last_updated: new Date(latestPubTime).toISOString(),
      time_ago_label: timeAgoLabel,
      velocity_status: velocityStatus,
      velocity_label: velocityLabel,
      lifecycle_phase,
      lifecycle_label,
      gravity_score,
      momentum_trend,
      cross_source_breadth,
      current_focus: currentFocus,
      public_sentiment: publicSentiment,
      historical_arc: historicalArc,
      llm_design: localDesign,
      dynamic_sections: localDesign.sections,
      executive_take: localDesign.executive_take,
      story_count: sortedCards.length,
      unseen_count: unseenCount,
      stories: sortedCards,
      key_highlights: keyHighlights,
      narrative_sentences: narrativeSentences,
      narrative_full_text: narrativeFullText,
      all_sources: allSources,
    });
  }

  // Sort briefs:
  // 1. Recency & Velocity status (Active & Breaking first, Dormant/Ancient strictly last)
  // 2. Freshness timestamp (latestPubTime descending)
  // 3. Unseen stories (within the same recency band)
  // 4. Event Gravity Score
  // 5. Weight
  return briefs.sort((a, b) => {
    // Priority 1: Velocity rank (Active/Breaking always beats Dormant)
    const velocityRank = { breaking: 5, active: 4, recent: 3, steady: 2, dormant: 1 };
    const rankDiff = velocityRank[b.velocity_status] - velocityRank[a.velocity_status];
    if (rankDiff !== 0) return rankDiff;

    // Priority 2: Recency timestamp (newest first)
    const timeA = new Date(a.last_updated).getTime();
    const timeB = new Date(b.last_updated).getTime();
    const timeDiff = timeB - timeA;
    if (Math.abs(timeDiff) > 12 * 60 * 60 * 1000) {
      return timeDiff;
    }

    // Priority 3: Fresh unseen story presence (within same recency band)
    const unseenDiff = (b.unseen_count || 0) - (a.unseen_count || 0);
    if (Math.abs(unseenDiff) >= 1) return unseenDiff;

    // Priority 4: Event Gravity Score
    const gravityDiff = b.gravity_score - a.gravity_score;
    if (Math.abs(gravityDiff) >= 3) return gravityDiff;

    // Priority 5: Weight
    const weightDiff = b.weight - a.weight;
    if (Math.abs(weightDiff) > 0.1) return weightDiff;

    return b.story_count - a.story_count;
  });
}

/**
 * Derives a clean, subject-level monitored topic title.
 * A monitored topic is an ongoing entity, release track, or subject (e.g. "Full Self-Driving 14.3.8"
 * or "Tesla FSD Value Proposition"), NEVER an individual news article's headline.
 */
export function deriveMonitoredTopicTitle(
  topic: string,
  cards: SynthesizedEventCard[] = []
): string {
  let cleanTopic = topic.trim();

  // If topic looks like an entire sentence or full news headline (> 65 chars with punctuation),
  // extract the core entity or subject phrase rather than displaying a sentence headline.
  if (cleanTopic.length > 65) {
    const firstEntity = cards[0]?.verified_entities?.[0];
    if (firstEntity && firstEntity.length > 3 && firstEntity.length <= 50) {
      cleanTopic = firstEntity;
    } else {
      const parts = cleanTopic.split(/[:—–-]/);
      cleanTopic = parts[0].trim();
    }
  }

  return cleanTopic;
}

/**
 * Derives the overarching parent domain/interest for a monitored topic.
 */
export function deriveParentInterest(
  topic: string,
  cards: SynthesizedEventCard[] = [],
  userNode?: UnifiedTopicNode | null
): string {
  // 1. If cards have an explicit topic category from ingestion, prioritize it as the parent domain
  const category = cards.find((c) => (c as any).topic_category)?.["topic_category" as keyof SynthesizedEventCard];
  if (category && typeof category === "string" && category.trim().length > 0) {
    return category.trim();
  }

  // 2. Check if user's interest graph has an overarching domain that encapsulates this topic
  if (userNode?.topics) {
    const userTopics = Object.keys(userNode.topics);
    for (const ut of userTopics) {
      if (ut !== topic && ut.length < topic.length && topic.toLowerCase().includes(ut.toLowerCase())) {
        return ut;
      }
    }
  }

  return topic;
}


