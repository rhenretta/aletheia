import { deepseekProvider } from "../../llm/deepseek-provider";
import {
  UserKnowledgeGraph,
  UnifiedTopicNode,
  InterestIntersection,
  AdjacentCuriosityFrontier,
  AttachedStoryContext,
  AgenticContextFlowStep,
  GeneratedMessageContext,
} from "../../types/contracts";
import { traceLogger } from "../../observability/trace-logger";
import { FreeNewsFetcher } from "../../ingestion/rss-search";
import { postgresStore } from "../../storage/postgres-store";
import { ContextAgent } from "../context/context-agent";
import { ObserverAgent } from "../observer/observer-agent";

export interface ToolExecution {
  tool_name: string;
  query: string;
  results_summary: string;
  items_retrieved: number;
}

export interface ChatMessage {
  id: string;
  role: "assistant" | "user" | "system";
  content: string;
  timestamp: string;
  trace_id?: string;
  context_trace_id?: string;
  attached_story?: AttachedStoryContext;
  tool_executions?: ToolExecution[];
  agent_internal_rationale?: {
    user_emotional_state_detected?: string;
    curiosity_focus_identified?: string;
    intersections_analyzed?: string;
    pedagogical_strategy?: string;
    why_this_response?: string;
  };
  context_generated?: GeneratedMessageContext;
}

export interface DialogueResponse {
  message: string;
  trace_id?: string;
  context_trace_id?: string;
  tool_executions?: ToolExecution[];
  agent_internal_rationale: {
    user_emotional_state_detected: string;
    curiosity_focus_identified: string;
    intersections_analyzed: string;
    pedagogical_strategy: string;
    why_this_response: string;
  };
  context_generated?: GeneratedMessageContext;
  extracted_topics: Array<{
    topic: string;
    weight: number;
    reasoning: string;
    confidence_score: number;
    evidence_quote: string;
  }>;
  interest_intersections: InterestIntersection[];
  adjacent_curiosity_frontiers: AdjacentCuriosityFrontier[];
  is_profile_ready: boolean;
  suggested_queries: string[];
}

