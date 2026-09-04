import {
  UnifiedTopicNode,
  AttachedStoryContext,
  AttachedTopicBriefContext,
  TechnicalDepth,
  RetrievedStoryContext,
} from "../../types/contracts";
import { traceLogger } from "../../observability/trace-logger";
import {
  SemanticTopicResolver,
  SemanticTopicResolutionResult,
} from "../../search/semantic-topic-resolver";

export interface CandidateFeedStory {
  event_id: string;
  headline: string;
  topic: string;
  summary: string;
  fact_bullets?: string[];
  disputed_claims?: Array<{ claim: string; divergence_reason: string }>;
}

export interface ContextFraming {
  empath_instructions: string;
  calibrated_depth: TechnicalDepth;
  emotional_trajectory: string;
  active_sensitivities: string[];
  active_boundaries: string[];
  why_they_care_context: string[];
  pedagogical_guidance: string;
  pedagogical_strategy?: string;
  retrieved_stories?: RetrievedStoryContext[];
  semantic_resolution?: SemanticTopicResolutionResult;
  trace_id: string;
}

export class ContextAgent {
  /**
   * Generates empathetic context framing and psychological safeguards using AI semantic topic & graph resolution
   */
  public static async generateContextFraming(
    unifiedNode: UnifiedTopicNode,
    chatHistory: Array<{ role: string; content: string }> = [],
    lastUserMessage: string = "",
    attachedStory?: AttachedStoryContext,
    candidateStories?: CandidateFeedStory[],
    attachedTopicBrief?: AttachedTopicBriefContext
  ): Promise<ContextFraming> {
    const startTime = Date.now();
    const traceId = `trace_ctx_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    const psych = unifiedNode.psychological_profile || {
      emotional_trajectory: "Grounded and analytical",
      sensitivities: [],
      boundaries: [],
      communication_style: "Direct, concise, rigorous peer",
    };

    // 1. Run AI Semantic Topic & Graph Resolution across dialogue thread
    const semanticResult = await SemanticTopicResolver.resolveContextualTopics(
      unifiedNode,
      chatHistory,
      lastUserMessage,
      attachedStory
    );

    const calibratedDepth: TechnicalDepth = semanticResult.calibrated_overall_depth || "practitioner";

    // Topic-scoped safeguard filtering: retain universal safeguards, exclude inactive topic-specific baggage
    const activeTopicNames = new Set(
      semanticResult.selected_topics.map((t) => t.topic_name.toLowerCase())
    );
    const activeSubject = (semanticResult.identified_discussion_subject || "").toLowerCase();
    const userMessageLower = lastUserMessage.toLowerCase();

    // Identify registered topics not active in the current turn
    const inactiveTopics = Object.keys(unifiedNode.topics || {}).filter(
      (t) =>
        !activeTopicNames.has(t.toLowerCase()) &&
        !activeSubject.includes(t.toLowerCase()) &&
        !userMessageLower.includes(t.toLowerCase())
    );

    const filterSafeguards = (items: string[]): string[] => {
      return items.filter((item) => {
        const itemLower = item.toLowerCase();
        // Check if this item is explicitly anchored to an inactive topic
        const isAnchoredToInactive = inactiveTopics.some((inactive) => {
          const inactiveWords = inactive.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
          return inactiveWords.length > 0 && inactiveWords.every((w) => itemLower.includes(w));
        });
        return !isAnchoredToInactive;
      });
    };

    const activeSensitivities = filterSafeguards(psych.sensitivities || []);
    const activeBoundaries = filterSafeguards(psych.boundaries || []);

    // Calibrate emotional trajectory: if discussion has pivoted to a novel domain, avoid bleeding old topic posture
    const isNovelTopic = semanticResult.selected_topics.length === 0;
    const emotionalTrajectory = isNovelTopic
      ? psych.emotional_trajectory &&
        !inactiveTopics.some((t) => psych.emotional_trajectory!.toLowerCase().includes(t.toLowerCase()))
        ? psych.emotional_trajectory
        : "Discerning and analytical, seeking factual substantiation"
      : psych.emotional_trajectory;

    // 2. Build topic motivations list from AI-selected topics and active graph connections
    const whyTheyCareLines = semanticResult.selected_topics.map((t) => {
      const connStr =
        t.graph_connection_type !== "direct_match"
          ? ` [Graph Connection: ${t.graph_connection_type.replace("_", " ")}]`
          : "";
      return `* ${t.topic_name}${connStr}: ${t.why_they_care} (Relevance: ${Math.round(t.relevance_score * 100)}%, Depth: ${t.calibrated_depth})`;
    });

    // 3. Assemble active intersection guidance if present
    const intersectionLines = semanticResult.active_intersections.map(
      (i) => `   * Intersectional Synergy: "${i.theme}" - ${i.rationale}`
    );

    // 4. Contextual Story Relevance Filtering & Deep Details Extraction
    const retrievedStories: RetrievedStoryContext[] = [];

    if (candidateStories && candidateStories.length > 0) {
      const activeSubject = (semanticResult.identified_discussion_subject || "").toLowerCase();
      const userTerms = lastUserMessage.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
      const selectedTopicNames = semanticResult.selected_topics.map((t) => t.topic_name.toLowerCase());

      const scoredStories = candidateStories.map((story) => {
        let score = 0.0;
        const reasons: string[] = [];

        // Direct attached story match
        if (attachedStory && attachedStory.event_id === story.event_id) {
          score = 1.0;
          reasons.push("Directly attached by user for focused discussion");
        } else {
          const storyText = `${story.topic} ${story.headline} ${story.summary}`.toLowerCase();

          // Topic / Subject alignment
          if (activeSubject && (storyText.includes(activeSubject) || activeSubject.includes(story.topic.toLowerCase()))) {
            score += 0.45;
            reasons.push(`Direct alignment with discussed subject '${semanticResult.identified_discussion_subject}'`);
          }

          // Matched selected graph topics
          for (const top of selectedTopicNames) {
            if (storyText.includes(top) || top.includes(story.topic.toLowerCase())) {
              score += 0.35;
              reasons.push(`Matches active knowledge graph topic '${top}'`);
              break;
            }
          }

          // User query term matches
          let termMatches = 0;
          for (const term of userTerms) {
            if (storyText.includes(term)) {
              termMatches++;
            }
          }
          if (termMatches > 0) {
            const termBoost = Math.min(0.35, termMatches * 0.12);
            score += termBoost;
            reasons.push(`Contains ${termMatches} relevant query keyword matches`);
          }
        }

        const finalScore = Math.min(1.0, Number(score.toFixed(2)));
        return {
          story,
          score: finalScore,
          rationale: reasons.join("; ") || "General background relevance",
        };
      });

      // Filter to only high-relevance stories (score >= 0.40), sorted descending, max 4
      const topScored = scoredStories
        .filter((s) => s.score >= 0.40)
        .sort((a, b) => b.score - a.score)
        .slice(0, 4);

      for (const item of topScored) {
        retrievedStories.push({
          event_id: item.story.event_id,
          headline: item.story.headline,
          topic: item.story.topic,
          summary: item.story.summary,
          fact_bullets: item.story.fact_bullets || [],
          relevance_score: item.score,
          relevance_rationale: item.rationale,
        });
      }
    }

    const relevantStoriesSection =
      retrievedStories.length > 0
        ? `\n7. CONTEXTUALLY RETRIEVED FEED STORIES & VERIFIED DETAILS (TOPIC-RELEVANT ONLY):\n` +
          retrievedStories
            .map(
              (s, i) =>
                `[Story ${i + 1} | Event ID: "${s.event_id}" | Topic: "${s.topic}" | Relevance: ${Math.round(
                  s.relevance_score * 100
                )}%]\nHeadline: ${s.headline}\nSummary: ${s.summary}${
                  s.fact_bullets && s.fact_bullets.length > 0
                    ? `\nVerified Key Facts:\n${s.fact_bullets.map((f) => `  * ${f}`).join("\n")}`
                    : ""
                }\nRelevance Rationale: ${s.relevance_rationale}`
            )
            .join("\n\n")
        : "\n7. RELEVANT FEED STORIES:\n   * No stories in the active feed currently match this specific conversation turn.";

    const empathInstructions = `
[CONTEXT AGENT - THE EMPATH GUIDANCE]:
1. IDENTIFIED TOPIC & SEMANTIC INTENT:
   - Core Subject Discussed: "${semanticResult.identified_discussion_subject}"
   - Semantic Rationale: ${semanticResult.semantic_reasoning_summary}

2. EMOTIONAL TRAJECTORY & PEER TONE:
   - Current user psychological state: "${emotionalTrajectory}".
   - Communication tone: "${psych.communication_style}".

3. INTELLECTUAL CALIBRATION & DEPTH:
   - Calibrated technical depth level: ${calibratedDepth}.
   - Frame explanations directly at this level without patronizing or over-simplifying.

4. ACTIVATED GRAPH TOPICS & MOTIVATIONS (WHY THEY CARE):
${whyTheyCareLines.length > 0 ? whyTheyCareLines.join("\n") : "   * Novel domain without pre-assigned knowledge graph anchors."}
${intersectionLines.length > 0 ? `\nACTIVE GRAPH INTERSECTIONS:\n${intersectionLines.join("\n")}` : ""}

5. ACTIVE PSYCHOLOGICAL SAFEGUARDS & BOUNDARIES:
   - SENSITIVITIES: ${activeSensitivities.join("; ") || "None specified"}
   - HARD BOUNDARIES: ${activeBoundaries.join("; ") || "Never speak out of turn; strict factual substantiation; zero artificial condescension"}

6. INVISIBLE STEERING (CRITICAL NEGATIVE CONSTRAINTS):
   - Let known user values subtly direct your answers rather than announcing or narrating connections.
   - NEVER mention user personal projects, hobbies, or previous unrelated personal topics as analogies for geopolitical, military, or macroeconomic events.
   - NEVER say "As someone who cares about X..." or "That's the same engineering rigor you appreciate".
   - NEVER end responses with sycophantic praise or formulaic survey wrap-up questions ("Is that the angle that draws you in...?").
   - Speak naturally, substantively, and objectively as a sharp intellectual peer.

${
  attachedTopicBrief
    ? `7. ATTACHED LIVING EVENT TOPIC DOSSIER:
   - Event Topic: "${attachedTopicBrief.topic_title}" (Parent Domain: "${attachedTopicBrief.parent_interest}")
   - Lifecycle State: ${attachedTopicBrief.lifecycle_label} (${attachedTopicBrief.lifecycle_phase}) · Gravity: ${attachedTopicBrief.gravity_score}/100
   - Current Focus ("The Now"): ${attachedTopicBrief.current_focus}
   - Executive Summary: ${attachedTopicBrief.executive_summary}
   ${attachedTopicBrief.public_sentiment ? `- Public Sentiment: Tone ${attachedTopicBrief.public_sentiment.tone.toUpperCase()} — ${attachedTopicBrief.public_sentiment.summary}` : ""}
   ${
     attachedTopicBrief.historical_arc && attachedTopicBrief.historical_arc.length > 0
       ? `- Historical Arc: ${attachedTopicBrief.historical_arc.map((m) => `[${m.time_label}] ${m.milestone}`).join(" -> ")}`
       : ""
   }
`
    : ""
}${relevantStoriesSection}
`.trim();

    const pedagogicalGuidance = `Frame responses with ${calibratedDepth} depth on '${semanticResult.identified_discussion_subject}', respecting sensitivities: [${activeSensitivities.join(", ")}].`;

    const latency = Date.now() - startTime;

    // Log structured trace for Observability
    traceLogger.logTrace({
      trace_id: traceId,
      session_id: `ctx_${unifiedNode.user_id}`,
      timestamp: new Date().toISOString(),
      node_name: "node_context",
      input_summary: {
        user_id: unifiedNode.user_id,
        last_user_message: lastUserMessage.slice(0, 100),
        attached_story: attachedStory?.headline || null,
        attached_topic_brief: attachedTopicBrief?.topic_title || null,
        total_registered_topics: Object.keys(unifiedNode.topics || {}).length,
        candidate_stories_count: candidateStories?.length || 0,
      },
      output_summary: {
        identified_discussion_subject: semanticResult.identified_discussion_subject,
        emotional_trajectory: emotionalTrajectory,
        calibrated_depth: calibratedDepth,
        selected_topics_count: semanticResult.selected_topics.length,
        selected_topics: semanticResult.selected_topics.map((t) => t.topic_name),
        retrieved_stories_count: retrievedStories.length,
        safeguards_active: activeSensitivities.length + activeBoundaries.length,
      },
      reasoning_rationale: semanticResult.semantic_reasoning_summary,
      latency_ms: latency,
      metadata: {
        psychological_profile: psych,
        semantic_resolution: semanticResult,
        retrieved_stories: retrievedStories,
      },
    });

    return {
      empath_instructions: empathInstructions,
      emotional_trajectory: emotionalTrajectory,
      active_sensitivities: activeSensitivities,
      active_boundaries: activeBoundaries,
      calibrated_depth: calibratedDepth,
      why_they_care_context: whyTheyCareLines,
      pedagogical_guidance: pedagogicalGuidance,
      retrieved_stories: retrievedStories,
      semantic_resolution: semanticResult,
      trace_id: traceId,
    };
  }
}
