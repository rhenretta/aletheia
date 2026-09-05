import { SynthesizedEventCard, UnifiedTopicNode } from "@/core/types/contracts";

export interface SemanticMatchResult {
  is_match: boolean;
  score: number; // 0.0 to 1.0
  matched_concepts: string[];
  match_rationale?: string;
}

// Stopwords to filter out noise
const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for", "with",
  "by", "about", "against", "between", "into", "through", "during", "before",
  "after", "above", "below", "from", "up", "down", "of", "off", "over", "under",
  "again", "further", "then", "once", "here", "there", "when", "where", "why",
  "how", "all", "any", "both", "each", "few", "more", "most", "other", "some",
  "such", "no", "nor", "not", "only", "own", "same", "so", "than", "too", "very",
  "s", "t", "can", "will", "just", "don", "should", "now", "is", "are", "was",
  "were", "be", "been", "being", "have", "has", "had", "having", "do", "does",
  "did", "doing"
]);

// Domain Knowledge Ontologies for common high-signal epistemic domains
const DOMAIN_ONTOLOGIES: Record<string, string[]> = {
  "starship": ["spacex", "super heavy", "booster", "raptor", "starbase", "boca chica", "orbital", "launch", "heat shield", "catch tower", "faa"],
  "spacex": ["starship", "falcon 9", "falcon heavy", "dragon", "starlink", "super heavy", "elon musk", "hawthorne", "starbase", "cape canaveral", "vandenberg"],
  "spaceflight regulation": ["faa", "licensing", "environmental review", "fcc", "orbital debris", "compliance", "policy", "regulator", "airspace", "safety", "approval", "launch license", "national airspace"],
  "regulation": ["policy", "compliance", "antitrust", "ftc", "sec", "faa", "eu", "directive", "court", "ruling", "statute", "enforcement", "oversight"],
  "artificial intelligence": ["ai", "llm", "neural network", "transformer", "deep learning", "inference", "training", "gpu", "compute", "agent", "reasoning", "benchmark", "anthropic", "openai", "deepseek", "meta", "gemini", "nvidia"],
  "ai": ["artificial intelligence", "llm", "neural", "gpu", "inference", "deepseek", "anthropic", "openai", "agent", "transformer", "model", "training", "compute", "nvidia"],
  "semiconductors": ["tsmc", "nvidia", "intel", "amd", "asml", "euv", "lithography", "packaging", "chips", "wafer", "foundry", "gpu", "arm"],
  "biotechnology": ["crispr", "mrna", "genomics", "clinical trial", "fda", "therapeutics", "oncology", "antibody", "gene therapy", "protein folding"],
  "quantum computing": ["qubit", "superconducting", "ion trap", "quantum advantage", "coherence", "error correction", "quantum algorithm"],
  "energy": ["nuclear", "fusion", "solar", "battery", "grid", "smr", "fission", "geothermal", "storage", "megawatt", "clean energy"]
};

/**
 * Tokenize and normalize text into meaningful n-grams and concept stems
 */
export function extractConceptTokens(text: string): string[] {
  if (!text) return [];
  const clean = text
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const words = clean.split(" ").filter((w) => w.length > 2 && !STOPWORDS.has(w));
  const bigrams: string[] = [];
  for (let i = 0; i < words.length - 1; i++) {
    bigrams.push(`${words[i]} ${words[i + 1]}`);
  }

  return Array.from(new Set([...words, ...bigrams]));
}

/**
 * Domain-agnostic detection of acronym or initialism equivalence between two topic strings.
 * Evaluates whether one term represents an abbreviation/acronym of the other (e.g., "Tesla FSD" vs "Tesla Full Self-Driving",
 * "US FDA" vs "US Food and Drug Administration", "WHO" vs "World Health Organization").
 */