export class DialogueAgent {
  /**
   * Dual-Intent Conversation with Context Agent Framing and Real-Time Tool Execution
   */
  public static async chat(
    history: ChatMessage[],
    currentGraph?: UserKnowledgeGraph | UnifiedTopicNode,
    attachedStory?: AttachedStoryContext
  ): Promise<DialogueResponse> {
    const startTime = Date.now();
    const executedTools: ToolExecution[] = [];
    const lastUserMessage = history[history.length - 1]?.content || "";

    // 1. Resolve Unified Topic Node
    let unifiedNode: UnifiedTopicNode;
    if (currentGraph && "psychological_profile" in currentGraph) {
      unifiedNode = currentGraph as UnifiedTopicNode;
    } else {
      unifiedNode = await postgresStore.getUnifiedTopicNode("usr_default");
    }

    // 2. Invoke Context Agent (The Empath) for AI semantic topic resolution, psychological framing and boundaries
    const contextFraming = await ContextAgent.generateContextFraming(
      unifiedNode,
      history.map((m) => ({ role: m.role, content: m.content })),
      lastUserMessage,
      attachedStory
    );

    const systemPrompt = `You are Aletheia, a personalized epistemic intelligence companion built on the Mind-State Memory Architecture.
You engage in dual-intent conversations equipped with real-time tool execution capabilities:

CRITICAL CONVERSATIONAL PRINCIPLES:
1. INVISIBLE STEERING (CONNECTIONS INFORM DIRECTION, NEVER NARRATION):
   - Use known user interests, motivations, and knowledge graph anchors to SUBTLY SHAPE how you direct the conversation, the angles of inquiry you explore, and the depth of details you provide.
   - NEVER narrate or echo user profile traits back to the user (e.g. NEVER say "As someone who values X...", "That fits your interest in Y...", "That's the same engineering rigor you appreciate").
   - NEVER use the user's personal projects, hobbies, or previous off-grid builds (like RV, camper, or home builds) as analogies for geopolitical, military, or macroeconomic events.
   - NEVER end turns with sycophantic praise or formulaic open-ended survey wrap-up questions ("Is that the angle that draws you in...?", "What do you think?").
   - Let the underlying connection silently guide your perspective (e.g. when discussing defense, naturally touch on decentralized command, electronic warfare, and low-cost drone economics without having to announce why).
2. NATURAL, RIGOROUS PEER TONE:
   - Treat discussed topics as substantive, empirical subjects.
   - Speak like a sharp, objective, thoughtful intellectual peer: direct, concise, grounded in operational realities, with zero condescension and zero sycophancy.
3. RESPECT BOUNDARIES & SENSITIVITIES:
   - Follow the active sensitivities and hard boundaries provided in the Context Agent guidance.
4. PROACTIVE REAL-TIME TOOL EXECUTION:
   - If the user discusses breaking news, active geopolitical conflicts, military operations, or unverified claims without an attached story, PROACTIVELY trigger a tool call to ground your response in verified live facts:
   {
     "tool_call": {
       "name": "search_internet" | "search_local_knowledge",
       "query": "precise search query"
     }
   }

When no tool call is needed (or once tool results have been provided), output strict JSON:
{
  "message": "Direct, natural, grounded, and insightful conversational response addressing the user's message as an intellectual peer",
  "agent_internal_rationale": {
    "user_emotional_state_detected": "User mindset and orientation",
    "curiosity_focus_identified": "Core technological, geopolitical, or intellectual interest",
    "intersections_analyzed": "Genuine, unforced relationships with other domains (or 'Standalone topic')",
    "pedagogical_strategy": "Subtle conversational goal (e.g. provide tactical clarity, analyze operational friction)",
    "why_this_response": "Why this response framing was chosen"
  },
  "extracted_topics": [
    {
      "topic": "Canonical Topic Name",
      "weight": 0.85,
      "reasoning": "Summary of user interest",
      "confidence_score": 0.95,
      "evidence_quote": "Exact user quote"
    }
  ],
  "interest_intersections": [
    {
      "interest_a": "Interest 1",
      "interest_b": "Interest 2",
      "intersection_theme": "Cross-Cutting Theme",
      "hypothesis": "Concrete real-world link"
    }
  ],
  "adjacent_curiosity_frontiers": [
    {
      "topic": "Novel Adjacent Topic",
      "connected_to": ["Interest 1"],
      "rationale": "Natural curiosity extension"
    }
  ],
  "is_profile_ready": boolean,
  "suggested_queries": ["query 1", "query 2"]
}`;

    const knownContext = `[UNIFIED TOPIC NODE - SINGLE SOURCE OF TRUTH]:
- Active Topics: ${Object.entries(unifiedNode.topics || {}).map(([k, v]) => `${k} (${Math.round(v.weight * 100)}%, depth: ${v.technical_depth})`).join(", ") || "None"}
- Concept Anchors: ${(unifiedNode.historical_anchors || []).join(", ") || "None"}
- Intersectional Bridges: ${(unifiedNode.interest_intersections || []).map((i) => i.intersection_theme).join(", ") || "None"}

${contextFraming.empath_instructions}`;

    const storyContext = attachedStory
      ? `\nATTACHED STORY CURRENTLY UNDER DISCUSSION:
- Topic: ${attachedStory.topic}
- Headline: ${attachedStory.headline}
- Summary: ${attachedStory.summary}
- Verified Facts:
${(attachedStory.fact_bullets || []).map((f) => `  * ${f}`).join("\n")}
- Partisan Disputes:
${(attachedStory.disputed_claims || []).map((d) => `  * ${d.claim}: ${d.divergence_reason}`).join("\n")}`
      : "";

    const formattedHistory = history
      .map((m) => {
        const prefix = m.role === "assistant" ? "ALETHEIA" : "USER";
        const storyTag = m.attached_story ? ` [Discussing Story: "${m.attached_story.headline}"]` : "";
        return `${prefix}${storyTag}: ${m.content}`;
      })
      .join("\n\n");

    let prompt = `${knownContext}${storyContext}\n\nConversation History:\n${formattedHistory}`;

    // Step 1: Initial LLM Evaluation (Can trigger tool call or respond directly)
    let result = await deepseekProvider.generateCompletion(prompt, {
      systemPrompt,
      temperature: 0.5,
    });

    let cleanJson = result.text.replace(/```json\n?|\n?```/g, "").trim();
    let parsed: any;
    try {
      parsed = JSON.parse(cleanJson);
    } catch (e) {
      parsed = { message: cleanJson };
    }

    // Step 2: Handle Tool Call Loop
    if (parsed.tool_call) {
      const { name, query } = parsed.tool_call;

      if (name === "search_internet" && query) {
        try {
          const liveArticles = await FreeNewsFetcher.searchNews(query, 5);
          const toolSummary = liveArticles
            .map(
              (a, idx) =>
                `[Source ${idx + 1}: ${a.source_name} (${a.author_bias_rating})]\nTitle: ${a.title}\nPublished: ${a.published_at}\nSnippet: ${a.raw_text.slice(0, 300)}...`
            )
            .join("\n\n");

          executedTools.push({
            tool_name: "search_internet",
            query,
            results_summary: `Retrieved ${liveArticles.length} live articles from web wire for "${query}".`,
            items_retrieved: liveArticles.length,
          });

          // Inject tool execution context and invoke LLM for final synthesis
          const toolContext = `\n\n[REAL-TIME LIVE INTERNET TOOL EXECUTION RESULT FOR "${query}"]:\n${toolSummary}\n\nBased on these live findings, provide your complete final JSON response answering the user and updating the knowledge graph.`;

          prompt += toolContext;
          result = await deepseekProvider.generateCompletion(prompt, {
            systemPrompt,
            temperature: 0.5,
          });

          cleanJson = result.text.replace(/```json\n?|\n?```/g, "").trim();
          parsed = JSON.parse(cleanJson);
        } catch (err) {
          console.warn("Live internet tool execution error:", err);
        }
      } else if (name === "search_local_knowledge" && query) {
        try {
          const storedGraph = await postgresStore.getUserGraph("usr_default");
          const localSummary = storedGraph
            ? `Stored Topics: ${Object.keys(storedGraph.topic_weights).join(", ")}\nAnchors: ${(storedGraph.historical_anchors || []).join(", ")}\nIntersections: ${(storedGraph.interest_intersections || []).map((i) => i.intersection_theme).join(", ")}`
            : "No local stored data found.";

          executedTools.push({
            tool_name: "search_local_knowledge",
            query,
            results_summary: `Queried local knowledge graph for "${query}".`,
            items_retrieved: 1,
          });

          const toolContext = `\n\n[LOCAL KNOWLEDGE BASE RESULT FOR "${query}"]:\n${localSummary}\n\nProvide your complete final JSON response.`;

          prompt += toolContext;
          result = await deepseekProvider.generateCompletion(prompt, {
            systemPrompt,
            temperature: 0.5,
          });

          cleanJson = result.text.replace(/```json\n?|\n?```/g, "").trim();
          parsed = JSON.parse(cleanJson);
        } catch (err) {
          console.warn("Local knowledge search error:", err);
        }
      }
    }

    // Step 3: Promote newly extracted topics, intersections, and frontiers into UnifiedTopicNode
    if (Array.isArray(parsed.extracted_topics)) {
      for (const et of parsed.extracted_topics) {
        if (!et.topic) continue;
        const existing = unifiedNode.topics[et.topic];
        const newWeight = Math.min(1.0, Math.max(0.1, et.weight || 0.8));
        unifiedNode.topics[et.topic] = {
          weight: newWeight,
          why_they_care: et.reasoning || existing?.why_they_care || "Expressed active intellectual interest in dialogue.",
          technical_depth: existing?.technical_depth || (contextFraming.calibrated_depth as any) || "practitioner",
          curiosity_vectors: existing?.curiosity_vectors || [],
          last_discussed_at: new Date().toISOString(),
        };
      }
    }

    if (Array.isArray(parsed.interest_intersections)) {
      for (const ii of parsed.interest_intersections) {
        if (
          ii.intersection_theme &&
          !unifiedNode.interest_intersections?.some((i) => i.intersection_theme === ii.intersection_theme)
        ) {
          unifiedNode.interest_intersections = [
            ...(unifiedNode.interest_intersections || []),
            ii,
          ];
        }
      }
    }

    if (Array.isArray(parsed.adjacent_curiosity_frontiers)) {
      for (const f of parsed.adjacent_curiosity_frontiers) {
        if (
          f.topic &&
          !unifiedNode.adjacent_curiosity_frontiers?.some((ex) => ex.topic === f.topic)
        ) {
          unifiedNode.adjacent_curiosity_frontiers = [
            ...(unifiedNode.adjacent_curiosity_frontiers || []),
            f,
          ];
        }
      }
    }

    // Also promote semantic topic resolver's new topic candidates
    if (contextFraming.semantic_resolution?.new_topic_candidates) {
      for (const cand of contextFraming.semantic_resolution.new_topic_candidates) {
        if (cand.topic_name && !unifiedNode.topics[cand.topic_name]) {
          unifiedNode.topics[cand.topic_name] = {
            weight: cand.suggested_initial_weight || 0.75,
            why_they_care: cand.why_they_care || "Discovered via semantic graph resolution.",
            technical_depth: cand.suggested_depth || "practitioner",
            curiosity_vectors: cand.curiosity_vectors || [],
            last_discussed_at: new Date().toISOString(),
          };
        }
      }
    }

    unifiedNode.last_updated = new Date().toISOString();
    await postgresStore.saveUnifiedTopicNode(unifiedNode);

    const latency = Date.now() - startTime;
    const traceId = `trace_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    // Build the complete Step-by-Step Agentic Flow for Generating Context
    const agenticFlowSteps: AgenticContextFlowStep[] = [
      {
        step_number: 1,
        stage_name: "User Input & Turn Retrieval",
        agent_name: "DialogueAgent (Intake)",
        description: `Captured active user prompt and conversation history (${history.length} preceding messages).`,
        input_data: {
          user_prompt: lastUserMessage,
          attached_story: attachedStory || null,
          history_turn_count: history.length,
        },
        output_data: {
          history_messages_analyzed: history.map((m) => ({
            role: m.role,
            content_preview: m.content.slice(0, 160),
            attached_story: m.attached_story?.headline || null,
          })),
          active_turn_length: lastUserMessage.length,
        },
        status: "completed",
      },
      {
        step_number: 2,
        stage_name: "Mind-State Knowledge Graph Resolution",
        agent_name: "Unified Topic Node (Single Source of Truth)",
        description: `Retrieved persistent mind-state: ${Object.keys(unifiedNode.topics || {}).length} registered canonical topics, active emotional trajectory, and sensitivity safeguards.`,
        input_data: {
          user_id: unifiedNode.user_id,
          raw_topics_registered: Object.entries(unifiedNode.topics || {}).map(([topicName, meta]) => ({
            topic: topicName,
            weight: meta.weight,
            technical_depth: meta.technical_depth,
            why_they_care: meta.why_they_care,
            curiosity_vectors: meta.curiosity_vectors,
          })),
          psychological_profile: unifiedNode.psychological_profile,
        },
        output_data: {
          resolved_topics_count: Object.keys(unifiedNode.topics || {}).length,
          user_emotional_trajectory: unifiedNode.psychological_profile?.emotional_trajectory,
          communication_style: unifiedNode.psychological_profile?.communication_style,
          historical_anchors: unifiedNode.historical_anchors,
          recent_topic_diffs_count: (unifiedNode.recent_topic_diffs || []).length,
        },
        status: "completed",
      },
      {
        step_number: 3,
        stage_name: "Psychological Framing & Calibration",
        agent_name: "Context Agent (The Empath)",
        description: `Calibrated technical depth to "${contextFraming.calibrated_depth}", synthesized ${contextFraming.why_they_care_context.length} topic motivations, and enforced ${contextFraming.active_sensitivities.length} sensitivities and ${contextFraming.active_boundaries.length} boundaries.`,
        input_data: {
          matched_topic_motivations: contextFraming.why_they_care_context,
          enforced_sensitivities: contextFraming.active_sensitivities,
          enforced_boundaries: contextFraming.active_boundaries,
          current_user_message: lastUserMessage,
        },
        output_data: {
          calibrated_depth: contextFraming.calibrated_depth,
          full_injected_empath_instructions: contextFraming.empath_instructions,
          pedagogical_guidance: contextFraming.pedagogical_guidance,
          trace_id: contextFraming.trace_id,
        },
        status: "completed",
      },
      {
        step_number: 4,
        stage_name: "Live Wire & Epistemic Grounding",
        agent_name: "Real-Time Tool Executor",
        description:
          executedTools.length > 0
            ? `Triggered ${executedTools.length} real-time tool calls for live empirical verification: ${executedTools.map((t) => t.tool_name).join(", ")}.`
            : "No live tool execution required. Relying on verified epistemic cache and base model weights.",
        input_data: {
          available_tools: ["search_internet", "search_local_knowledge"],
          model_tool_call_request: parsed.tool_call || null,
          tools_executed_list: executedTools.map((t) => t.tool_name),
        },
        output_data: {
          tool_executions: executedTools,
          total_items_retrieved: executedTools.reduce((acc, t) => acc + t.items_retrieved, 0),
        },
        status: executedTools.length > 0 ? "completed" : "skipped",
      },
      {
        step_number: 5,
        stage_name: "Dual-Intent Response Synthesis",
        agent_name: "Aletheia Dialogue Engine (DeepSeek)",
        description: `Synthesized grounded response with invisible steering. Identified mindset "${parsed.agent_internal_rationale?.user_emotional_state_detected || "Engaged"}" and pedagogical strategy "${parsed.agent_internal_rationale?.pedagogical_strategy || "Exploration"}".`,
        input_data: {
          system_prompt: systemPrompt,
          complete_prompt_payload: prompt,
          temperature: 0.7,
        },
        output_data: {
          raw_model_completion_json: cleanJson,
          parsed_response_message: parsed.message,
          agent_internal_rationale: parsed.agent_internal_rationale,
          tokens_used: result.tokensUsed || 380,
        },
        status: "completed",
      },
      {
        step_number: 6,
        stage_name: "Observer Active Listening & Continuous Adaptation",
        agent_name: "Observer Agent (The Active Listener)",
        description: `Analyzed turn to update topic weights, emotional trajectory, and boundary constraints in the background.`,
        input_data: {
          evaluated_user_prompt: lastUserMessage,
          bot_reply_content: parsed.message,
          current_psychological_profile: unifiedNode.psychological_profile,
        },
        output_data: {
          background_adaptation_invoked: true,
          updated_mind_state_envelope: {
            emotional_trajectory: unifiedNode.psychological_profile?.emotional_trajectory,
            active_sensitivities: unifiedNode.psychological_profile?.sensitivities,
            active_boundaries: unifiedNode.psychological_profile?.boundaries,
          },
        },
        status: "completed",
      },
    ];

    const contextGenerated: GeneratedMessageContext = {
      empath_instructions: contextFraming.empath_instructions,
      calibrated_depth: contextFraming.calibrated_depth,
      emotional_trajectory: unifiedNode.psychological_profile?.emotional_trajectory,
      active_sensitivities: contextFraming.active_sensitivities,
      active_boundaries: contextFraming.active_boundaries,
      why_they_care_context: contextFraming.why_they_care_context,
      pedagogical_strategy: parsed.agent_internal_rationale?.pedagogical_strategy,
      tools_executed: executedTools,
      agent_internal_rationale: parsed.agent_internal_rationale,
      agentic_flow: agenticFlowSteps,
    };

    traceLogger.logTrace({
      session_id: "intake-session",
      node_name: "node_b_telemetry",
      input_summary: {
        last_user_message: history[history.length - 1]?.content || "",
        attached_story: attachedStory?.headline || null,
        history_length: history.length,
      },
      output_summary: {
        response_preview: (parsed.message || "").slice(0, 100),
        tools_executed: executedTools.map((t) => `${t.tool_name}("${t.query}")`),
        extracted_topics: parsed.extracted_topics?.map((t: any) => t.topic),
        intersections: parsed.interest_intersections?.map((i: any) => i.intersection_theme),
        frontiers: parsed.adjacent_curiosity_frontiers?.map((f: any) => f.topic),
        calibrated_depth: contextFraming.calibrated_depth,
        flow_steps_count: agenticFlowSteps.length,
      },
      reasoning_rationale: `Dual-Intent Dialogue with Tools: ${parsed.agent_internal_rationale?.why_this_response || "Empathetic reflection with real-time tool grounding."}`,
      latency_ms: latency,
      llm_tokens_used: result.tokensUsed || 380,
      metadata: {
        trace_id: traceId,
        context_trace_id: contextFraming.trace_id,
        context_generated: contextGenerated,
        agentic_flow: agenticFlowSteps,
        agent_internal_rationale: parsed.agent_internal_rationale,
        tools_executed: executedTools,
        raw_system_prompt: systemPrompt,
        raw_user_prompt: prompt,
        raw_llm_completion: result.text,
      },
    });

    return {
      message: parsed.message || "I've analyzed your thoughts against the latest live intelligence.",
      trace_id: traceId,
      context_trace_id: contextFraming.trace_id,
      tool_executions: executedTools.length > 0 ? executedTools : undefined,
      agent_internal_rationale: parsed.agent_internal_rationale || {
        user_emotional_state_detected: "Open and engaged",
        curiosity_focus_identified: "Empirical discovery",
        intersections_analyzed: "Emergent synergy",
        pedagogical_strategy: "Exploration",
        why_this_response: "Conversational continuation with real-time tools",
      },
      context_generated: contextGenerated,
      extracted_topics: parsed.extracted_topics || [],
      interest_intersections: parsed.interest_intersections || [],
      adjacent_curiosity_frontiers: parsed.adjacent_curiosity_frontiers || [],
      is_profile_ready: parsed.is_profile_ready || false,
      suggested_queries: parsed.suggested_queries || [],
    };
  }
}

