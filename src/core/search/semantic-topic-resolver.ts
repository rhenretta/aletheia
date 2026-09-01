import {
  UnifiedTopicNode,
  AttachedStoryContext,
  TechnicalDepth,
  TopicMetadata,
} from "../types/contracts";
import { deepseekProvider } from "../llm/deepseek-provider";

export interface SelectedTopicContext {
  topic_name: string;
  relevance_score: number; // 0.0 to 1.0
  relevance_rationale: string;
  why_they_care: string;
  calibrated_depth: TechnicalDepth;
  curiosity_vectors: string[];
  graph_connection_type: "direct_match" | "interest_intersection" | "curiosity_frontier" | "thematic_expansion";
  connecting_node?: string;
}

export interface SemanticTopicResolutionResult {
  identified_discussion_subject: string;
  selected_topics: SelectedTopicContext[];
  calibrated_overall_depth: TechnicalDepth;
  active_intersections: Array<{ theme: string; rationale: string }>;
  new_topic_candidates?: Array<{
    topic_name: string;
    why_they_care: string;
    suggested_initial_weight: number;
    suggested_depth: TechnicalDepth;
    curiosity_vectors: string[];
  }>;
  semantic_reasoning_summary: string;
}

export class SemanticTopicResolver {
  /**
   * Uses AI reasoning to semantically identify the discussed subject across dialogue history,
   * compare it against canonical topics & graph connections, and intelligently select context topics.
   */
  public static async resolveContextualTopics(
    unifiedNode: UnifiedTopicNode,
    chatHistory: Array<{ role: string; content: string }> = [],
    lastUserMessage: string = "",
    attachedStory?: AttachedStoryContext
  ): Promise<SemanticTopicResolutionResult> {
    const existingTopics = unifiedNode.topics || {};
    const intersections = unifiedNode.interest_intersections || [];
    const frontiers = unifiedNode.adjacent_curiosity_frontiers || [];

    // If no LLM configured or empty history, use semantic graph heuristics
    if (!deepseekProvider.isConfigured() || (lastUserMessage.trim().length === 0 && chatHistory.length === 0)) {
      return this.heuristicFallbackResolution(unifiedNode, lastUserMessage, attachedStory);
    }

    try {
      const topicSummaries = Object.entries(existingTopics).map(([name, meta]) => ({
        topic: name,
        weight: meta.weight,
        depth: meta.technical_depth,
        why_they_care: meta.why_they_care,
        curiosity_vectors: meta.curiosity_vectors || [],
      }));

      const intersectionSummaries = intersections.map((i) => ({
        theme: i.intersection_theme,
        connects: [i.interest_a, i.interest_b],
        hypothesis: i.hypothesis,
      }));

      const frontierSummaries = frontiers.map((f) => ({
        topic: f.topic,
        connected_to: f.connected_to,
        rationale: f.rationale,
      }));

      const recentTurns = chatHistory.slice(-5).map((m) => `${m.role.toUpperCase()}: ${m.content}`).join("\n");
      const storyInfo = attachedStory
        ? `Attached Story Context: "${attachedStory.headline}" (Topic: ${attachedStory.topic})\nSummary: ${attachedStory.summary}`
        : "No attached story.";

      const systemPrompt = `You are the Semantic Topic & Graph Resolver in the Mind-State Memory Architecture.
Your role:
1. Identify the CORE SUBJECT and INTENT being discussed by the USER (resolving pronouns like "they", "it", or contextual shorthand across recent turns).
2. Compare the identified subject against the user's Knowledge Graph (Canonical Topics, Interest Intersections, and Curiosity Frontiers).
3. Select and rank the most relevant topics from the graph to include in the context envelope for the upcoming response.
4. If the user explicitly asks about a novel subject not in the graph, identify it as a "new_topic_candidate".

CRITICAL GUARDRAILS:
- Focus exclusively on the subject matter the USER brought up or asked about.
- NEVER generate candidate topics based on the assistant's greeting, meta-framing, or app terminology (e.g. NEVER propose "Epistemology", "Cognitive Psychology", "Decision-making", or "Mindset" unless the USER explicitly brought them up).
- If the user only asks an open-ended question like "What should we talk about", "identified_discussion_subject" is "Open Topic Exploration" and "new_topic_candidates" MUST BE [].

User's Canonical Knowledge Graph Topics:
${JSON.stringify(topicSummaries, null, 2)}

Graph Intersections:
${JSON.stringify(intersectionSummaries, null, 2)}

Curiosity Frontiers:
${JSON.stringify(frontierSummaries, null, 2)}

Output strict JSON in this format:
{
  "semantic_reasoning_summary": string,
  "identified_discussion_subject": string,
  "calibrated_overall_depth": "introductory" | "practitioner" | "expert" | "deep_technical",
  "selected_topics": [
    {
      "relevance_rationale": string,
      "topic_name": string,
      "relevance_score": number (0.0 to 1.0),
      "graph_connection_type": "direct_match" | "interest_intersection" | "curiosity_frontier" | "thematic_expansion",
      "connecting_node": string or null
    }
  ],
  "active_intersections": [
    {
      "rationale": string,
      "theme": string
    }
  ],
  "new_topic_candidates": [
    {
      "why_they_care": string,
      "topic_name": string,
      "suggested_initial_weight": number (0.1 to 1.0),
      "suggested_depth": "introductory" | "practitioner" | "expert" | "deep_technical",
      "curiosity_vectors": string[]
    }
  ]
}`;

      const prompt = `Recent Conversation History:
${recentTurns || `USER: ${lastUserMessage}`}

Active User Prompt:
"${lastUserMessage}"

${storyInfo}`;

      const result = await deepseekProvider.generateCompletion(prompt, {
        systemPrompt,
        temperature: 0.2,
      });

      const cleanJson = result.text.replace(/```json\n?|\n?```/g, "").trim();
      const parsed = JSON.parse(cleanJson);

      const selectedTopics: SelectedTopicContext[] = (parsed.selected_topics || []).map((st: any) => {
        const canonical = existingTopics[st.topic_name];
        return {
          topic_name: st.topic_name,
          relevance_score: typeof st.relevance_score === "number" ? st.relevance_score : 0.85,
          relevance_rationale: st.relevance_rationale || "Direct semantic relevance to active discussion.",
          why_they_care: canonical?.why_they_care || "Evolving interest in this domain.",
          calibrated_depth: canonical?.technical_depth || parsed.calibrated_overall_depth || "practitioner",
          curiosity_vectors: canonical?.curiosity_vectors || [],
          graph_connection_type: st.graph_connection_type || "direct_match",
          connecting_node: st.connecting_node || undefined,
        };
      });

      // Fallback if model returned empty selected topics: pick highest weight canonical topic
      if (selectedTopics.length === 0 && Object.keys(existingTopics).length > 0) {
        const topTopicName = Object.entries(existingTopics).sort(([, a], [, b]) => b.weight - a.weight)[0][0];
        const canonical = existingTopics[topTopicName];
        selectedTopics.push({
          topic_name: topTopicName,
          relevance_score: 0.7,
          relevance_rationale: "Default top affinity baseline topic in knowledge graph.",
          why_they_care: canonical.why_they_care,
          calibrated_depth: canonical.technical_depth,
          curiosity_vectors: canonical.curiosity_vectors || [],
          graph_connection_type: "direct_match",
        });
      }

      return {
        identified_discussion_subject: parsed.identified_discussion_subject || "General Inquiry",
        selected_topics: selectedTopics,
        calibrated_overall_depth: parsed.calibrated_overall_depth || "practitioner",
        active_intersections: parsed.active_intersections || [],
        new_topic_candidates: parsed.new_topic_candidates || [],
        semantic_reasoning_summary:
          parsed.semantic_reasoning_summary ||
          `Semantically identified '${parsed.identified_discussion_subject}' and activated ${selectedTopics.length} relevant topic nodes.`,
      };
    } catch (err) {
      console.warn("SemanticTopicResolver LLM error, falling back to heuristic graph resolution:", err);
      return this.heuristicFallbackResolution(unifiedNode, lastUserMessage, attachedStory);
    }
  }