export function isAcronymEquivalent(a: string, b: string): boolean {
  if (!a || !b) return false;

  // 1. Check parenthetical expressions, e.g. "Topic Name (ACR)" vs "Topic Name" or "Topic ACR"
  const extractParen = (str: string) => {
    const match = str.match(/\(([^)]+)\)/);
    const without = str.replace(/\([^)]*\)/g, "").replace(/\s+/g, " ").trim();
    return {
      inside: match ? match[1].trim() : null,
      outside: without,
    };
  };

  const parenA = extractParen(a);
  const parenB = extractParen(b);

  if (parenA.inside || parenB.inside) {
    const cleanOutA = parenA.outside || a;
    const cleanOutB = parenB.outside || b;
    if (isAcronymEquivalent(cleanOutA, cleanOutB)) return true;

    if (parenA.inside) {
      if (isAcronymEquivalent(parenA.inside, b) || isAcronymEquivalent(parenA.inside, cleanOutB)) return true;
      const firstWordA = cleanOutA.trim().split(/\s+/)[0];
      if (firstWordA && isAcronymEquivalent(`${firstWordA} ${parenA.inside}`, b)) return true;
    }
    if (parenB.inside) {
      if (isAcronymEquivalent(a, parenB.inside) || isAcronymEquivalent(cleanOutA, parenB.inside)) return true;
      const firstWordB = cleanOutB.trim().split(/\s+/)[0];
      if (firstWordB && isAcronymEquivalent(a, `${firstWordB} ${parenB.inside}`)) return true;
    }
  }

  const cleanWords = (str: string) =>
    str
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .trim()
      .split(/\s+/)
      .filter(Boolean);

  const normA = cleanWords(a);
  const normB = cleanWords(b);
  if (normA.length === 0 || normB.length === 0) return false;
  if (normA.join(" ") === normB.join(" ")) return true;

  const filterStop = (words: string[]) => words.filter((w) => !STOPWORDS.has(w));
  const getAcronym = (words: string[]) => filterStop(words).map((w) => w[0]).join("");

  const filteredA = filterStop(normA);
  const filteredB = filterStop(normB);

  // Direct full-term acronym match (e.g. "fsd" vs "full self-driving")
  if (filteredA.length === 1 && filteredA[0].length >= 2 && filteredA[0] === getAcronym(normB)) return true;
  if (filteredB.length === 1 && filteredB[0].length >= 2 && filteredB[0] === getAcronym(normA)) return true;

  // Compound acronym with shared common words (e.g. "tesla fsd" vs "tesla full self-driving")
  const [shorter, longer] = normA.length <= normB.length ? [normA, normB] : [normB, normA];
  const commonWords = shorter.filter((w) => longer.includes(w));
  if (commonWords.length > 0) {
    const remShorter = filterStop(shorter.filter((w) => !commonWords.includes(w)));
    const remLonger = filterStop(longer.filter((w) => !commonWords.includes(w)));

    if (remShorter.length === 1 && remLonger.length >= 2 && getAcronym(remLonger) === remShorter[0]) {
      return true;
    }
    if (remLonger.length === 1 && remShorter.length >= 2 && getAcronym(remShorter) === remLonger[0]) {
      return true;
    }
    // Sub-phrase acronym matching when remaining longer contains prefix matching remShorter
    if (remShorter.length === 1 && remLonger.length >= 2) {
      for (let len = 2; len <= remLonger.length; len++) {
        if (getAcronym(remLonger.slice(0, len)) === remShorter[0]) return true;
      }
    }
  }

  // Prefix phrase containment (e.g. "Tesla Full Self-Driving" vs "Tesla Full Self-Driving current status and developments")
  const [shorterF, longerF] = filteredA.length <= filteredB.length ? [filteredA, filteredB] : [filteredB, filteredA];
  if (shorterF.length >= 2 && longerF.length > shorterF.length) {
    const isPrefix = shorterF.every((w, idx) => longerF[idx] === w);
    if (isPrefix) {
      const ratio = shorterF.length / longerF.length;
      if (ratio >= 0.4) return true;
    }
  }

  return false;
}

/**
 * Construct the full Semantic Concept Sphere for a given target topic,
 * incorporating user knowledge graph nodes, curiosity vectors, and domain ontologies.
 */
