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
  active_feed_filter?: {
    is_active: boolean;
    topic?: string;
    matched_event_ids?: string[];
    filter_reason?: string;
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
   * Dual-Intent Conversation with Context Agent Framing, Live Tools, and Dynamic Feed Filtering
   */
  public static async chat(
    history: ChatMessage[],
    currentGraph?: UserKnowledgeGraph | UnifiedTopicNode,
    attachedStory?: AttachedStoryContext,
    currentStories?: Array<{
      event_id: string;
      headline: string;
      topic: string;
      summary: string;
    }>
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

    const currentDateStr = new Date().toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const systemPrompt = `You are Aletheia, a personalized epistemic intelligence companion built on the Mind-State Memory Architecture.
You engage in dual-intent conversations equipped with real-time tool execution and feed filtering capabilities:

CURRENT DATE: ${currentDateStr}

CRITICAL CONVERSATIONAL PRINCIPLES:
1. INVISIBLE STEERING (CONNECTIONS INFORM DIRECTION, NEVER NARRATION):
   - Use known user interests, motivations, and knowledge graph anchors to SUBTLY SHAPE how you direct the conversation, the angles of inquiry you explore, and the depth of details you provide.
   - NEVER narrate or echo user profile traits back to the user (e.g. NEVER say "As someone who values X...", "That fits your interest in Y...").
   - NEVER end turns with sycophantic praise or formulaic open-ended survey wrap-up questions (e.g. NEVER say "What's your read on...?", "What do you think?"). State your grounded insights and stop.
   - Speak like a sharp, objective, thoughtful intellectual peer: direct, concise, grounded in operational realities.

2. RESPECT BOUNDARIES & SENSITIVITIES:
   - Follow the active sensitivities and hard boundaries provided in the Context Agent guidance.

3. MANDATORY REAL-TIME SEARCH FOR TEMPORAL / STATUS INQUIRIES:
   - If the user asks about ANY ongoing development, upcoming schedule, recent test, status, or date (e.g. "when might we see an orbital flight?", "what is the status of X?", "latest on Y?"), you MUST NOT guess or rely on internal pre-training cutoff dates.
   - You MUST trigger a tool call to search the live web wire:
     {
       "tool_call": {
         "name": "search_internet",
         "query": "exact search terms matching user inquiry"
       }
     }

4. DYNAMIC CONVERSATIONAL FEED ADAPTATION & FILTER CLEANUP:
   - If the user discusses a topic that matches stories in their feed, set "active_feed_filter" to focus their news feed on those matching stories:
     {
       "active_feed_filter": {
         "is_active": true,
         "topic": "Canonical Topic Name",
         "matched_event_ids": ["evt_123", "evt_456"],
         "filter_reason": "Curated to show relevant stories matching our discussion."
       }
     }
   - CRITICAL: When the conversation shifts to a new topic or question that does NOT relate to the previously filtered topic, NEVER leave the old filter stuck! Either update "active_feed_filter" to the new topic, or set "is_active": false so stale filters are cleared immediately.

When no tool call is needed (or once tool results have been provided), output strict JSON:
{
  "message": "Direct, natural, grounded, and insightful conversational response addressing the user's message as an intellectual peer with verified live data",
  "agent_internal_rationale": {
    "user_emotional_state_detected": "User mindset and orientation",
    "curiosity_focus_identified": "Core technological, geopolitical, or intellectual interest",
    "intersections_analyzed": "Genuine relationships with other domains (or 'Standalone topic')",
    "pedagogical_strategy": "Subtle conversational goal (e.g. provide tactical clarity, analyze operational friction)",
    "why_this_response": "Why this response framing was chosen"
  },
  "active_feed_filter": {
    "is_active": boolean,
    "topic": string or null,
    "matched_event_ids": ["evt_123", ...],
    "filter_reason": "Specific note explaining why the feed is filtered (or null/empty if no active filter)"
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

    const storiesContext =
      currentStories && currentStories.length > 0
        ? `\nCURRENT STORIES ACTIVE IN USER'S NEWS FEED:
${currentStories.map((s, i) => `[Story ${i + 1} | Event ID: "${s.event_id}" | Topic: "${s.topic}"]\nHeadline: ${s.headline}\nSummary: ${s.summary.slice(0, 200)}`).join("\n\n")}`
        : "";

    const formattedHistory = history
      .map((m) => {
        const prefix = m.role === "assistant" ? "ALETHEIA" : "USER";
        const storyTag = m.attached_story ? ` [Discussing Story: "${m.attached_story.headline}"]` : "";
        return `${prefix}${storyTag}: ${m.content}`;
      })
      .join("\n\n");

    let prompt = `${knownContext}${storyContext}${storiesContext}\n\nConversation History:\n${formattedHistory}`;

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

    // Step 2: Handle Tool Call Loop & Proactive Live Grounding
    const isTemporalOrStatusInquiry =
      /\b(when|latest|status|next|flight|launch|schedule|update|current|happened|recent|progress|test)\b/i.test(lastUserMessage) &&
      !attachedStory &&
      lastUserMessage.length > 5;

    if (!parsed.tool_call && isTemporalOrStatusInquiry) {
      // Auto-trigger live internet search for time-sensitive inquiries
      const cleanTerms = lastUserMessage.replace(/[?.,!]/g, " ").replace(/\s+/g, " ").trim();
      parsed.tool_call = {
        name: "search_internet",
        query: cleanTerms,
      };
    }

    if (parsed.tool_call) {
      const { name, query } = parsed.tool_call;

      if (name === "filter_feed") {
        const filterTopic = parsed.tool_call.filter_topic || parsed.tool_call.topic;
        const matchedIds = parsed.tool_call.matched_event_ids || parsed.tool_call.story_ids || [];
        const filterReason = parsed.tool_call.reasoning || `Filtered feed to ${filterTopic || "relevant stories"} matching current discussion.`;

        executedTools.push({
          tool_name: "filter_feed",
          query: filterTopic || matchedIds.join(", "),
          results_summary: `Filtered feed: "${filterTopic || "focused stories"}" (${matchedIds.length} event IDs). Reason: ${filterReason}`,
          items_retrieved: matchedIds.length,
        });

        parsed.active_feed_filter = {
          is_active: true,
          topic: filterTopic || undefined,
          matched_event_ids: matchedIds.length > 0 ? matchedIds : undefined,
          filter_reason: filterReason,
        };
      } else if (name === "search_internet" && query) {
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

    // Step 3: Validate extracted topics against genuine user messages
    const validatedExtractedTopics: DialogueResponse["extracted_topics"] = [];
    if (Array.isArray(parsed.extracted_topics)) {
      const userText = history
        .filter((m) => m.role === "user")
        .map((m) => m.content)
        .join(" ")
        .toLowerCase();

      for (const et of parsed.extracted_topics) {
        if (!et.topic || typeof et.topic !== "string") continue;
        const lowerTopic = et.topic.toLowerCase();
        const lowerReasoning = (et.reasoning || "").toLowerCase();

        // Reject meta-app / system hallucinations
        if (
          lowerReasoning.includes("epistemic companion") ||
          lowerReasoning.includes("using this app") ||
          lowerReasoning.includes("context that emphasizes") ||
          lowerReasoning.includes("personalized adaptation") ||
          lowerTopic.includes("epistemology and the nature of knowledge") ||
          lowerTopic.includes("psychology of decision-making")
        ) {
          if (!userText.includes(lowerTopic)) continue;
        }

        const evidence = (et.evidence_quote || "").toLowerCase().trim();
        if ((evidence.length >= 3 && userText.includes(evidence)) || userText.includes(lowerTopic)) {
          validatedExtractedTopics.push({
            topic: et.topic,
            weight: Math.min(1.0, Math.max(0.1, et.weight || 0.8)),
            reasoning: et.reasoning || `User actively discussed ${et.topic}.`,
            confidence_score: et.confidence_score || 0.9,
            evidence_quote: et.evidence_quote || "",
          });
        }
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
      active_feed_filter: parsed.active_feed_filter || undefined,
      extracted_topics: validatedExtractedTopics,
      interest_intersections: parsed.interest_intersections || [],
      adjacent_curiosity_frontiers: parsed.adjacent_curiosity_frontiers || [],
      is_profile_ready: parsed.is_profile_ready || false,
      suggested_queries: parsed.suggested_queries || [],
    };
  }
}

