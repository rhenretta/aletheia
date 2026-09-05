import {
  SynthesizedEventCard,
  EventSourceArticle,
  DynamicBriefSection,
  LLMTopicBriefDesign,
  EvolvedTopicCardResult,
  generateTopicId,
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
    editorialContext?: EditorialBriefingContext,
    topicId?: string
  ): Promise<EvolvedTopicCardResult> {
    const { TopicCardEvolutionOrchestrator } = await import(
      "../agents/cards/topic-card-evolution-orchestrator"
    );
    const resolvedTopicId = topicId || previousDesign?.topic_id || cards.find((c) => c.topic_id)?.topic_id || generateTopicId(topic);
    return TopicCardEvolutionOrchestrator.evolveCard({
      topic,
      topic_id: resolvedTopicId,
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
    editorialContext?: EditorialBriefingContext,
    topicId?: string
  ): Promise<LLMTopicBriefDesign> {
    const depth = editorialContext?.technical_depth || "practitioner";
    const curiosityAngles = editorialContext?.curiosity_vectors || [];
    const resolvedTopicId = topicId || cards.find((c) => c.topic_id)?.topic_id || generateTopicId(topic);

    let design: LLMTopicBriefDesign | null = null;

    // If LLM is configured, invoke the Briefing Architect
    if (deepseekProvider.isConfigured()) {
      try {
        design = await this.synthesizeWithLLM(
          topic,
          cards,
          sources,
          depth,
          curiosityAngles
        );
      } catch (err) {
        console.warn(`[TopicBriefSynthesizer] LLM synthesis failed for "${topic}", falling back to local synthesis:`, err);
      }
    }

    if (!design || !design.sections || design.sections.length === 0) {
      design = this.synthesizeLocalDeterministic(topic, cards, sources, depth, curiosityAngles);
    }

    design.topic_id = resolvedTopicId;
    if (design.sections) {
      for (const s of design.sections) {
        s.topic_id = resolvedTopicId;
      }
    }
    return design;
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
      * "key_developments": The biggest recent news updates. Each bullet MUST be an articulate, substantive breakdown of a distinct recent development:
         - "title": A clean, concise journalistic title for the development (NOT a sensationalist headline).
         - "text": A substantive 1-to-2 sentence explanation of what happened, what the data or milestone reveals, and why it matters. Write in clear, complete sentences with correct numbers and grammar.
         - "source": Publisher name.
      * "real_world_chronology": ONLY use if the research documents a genuine multi-stage progression across distinct separated calendar dates (e.g. across months/years/phases like "Jan 2026", "Nov 2025", "2024"). NEVER generate a timeline from concurrent breaking news stories from the same news cycle, and NEVER use relative time labels like "Just now", "4h ago", "Today", or "Yesterday". If there are no milestone articles or historical milestones spanning distinct calendar dates, DO NOT INCLUDE THIS SECTION.
      * "community_pulse": ONLY use if the sources contain authentic social media posts and comments from platforms like Reddit, Bluesky, X/Twitter, or Threads. Quotes MUST be recent (within the last 60 days) and reflect authentic user/practitioner discussions (never corporate PR, landing page copy, or subreddit sidebar boilerplate). If no authentic social media posts exist, DO NOT INCLUDE THIS SECTION.
      * "telemetry_metrics": Key numbers, stats, or specs.
      * "catalysts_outlook": What to watch for next (strictly forward-looking).
      * "deep_dive_inquiries": Interesting questions to explore further.

4. "WHAT'S HAPPENING NOW" (executive_take):
   - Write a cohesive 2-to-3 sentence executive summary that synthesizes ALL recent developments in the topic into a clear, high-level overview.
   - Explain the big picture: what major developments have taken place across these stories, what new evidence or milestones emerged, and what the current status is.
   - Written in natural, smart, accessible prose for everyday readers.
   - NEVER repeat headlines verbatim, never concatenate snippets with em-dashes ("Headline — Headline"), and never use formulaic connectors like "Meanwhile,".
   - Ensure the summary flows naturally and ends with complete punctuation.

OUTPUT STRICT JSON MATCHING THIS SCHEMA:
{
  "presentation_archetype": "regulatory_controversy" | "technical_deep_dive" | "breaking_chronology" | "field_synthesis" | "empirical_investigation",
  "design_rationale": "Short friendly note on what this card focuses on",
  "executive_take": "Cohesive 2-to-3 sentence overarching summary of all recent developments across the topic (never repeating headlines verbatim)",
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
        "bullets": [{ "title": "Clean Descriptive Development Title", "text": "Substantive 1-2 sentence explanation of what happened, key data/milestones, and significance.", "source": "Source Name" }],
        "metrics": [{ "label": "Metric Name", "value": "12.4x", "context": "Context description", "trend": "up" | "down" | "neutral" }],
        "milestones": [{ "time_label": "Month Year / Date", "milestone": "Event description", "source_name": "Source" }],
        "quotes": [{ "quote": "Quote text", "speaker_or_community": "Attribution", "platform": "reddit" | "x" | "bluesky" | "threads" | "social", "sentiment": "positive" | "critical" | "mixed" | "neutral" }],
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
      traceOptions: {
        agentName: "agent_brief_synthesizer",
        reasoningDetails: {
          primary_rationale: `LLM-Designed Topic Brief Synthesis for "${topic}"`,
        },
        contextDetails: {
          topic,
          technical_depth: depth,
          curiosity_vectors: curiosityAngles,
          cards_count: cards.length,
          sources_count: sources.length,
        },
      },
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
          // Sanitize sections for strict chronological forward-looking, timeline milestone, and social media integrity
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
              if (sec.section_type === "real_world_chronology" && sec.content.milestones) {
                const validMilestones = sec.content.milestones.filter(isValidTimelineMilestone);
                const distinct = new Set(validMilestones.map((m) => m.time_label));
                if (validMilestones.length < 2 || distinct.size < 2) {
                  return null;
                }
                return {
                  ...sec,
                  content: {
                    ...sec.content,
                    milestones: validMilestones,
                  },
                };
              }
              if (sec.section_type === "community_pulse" && sec.content.quotes) {
                const validQuotes = sec.content.quotes.filter((q) => {
                  const plat = (q.platform || "").toLowerCase();
                  const speaker = (q.speaker_or_community || "").toLowerCase();
                  const isSocial =
                    plat === "reddit" ||
                    plat === "bluesky" ||
                    plat === "x" ||
                    plat === "threads" ||
                    plat === "hacker_news" ||
                    speaker.startsWith("r/") ||
                    speaker.includes("reddit") ||
                    speaker.includes("bluesky");
                  if (!isSocial) return false;
                  if (!isAuthenticUserComment(q.quote)) return false;
                  return true;
                });
                if (validQuotes.length === 0) return null;
                return {
                  ...sec,
                  content: {
                    ...sec.content,
                    quotes: validQuotes.map((q) => ({
                      ...q,
                      platform: detectSocialPlatform(q.platform || q.speaker_or_community || ""),
                    })),
                  },
                };
              }
              return sec;
            })
            .filter((sec): sec is DynamicBriefSection => {
              if (!sec) return false;
              if (sec.section_type === "catalysts_outlook") {
                return Boolean(sec.content.catalysts && sec.content.catalysts.length > 0);
              }
              if (sec.section_type === "real_world_chronology") {
                return Boolean(sec.content.milestones && sec.content.milestones.length >= 2);
              }
              if (sec.section_type === "community_pulse") {
                return Boolean(sec.content.quotes && sec.content.quotes.length > 0);
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
      const bullets = synthesizeCleanDevelopments(cards.slice(0, 3));

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

    // 2. Timeline: ONLY include if there are authentic milestone articles or documented multi-date progression
    // with distinct calendar dates (e.g. Month Year or formatted historical dates spanning distinct periods).
    // NEVER convert breaking news feed cards into a fake timeline with hourly labels ("4h ago", "Just now")!
    const explicitMilestoneSources = sources.filter((s) => {
      const title = (s.title || "").toLowerCase();
      const text = (s.raw_text || "").toLowerCase();
      return (
        title.includes("timeline") ||
        title.includes("milestones") ||
        title.includes("roadmap") ||
        title.includes("history") ||
        text.includes("chronology")
      );
    });

    if (explicitMilestoneSources.length > 0) {
      const extractedMilestones: NonNullable<DynamicBriefSection["content"]["milestones"]> = [];
      explicitMilestoneSources.forEach((src) => {
        (src.highlighted_passages || []).forEach((p) => {
          const dateMatch = p.match(/\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}|\d{4}|Phase\s+\d+|Stage\s+\d+|Q[1-4]\s+\d{4})\b/i);
          if (dateMatch && extractedMilestones.length < 4) {
            const timeLabel = dateMatch[1];
            const cleanDesc = p.replace(dateMatch[0], "").replace(/^[:\s\-—]+/, "").trim();
            if (cleanDesc.length > 15) {
              extractedMilestones.push({
                time_label: timeLabel,
                milestone: cleanDesc.length > 120 ? cleanDesc.slice(0, 117) + "..." : cleanDesc,
                source_name: src.name,
                source_url: src.url,
              });
            }
          }
        });
      });

      const validMilestones = extractedMilestones.filter(isValidTimelineMilestone);
      const distinctLabels = new Set(validMilestones.map((m) => m.time_label));
      if (validMilestones.length >= 2 && distinctLabels.size >= 2) {
        sections.push({
          id: `sec_chronology_${Date.now()}`,
          section_type: "real_world_chronology",
          title: "Timeline for Context",
          subtitle: "How this topic has developed across key milestones",
          badge: "Timeline",
          layout_style: "timeline",
          content: { milestones: validMilestones },
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
    // ONLY include if quotes originate strictly from authentic social media / community platforms (Reddit, Bluesky, X, Threads, HN)
    // AND are recent (within 60 days) and reflect authentic user discussion (NEVER corporate PR, landing page copy, or subreddit sidebars).
    const extractedQuotes: NonNullable<DynamicBriefSection["content"]["quotes"]> = [];
    sources.filter(isStrictSocialMediaSource).forEach((src) => {
      (src.highlighted_passages || []).forEach((p) => {
        const clean = p.replace(/^["']|["']$/g, "").trim();
        // Skip quotes referencing obsolete years (2020-2024)
        if (/\b(201[0-9]|202[0-4])\b/.test(clean)) return;
        if (!isAuthenticUserComment(clean)) return;

        if (clean.length > 25 && clean.length < 220 && extractedQuotes.length < 3) {
          extractedQuotes.push({
            quote: clean,
            speaker_or_community: src.name || "Community Discussion",
            platform: detectSocialPlatform(src.url || src.name),
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
 * Checks whether a source originates from an authentic social media / community platform
 * (e.g. Reddit, X/Twitter, Bluesky, Threads, Hacker News).
 * Strictly excludes corporate websites, PR pages, news publications, and generic open web domains.
 */
export function isStrictSocialMediaSource(src: EventSourceArticle | { url?: string; name?: string; published_at?: string }): boolean {
  const url = (src.url || "").toLowerCase();
  const name = (src.name || "").toLowerCase();

  // Reject encyclopedia, dictionary, wiki, or news sites
  if (
    url.includes("wikipedia.org") ||
    url.includes("wikimedia.org") ||
    url.includes("wiktionary.org") ||
    url.includes("britannica.com")
  ) {
    return false;
  }

  // Reject sources older than 60 days
  if (src.published_at) {
    const pub = new Date(src.published_at).getTime();
    if (!isNaN(pub) && Date.now() - pub > 60 * 24 * 60 * 60 * 1000) {
      return false;
    }
  }

  const isSocialUrl = (
    url.includes("reddit.com") ||
    url.includes("redd.it") ||
    url.includes("twitter.com") ||
    url.includes("x.com") ||
    url.includes("bsky.app") ||
    url.includes("threads.net") ||
    url.includes("news.ycombinator.com") ||
    url.includes("mastodon.") ||
    url.includes("lemmy.")
  );

  if (url && url !== "#") {
    return isSocialUrl;
  }

  const isSocialName = (
    name.startsWith("r/") ||
    name.includes("reddit") ||
    name.includes("bluesky") ||
    name.includes("hacker news") ||
    name.includes("twitter")
  );

  return isSocialName;
}

/**
 * Detects the platform identifier for a social media source.
 */
export function detectSocialPlatform(urlOrName: string): "reddit" | "x" | "bluesky" | "threads" | "hacker_news" | "social" {
  const lower = (urlOrName || "").toLowerCase();
  if (lower.includes("reddit") || lower.includes("redd.it")) return "reddit";
  if (lower.includes("x.com") || lower.includes("twitter")) return "x";
  if (lower.includes("bsky.app") || lower.includes("bluesky")) return "bluesky";
  if (lower.includes("threads.net") || lower.includes("threads")) return "threads";
  if (lower.includes("ycombinator") || lower.includes("hacker news")) return "hacker_news";
  return "social";
}

/**
 * Filters out subreddit sidebar descriptions, navigation boilerplate, forum rules, corporate slogans,
 * and encyclopedia definitions to ensure only authentic user discussion is used in Community Pulse.
 */
export function isAuthenticUserComment(passage: string): boolean {
  if (!passage || passage.trim().length < 20) return false;
  const lower = passage.toLowerCase().trim();

  // Filter out subreddit sidebar / directory / rules boilerplate & encyclopedic definitions
  const boilerplateIndicators = [
    "welcome to r/",
    "get real-time updates on",
    "rules of this subreddit",
    "a place to discuss",
    "post guidelines",
    "all posts must",
    "official subreddit",
    "sidebar",
    "moderators",
    "please read the rules",
    "subscribe to",
    "terms of service",
    "privacy policy",
    "cookie policy",
    "all rights reserved",
    "doing business as",
    "is an american spaceflight",
    "is an american aerospace",
    "is an american corporation",
    "is a corporation",
    "is a company",
    "headquartered in",
    "founded in",
    "the path to launch is filled with obstacles",
  ];

  if (boilerplateIndicators.some((ind) => lower.includes(ind))) {
    return false;
  }

  return true;
}

/**
 * Validates whether a timeline milestone represents a genuine historical or developmental
 * milestone spanning distinct calendar dates, rather than a concurrent breaking news timestamp.
 */
export function isValidTimelineMilestone(m: { time_label: string; milestone: string }): boolean {
  if (!m.milestone || m.milestone.trim().length < 5) return false;
  const label = (m.time_label || "").trim().toLowerCase();

  // Reject relative intraday or concurrent breaking labels
  if (
    /^(just now|today|yesterday|\d+\s*h(ours?)?\s*ago|\d+\s*m(in(utes?)?)?\s*ago|\d+\s*d(ays?)?\s*ago|recent|current)/i.test(label)
  ) {
    return false;
  }

  // A genuine milestone time label must specify a distinct calendar month/year, date, or structured phase
  // e.g. "Jan 2026", "Nov 2025", "2024", "Oct 14, 2025", "Phase 1: 2024", "Q3 2025"
  const hasCalendarDateOrPhase = (
    /\b(20[123][0-9])\b/.test(label) ||
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december)\b/i.test(label) ||
    /\b(phase|stage|version|v\d|q[1-4])\b/i.test(label)
  );

  return hasCalendarDateOrPhase;
}

/**
 * Cleans a raw article snippet from web wires:
 * - Strips leading duplicate title / headline if repeated at start
 * - Extracts complete, grammatical sentences ending in punctuation (. ! ?) without breaking decimal numbers
 * - Discards trailing dangling sentence fragments
 */
export function cleanArticleSnippet(title: string, rawText?: string): string {
  if (!rawText || rawText.trim().length === 0) return title.trim();
  let text = rawText.trim();

  // Strip leading duplicate title if present (case-insensitive, optional trailing colon/dash/space)
  const cleanTitle = title.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const titlePrefixRegex = new RegExp(`^${cleanTitle}[\\s:—–-]*`, "i");
  text = text.replace(titlePrefixRegex, "").trim();

  // Strip leading punctuation, dots, colons, or dashes
  text = text.replace(/^[.,:;—–\s-]+/, "").trim();

  if (text.length === 0) return title.trim();

  // Strip wire prefixes, timestamps, datelines, and metadata
  text = text
    .replace(/^\s*\b\d{1,2}\s+(hours?|days?|mins?|minutes?|weeks?|months?)\s+ago\s*[-—–·]?\s*/gi, "")
    .replace(/^[A-Z\s]{2,15}\s*\([^)]*\)\s*[-—–·]\s*/, "") // e.g. "WASHINGTON (AP) — "
    .replace(/^[A-Z\s]{2,15}\s*[-—–·]\s*/, "")
    .replace(/\b\d+\s*Members\s*Online\b/gi, "")
    .replace(/\bADMIN\s*MOD\b/gi, "")
    .replace(/\bPost\s*Karma\b/gi, "")
    .replace(/\br\/[a-zA-Z0-9_]+\b/gi, "")
    .replace(/\s*\([a-zA-Z0-9_-]{8,15}\)/g, "") // Strip YouTube/video alphanumeric hashes e.g. (n8Ndhm9wU8)
    .replace(/\s+[a-zA-Z0-9-]+\.(com|org|net|io|co|app)\.?$/gi, "") // Strip trailing raw domain e.g. "mshale.com"
    .replace(/^[.,:;—–\s-]+/, "")
    .trim();

  // Split into sentences ending with punctuation, safely preserving decimal numbers (e.g. 4.1x, 2.88 million)
  const sentenceMatches = text.match(/(?:[^.!?]|\d+\.\d+)+[.!?]+(?=\s+|$)/g);
  if (sentenceMatches && sentenceMatches.length > 0) {
    let combined = "";
    for (const s of sentenceMatches) {
      const trimmed = s.trim().replace(/^[.,:;—–\s-]+/, "");
      if ((combined + " " + trimmed).trim().length <= 280) {
        combined = (combined + " " + trimmed).trim();
      } else {
        if (!combined) combined = trimmed;
        break;
      }
    }
    if (combined.length > 20) {
      return combined.replace(/^[.,:;—–\s-]+/, "");
    }
  }

  // If no clean punctuation matched, truncate cleanly at last word boundary and end with period
  if (text.length > 240) {
    const lastSpace = text.lastIndexOf(" ", 240);
    text = (lastSpace > 50 ? text.slice(0, lastSpace) : text.slice(0, 240)).trim();
  }
  text = text.replace(/^[.,:;—–\s-]+/, "").trim();
  return text.endsWith(".") || text.endsWith("!") || text.endsWith("?") ? text : `${text}.`;
}

/**
 * Cleans a development title from raw headlines (strips clickbait suffixes, publisher tags, and trailing punctuation)
 * Safely preserves hyphenated words like "Self-Driving", "AI-Powered", "Next-Gen", and "Real-Time".
 */
export function cleanDevelopmentTitle(headline: string): string {
  if (!headline) return "Recent Development";
  let title = headline.trim().replace(/^[.,:;—–\s-]+/, "");

  // 1. Strip trailing bracketed sources or domains (e.g. " [basenor.com]", " [Reddit (r/TeslaFSD)]")
  title = title.replace(/\s*\[[^\]]+\]\s*$/g, "").trim();
  title = title.replace(/\s*\([a-zA-Z0-9_-]{8,15}\)/g, "").trim(); // video IDs
  title = title.replace(/\s*\([a-zA-Z0-9\s.,-]+\)\s*$/g, "").trim();

  // 2. Strip trailing pipe tags (e.g. " | Electrek")
  title = title.replace(/\s*\|\s*[^|]+$/g, "").trim();

  // 3. Strip trailing em-dash or en-dash tags (e.g. " — The Verge", " – Reuters")
  title = title.replace(/\s+[—–]\s+[^\s—–]+(?:\s+[^\s—–]+){0,4}$/g, "").trim();

  // 4. Strip trailing hyphen publisher tags ONLY when preceded by whitespace (e.g. " - Reuters", " - TechCrunch")
  title = title.replace(/\s+-\s+[^\s-]+(?:\s+[^\s-]+){0,4}$/g, "").trim();

  // 5. Strip trailing raw domain (e.g. "mshale.com")
  title = title.replace(/\s+[a-zA-Z0-9-]+\.(com|org|net|io|co|app)\.?$/gi, "").trim();

  // 6. Strip trailing colons, semicolons, or dashes
  title = title.replace(/[:;—–-]\s*$/g, "").trim();

  // 7. Clean up unbalanced surrounding quotes
  if (title.startsWith('"') && !title.endsWith('"')) {
    title = title.slice(1).trim();
  } else if (!title.startsWith('"') && title.endsWith('"') && !title.includes('"')) {
    title = title.slice(0, -1).trim();
  }

  if (title.startsWith("'") && !title.endsWith("'")) {
    title = title.slice(1).trim();
  }

  title = title.replace(/^[.,:;—–\s-]+/, "").trim();
  return title.length >= 5 ? title : headline.trim();
}

/**
 * Deterministic fallback for key developments: produces clean, articulate bullets
 * with preserved decimal numbers and complete sentences.
 */
export function synthesizeCleanDevelopments(
  cards: SynthesizedEventCard[]
): Array<{ title: string; text: string; source: string; source_url?: string }> {
  if (!cards || cards.length === 0) return [];

  return cards.slice(0, 3).map((c) => {
    const title = cleanDevelopmentTitle(c.headline);
    const text = cleanArticleSnippet(c.headline, c.summary);
    return {
      title,
      text,
      source: c.sources?.[0]?.name || "Reporting",
      source_url: c.sources?.[0]?.url,
    };
  });
}

/**
 * Synthesizes a high-level executive summary ("What's Happening Now")
 * that summarizes the SUBSTANTIVE content and developments across the articles
 * rather than mechanically concatenating raw headline titles.
 */
export function synthesizeCleanExecutiveTake(topic: string, cards: SynthesizedEventCard[]): string {
  if (!cards || cards.length === 0) {
    return `Things have been quiet for ${topic} lately, with no major breaking updates reported this week. We're actively monitoring live wires for emerging developments.`;
  }

  // Extract substantive article summaries and clean facts (NOT headline titles)
  const substantiveSnippets = cards
    .map((c) => {
      // 1. Prefer substantive summary if available and not just a repetition of the headline
      const cleanSum = cleanArticleSnippet(c.headline, c.summary);
      if (cleanSum && cleanSum.length >= 30 && !cleanSum.toLowerCase().startsWith(c.headline.toLowerCase().slice(0, 20))) {
        return cleanSum;
      }
      // 2. Fall back to top fact bullet if summary was sparse or redundant
      if (c.fact_bullets && c.fact_bullets.length > 0) {
        const topFact = c.fact_bullets[0].trim();
        if (topFact.length >= 25) {
          return topFact.endsWith(".") ? topFact : `${topFact}.`;
        }
      }
      return cleanSum || "";
    })
    .filter((s) => s.length > 20);

  if (substantiveSnippets.length === 0) {
    const entities = Array.from(new Set(cards.flatMap((c) => c.verified_entities || []))).slice(0, 4);
    if (entities.length > 0) {
      return `Recent reporting in ${topic} tracks ongoing developments involving ${entities.join(", ")}. Coverage is actively following emerging updates across primary sources.`;
    }
    return `Recent coverage in ${topic} is tracking multiple emerging developments across primary sources.`;
  }

  if (substantiveSnippets.length === 1) {
    return substantiveSnippets[0];
  }

  // When 2 or more stories exist, combine the substantive insights into a cohesive multi-sentence summary
  const first = substantiveSnippets[0].trim();
  const second = substantiveSnippets[1].trim();

  const cleanFirst = first.endsWith(".") || first.endsWith("!") || first.endsWith("?") ? first : `${first}.`;
  const cleanSecond = second.endsWith(".") || second.endsWith("!") || second.endsWith("?") ? second : `${second}.`;

  if (substantiveSnippets.length === 2) {
    if (!cleanFirst.toLowerCase().includes(cleanSecond.toLowerCase().slice(0, 25))) {
      const secondClean = cleanSecond.replace(/^[.,:;—–\s-]+/, "").trim();
      return `${cleanFirst} In parallel, ${secondClean.charAt(0).toLowerCase() + secondClean.slice(1)}`;
    }
    return cleanFirst;
  }

  // 3 or more stories: weave top substantive insights into an overarching summary
  const third = substantiveSnippets[2].trim();
  const cleanThird = third.endsWith(".") || third.endsWith("!") || third.endsWith("?") ? third : `${third}.`;
  const secondClean = cleanSecond.replace(/^[.,:;—–\s-]+/, "").trim();
  const thirdClean = cleanThird.replace(/^[.,:;—–\s-]+/, "").trim();

  if ((cleanFirst.length + secondClean.length) <= 320) {
    const combinedTwo = `${cleanFirst} In parallel, ${secondClean.charAt(0).toLowerCase() + secondClean.slice(1)}`;
    if (combinedTwo.length + thirdClean.length <= 440 && !combinedTwo.toLowerCase().includes(thirdClean.toLowerCase().slice(0, 25))) {
      return `${combinedTwo} Furthermore, ${thirdClean.charAt(0).toLowerCase() + thirdClean.slice(1)}`;
    }
    return combinedTwo;
  }

  return `${cleanFirst} In parallel, ${cleanSecond.charAt(0).toLowerCase() + cleanSecond.slice(1)}`;
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
      const socialSources = allKnownSources.filter(isStrictSocialMediaSource);
      const enrichedQuotes = sec.content.quotes
        .filter((q) => isAuthenticUserComment(q.quote))
        .map((q) => {
          let resolvedUrl = q.url;
          if (!resolvedUrl || !isStrictSocialMediaSource({ url: resolvedUrl })) {
            const match = socialSources.find((s) =>
              (q.speaker_or_community && s.name?.toLowerCase().includes(q.speaker_or_community.toLowerCase())) ||
              (q.quote && s.raw_text?.toLowerCase().includes(q.quote.toLowerCase().slice(0, 30)))
            );
            resolvedUrl = match?.url || socialSources[0]?.url;
          }

          const platform = detectSocialPlatform(resolvedUrl || q.platform || q.speaker_or_community || "");
          return {
            ...q,
            url: resolvedUrl || (platform === "reddit" ? "https://www.reddit.com" : undefined),
            platform,
          };
        });

      if (enrichedQuotes.length === 0) {
        return null;
      }
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
  }).filter((s): s is DynamicBriefSection => s !== null);
}