export function buildTopicSemanticSphere(
  targetTopic: string,
  userNode?: UnifiedTopicNode | null
): {
  primary_tokens: Set<string>;
  expanded_concepts: Set<string>;
  related_entities: Set<string>;
} {
  const primaryTokens = new Set<string>();
  const expandedConcepts = new Set<string>();
  const relatedEntities = new Set<string>();

  const normalizedTarget = targetTopic.toLowerCase().trim();
  extractConceptTokens(normalizedTarget).forEach((t) => primaryTokens.add(t));
  primaryTokens.add(normalizedTarget);

  // Domain-agnostically extract subphrase initials as acronym tokens into primary_tokens
  const cleanTargetWords = normalizedTarget
    .replace(/[^a-z0-9\s]/g, " ")
    .trim()
    .split(/\s+/)
    .filter((w) => !STOPWORDS.has(w));
  if (cleanTargetWords.length >= 2) {
    primaryTokens.add(cleanTargetWords.map((w) => w[0]).join(""));
    if (cleanTargetWords.length >= 3) {
      primaryTokens.add(cleanTargetWords.slice(1).map((w) => w[0]).join(""));
    }
  }

  // 1. Check Domain Ontologies
  for (const [key, synonyms] of Object.entries(DOMAIN_ONTOLOGIES)) {
    if (normalizedTarget.includes(key) || key.includes(normalizedTarget)) {
      synonyms.forEach((s) => expandedConcepts.add(s.toLowerCase()));
    }
  }

  // 2. Extract from User Knowledge Graph if present
  if (userNode?.topics) {
    for (const [topicName, meta] of Object.entries(userNode.topics)) {
      const lowerName = topicName.toLowerCase();
      const isTarget = lowerName === normalizedTarget || lowerName.includes(normalizedTarget) || normalizedTarget.includes(lowerName);

      if (isTarget) {
        // Add curiosity vectors
        (meta.curiosity_vectors || []).forEach((vec) => {
          extractConceptTokens(vec).forEach((tok) => expandedConcepts.add(tok));
        });

        // Add why_they_care concepts
        if (meta.why_they_care) {
          extractConceptTokens(meta.why_they_care).forEach((tok) => expandedConcepts.add(tok));
        }
      }
    }
  }

  // 3. Extract connected bridges and frontiers
  if (userNode?.adjacent_curiosity_frontiers) {
    userNode.adjacent_curiosity_frontiers.forEach((f) => {
      const isConnected =
        f.connected_to?.some((c) => c.toLowerCase().includes(normalizedTarget) || normalizedTarget.includes(c.toLowerCase())) ||
        f.topic.toLowerCase().includes(normalizedTarget);

      if (isConnected) {
        expandedConcepts.add(f.topic.toLowerCase());
        extractConceptTokens(f.rationale).forEach((tok) => expandedConcepts.add(tok));
      }
    });
  }

  if (userNode?.interest_intersections) {
    userNode.interest_intersections.forEach((inter) => {
      const matchesA = inter.interest_a.toLowerCase().includes(normalizedTarget);
      const matchesB = inter.interest_b.toLowerCase().includes(normalizedTarget);
      if (matchesA || matchesB) {
        expandedConcepts.add(inter.intersection_theme.toLowerCase());
        extractConceptTokens(inter.hypothesis).forEach((tok) => expandedConcepts.add(tok));
      }
    });
  }

  return {
    primary_tokens: primaryTokens,
    expanded_concepts: expandedConcepts,
    related_entities: relatedEntities,
  };
}

/**
 * Score semantic affinity between a SynthesizedEventCard and a target topic
 */
