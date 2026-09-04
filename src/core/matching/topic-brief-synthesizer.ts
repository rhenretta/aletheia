import {
  SynthesizedEventCard,
  EventSourceArticle,
  DynamicBriefSection,
  LLMTopicBriefDesign,
  EvolvedTopicCardResult,
} from "../types/contracts";
import { deepseekProvider } from "../llm/deepseek-provider";

export interface EditorialBriefingContext {
  technical_depth?: string;
  curiosity_vectors?: string[];
  parent_interest?: string;
}

export class TopicBriefSynthesizer {
  /**
   * Multi-agent evolutionary workflow for refreshing and designing a topic card.
   * Discovers fresh data, evaluates update vs. redesign, identifies information gaps,
   * conducts targeted research, and synthesizes the final card.
   */
  public static async evolveBrief(
    topic: string,
    cards: SynthesizedEventCard[] = [],
    sources: EventSourceArticle[] = [],
    previousDesign?: LLMTopicBriefDesign | null,
    editorialContext?: EditorialBriefingContext
  ): Promise<EvolvedTopicCardResult> {
    const { TopicCardEvolutionOrchestrator } = await import(
      "../agents/cards/topic-card-evolution-orchestrator"
    );
    return TopicCardEvolutionOrchestrator.evolveCard({
      topic,
      previousCards: cards,
      previousSources: sources,
      previousDesign,
      technicalDepth: editorialContext?.technical_depth,
      curiosityVectors: editorialContext?.curiosity_vectors,
    });
  }

  /**
   * Generates an LLM-designed, topic-focused intelligence briefing with bespoke dynamic sections.
   * Eliminates all meta-commentary about the user, letting the AI determine what information
   * to present and how to structure it for maximum clarity.
   */
  public static async synthesizeBrief(
    topic: string,
    cards: SynthesizedEventCard[] = [],
    sources: EventSourceArticle[] = [],
    editorialContext?: EditorialBriefingContext
  ): Promise<LLMTopicBriefDesign> {
    const depth = editorialContext?.technical_depth || "practitioner";
    const curiosityAngles = editorialContext?.curiosity_vectors || [];

    // If LLM is configured, invoke the Briefing Architect
    if (deepseekProvider.isConfigured()) {
      try {
        const design = await this.synthesizeWithLLM(
          topic,
          cards,
          sources,
          depth,
          curiosityAngles
        );
        if (design && design.sections && design.sections.length > 0) {
          return design;
        }
      } catch (err) {
        console.warn(`[TopicBriefSynthesizer] LLM synthesis failed for "${topic}", falling back to local synthesis:`, err);
      }
    }

    // Deterministic fallback (100% topic-centric, zero user-history meta-commentary)
    return this.synthesizeLocalDeterministic(topic, cards, sources, depth, curiosityAngles);
  }

