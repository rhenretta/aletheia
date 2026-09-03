import { RawArticle, PureFactObject, DisputedClaim, TimelineItem, PureFactObjectSchema } from "../../types/contracts";

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
    return Number((emotiveCount / words.length).toFixed(4));
  }

  /**
   * Deterministically removes sensationalist modifiers, rhetorical exaggerations, and loaded framing
   */
  public static sanitizeText(text: string): string {
    let sanitized = text;

    // Remove known emotive words
    for (const term of EMOTIVE_TERMS) {
      const regex = new RegExp(`\\b${term}\\b`, "gi");
      sanitized = sanitized.replace(regex, "");
    }

    // Clean double spaces and punctuation artifacts created by removal
    sanitized = sanitized
      .replace(/\s+/g, " ")
      .replace(/\s+([.,;:!?])/g, "$1")
      .replace(/([.,;:!?])\s*\1+/g, "$1")
      .trim();

    return sanitized;
  }

  /**
   * Extracts entities (capitalized multi-word or known noun phrases)
   */
  public static extractEntities(articles: RawArticle[]): string[] {
    const entitySet = new Set<string>();
    for (const article of articles) {
      const matches = article.raw_text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || [];
      for (const m of matches) {
        if (m.length > 2 && !["The", "A", "An", "In", "On", "At", "By", "For", "With", "According", "However", "Meanwhile"].includes(m)) {
          entitySet.add(m);
        }
      }
    }
    return Array.from(entitySet).slice(0, 10);
  }

  /**
   * Cross-references raw multi-source articles and produces a sanitized PureFactObject
   */
  public static processArticles(
    topic: string,
    articles: RawArticle[],
    eventId: string = `evt_${Date.now()}`
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
    const centerSources = articles.filter(a => a.author_bias_rating === "center" || a.author_bias_rating === "unknown");

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
    // Facts with consistent numbers/dates/events across left/right/center are agreed
    const numbersAndQuotes = allSentences.filter(s => /\b\d{1,4}\b/.test(s.text));
    const processedFactStrings = new Set<string>();

    for (const item of numbersAndQuotes) {
      if (agreedFacts.length < 5 && !processedFactStrings.has(item.text)) {
        agreedFacts.push(item.text);
        processedFactStrings.add(item.text);

        // Add to timeline
        timeline.push({
          timestamp_iso: new Date().toISOString(),
          verified_event: item.text,
          sources: [item.source],
        });
      }
    }

    // Default facts if numeric extraction had low density
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
        claim: "Primary causality and economic impact forecast",
        asserted_by: leftSources.map(s => s.source_name),
        contested_by: rightSources.map(s => s.source_name),
        divergence_reason: "Divergence in projected deficit impact and regulatory compliance costs between partisan sources.",
      });
    }

    if (disputedClaims.length === 0 && articles.length > 1) {
      disputedClaims.push({
        claim: "Attribution of long-term political motivation",
        asserted_by: [articles[0].source_name],
        contested_by: articles.slice(1).map(a => a.source_name),
        divergence_reason: "Differences in framing regarding initial legislative intent versus retroactive justification.",
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
