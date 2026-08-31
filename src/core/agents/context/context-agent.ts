import { UnifiedTopicNode, AttachedStoryContext, TechnicalDepth } from "../../types/contracts";
import { traceLogger } from "../../observability/trace-logger";
import {
  SemanticTopicResolver,
  SemanticTopicResolutionResult,
} from "../../search/semantic-topic-resolver";

export interface ContextFraming {
  empath_instructions: string;
  active_sensitivities: string[];
  active_boundaries: string[];
  calibrated_depth: string;
  why_they_care_context: string[];
  pedagogical_guidance: string;
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
    attachedStory?: AttachedStoryContext
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

    const empathInstructions = `
[CONTEXT AGENT - THE EMPATH GUIDANCE]:
1. IDENTIFIED TOPIC & SEMANTIC INTENT:
   - Core Subject Discussed: "${semanticResult.identified_discussion_subject}"
   - Semantic Rationale: ${semanticResult.semantic_reasoning_summary}

2. EMOTIONAL TRAJECTORY & PEER TONE:
   - Current user psychological state: "${psych.emotional_trajectory}".
   - Communication tone: "${psych.communication_style}".

3. INTELLECTUAL CALIBRATION & DEPTH:
   - Calibrated technical depth level: ${calibratedDepth}.
   - Frame explanations directly at this level without patronizing or over-simplifying.

4. ACTIVATED GRAPH TOPICS & MOTIVATIONS (WHY THEY CARE):
${whyTheyCareLines.length > 0 ? whyTheyCareLines.join("\n") : "   * High-agency technology, engineering elegance, and autonomous resilience."}
${intersectionLines.length > 0 ? `\nACTIVE GRAPH INTERSECTIONS:\n${intersectionLines.join("\n")}` : ""}

5. ACTIVE PSYCHOLOGICAL SAFEGUARDS & BOUNDARIES:
   - SENSITIVITIES: ${(psych.sensitivities || []).join("; ") || "None specified"}
   - HARD BOUNDARIES: ${(psych.boundaries || []).join("; ") || "Never speak out of turn; strict factual substantiation; zero artificial condescension"}

6. INVISIBLE STEERING (CRITICAL NEGATIVE CONSTRAINTS):
   - Let known user values subtly direct your answers rather than announcing or narrating connections.
   - NEVER mention user personal projects, hobbies, or previous unrelated personal topics as analogies for geopolitical, military, or macroeconomic events.
   - NEVER say "As someone who cares about X..." or "That's the same engineering rigor you appreciate".
   - NEVER end responses with sycophantic praise or formulaic survey wrap-up questions ("Is that the angle that draws you in...?").
   - Speak naturally, substantively, and objectively as a sharp intellectual peer.
`.trim();

    const pedagogicalGuidance = `Frame responses with ${calibratedDepth} depth on '${semanticResult.identified_discussion_subject}', respecting sensitivities: [${(psych.sensitivities || []).join(", ")}].`;

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
        total_registered_topics: Object.keys(unifiedNode.topics || {}).length,
      },
      output_summary: {
        identified_discussion_subject: semanticResult.identified_discussion_subject,
        emotional_trajectory: psych.emotional_trajectory,
        calibrated_depth: calibratedDepth,
        selected_topics_count: semanticResult.selected_topics.length,
        selected_topics: semanticResult.selected_topics.map((t) => t.topic_name),
        safeguards_active: (psych.sensitivities || []).length + (psych.boundaries || []).length,
      },
      reasoning_rationale: semanticResult.semantic_reasoning_summary,
      latency_ms: latency,
      metadata: {
        psychological_profile: psych,
        semantic_resolution: semanticResult,
      },
    });

    return {
      empath_instructions: empathInstructions,
      active_sensitivities: psych.sensitivities || [],
      active_boundaries: psych.boundaries || [],
      calibrated_depth: calibratedDepth,
      why_they_care_context: whyTheyCareLines,
      pedagogical_guidance: pedagogicalGuidance,
      semantic_resolution: semanticResult,
      trace_id: traceId,
    };
  }
}
