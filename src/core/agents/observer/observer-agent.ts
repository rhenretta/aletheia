import {
  UnifiedTopicNode,
  BehavioralTelemetry,
  TechnicalDepth,
  TopicMetadata,
  TopicUpdateDiff,
} from "../../types/contracts";
import { traceLogger } from "../../observability/trace-logger";
import { deepseekProvider } from "../../llm/deepseek-provider";
import { postgresStore } from "../../storage/postgres-store";

export interface ObserverAdaptationResult {
  adapted_node: UnifiedTopicNode;
  adaptations_made: Array<{
    category: "emotional_trajectory" | "topic_weights" | "why_they_care" | "technical_depth" | "sensitivity" | "boundary";
    description: string;
    evidence: string;
  }>;
  topic_diffs: TopicUpdateDiff[];
  trace_id: string;
}

export class ObserverAgent {
  /**
   * Silently evaluates conversational feedback, sentiment, and telemetry to update the Unified Topic Node
   */
  public static async observeAndAdapt(
    unifiedNode: UnifiedTopicNode,
    chatHistory: Array<{ role: string; content: string }>,
    telemetry?: BehavioralTelemetry[]
  ): Promise<ObserverAdaptationResult> {
    const startTime = Date.now();
    const traceId = `trace_obs_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const adaptationsMade: ObserverAdaptationResult["adaptations_made"] = [];
    const topicDiffs: TopicUpdateDiff[] = [];
    let rawSystemPrompt: string | undefined;
    let rawUserPrompt: string | undefined;
    let rawLLMCompletion: string | undefined;
    let parsedLLMResponse: any;

    // Clone the existing node to build the adapted version
    const adaptedNode: UnifiedTopicNode = JSON.parse(JSON.stringify(unifiedNode));
    if (!adaptedNode.recent_topic_diffs) {
      adaptedNode.recent_topic_diffs = [];
    }

    const recentUserMessages = chatHistory
      .filter((m) => m.role === "user")
      .map((m) => m.content)
      .slice(-3);

    const lastUserMessage = recentUserMessages[recentUserMessages.length - 1] || "";

    // Step 1: If DeepSeek is available, perform deep psychological and motivation extraction
    if (deepseekProvider.isConfigured() && lastUserMessage.length > 5) {
      try {
        const systemPrompt = `You are the Observer Agent in the Mind-State Memory Architecture.
Your role is silent, empathetic, and continuous adaptation. You analyze ONLY the USER's conversational inputs to infer:
1. "emotional_trajectory": The user's updated psychological state and mindset (e.g. "curious and analytical", "fatigued by market hype", "seeking practical engineering clarity").
2. "detected_sensitivities": Any subtle sensitivities, pet peeves, or communication preferences revealed EXCLUSIVELY by the user.
3. "detected_boundaries": Hard boundaries or topics the user explicitly or implicitly wants to avoid.
4. "topic_updates": Evolving topics or brand new topics discussed, with inferred "why_they_care" motivation, "curiosity_vectors" (keywords), and "technical_depth" ("introductory" | "practitioner" | "expert" | "deep_technical").

CRITICAL GUARDRAILS:
- NEVER extract sensitivities or preferences from statements or analogies made by the ASSISTANT.
- Base all inferences exclusively on the USER's words and revealed values.
- If the user discusses a new subject not yet in Existing Topics, include it in "topic_updates" with a reasonable starting weight (0.7-0.85).

Existing Topics: ${Object.keys(adaptedNode.topics || {}).join(", ")}
Current Emotional Trajectory: "${adaptedNode.psychological_profile?.emotional_trajectory || "Grounded"}"

Output strict JSON:
{
  "updated_emotional_trajectory": string,
  "new_sensitivities": string[],
  "new_boundaries": string[],
  "topic_updates": [
    {
      "topic": string,
      "weight_delta": number,
      "why_they_care": string,
      "technical_depth": "introductory" | "practitioner" | "expert" | "deep_technical",
      "curiosity_vectors": string[],
      "evidence": string
    }
  ],
  "reasoning_summary": string
}`;

        const prompt = `Recent User Interaction History:\n${chatHistory.map((m) => `${m.role.toUpperCase()}: ${m.content}`).slice(-6).join("\n\n")}`;

        rawSystemPrompt = systemPrompt;
        rawUserPrompt = prompt;

        const result = await deepseekProvider.generateCompletion(prompt, {
          systemPrompt,
          temperature: 0.3,
        });

        rawLLMCompletion = result.text;
        const cleanJson = result.text.replace(/```json\n?|\n?```/g, "").trim();
        const parsed = JSON.parse(cleanJson);
        parsedLLMResponse = parsed;

        // Apply emotional trajectory update
        if (parsed.updated_emotional_trajectory && parsed.updated_emotional_trajectory.length > 5) {
          const prev = adaptedNode.psychological_profile.emotional_trajectory;
          adaptedNode.psychological_profile.emotional_trajectory = parsed.updated_emotional_trajectory;
          adaptationsMade.push({
            category: "emotional_trajectory",
            description: `Adapted emotional trajectory from "${prev}" to "${parsed.updated_emotional_trajectory}"`,
            evidence: lastUserMessage.slice(0, 80),
          });
        }

        // Apply sensitivities
        if (Array.isArray(parsed.new_sensitivities)) {
          for (const s of parsed.new_sensitivities) {
            if (s && !adaptedNode.psychological_profile.sensitivities.includes(s)) {
              adaptedNode.psychological_profile.sensitivities.push(s);
              adaptationsMade.push({
                category: "sensitivity",
                description: `Learned new user sensitivity: "${s}"`,
                evidence: lastUserMessage.slice(0, 80),
              });
            }
          }
        }

        // Apply boundaries
        if (Array.isArray(parsed.new_boundaries)) {
          for (const b of parsed.new_boundaries) {
            if (b && !adaptedNode.psychological_profile.boundaries.includes(b)) {
              adaptedNode.psychological_profile.boundaries.push(b);
              adaptationsMade.push({
                category: "boundary",
                description: `Registered user communication boundary: "${b}"`,
                evidence: lastUserMessage.slice(0, 80),
              });
            }
          }
        }

        // Apply topic updates and compute structured Diffs
        if (Array.isArray(parsed.topic_updates)) {
          for (const tu of parsed.topic_updates) {
            if (!tu.topic) continue;
            const existingTopic = adaptedNode.topics[tu.topic];
            const prevWeight = existingTopic?.weight || 0.5;
            const prevDepth: TechnicalDepth = existingTopic?.technical_depth || "practitioner";
            const prevWhy = existingTopic?.why_they_care || "General interest and exploration.";
            const prevVectors = existingTopic?.curiosity_vectors || [];

            const newWeight = Number(Math.min(1.0, Math.max(0.1, prevWeight + (tu.weight_delta || 0.1))).toFixed(2));
            const validDepth: TechnicalDepth = ["introductory", "practitioner", "expert", "deep_technical"].includes(tu.technical_depth)
              ? tu.technical_depth
              : prevDepth;
            const newWhy = tu.why_they_care || prevWhy;
            const newVectors = Array.from(new Set([...prevVectors, ...(tu.curiosity_vectors || [])]));

            adaptedNode.topics[tu.topic] = {
              weight: newWeight,
              why_they_care: newWhy,
              technical_depth: validDepth,
              curiosity_vectors: newVectors,
              last_discussed_at: new Date().toISOString(),
            };

            const diff: TopicUpdateDiff = {
              topic_name: tu.topic,
              timestamp: new Date().toISOString(),
              trigger_source: "observer_agent",
              reasoning: tu.evidence || parsed.reasoning_summary || "Conversational intent and depth adaptation.",
              evidence: tu.evidence || lastUserMessage.slice(0, 80),
              previous_state: {
                weight: prevWeight,
                technical_depth: prevDepth,
                why_they_care: prevWhy,
                curiosity_vectors: prevVectors,
              },
              current_state: {
                weight: newWeight,
                technical_depth: validDepth,
                why_they_care: newWhy,
                curiosity_vectors: newVectors,
              },
              weight_delta: Number((newWeight - prevWeight).toFixed(2)),
              depth_changed: prevDepth !== validDepth,
              why_changed: prevWhy !== newWhy,
              vectors_added: newVectors.filter((v) => !prevVectors.includes(v)),
              vectors_removed: prevVectors.filter((v) => !newVectors.includes(v)),
            };

            topicDiffs.push(diff);
            adaptedNode.recent_topic_diffs = [diff, ...(adaptedNode.recent_topic_diffs || []).slice(0, 25)];

            adaptationsMade.push({
              category: "why_they_care",
              description: `Updated topic "${tu.topic}" (Weight: ${prevWeight} → ${newWeight}, Depth: ${prevDepth} → ${validDepth})`,
              evidence: tu.evidence || lastUserMessage.slice(0, 80),
            });
          }
        }
      } catch (err) {
        console.warn("ObserverAgent: LLM observation error, falling back to heuristic adaptation:", err);
      }
    }

    // Step 2: Apply telemetry feedback (dwell time / engagement decay)
    if (telemetry && telemetry.length > 0) {
      for (const event of telemetry) {
        if (event.topic && adaptedNode.topics[event.topic]) {
          const currentTopic = adaptedNode.topics[event.topic];
          const prevWeight = currentTopic.weight;
          let delta = 0;

          // Dwell over 20s indicates high engagement
          if (event.dwell_time_ms > 20000) {
            delta = 0.05;
            currentTopic.weight = Number(Math.min(1.0, currentTopic.weight + delta).toFixed(2));
            adaptationsMade.push({
              category: "topic_weights",
              description: `Elevated weight of "${event.topic}" (+0.05) based on ${Math.round(event.dwell_time_ms / 1000)}s dwell time`,
              evidence: `Telemetry dwell: ${event.dwell_time_ms}ms`,
            });
          } else if (event.session_abandoned || event.dwell_time_ms < 3000) {
            delta = -0.03;
            currentTopic.weight = Number(Math.max(0.2, currentTopic.weight + delta).toFixed(2));
            adaptationsMade.push({
              category: "topic_weights",
              description: `Decayed weight of "${event.topic}" (-0.03) due to rapid bounce/skip`,
              evidence: `Bounce telemetry: ${event.dwell_time_ms}ms`,
            });
          }

          if (delta !== 0) {
            const diff: TopicUpdateDiff = {
              topic_name: event.topic,
              timestamp: new Date().toISOString(),
              trigger_source: "telemetry_agent",
              reasoning: delta > 0 ? `High dwell time (${Math.round(event.dwell_time_ms / 1000)}s)` : `Rapid bounce/skip (${event.dwell_time_ms}ms)`,
              evidence: `Telemetry: dwell=${event.dwell_time_ms}ms, scroll=${event.scroll_depth_pct}%`,
              previous_state: {
                weight: prevWeight,
                technical_depth: currentTopic.technical_depth,
                why_they_care: currentTopic.why_they_care,
                curiosity_vectors: currentTopic.curiosity_vectors || [],
              },
              current_state: {
                weight: currentTopic.weight,
                technical_depth: currentTopic.technical_depth,
                why_they_care: currentTopic.why_they_care,
                curiosity_vectors: currentTopic.curiosity_vectors || [],
              },
              weight_delta: Number((currentTopic.weight - prevWeight).toFixed(2)),
              depth_changed: false,
              why_changed: false,
            };
            topicDiffs.push(diff);
            adaptedNode.recent_topic_diffs = [diff, ...(adaptedNode.recent_topic_diffs || []).slice(0, 25)];
          }
        }
      }
    }

    adaptedNode.last_updated = new Date().toISOString();

    // Persist updated Unified Topic Node to database and disk cache
    await postgresStore.saveUnifiedTopicNode(adaptedNode);

    const latency = Date.now() - startTime;

    // Log transparent adaptation trace
    traceLogger.logTrace({
      trace_id: traceId,
      session_id: `obs_${unifiedNode.user_id}`,
      timestamp: new Date().toISOString(),
      node_name: "node_observer",
      input_summary: {
        last_user_message: lastUserMessage.slice(0, 100),
        telemetry_events_count: telemetry?.length || 0,
        active_topics_count: Object.keys(adaptedNode.topics || {}).length,
      },
      output_summary: {
        adaptations_count: adaptationsMade.length,
        topic_diffs_count: topicDiffs.length,
        emotional_trajectory: adaptedNode.psychological_profile.emotional_trajectory,
        adaptations: adaptationsMade.map((a) => a.description),
        topic_diffs: topicDiffs.map((d) => `${d.topic_name}: weight Δ${d.weight_delta > 0 ? `+${d.weight_delta}` : d.weight_delta}`),
      },
      reasoning_rationale: `Observer Agent analyzed interaction and generated ${topicDiffs.length} topic state diffs and ${adaptationsMade.length} mind-state adaptations.`,
      latency_ms: latency,
      metadata: {
        raw_system_prompt: rawSystemPrompt,
        raw_user_prompt: rawUserPrompt,
        raw_llm_completion: rawLLMCompletion,
        parsed_llm_response: parsedLLMResponse,
        chat_history_input: chatHistory,
        telemetry_input: telemetry,
        adaptations_made: adaptationsMade,
        topic_diffs: topicDiffs,
        updated_node: adaptedNode,
      },
    });

    return {
      adapted_node: adaptedNode,
      adaptations_made: adaptationsMade,
      topic_diffs: topicDiffs,
      trace_id: traceId,
    };
  }
}
