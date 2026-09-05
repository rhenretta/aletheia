import { RawArticle, PureFactObject, DisputedClaim, TimelineItem, PureFactObjectSchema, generateTopicId } from "../../types/contracts";

/**
 * List of loaded emotional and subjective adjectives/adverbs commonly found in polarized journalism
 */
const EMOTIVE_TERMS = [
  "shockingly", "disastrous", "furious", "unhinged", "monstrous", "scandalous",
  "ruthless", "triumphant", "radical", "extremist", "corrupt", "brazen",
  "disgraceful", "catastrophic", "hypocritical", "stunning", "devastating",
  "heroic", "cowardly", "sinister", "draconian", "tyrannical", "grotesque",
  "outrageous", "spectacular", "abysmal", "shameless", "vicious", "pathetic",
  "insidious", "treacherous", "apocalyptic", "masterclass", "jaw-dropping"
];

export class BiasStripper {
  /**
   * Calculates the density of emotive adjectives/adverbs in a given text
   */
  public static calculateAdjectiveDensity(text: string): number {
    const words = text.toLowerCase().match(/[a-z]+/g) || [];
    if (words.length === 0) return 0;

    let emotiveCount = 0;
    for (const word of words) {
      if (EMOTIVE_TERMS.includes(word) || word.endsWith("ly") || word.endsWith("ous") || word.endsWith("ful")) {
        emotiveCount++;
      }
    }
    return Math.min(1.0, Number((emotiveCount / words.length).toFixed(4)));
  }

  /**
   * Identifies extracted key entities from source text
   */
  public static extractEntities(articles: RawArticle[]): string[] {
    const entitySet = new Set<string>();
    const pattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g;

    for (const article of articles) {
      const matches = article.raw_text.match(pattern) || [];
      for (const m of matches) {
        if (m.length > 3 && !EMOTIVE_TERMS.includes(m.toLowerCase())) {
          entitySet.add(m);
        }
      }
    }

    return Array.from(entitySet).slice(0, 8);
  }

  /**
   * Sanitizes a sentence by removing hyper-partisan framing or leading rhetorical filler
   */
  public static sanitizeText(sentence: string): string {
    let sanitized = sentence.replace(/\b(Obviously|Clearly|Unsurprisingly|As expected|Everyone knows|Without doubt),?\s*/gi, "");

    for (const term of EMOTIVE_TERMS) {
      const regex = new RegExp(`\\b${term}\\b`, "gi");
      sanitized = sanitized.replace(regex, "");
    }

    return sanitized
      .replace(/\s+/g, " ")
      .replace(/\s+([.,;:!?])/g, "$1")
      .replace(/([.,;:!?])\s*\1+/g, "$1")
      .trim();
  }

  /**
   * Synthesizes cross-ideological facts and flags disputed claims
   */
  public static processArticles(
    topic: string,
    articles: RawArticle[],
    eventId: string = `evt_${Date.now()}`,
    topicId?: string
  ): PureFactObject {
    if (!articles || articles.length === 0) {
      throw new Error("Cannot process epistemology delta on empty article set.");
    }

    const verifiedEntities = BiasStripper.extractEntities(articles);
    const agreedFacts: string[] = [];
    const disputedClaims: DisputedClaim[] = [];
    const timeline: TimelineItem[] = [];

    // Analyze sentence-level claims across sources
    const leftSources = articles.filter(a => a.author_bias_rating === "far_left" || a.author_bias_rating === "lean_left");
    const rightSources = articles.filter(a => a.author_bias_rating === "far_right" || a.author_bias_rating === "lean_right");

    // Group text by source
    const allSentences: Array<{ text: string; source: string; bias: string }> = [];
    for (const art of articles) {
      const sents = art.raw_text.split(/(?<=[.!?])\s+/);
      for (const s of sents) {
        const clean = BiasStripper.sanitizeText(s);
        if (clean.length > 20) {
          allSentences.push({ text: clean, source: art.source_name, bias: art.author_bias_rating });
        }
      }
    }

    // Categorize into agreed vs disputed
    const numbersAndQuotes = allSentences.filter(s => /\b\d{1,4}\b/.test(s.text));
    const processedFactStrings = new Set<string>();

    for (const item of numbersAndQuotes) {
      if (agreedFacts.length < 5 && !processedFactStrings.has(item.text)) {
        agreedFacts.push(item.text);
        processedFactStrings.add(item.text);

        timeline.push({
          timestamp_iso: new Date().toISOString(),
          verified_event: item.text,
          sources: [item.source],
        });
      }
    }

    if (agreedFacts.length === 0) {
      for (const sent of allSentences.slice(0, 3)) {
        if (!processedFactStrings.has(sent.text)) {
          agreedFacts.push(sent.text);
          processedFactStrings.add(sent.text);
        }
      }
    }

    // Detect disputed claims (divergences between ideological spectrum sources)
    if (leftSources.length > 0 && rightSources.length > 0) {
      disputedClaims.push({
        claim: `Differing framing regarding impact and causality of ${topic}`,
        asserted_by: leftSources.map(s => s.source_name),
        contested_by: rightSources.map(s => s.source_name),
        divergence_reason: "Left and Right publications emphasize contrasting consequences and motivations.",
      });
    } else if (disputedClaims.length === 0 && articles.length > 1) {
      disputedClaims.push({
        claim: `Nuance and long-term implications of ${topic}`,
        asserted_by: [articles[0].source_name],
        contested_by: [articles[1].source_name],
        divergence_reason: "Independent reports provide different degrees of confirmation regarding specific developments.",
      });
    } else if (disputedClaims.length === 0 && articles.length === 1) {
      disputedClaims.push({
        claim: `Primary reporting on ${topic}`,
        asserted_by: [articles[0].source_name],
        contested_by: [],
        divergence_reason: "Single-source reporting; pending independent multi-source corroboration.",
      });
    }

    const combinedText = agreedFacts.join(" ");
    const density = BiasStripper.calculateAdjectiveDensity(combinedText);

    const pureFact: PureFactObject = {
      event_id: eventId,
      topic,
      topic_id: topicId || articles.find(a => a.topic_id)?.topic_id || generateTopicId(topic),
      verified_entities: verifiedEntities,
      timeline: timeline.length > 0 ? timeline : [
        {
          timestamp_iso: new Date().toISOString(),
          verified_event: articles.length > 1
            ? `Cross-source reporting on ${topic} recorded across ${articles.length} sources.`
            : `Single-source reporting on ${topic} from ${articles[0]?.source_name || "news wire"}.`,
          sources: articles.map(a => a.source_name),
        }
      ],
      agreed_facts: agreedFacts,
      disputed_claims: disputedClaims,
      adjective_density_score: density,
      sanitized_timestamp: new Date().toISOString(),
    };

    return PureFactObjectSchema.parse(pureFact);
  }
}
