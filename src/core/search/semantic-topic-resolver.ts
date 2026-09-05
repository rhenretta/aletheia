import {
  UnifiedTopicNode,
  AttachedStoryContext,
  TechnicalDepth,
  TopicMetadata,
  generateTopicId,
} from "../types/contracts";
import { deepseekProvider } from "../llm/deepseek-provider";

export interface SelectedTopicContext {
  topic_id?: string;
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
    topic_id?: string;
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
      return this.heuristicFallbackResolution(unifiedNode, lastUserMessage, attachedStory, chatHistory);
    }

    try {
      const topicSummaries = Object.entries(existingTopics).map(([name, meta]) => ({
        topic_id: meta.topic_id || generateTopicId(name),
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
4. If the user mentions or asks about novel subjects or domains not in the graph, identify each as a "new_topic_candidate".
5. MULTI-TOPIC REGISTRATION MANDATE: When the user shares multiple areas of interest, hobbies, or domains (e.g. "I like to learn about X, Y, and Z"), you MUST extract EACH distinct, substantive real-world domain as its own individual entry in "new_topic_candidates" with an appropriate rationale and curiosity vectors. Do NOT collapse them into a single generic bucket.

CRITICAL GUARDRAILS:
- Focus exclusively on the subject matter the USER brought up or asked about.
- NEVER generate candidate topics based on the assistant's greeting, meta-framing, or app terminology (e.g. NEVER propose "Epistemology", "Cognitive Psychology", "Decision-making", or "Mindset" unless the USER explicitly brought them up).
- If and ONLY if the user's prompt is completely devoid of concrete subjects or interests (e.g. purely asking "What should we talk about?", "Surprise me", or "Hello"), set "identified_discussion_subject" to "Open Topic Exploration" and "new_topic_candidates" to []. If the user listed specific interest areas, extract all of them into "new_topic_candidates".

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
      "topic_name": "Concise canonical entity/domain name without parentheticals or inquiry qualifiers",
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

      const selectedTopics: SelectedTopicContext[] = (parsed.selected_topics || [])
        .filter((st: any) => st.topic_name && existingTopics[st.topic_name] && (typeof st.relevance_score !== "number" || st.relevance_score >= 0.50))
        .map((st: any) => {
          const canonical = existingTopics[st.topic_name];
          const topicId = canonical?.topic_id || generateTopicId(st.topic_name);
          return {
            topic_id: topicId,
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

      const normalizedCandidates = (parsed.new_topic_candidates || []).map((tc: any) => {
        const cleanName = tc.topic_name
          ? tc.topic_name.replace(/\([^)]*\)/g, "").replace(/\s+/g, " ").trim()
          : tc.topic_name;
        return {
          ...tc,
          topic_id: generateTopicId(cleanName),
          topic_name: cleanName,
        };
      });

      return {
        identified_discussion_subject: parsed.identified_discussion_subject || "General Inquiry",
        selected_topics: selectedTopics,
        calibrated_overall_depth: parsed.calibrated_overall_depth || "practitioner",
        active_intersections: parsed.active_intersections || [],
        new_topic_candidates: normalizedCandidates,
        semantic_reasoning_summary:
          parsed.semantic_reasoning_summary ||
          `Semantically identified '${parsed.identified_discussion_subject}' and activated ${selectedTopics.length} relevant topic nodes.`,
      };
    } catch (err) {
      console.warn("SemanticTopicResolver LLM error, falling back to heuristic graph resolution:", err);
      return this.heuristicFallbackResolution(unifiedNode, lastUserMessage, attachedStory, chatHistory);
    }
  }

  /**
   * Fast graph-aware heuristic fallback if LLM is unavailable
   */
  private static heuristicFallbackResolution(
    unifiedNode: UnifiedTopicNode,
    lastUserMessage: string = "",
    attachedStory?: AttachedStoryContext,
    chatHistory: Array<{ role: string; content: string }> = []
  ): SemanticTopicResolutionResult {
    const existingTopics = unifiedNode.topics || {};
    const historyText = chatHistory.map((m) => m.content).join(" ");
    const combinedText = `${lastUserMessage} ${historyText} ${attachedStory?.headline || ""} ${attachedStory?.topic || ""}`.toLowerCase();

    const selectedTopics: SelectedTopicContext[] = [];

    for (const [topicName, meta] of Object.entries(existingTopics)) {
      const nameMatch = combinedText.includes(topicName.toLowerCase());
      const vectorMatch = (meta.curiosity_vectors || []).some((v) => combinedText.includes(v.toLowerCase()));

      if (nameMatch || vectorMatch) {
        const topicId = meta.topic_id || generateTopicId(topicName);
        selectedTopics.push({
          topic_id: topicId,
          topic_name: topicName,
          relevance_score: nameMatch ? 0.95 : 0.85,
          relevance_rationale: nameMatch
            ? "Exact topic match in text."
            : "Curiosity vector semantic overlap.",
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