export function calculateSemanticAffinity(
  card: SynthesizedEventCard,
  targetTopic: string,
  userNode?: UnifiedTopicNode | null
): SemanticMatchResult {
  if (!targetTopic || targetTopic.toLowerCase() === "all") {
    return {
      is_match: true,
      score: 1.0,
      matched_concepts: ["all"],
      match_rationale: "All Topics selected",
    };
  }

  const sphere = buildTopicSemanticSphere(targetTopic, userNode);
  const matchedConcepts = new Set<string>();

  let score = 0.0;
  const rationaleParts: string[] = [];

  const cardTopicLower = (card.topic || "").toLowerCase().trim();
  const normalizedTarget = targetTopic.toLowerCase().trim();

  // 1. Direct Topic Label Alignment (Weight: 0.50)
  if (cardTopicLower === normalizedTarget || isAcronymEquivalent(cardTopicLower, normalizedTarget)) {
    score += 0.50;
    matchedConcepts.add(card.topic);
    rationaleParts.push(`Exact or acronym topic match: "${card.topic}"`);
  } else if (cardTopicLower.includes(normalizedTarget) || normalizedTarget.includes(cardTopicLower)) {
    score += 0.40;
    matchedConcepts.add(card.topic);
    rationaleParts.push(`Topic overlap: "${card.topic}"`);
  }

  // 2. Headline Semantic Analysis (Weight: 0.35)
  const headlineTokens = extractConceptTokens(card.headline);
  let headlineHits = 0;
  for (const token of headlineTokens) {
    if (sphere.primary_tokens.has(token)) {
      score += 0.15;
      headlineHits++;
      matchedConcepts.add(token);
    } else if (sphere.expanded_concepts.has(token)) {
      score += 0.08;
      headlineHits++;
      matchedConcepts.add(token);
    }
  }
  if (headlineHits > 0) {
    rationaleParts.push(`Headline mentions ${headlineHits} target concepts`);
  }

  // 3. Verified Entities Overlap (Weight: 0.25)
  let entityHits = 0;
  for (const entity of card.verified_entities || []) {
    const entityLower = entity.toLowerCase();
    const entityTokens = extractConceptTokens(entityLower);

    for (const token of entityTokens) {
      if (sphere.primary_tokens.has(token) || sphere.expanded_concepts.has(token) || sphere.primary_tokens.has(entityLower)) {
        score += 0.12;
        entityHits++;
        matchedConcepts.add(entity);
        break;
      }
    }
  }
  if (entityHits > 0) {
    rationaleParts.push(`Verified entities: ${Array.from(matchedConcepts).slice(0, 3).join(", ")}`);
  }

  // 4. Summary & Fact Bullets Semantic Depth (Weight: 0.20)
  const bodyText = `${card.summary || ""} ${(card.fact_bullets || []).join(" ")}`;
  const bodyTokens = extractConceptTokens(bodyText);
  let bodyHits = 0;
  for (const token of bodyTokens) {
    if (sphere.primary_tokens.has(token)) {
      score += 0.04;
      bodyHits++;
      matchedConcepts.add(token);
    } else if (sphere.expanded_concepts.has(token)) {
      score += 0.02;
      bodyHits++;
      matchedConcepts.add(token);
    }
  }

  // 5. Anchor Concept & Discovery Category Synergy (Weight: 0.15)
  if (card.anchor_concept) {
    const anchorLower = card.anchor_concept.toLowerCase();
    if (sphere.primary_tokens.has(anchorLower) || sphere.expanded_concepts.has(anchorLower)) {
      score += 0.15;
      matchedConcepts.add(card.anchor_concept);
      rationaleParts.push(`Anchor concept: "${card.anchor_concept}"`);
    }
  }

  // Normalize final score to [0.0, 1.0]
  const finalScore = Math.min(1.0, Math.round(score * 100) / 100);
  const isMatch = finalScore >= 0.20; // Semantic matching threshold

  return {
    is_match: isMatch,
    score: finalScore,
    matched_concepts: Array.from(matchedConcepts),
    match_rationale: rationaleParts.length > 0 ? rationaleParts.join(" • ") : undefined,
  };
}

export interface SeenInteractionState {
  seen_story_ids?: Record<string, { last_seen_at: string; impressions: number }>;
  seen_topics?: Record<string, { last_seen_at: string; impressions: number }>;
}

export interface FreshnessMetadata {
  freshness_score: number;
  is_fresh: boolean;
  impression_count: number;
  hours_since_seen?: number;
}

/**
 * Calculates freshness score for an individual story card based on publication time and user impression history.
 */
