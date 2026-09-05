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
    telemetry?: BehavioralTelemetry[],
    runId?: string
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
        const existingTopics = adaptedNode.topics || {};
        const serializedDossiers = Object.entries(existingTopics).length > 0
          ? Object.entries(existingTopics).map(([name, meta]) => `TOPIC: "${name}"
- Weight: ${meta.weight} (${Math.round(meta.weight * 100)}%) | Technical Depth: ${meta.technical_depth}
- 1. WHAT THEY ARE INTERESTED IN (Focus & Scope): ${meta.what_they_care_about || "(None specified yet)"}
- 2. WHY THEY CARE (Intellectual Stakes & Worldview): ${meta.why_they_care || "(None specified yet)"}
- 3. LIVING NARRATIVE (Cumulative Synthesis): ${meta.living_narrative || meta.why_they_care || "(None specified yet)"}
- 4. PRESENTATION STRATEGY: ${meta.presentation_strategy || "(Standard)"}
- Preferred Angles: ${meta.likes_and_angles?.join(", ") || "None"}
- Anti-Preferences / Critiques: ${meta.dislikes_and_critiques?.join(", ") || "None"}
- Curiosity Vectors: ${meta.curiosity_vectors?.join(", ") || "None"}
- Recent Evolution Timeline:
${(meta.evolution_timeline || []).slice(-3).map((t) => `  * [${t.timestamp}] ${t.insight}`).join("\n") || "  * (Initial creation)"}`).join("\n---\n")
          : "None (Knowledge graph is empty)";

        const systemPrompt = `You are the Observer Agent in the Mind-State Memory Architecture.
Your role is silent, empathetic, and continuous adaptation. You build and evolve a LIVING DOCUMENT for each user interest topic.
Analyze EXCLUSIVELY the USER's conversational inputs to emit discrete mutation tool calls:
1. "updated_emotional_trajectory": The user's updated psychological state and mindset revealed by their words.
2. "new_sensitivities": Subtle sensitivities, pet peeves, or communication preferences revealed EXCLUSIVELY by the user.
3. "new_boundaries": Hard boundaries or topics the user explicitly or implicitly wants to avoid.
4. "tool_calls": Discrete atomic tool calls to mutate individual user interests one by one ("create_topic" or "update_topic").

LIVING TOPIC DOSSIER MANDATE & CUMULATIVE SYNTHESIS:
Each topic is an EVER-EVOLVING LIVING DOCUMENT capturing THREE essential dimensions:
1. WHAT THE USER IS INTERESTED IN ("what_they_care_about"): The cumulative, evolving scope of specific areas, sub-domains, technologies, and focus dimensions the user tracks over time. Integrate new aspects with prior ones.
2. WHY THEY CARE ("why_they_care"): The user's underlying intellectual stakes, motivations, philosophical worldview, and core concerns. Deepen this with new context—do NOT lose prior context.
3. HOW BEST TO PRESENT STORIES ("presentation_strategy"): Editorial direction derived strictly from how the user responds to content, engages with topics, and expresses what they like or dislike.
4. LIVING NARRATIVE ("living_narrative"): A rich, multi-dimensional living synthesis of the user's overall perspective, nuance, and journey on this topic. It weaves historical context with the newest discussion.
5. EVOLUTION INSIGHT ("evolution_insight"): A concise 1-sentence note capturing the discrete incremental shift, new question, or nuance introduced in this specific conversation.

NON-OVERWRITE & SYNTHESIS RULES FOR "update_topic":
- When a topic already exists in the graph, you MUST NOT summarize only the latest turn in isolation or overwrite the document!
- Take the PREVIOUS LIVING DOSSIER (provided below) as the baseline and SYNTHESIZE the new user input into it.
- "what_they_care_about" and "why_they_care" MUST be distinct and non-identical:
  * "what_they_care_about" specifies WHAT topics, sub-fields, and dimensions they follow.
  * "why_they_care" specifies WHY it matters intellectually/philosophically.
- ABSOLUTE BAN ON THIRD-PERSON CONVERSATIONAL META-NARRATION:
  * NEVER write "User's question about...", "The user asked...", "In this turn the user...", "User's query reflects...", or narrate conversational turns.
  * Write substantive, declarative statements characterizing the user's stance and interests (e.g. "Focuses on comparative safety benchmarks between autonomous driving systems and human baselines, emphasizing empirical edge-case disengagement data over marketing claims.").

DISCRETE MUTATION TOOLS:
- "create_topic" & "update_topic":
  Parameters:
  - "topic": Canonical name of the topic.
  - "weight_delta": Numeric delta (+0.05 to +0.2).
  - "what_they_care_about": Cumulative specific focus areas and sub-domains.
  - "why_they_care": Cumulative substantive intellectual stakes and worldview.
  - "presentation_strategy": Presentation guidance derived strictly from user feedback.
  - "living_narrative": Rich, cumulative evolving living dossier synthesis.
  - "likes_and_angles": Specific dimensions, features, or angles the user values.
  - "dislikes_and_critiques": Specific critiques, pet peeves, or anti-preferences.
  - "technical_depth": "introductory" | "practitioner" | "expert" | "deep_technical"
  - "curiosity_vectors": Sub-themes explored.
  - "evolution_insight": 1-sentence insight describing what was learned or how their perspective evolved in this turn.
  - "evidence": Verbatim quote from user.

IRONCLAD GUARDRAILS & NEGATIVE CONSTRAINTS:
- NEVER extract topics, interests, or sensitivities from statements, greetings, suggestions, or analogies made by the ASSISTANT / ALETHEIA.
- NEVER infer user interests from the existence or framing of the application.
- If the user has only asked an open-ended conversational prompt (e.g. "What should we talk about", "Hello", "Tell me the news"), "tool_calls" MUST BE EMPTY ([]).
- ONLY add a topic if the user actively introduced it or articulated substantive curiosity/opinions about it.
- The "evidence" field MUST contain the exact verbatim substring from the USER showing their explicit statement.
- SUBSTANTIVE REAL-WORLD DOMAIN INTEGRITY: A trackable topic MUST represent a concrete, ongoing real-world subject domain, technology, industry, organization, public figure, product, or event field (e.g., "Autonomous Vehicles", "Commercial Spaceflight", "Solid-State Batteries"). NEVER extract cognitive thinking styles, epistemic inquiry modes, statistical analysis methods, or rhetorical/debate framing devices as trackable topics (e.g., NEVER create topics like "Evidence Evaluation", "Critical Thinking", "Statistical Inference", "Fact Verification", "Anecdotal Comparison", "Debate Analysis"). When a user evaluates evidence or compares anecdotes to statistics, that analytical lens belongs inside "why_they_care" or "living_narrative" of the underlying domain topic, NEVER as an independent topic.
- CANONICAL TOPIC CONVERGENCE (DO NOT SPLINTER EXISTING INTERESTS): If the user discusses a sub-aspect, new question, specific version, safety data, benchmark, or milestone of an interest that is ALREADY present in their knowledge graph (e.g., discussing safety benchmarks, version updates, or pilot data when an established topic already exists in the graph):
  * You MUST emit an 'update_topic' tool call for the existing canonical topic!
  * You are STRICTLY FORBIDDEN from emitting 'create_topic' for splinter variations (e.g. do NOT create '[Topic] Sub-Feature', '[Topic] Benchmark Results', '[Topic] Updates', or '[Topic] Perspectives').
  * Fold the new angle into the existing topic's 'curiosity_vectors', 'evolution_insight', 'why_they_care', and 'living_narrative'.

=== EXISTING LIVING TOPIC DOSSIERS IN KNOWLEDGE GRAPH ===
${serializedDossiers}

Current Emotional Trajectory: "${adaptedNode.psychological_profile?.emotional_trajectory || "Open and exploratory"}"

Output strict JSON:
{
  "reasoning_summary": "In-depth cognitive evaluation synthesizing prior living dossiers with new user thoughts...",
  "updated_emotional_trajectory": string,
  "new_sensitivities": string[],
  "new_boundaries": string[],
  "tool_calls": [
    {
      "rationale": "Clear rationale explaining how the living document was cumulatively evolved or created",
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
  ]
}`;

        const userOnlyDialogue = chatHistory
          .filter((m) => m.role === "user")
          .map((m) => `USER MESSAGE: "${m.content}"`)
          .slice(-12)
          .join("\n");

        const prompt = `Evaluate these user messages to cumulatively evolve the living topic dossiers:\n\n${userOnlyDialogue}`;

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

    // Step 3: Background knowledge graph harmonization (triggers when topics >= 4 to prevent splinter fragmentation)
    if (Object.keys(adaptedNode.topics || {}).length >= 4) {
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
      run_id: runId,
      session_id: `obs_${unifiedNode.user_id}`,
      timestamp: new Date().toISOString(),
      node_name: "node_observer",
      call_type: "agent_step",
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
      prompt_details: {
        system_prompt: rawSystemPrompt,
        user_prompt: rawUserPrompt,
      },
      context_details: {
        chat_history_length: chatHistory.length,
        active_topics: Object.keys(adaptedNode.topics || {}),
      },
      reasoning_details: {
        primary_rationale: `Observer Agent analyzed interaction and generated ${topicDiffs.length} topic state diffs and ${adaptationsMade.length} mind-state adaptations.`,
        emotional_state: adaptedNode.psychological_profile.emotional_trajectory,
        adaptations: adaptationsMade,
        topic_diffs: topicDiffs,
      },
      response_details: {
        raw_completion: rawLLMCompletion,
        parsed_output: parsedLLMResponse,
        emitted_state: {
          adaptations: adaptationsMade,
          topic_diffs: topicDiffs,
        },
      },
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