  /**
   * Invokes LLM to act as Executive Intelligence Briefing Architect
   */
  public static async synthesizeWithLLM(
    topic: string,
    cards: SynthesizedEventCard[],
    sources: EventSourceArticle[],
    depth: string,
    curiosityAngles: string[]
  ): Promise<LLMTopicBriefDesign> {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const currentQuarter = Math.floor(currentMonth / 3) + 1;
    const currentDateStr = now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

    const systemPrompt = `You are a clear, engaging editor at Aletheia helping everyday people stay on top of the topics they care about.
Your goal is to make the latest news and key developments feel accessible, interesting, and easy to follow—without stuffy corporate jargon, academic stiffness, or military briefing terminology.

KEY EDITORIAL PRINCIPLES:
1. WRITTEN FOR EVERYDAY PEOPLE:
   - Use natural, friendly, and smart conversational language (think Axios, Morning Brew, or a sharp tech journalist).
   - NEVER mention "the user" or "the reader".
   - Keep things clear, direct, and human.

2. REAL-TIME TEMPORAL GROUNDING & FUTURE CATALYSTS INTEGRITY (CRITICAL):
   - CURRENT EXACT DATE: ${currentDateStr} (Year: ${currentYear}, Quarter: Q${currentQuarter})
   - ALL upcoming events in "catalysts_outlook" or labeled "Upcoming", "Near-term", or "Pending" MUST be strictly forward-looking relative to ${currentDateStr}.
   - NEVER list past quarters or elapsed events as upcoming. (In Q${currentQuarter} ${currentYear}, earlier quarters such as ${Array.from({ length: currentQuarter - 1 }, (_, i) => `Q${i + 1} ${currentYear}`).join(", ")} or prior years are completed history and CANNOT be 'Upcoming').
   - Upcoming milestones, earnings calls, regulatory votes, or product launches MUST refer to future quarters (e.g. ${currentQuarter < 4 ? `Q${currentQuarter + 1} ${currentYear}` : `Q1 ${currentYear + 1}`}) or dates strictly after ${currentDateStr}. Ground catalysts in the provided research, never pull outdated historical calendar items from pre-training memory.

3. DYNAMIC PRESENTATION DESIGN:
   - Decide WHAT information to present and HOW to best present it.
   - Choose a natural presentation archetype: "regulatory_controversy" | "technical_deep_dive" | "breaking_chronology" | "field_synthesis" | "empirical_investigation".
   - Select 2 to 4 sections that best structure THIS topic's story:
      * "critical_tensions": When there are opposing sides, disputed claims, or controversies (The Claim vs The Pushback).
      * "key_developments": The biggest recent news updates
      * "real_world_chronology": ONLY use if the research documents a genuine multi-stage progression across distinct separated dates (e.g. across weeks/months/stages). NEVER show a timeline for concurrent breaking stories from the same news cycle, where events happened within 48h, or where items would all be labeled "Just now" or "Today". If there is no genuine multi-date progression, do NOT include this section.
      * "community_pulse": Real quotes and chatter from testers, forums, or observers strictly from the current active news window (within the last 30-60 days). NEVER include obsolete quotes from years-old discussions.
      * "telemetry_metrics": Key numbers, stats, or specs.
      * "catalysts_outlook": What to watch for next (strictly forward-looking).
      * "deep_dive_inquiries": Interesting questions to explore further.

4. "WHAT'S HAPPENING NOW" (executive_take):
   - Write a 1-to-2 sentence warm, clear summary of what is happening right now with the topic.
   - Summarize the core situation directly in natural, engaging human language.
   - NEVER repeat headlines verbatim, never concatenate snippets with em-dashes ("Headline — Headline"), and never use formulaic connectors like "Meanwhile,".
   - Ensure the summary flows naturally and ends with complete punctuation.

OUTPUT STRICT JSON MATCHING THIS SCHEMA:
{
  "presentation_archetype": "regulatory_controversy" | "technical_deep_dive" | "breaking_chronology" | "field_synthesis" | "empirical_investigation",
  "design_rationale": "Short friendly note on what this card focuses on",
  "executive_take": "1-2 sentence warm, clear, natural language summary of what is happening right now (never repeating headlines verbatim)",
  "sections": [
    {
      "id": "sec_1",
      "section_type": "critical_tensions" | "telemetry_metrics" | "real_world_chronology" | "community_pulse" | "key_developments" | "catalysts_outlook" | "deep_dive_inquiries",
      "title": "Natural Section Title (e.g. 'The Big Debate', 'Timeline', 'What People Are Saying')",
      "subtitle": "Short friendly subtitle",
      "badge": "Short badge (e.g. 'Debate', 'Timeline', 'Highlights')",
      "layout_style": "callout" | "grid" | "timeline" | "metrics" | "quote_cards" | "bullets" | "key_value",
      "content": {
        "summary": "Optional narrative",
        "bullets": [{ "title": "Headline", "text": "Details", "source": "Source Name" }],
        "metrics": [{ "label": "Metric Name", "value": "12.4x", "context": "Context description", "trend": "up" | "down" | "neutral" }],
        "milestones": [{ "time_label": "Recent / Date", "milestone": "Event description", "source_name": "Source" }],
        "quotes": [{ "quote": "Quote text", "speaker_or_community": "Attribution", "platform": "reddit / open_web", "sentiment": "positive" | "critical" | "mixed" | "neutral" }],
        "tensions": [{ "topic_tension": "What's in dispute", "thesis": "The claim", "antithesis": "The pushback", "verified_evidence": "What we know" }],
        "catalysts": [{ "timeframe": "When to expect it", "event": "What's coming", "significance": "Why it matters" }],
        "inquiries": [{ "question": "Question to ask", "angle": "Context angle" }]
      }
    }
  ]
}`;

    const cardsContext = cards.map((c, i) => `[Story ${i + 1}: ${c.headline}]
Summary: ${c.summary}
Fact Bullets:
${(c.fact_bullets || []).map((f) => `  * ${f}`).join("\n")}
Disputed Claims:
${(c.disputed_claims || []).map((d) => `  * Claim: "${d.claim}" (Contested by: ${d.contested_by?.join(", ") || "Observers"}; Divergence: ${d.divergence_reason})`).join("\n")}
Sources: ${c.sources?.map((s) => s.name).join(", ") || "Wire"}
Published: ${c.published_at || "Recent"}`).join("\n\n");

    const sourcesContext = sources.slice(0, 5).map((s, i) => `[Source ${i + 1}: ${s.name}]
Title: ${s.title}
Passages: ${(s.highlighted_passages || []).join(" | ") || (s.raw_text ? s.raw_text.slice(0, 200) : "")}`).join("\n\n");

    const anglesContext = curiosityAngles && curiosityAngles.length > 0
      ? `\nSPECIFIC USER PERSPECTIVE & ACTIVE CURIOSITY ANGLES TO PRIORITIZE:
${curiosityAngles.map((a) => `- ${a}`).join("\n")}
Focus the briefing on stories and developments relevant to these specific angles, and do NOT let obsolete or mismatched sub-topics (e.g. legacy hardware variants or irrelevant software versions) dominate the card.\n`
      : "";

    const userPrompt = `TOPIC TO BRIEF: "${topic}"

CURRENT REAL-WORLD DATE: ${currentDateStr} (Year: ${currentYear}, Quarter: Q${currentQuarter})
${anglesContext}
AVAILABLE NEWS STORIES:
${cardsContext || "No active stories on wire right now."}

SOURCE PASSAGES & QUOTES:
${sourcesContext || "No secondary reporting excerpts available."}

Task: Write a clear, friendly, and engaging briefing that helps everyday people keep up to date on this topic. Ensure any upcoming catalysts are forward-looking relative to ${currentDateStr}.`;

    const res = await deepseekProvider.generateCompletion(userPrompt, {
      systemPrompt,
      temperature: 0.2,
      maxTokens: 2000,
    });

    if (res.text) {
      try {
        let cleaned = res.text.trim();
        if (cleaned.startsWith("```json")) {
          cleaned = cleaned.replace(/^```json\s*/, "").replace(/\s*```$/, "");
        } else if (cleaned.startsWith("```")) {
          cleaned = cleaned.replace(/^```\s*/, "").replace(/\s*```$/, "");
        }
        const parsed = JSON.parse(cleaned) as LLMTopicBriefDesign;
        if (parsed && parsed.sections && parsed.sections.length > 0) {
          if (!parsed.executive_take || parsed.executive_take.trim().length === 0) {
            parsed.executive_take = synthesizeCleanExecutiveTake(topic, cards);
          }
          // Sanitize catalysts for strict chronological forward-looking integrity
          parsed.sections = parsed.sections
            .map((sec) => {
              if (sec.section_type === "catalysts_outlook" && sec.content.catalysts) {
                const validCatalysts = sec.content.catalysts.filter((c) =>
                  isForwardLookingCatalyst(c.event, c.timeframe, now)
                );
                return {
                  ...sec,
                  content: {
                    ...sec.content,
                    catalysts: validCatalysts,
                  },
                };
              }
              return sec;
            })
            .filter((sec) => {
              if (sec.section_type === "catalysts_outlook") {
                return Boolean(sec.content.catalysts && sec.content.catalysts.length > 0);
              }
              return true;
            });
          parsed.sections = enrichSectionSourceUrls(parsed.sections, cards, sources);
          return parsed;
        }
      } catch (err) {
        console.warn(`[TopicBriefSynthesizer] JSON parse failed, falling back to deterministic local design:`, err);
      }
    }

    return this.synthesizeLocalDeterministic(topic, cards, sources, depth, curiosityAngles);
  }