export function calculateFreshnessScore(
  card: SynthesizedEventCard,
  seenState?: SeenInteractionState
): FreshnessMetadata {
  const publishedAt = card.published_at ? new Date(card.published_at).getTime() : Date.now();
  const hoursSincePublished = Math.max(0, (Date.now() - publishedAt) / (1000 * 60 * 60));
  
  // Publication recency score (decays over 72 hours)
  const publicationScore = Math.max(0, 1 - hoursSincePublished / 72);

  const seenInfo = seenState?.seen_story_ids?.[card.event_id];
  const topicSeenInfo = card.topic ? seenState?.seen_topics?.[card.topic.toLowerCase()] : undefined;

  if (!seenInfo) {
    // Unseen story: Gets maximum freshness boost!
    const topicPenalty = topicSeenInfo ? Math.min(0.25, (topicSeenInfo.impressions || 0) * 0.03) : 0;
    const finalScore = Number((1.2 + publicationScore * 0.5 - topicPenalty).toFixed(3));
    return {
      freshness_score: finalScore,
      is_fresh: true,
      impression_count: 0,
    };
  }

  // Seen story: calculate decay based on impressions and recency
  const lastSeenAt = new Date(seenInfo.last_seen_at).getTime();
  const hoursSinceSeen = Math.max(0, (Date.now() - lastSeenAt) / (1000 * 60 * 60));
  const impressions = seenInfo.impressions || 1;

  // Seen penalty is highest immediately after seeing and scales with impressions
  const seenDecay = Math.min(1.0, hoursSinceSeen / 48); // 0.0 right after seen, 1.0 after 48h
  const impressionPenalty = Math.min(0.9, impressions * 0.3);
  
  const finalScore = Number(((publicationScore * 0.4) + (seenDecay * 0.3) - impressionPenalty).toFixed(3));

  return {
    freshness_score: finalScore,
    is_fresh: false,
    impression_count: impressions,
    hours_since_seen: hoursSinceSeen,
  };
}

/**
 * Filter and rank a list of feed cards by Semantic Affinity and Freshness / Recency
 */
export function filterFeedBySemanticAffinity(
  cards: SynthesizedEventCard[],
  targetTopic: string,
  userNode?: UnifiedTopicNode | null,
  categoryFilter: string = "all",
  seenState?: SeenInteractionState
): Array<SynthesizedEventCard & { semantic_score: number; freshness_score: number; is_fresh: boolean; semantic_match_reason?: string }> {
  if (!cards || cards.length === 0) return [];

  return cards
    .map((card) => {
      const match = calculateSemanticAffinity(card, targetTopic, userNode);
      const freshness = calculateFreshnessScore(card, seenState);
      return {
        ...card,
        semantic_score: match.score,
        freshness_score: freshness.freshness_score,
        is_fresh: freshness.is_fresh,
        semantic_match_reason: match.match_rationale,
        _is_semantic_match: match.is_match,
      };
    })
    .filter((card) => {
      // 1. Semantic Topic Match
      if (targetTopic !== "all" && !card._is_semantic_match) {
        return false;
      }

      // 2. Category Filter Match
      if (categoryFilter === "all") return true;
      if (categoryFilter === "curiosity_frontier") {
        return card.discovery_category === "curiosity_frontier" || card.is_exploration;
      }
      if (categoryFilter === "thematic_intersection") {
        return card.discovery_category === "thematic_intersection";
      }
      if (categoryFilter === "revealed_preference") {
        return card.discovery_category === "revealed_preference" || !card.discovery_category;
      }
      return true;
    })
    .sort((a, b) => {
      // Sort priority:
      // 1. If filtering by specific topic: combine freshness and semantic score
      if (targetTopic !== "all") {
        const scoreA = a.freshness_score * 0.6 + a.semantic_score * 0.4;
        const scoreB = b.freshness_score * 0.6 + b.semantic_score * 0.4;
        return scoreB - scoreA;
      }
      // 2. General feed: Sort by freshness so unseen stories always surface first
      return b.freshness_score - a.freshness_score;
    });
}
