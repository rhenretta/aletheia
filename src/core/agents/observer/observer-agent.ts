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
import { InterestHarmonizer } from "./interest-harmonizer";
import { TopicMutationEngine } from "./topic-mutation-engine";

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
    if (deepseekProvider.isConfigured() && lastUserMessage.length > 3) {
      try {
        const systemPrompt = `You are the Observer Agent in the Mind-State Memory Architecture.
Your role is silent, empathetic, and continuous adaptation. You build and evolve a LIVING DOCUMENT for each user interest topic.
Analyze EXCLUSIVELY the USER's conversational inputs to emit discrete mutation tool calls:
1. "updated_emotional_trajectory": The user's updated psychological state and mindset revealed by their words.
2. "new_sensitivities": Subtle sensitivities, pet peeves, or communication preferences revealed EXCLUSIVELY by the user.
3. "new_boundaries": Hard boundaries or topics the user explicitly or implicitly wants to avoid.
4. "tool_calls": Discrete atomic tool calls to mutate individual user interests one by one ("create_topic" or "update_topic").

LIVING TOPIC DOSSIER MANDATE:
Each topic is a LIVING DOCUMENT capturing THREE essential dimensions learned entirely from the individual user:
1. WHAT THE USER IS INTERESTED IN ("what_they_care_about"): The specific areas, aspects, and dimensions the user focuses on based on what they actively discuss.
2. WHY THEY CARE ("why_they_care"): The user's underlying motivations, concerns, or reasons for caring as revealed by their words (write substantively in active voice; never narrate conversation turns).
3. HOW BEST TO PRESENT STORIES ("presentation_strategy"): Derived STRICTLY and EXCLUSIVELY from how the user responds to content, engages with topics, and expresses what they like, dislike, or want to see. Never use hardcoded assumptions or generic formulas. If the user has not articulated presentation preferences for this topic, leave presentation fields empty.

DISCRETE MUTATION TOOLS:
- "create_topic" & "update_topic":
  Parameters:
  - "topic": Canonical name of the topic.
  - "weight_delta": Numeric delta (+0.05 to +0.2).
  - "what_they_care_about": Specific areas and focus dimensions observed from the user.
  - "why_they_care": Bottom-line motivation summary (substantive intellectual stakes only; NO conversation meta-commentary).
  - "presentation_strategy": Presentation guidance derived strictly from how the user engages and responds to content (or empty if not expressed).
  - "living_narrative": A rich, evolving living dossier synthesis of the user's specific perspective, context, and nuance on this topic.
  - "likes_and_angles": Specific dimensions, features, or angles the user values based on their expressions.
  - "dislikes_and_critiques": Specific critiques, pet peeves, or anti-preferences the user expressed.
  - "technical_depth": "introductory" | "practitioner" | "expert" | "deep_technical"
  - "curiosity_vectors": Sub-themes explored.
  - "evolution_insight": 1-sentence insight describing what was learned or how their perspective shifted in this conversation.
  - "evidence": Verbatim quote from user.

IRONCLAD GUARDRAILS & NEGATIVE CONSTRAINTS:
- NEVER extract topics, interests, or sensitivities from statements, greetings, suggestions, or analogies made by the ASSISTANT / ALETHEIA.
- NEVER infer user interests from the existence or framing of the application.
- NEVER narrate conversation turns in "why_they_care" or "living_narrative".
- If the user has only asked an open-ended conversational prompt (e.g. "What should we talk about", "Hello", "Tell me the news"), "tool_calls" MUST BE EMPTY ([]).
- ONLY add a topic if the user actively introduced it or articulated substantive curiosity/opinions about it.
- The "evidence" field MUST contain the exact verbatim substring from the USER showing their explicit statement.

Existing Topics in Graph: ${Object.keys(adaptedNode.topics || {}).join(", ") || "None"}
Current Emotional Trajectory: "${adaptedNode.psychological_profile?.emotional_trajectory || "Open and exploratory"}"

Output strict JSON:
{
  "updated_emotional_trajectory": string,
  "new_sensitivities": string[],
  "new_boundaries": string[],
  "tool_calls": [
    {
      "tool": "create_topic" | "update_topic",
      "parameters": {
        "topic": string,
        "weight_delta": number,
        "what_they_care_about": string,
        "why_they_care": string,
        "presentation_strategy": string,
        "living_narrative": string,
        "likes_and_angles": string[],
        "dislikes_and_critiques": string[],
        "technical_depth": "introductory" | "practitioner" | "expert" | "deep_technical",
        "curiosity_vectors": string[],
        "evolution_insight": string,
        "evidence": string
      }
    }
  ],
  "reasoning_summary": string
}`;

        const userOnlyDialogue = chatHistory
          .filter((m) => m.role === "user")
          .map((m) => `USER MESSAGE: "${m.content}"`)
          .slice(-12)
          .join("\n");

        const prompt = `Evaluate ONLY these user messages for genuine topic interests and mindset:\n\n${userOnlyDialogue}`;

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

        // Execute discrete topic mutation tool calls
        const toolCalls: any[] = Array.isArray(parsed.tool_calls)
          ? parsed.tool_calls
          : Array.isArray(parsed.topic_updates)
          ? parsed.topic_updates.map((tu: any) => ({
              tool: adaptedNode.topics?.[tu.topic] ? "update_topic" : "create_topic",
              parameters: tu,
            }))
          : [];

        const combinedUserText = recentUserMessages.join(" ").toLowerCase();

        for (const tc of toolCalls) {
          const params = tc.parameters || tc;
          const topicName = params.topic;
          if (!topicName || typeof topicName !== "string") continue;

          const lowerTopic = topicName.toLowerCase();
          const lowerWhy = (params.why_they_care || "").toLowerCase();

          // Reject meta-application / system hallucinations
          if (
            lowerWhy.includes("epistemic companion") ||
            lowerWhy.includes("using this app") ||
            lowerWhy.includes("engaging with an epistemic") ||
            lowerWhy.includes("context that emphasizes") ||
            lowerWhy.includes("personalized adaptation") ||
            lowerWhy.includes("mind-state") ||
            lowerTopic === "epistemology" ||
            lowerTopic.includes("nature of knowledge") ||
            lowerTopic.includes("psychology of decision-making") ||
            lowerTopic.includes("personalized adaptation")
          ) {
            if (!combinedUserText.includes(lowerTopic)) continue;
          }

          // Ensure evidence/substantive user grounding
          const evidence = (params.evidence || "").toLowerCase().trim();
          const hasDirectEvidence =
            (evidence.length >= 3 && combinedUserText.includes(evidence)) ||
            combinedUserText.includes(lowerTopic) ||
            (params.curiosity_vectors || []).some((v: string) => combinedUserText.includes(v.toLowerCase()));

          if (!hasDirectEvidence && !adaptedNode.topics?.[topicName]) {
            continue;
          }

          if (tc.tool === "create_topic" || !adaptedNode.topics?.[topicName]) {
            const res = TopicMutationEngine.executeCreateTopic(
              adaptedNode,
              {
                topic: topicName,
                weight: params.weight || 0.6,
                why_they_care: params.why_they_care,
                technical_depth: params.technical_depth,
                living_narrative: params.living_narrative,
                likes_and_angles: params.likes_and_angles,
                dislikes_and_critiques: params.dislikes_and_critiques,
                curiosity_vectors: params.curiosity_vectors,
                evolution_insight: params.evolution_insight,
                evidence: params.evidence || lastUserMessage.slice(0, 80),
              },
              "observer_agent"
            );
            if (res.changed && res.diff) {
              topicDiffs.push(res.diff);
              adaptationsMade.push({
                category: "why_they_care",
                description: `Created new living topic dossier "${topicName}" via tool call create_topic.`,
                evidence: params.evidence || lastUserMessage.slice(0, 80),
              });
            }
          } else {
            const res = TopicMutationEngine.executeUpdateTopic(
              adaptedNode,
              {
                topic: topicName,
                weight_delta: params.weight_delta || 0.05,
                why_they_care: params.why_they_care,
                technical_depth: params.technical_depth,
                living_narrative: params.living_narrative,
                likes_and_angles: params.likes_and_angles,
                dislikes_and_critiques: params.dislikes_and_critiques,
                curiosity_vectors_to_add: params.curiosity_vectors,
                evolution_insight: params.evolution_insight,
                evidence: params.evidence || lastUserMessage.slice(0, 80),
              },
              "observer_agent"
            );
            if (res.changed && res.diff) {
              topicDiffs.push(res.diff);
              adaptationsMade.push({
                category: "why_they_care",
                description: `Evolved living dossier for "${topicName}" (Weight Δ: ${res.diff.weight_delta}).`,
                evidence: params.evidence || lastUserMessage.slice(0, 80),
              });
            }
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

    // Step 3: Background knowledge graph harmonization (only triggers on extreme graph saturation >= 25 topics)
    if (Object.keys(adaptedNode.topics || {}).length >= 25) {
      try {
        const harmResult = await InterestHarmonizer.harmonize(adaptedNode, "background_observer");
        if (harmResult.changed) {
          adaptedNode.topics = harmResult.harmonized_node.topics;
          adaptedNode.harmonization_runs = harmResult.harmonized_node.harmonization_runs;
          adaptedNode.recent_topic_diffs = harmResult.harmonized_node.recent_topic_diffs;

          for (const act of harmResult.actions_taken) {
            adaptationsMade.push({
              category: "why_they_care",
              description: `Background Harmonization (${act.type}): ${act.rationale}`,
              evidence: `${act.source_topics.join(", ")} -> ${act.resulting_topics.join(", ")}`,
            });
          }
        }
      } catch (err) {
        console.warn("ObserverAgent: Background interest harmonization error:", err);
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