  /**
   * Deterministic local fallback synthesizer ensuring responsive, rich card presentations
   * even when LLM is unavailable or offline.
   */
  public static synthesizeLocalDeterministic(
    topic: string,
    cards: SynthesizedEventCard[],
    sources: EventSourceArticle[] = [],
    technicalDepth: string = "practitioner",
    curiosityVectors: string[] = []
  ): LLMTopicBriefDesign {
    const executiveTake = synthesizeCleanExecutiveTake(topic, cards);
    const curiosityAngles = curiosityVectors;
    const sections: DynamicBriefSection[] = [];

    // 1. Primary: Key Developments (The core news stories)
    if (cards.length > 0) {
      const bullets = cards.slice(0, 3).map((c) => ({
        title: c.headline,
        text: c.summary,
        source: c.sources?.[0]?.name || "Reporting",
        source_url: c.sources?.[0]?.url,
      }));

      sections.push({
        id: `sec_developments_${Date.now()}`,
        section_type: "key_developments",
        title: "Key Developments",
        subtitle: `Important updates reported across ${sources.length > 0 ? sources.length : cards.length} outlets`,
        badge: "Highlights",
        layout_style: "bullets",
        content: { bullets },
      });
    }

    // 2. Timeline: Only include if there is genuine multi-day progression across distinct dates (>= 48h span)
    const pubTimes = cards.map((c) => new Date(c.published_at || 0).getTime()).filter((t) => t > 0);
    const latestPubTime = pubTimes.length > 0 ? Math.max(...pubTimes) : Date.now();
    const earliestPubTime = pubTimes.length > 0 ? Math.min(...pubTimes) : latestPubTime;
    const timeSpanHours = (latestPubTime - earliestPubTime) / (1000 * 60 * 60);

    const recentProgressionCards = cards.filter((c) => {
      const pub = new Date(c.published_at || 0).getTime();
      // Must be within 60 days of latest news to reflect current story development, never years-old seed data
      return latestPubTime - pub < 60 * 24 * 60 * 60 * 1000;
    });

    // A real timeline requires at least 2 cards spanning at least 48 hours.
    // If all cards broke in the same afternoon/day (<48h), they are breaking news updates, NOT a timeline!
    if (recentProgressionCards.length >= 2 && timeSpanHours >= 48) {
      const sorted = [...recentProgressionCards].sort(
        (a, b) => new Date(a.published_at || 0).getTime() - new Date(b.published_at || 0).getTime()
      );
      const timelineCards = sorted.slice(-4);
      const milestones = timelineCards.map((c) => {
        const pubTime = new Date(c.published_at || 0).getTime();
        const diffH = Math.round((Date.now() - pubTime) / (1000 * 60 * 60));
        const timeLabel =
          diffH <= 2
            ? "Just now"
            : diffH < 24
            ? `${diffH}h ago`
            : diffH < 48
            ? "Yesterday"
            : diffH < 24 * 30
            ? `${Math.round(diffH / 24)}d ago`
            : new Date(pubTime).toLocaleDateString("en-US", { month: "short", year: "numeric" });
        return {
          time_label: timeLabel,
          milestone: c.headline,
          source_name: c.sources?.[0]?.name,
          source_url: c.sources?.[0]?.url,
        };
      });

      // A genuine timeline must have distinct time labels and NOT multiple items saying "Just now" or "Today".
      // If milestones collapsed into the same short window, they are concurrent news updates, NOT a timeline!
      const distinctLabels = new Set(milestones.map((m) => m.time_label));
      const justNowCount = milestones.filter((m) => m.time_label === "Just now").length;
      if (milestones.length >= 2 && distinctLabels.size >= 2 && justNowCount < 2) {
        sections.push({
          id: `sec_chronology_${Date.now()}`,
          section_type: "real_world_chronology",
          title: "Timeline for Context",
          subtitle: "How this topic has developed recently",
          badge: "Timeline",
          layout_style: "timeline",
          content: { milestones },
        });
      }
    }

    // 3. Third priority: Genuine two-sided debates (ONLY if actual opposing arguments exist; NEVER placeholder text)
    const genuineTensionItems: NonNullable<DynamicBriefSection["content"]["tensions"]> = [];
    cards.forEach((c) => {
      (c.disputed_claims || []).forEach((d) => {
        const reason = (d.divergence_reason || "").toLowerCase();
        const isSingleSourceDisclaimer =
          reason.includes("single-source") ||
          reason.includes("only one source") ||
          reason.includes("no contesting source") ||
          reason.includes("pending independent confirmation") ||
          reason.includes("subjective definition proposed");

        // Must have real contested sources or substantive opposing argument, and not be a single-source disclaimer
        if (!isSingleSourceDisclaimer && d.contested_by && d.contested_by.length > 0 && d.claim && d.claim.trim().length > 10) {
          const thesis = d.asserted_by && d.asserted_by.length > 0
            ? `${d.claim} (${d.asserted_by.join(", ")})`
            : d.claim;
          const antithesis = d.divergence_reason && d.divergence_reason.length > 20
            ? d.divergence_reason
            : `Contested by ${d.contested_by.join(", ")}`;

          if (thesis.toLowerCase() !== "the claim" && antithesis.toLowerCase() !== "the pushback" && thesis !== antithesis) {
            genuineTensionItems.push({
              topic_tension: d.claim.length > 75 ? d.claim.slice(0, 72) + "..." : d.claim,
              thesis,
              antithesis,
            });
          }
        }
      });
    });

    if (genuineTensionItems.length > 0) {
      sections.push({
        id: `sec_tensions_${Date.now()}`,
        section_type: "critical_tensions",
        title: "Differing Perspectives",
        subtitle: "Key points of disagreement between reporting sources",
        badge: "Debate",
        layout_style: "callout",
        content: { tensions: genuineTensionItems.slice(0, 2) },
      });
    }

    const hasMultipleOutlets = sources.length >= 2;
    let archetype: LLMTopicBriefDesign["presentation_archetype"] = "field_synthesis";
    if (genuineTensionItems.length > 0) {
      archetype = "regulatory_controversy";
    } else if (cards.length >= 2 && hasMultipleOutlets) {
      archetype = "breaking_chronology";
    } else {
      archetype = "technical_deep_dive";
    }

    // Section D: What People Are Saying (Community Pulse)
    // ONLY include if the quotes originate from genuine community / social platforms (Reddit, Bluesky, forums)
    // AND are strictly recent (within 60 days). NEVER repurpose stale multi-year-old threads.
    const isAuthenticCommunitySource = (src: EventSourceArticle): boolean => {
      const name = (src.name || "").toLowerCase();
      const url = (src.url || "").toLowerCase();
      const isSocial = (
        name.includes("reddit") ||
        url.includes("reddit.com") ||
        url.includes("bsky.app") ||
        url.includes("forum") ||
        url.includes("community") ||
        url.includes("twitter.com") ||
        url.includes("x.com")
      );
      if (!isSocial) return false;

      // Reject sources older than 60 days
      if (src.published_at) {
        const pub = new Date(src.published_at).getTime();
        if (!isNaN(pub) && Date.now() - pub > 60 * 24 * 60 * 60 * 1000) {
          return false;
        }
      }
      return true;
    };

    const extractedQuotes: NonNullable<DynamicBriefSection["content"]["quotes"]> = [];
    sources.filter(isAuthenticCommunitySource).forEach((src) => {
      (src.highlighted_passages || []).forEach((p) => {
        const clean = p.replace(/^["']|["']$/g, "").trim();
        // Skip quotes referencing obsolete years (2020-2024)
        if (/\b(201[0-9]|202[0-4])\b/.test(clean)) return;

        if (clean.length > 25 && clean.length < 220 && extractedQuotes.length < 3) {
          extractedQuotes.push({
            quote: clean,
            speaker_or_community: src.name || "Community Discussion",
            platform: src.name.toLowerCase().includes("reddit") ? "reddit" : "open_web",
            sentiment: "mixed",
            url: src.url,
          });
        }
      });
    });

    if (extractedQuotes.length > 0) {
      sections.push({
        id: `sec_pulse_${Date.now()}`,
        section_type: "community_pulse",
        title: "Social Media & Community Reactions",
        subtitle: "What users, testers, and communities on Reddit & social media are saying",
        badge: "Community",
        layout_style: "quote_cards",
        content: { quotes: extractedQuotes },
      });
    }

    // Section E: Questions to Explore
    if (sections.length < 2) {
      const inquiries = curiosityAngles.length > 0
        ? curiosityAngles.slice(0, 3).map((ang) => ({
            question: `What are the most interesting developments happening around ${ang}?`,
            angle: ang,
          }))
        : [
            {
              question: `What should I know about the current state of ${topic}?`,
              angle: "The Basics",
            },
            {
              question: `What are experts and enthusiasts debating most about ${topic}?`,
              angle: "Key Debates",
            },
          ];

      sections.push({
        id: `sec_inquiries_${Date.now()}`,
        section_type: "deep_dive_inquiries",
        title: "Want to Learn More?",
        subtitle: "Tap any question to chat with Aletheia",
        badge: "Explore",
        layout_style: "key_value",
        content: { inquiries },
      });
    }

    return {
      presentation_archetype: archetype,
      design_rationale: "Curated digest of the latest updates and discussions.",
      executive_take: executiveTake,
      sections: enrichSectionSourceUrls(sections, cards, sources),
    };
  }
}

/**
 * Cleans a raw article snippet from web wires:
 * - Strips leading duplicate title / headline if repeated at start
 * - Extracts complete, grammatical sentences ending in punctuation (. ! ?)
 * - Discards trailing dangling sentence fragments (e.g. "delivering on a commitment to bring")
 */
export function cleanArticleSnippet(title: string, rawText?: string): string {
  if (!rawText || rawText.trim().length === 0) return title.trim();
  let text = rawText.trim();

  // Strip leading duplicate title if present (case-insensitive, optional trailing colon/dash/space)
  const cleanTitle = title.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const titlePrefixRegex = new RegExp(`^${cleanTitle}[\\s:—–-]*`, "i");
  text = text.replace(titlePrefixRegex, "").trim();

  if (text.length === 0) return title.trim();

  // Split into sentences ending with punctuation
  const sentenceMatches = text.match(/[^.!?]+[.!?]+/g);
  if (sentenceMatches && sentenceMatches.length > 0) {
    let combined = "";
    for (const s of sentenceMatches) {
      const trimmed = s.trim();
      if ((combined + " " + trimmed).trim().length <= 280) {
        combined = (combined + " " + trimmed).trim();
      } else {
        if (!combined) combined = trimmed;
        break;
      }
    }
    if (combined.length > 20) return combined;
  }

  // If no clean punctuation matched, truncate at last word boundary and end with period
  if (text.length > 240) {
    const lastSpace = text.lastIndexOf(" ", 240);
    text = (lastSpace > 50 ? text.slice(0, lastSpace) : text.slice(0, 240)).trim();
  }
  return text.endsWith(".") || text.endsWith("!") || text.endsWith("?") ? text : `${text}.`;
}

/**
 * Synthesizes a clean, natural 1-to-2 sentence executive summary ("What's Happening Now")
 * from the top stories without repeating headlines verbatim or creating fragmented em-dashes.
 */
export function synthesizeCleanExecutiveTake(topic: string, cards: SynthesizedEventCard[]): string {
  if (!cards || cards.length === 0) {
    return `Things have been quiet for ${topic} lately, with no major breaking updates reported this week. We're actively monitoring live wires for emerging developments.`;
  }

  const extractLeadSentence = (card: SynthesizedEventCard): string => {
    const headline = (card.headline || "").trim();
    let summary = (card.summary || "").trim();

    // Strip leading headline if repeated inside summary
    const cleanH = headline.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    summary = summary.replace(new RegExp(`^${cleanH}[\\s:—–-]*`, "i"), "").trim();

    // Strip leading punctuation/symbols (e.g. leading periods or dashes like ". FSD v14")
    summary = summary.replace(/^[^a-zA-Z0-9"'(]+/, "").trim();

    // Strip forum/boilerplate noise from raw web posts
    summary = summary
      .replace(/\b\d+\s*Members\s*Online\b/gi, "")
      .replace(/\bADMIN\s*MOD\b/gi, "")
      .replace(/\bPost\s*Karma\b/gi, "")
      .replace(/\br\/[a-zA-Z0-9_]+\b/gi, "")
      .trim();

    summary = summary.replace(/^[^a-zA-Z0-9"'(]+/, "").trim();

    // Match first complete sentence
    const firstSentence = summary.match(/^([A-Z0-9"'(][^.!?]+[.!?])/);
    if (firstSentence && firstSentence[1].trim().length >= 25) {
      let s = firstSentence[1].trim();
      s = s.replace(/\s+(the|a|an|and|to|of|in|with|for|that|on|by|at)\.$/i, ".");
      return s;
    }

    if (summary.length >= 25) {
      let s = summary.endsWith(".") || summary.endsWith("!") || summary.endsWith("?")
        ? summary
        : `${summary}.`;
      s = s.replace(/\s+(the|a|an|and|to|of|in|with|for|that|on|by|at)\.$/i, ".");
      return s;
    }

    // Fall back to headline as a complete sentence
    return headline.endsWith(".") ? headline : `${headline}.`;
  };

  const top = cards[0];
  const second = cards[1];

  const leadSentence = extractLeadSentence(top);

  if (!second) {
    return leadSentence;
  }

  const secondSentence = extractLeadSentence(second).replace(/^[^a-zA-Z0-9"'(]+/, "").trim();

  // If second sentence is nearly identical or redundant with lead sentence, don't duplicate
  if (
    !secondSentence ||
    leadSentence.toLowerCase().slice(0, 35) === secondSentence.toLowerCase().slice(0, 35) ||
    secondSentence.length < 20
  ) {
    return leadSentence;
  }

  // Format cleanly into two distinct sentences
  return `${leadSentence} Additionally, ${secondSentence.charAt(0).toLowerCase() + secondSentence.slice(1)}`;
}

/**
 * Programmatically validates that an upcoming catalyst or milestone is forward-looking
 * relative to the current real-world date, preventing anachronistic references to past quarters or elapsed years.
 */
export function isForwardLookingCatalyst(
  eventText: string,
  timeframeText?: string,
  referenceDate: Date = new Date()
): boolean {
  const combined = `${timeframeText || ""} ${eventText || ""}`.toLowerCase();
  const currentYear = referenceDate.getFullYear();
  const currentMonth = referenceDate.getMonth(); // 0 = Jan .. 8 = Sep
  const currentQuarter = Math.floor(currentMonth / 3) + 1; // 1 = Q1 .. 3 = Q3

  // 1. Check for past years (e.g. 2023, 2024, 2025 when currentYear is 2026)
  const yearMatches = combined.match(/\b(20[12][0-9])\b/g);
  if (yearMatches && yearMatches.length > 0) {
    const years = yearMatches.map((y) => parseInt(y, 10));
    const maxYear = Math.max(...years);
    if (maxYear < currentYear) {
      return false;
    }
  }

  // 2. Check for past quarters of the current year (e.g. Q1 or Q2 when currentQuarter is 3)
  const ordinalWords = ["first", "second", "third", "fourth"];
  for (let q = 1; q < currentQuarter; q++) {
    const ordWord = ordinalWords[q - 1];
    // Matches e.g. "Q1 2026", "1Q 2026", "first quarter 2026", "Q1 of 2026", "1st quarter 2026"
    const qYearPattern = new RegExp(`\\b(q${q}|${q}q|quarter\\s*${q}|${q}(?:st|nd|rd|th)?\\s*quarter|${ordWord}\\s*quarter)\\s*(?:of\\s*)?${currentYear}\\b`, "i");
    if (qYearPattern.test(combined)) {
      return false;
    }

    // Matches standalone "Q1" or "first quarter" without any future year explicitly mentioned
    const qStandalonePattern = new RegExp(`\\b(q${q}|${q}q|quarter\\s*${q}|${q}(?:st|nd|rd|th)?\\s*quarter|${ordWord}\\s*quarter)\\b`, "i");
    if (qStandalonePattern.test(combined)) {
      const mentionsFutureYear = yearMatches && yearMatches.some((y) => parseInt(y, 10) > currentYear);
      if (!mentionsFutureYear) {
        return false;
      }
    }
  }

  // 3. Check for past months of the current year if a specific month is mentioned with currentYear
  const monthNames = [
    "january", "february", "march", "april", "may", "june",
    "july", "august", "september", "october", "november", "december"
  ];
  for (let m = 0; m < currentMonth; m++) {
    const pastMonth = monthNames[m];
    const monthYearPattern = new RegExp(`\\b${pastMonth}\\s+(?:of\\s+)?${currentYear}\\b`, "i");
    if (monthYearPattern.test(combined)) {
      return false;
    }
  }

  return true;
}

/**
 * Ensures that every item across all dynamic sections that references a source
 * is enriched with a direct, valid URL to the original reporting article or discussion.
 */
export function enrichSectionSourceUrls(
  sections: DynamicBriefSection[],
  cards: SynthesizedEventCard[] = [],
  sources: EventSourceArticle[] = []
): DynamicBriefSection[] {
  // Aggregate all sources from sources array and from all cards
  const allKnownSources: EventSourceArticle[] = [...sources];
  cards.forEach((c) => {
    (c.sources || []).forEach((s) => {
      if (s.url && !allKnownSources.some((k) => k.url === s.url)) {
        allKnownSources.push(s);
      }
    });
  });

  const findSourceUrl = (
    sourceName?: string,
    contextHeadline?: string,
    contextSnippet?: string
  ): { name?: string; url?: string } => {
    const cleanName = (sourceName || "").trim().toLowerCase();
    const cleanHeadline = (contextHeadline || "").trim().toLowerCase();
    const cleanSnippet = (contextSnippet || "").trim().toLowerCase();

    // 1. Direct name match
    if (cleanName) {
      const match = allKnownSources.find(
        (s) =>
          s.name &&
          (s.name.toLowerCase() === cleanName ||
            s.name.toLowerCase().includes(cleanName) ||
            cleanName.includes(s.name.toLowerCase()))
      );
      if (match?.url) {
        return { name: match.name, url: match.url };
      }
    }

    // 2. Match against card headlines or text
    if (cleanHeadline || cleanSnippet) {
      const cardMatch = cards.find((c) => {
        const cHead = (c.headline || "").toLowerCase();
        const cSumm = (c.summary || "").toLowerCase();
        return (
          (cleanHeadline &&
            (cHead.includes(cleanHeadline.slice(0, 30)) || cleanHeadline.includes(cHead.slice(0, 30)))) ||
          (cleanSnippet && cSumm.includes(cleanSnippet.slice(0, 35)))
        );
      });
      if (cardMatch?.sources?.[0]?.url) {
        return {
          name: cardMatch.sources[0].name,
          url: cardMatch.sources[0].url,
        };
      }
    }

    // 3. Fallback to first available known source if available
    if (allKnownSources.length > 0 && allKnownSources[0]?.url) {
      return { name: allKnownSources[0].name, url: allKnownSources[0].url };
    }

    return {};
  };

  return sections.map((sec) => {
    if (sec.section_type === "key_developments" && sec.content.bullets) {
      const enrichedBullets = sec.content.bullets.map((b) => {
        if (!b.source_url) {
          const found = findSourceUrl(b.source, b.title, b.text);
          return {
            ...b,
            source: b.source || found.name || "Reporting",
            source_url: found.url,
          };
        }
        return b;
      });
      return { ...sec, content: { ...sec.content, bullets: enrichedBullets } };
    }

    if (sec.section_type === "real_world_chronology" && sec.content.milestones) {
      const enrichedMilestones = sec.content.milestones.map((m) => {
        if (!m.source_url) {
          const found = findSourceUrl(m.source_name, m.milestone);
          return {
            ...m,
            source_name: m.source_name || found.name,
            source_url: found.url,
          };
        }
        return m;
      });
      return { ...sec, content: { ...sec.content, milestones: enrichedMilestones } };
    }

    if (sec.section_type === "community_pulse" && sec.content.quotes) {
      const enrichedQuotes = sec.content.quotes.map((q) => {
        if (!q.url) {
          const found = findSourceUrl(q.speaker_or_community, undefined, q.quote);
          return {
            ...q,
            url: found.url,
          };
        }
        return q;
      });
      return { ...sec, content: { ...sec.content, quotes: enrichedQuotes } };
    }

    if (sec.section_type === "critical_tensions" && sec.content.tensions) {
      const enrichedTensions = sec.content.tensions.map((t) => {
        if (!t.source_url) {
          const found = findSourceUrl(t.source, t.topic_tension, t.thesis);
          return {
            ...t,
            source: t.source || found.name,
            source_url: found.url,
          };
        }
        return t;
      });
      return { ...sec, content: { ...sec.content, tensions: enrichedTensions } };
    }

    if (sec.section_type === "catalysts_outlook" && sec.content.catalysts) {
      const enrichedCatalysts = sec.content.catalysts.map((cat) => {
        if (!cat.source_url) {
          const found = findSourceUrl(cat.source, cat.event, cat.significance);
          return {
            ...cat,
            source: cat.source || found.name,
            source_url: found.url,
          };
        }
        return cat;
      });
      return { ...sec, content: { ...sec.content, catalysts: enrichedCatalysts } };
    }

    return sec;
  });
}