  /**
   * Fast graph-aware heuristic fallback if LLM is unavailable
   */
  private static heuristicFallbackResolution(
    unifiedNode: UnifiedTopicNode,
    lastUserMessage: string = "",
    attachedStory?: AttachedStoryContext
  ): SemanticTopicResolutionResult {
    const existingTopics = unifiedNode.topics || {};
    const combinedText = `${lastUserMessage} ${attachedStory?.headline || ""} ${attachedStory?.topic || ""}`.toLowerCase();

    const selectedTopics: SelectedTopicContext[] = [];

    for (const [topicName, meta] of Object.entries(existingTopics)) {
      const nameMatch = combinedText.includes(topicName.toLowerCase());
      const vectorMatch = (meta.curiosity_vectors || []).some((v) => combinedText.includes(v.toLowerCase()));

      if (nameMatch || vectorMatch || meta.weight >= 0.8) {
        selectedTopics.push({
          topic_name: topicName,
          relevance_score: nameMatch ? 0.95 : vectorMatch ? 0.85 : meta.weight * 0.7,
          relevance_rationale: nameMatch
            ? "Exact topic match in text."
            : vectorMatch
            ? "Curiosity vector semantic overlap."
            : "High baseline affinity weight.",
          why_they_care: meta.why_they_care,
          calibrated_depth: meta.technical_depth,
          curiosity_vectors: meta.curiosity_vectors || [],
          graph_connection_type: "direct_match",
        });
      }
    }

    // Sort by relevance score
    selectedTopics.sort((a, b) => b.relevance_score - a.relevance_score);

    const primaryDepth = selectedTopics[0]?.calibrated_depth || "practitioner";

    return {
      identified_discussion_subject: attachedStory?.topic || (selectedTopics[0]?.topic_name || "General Inquiry"),
      selected_topics: selectedTopics.slice(0, 3),
      calibrated_overall_depth: primaryDepth,
      active_intersections: [],
      semantic_reasoning_summary: `Heuristically selected ${selectedTopics.length} topics based on context vectors and affinity weights.`,
    };
  }
}
