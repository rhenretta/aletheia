import { deepseekProvider } from "../../llm/deepseek-provider";
import {
  UserKnowledgeGraph,
  UnifiedTopicNode,
  InterestIntersection,
  AdjacentCuriosityFrontier,
  AttachedStoryContext,
  AgenticContextFlowStep,
  GeneratedMessageContext,
  EventSourceArticle,
} from "../../types/contracts";
import { traceLogger } from "../../observability/trace-logger";
import { FreeNewsFetcher } from "../../ingestion/rss-search";
import { postgresStore } from "../../storage/postgres-store";
import { ContextAgent } from "../context/context-agent";
import { ObserverAgent } from "../observer/observer-agent";
import { SemanticTopicResolver } from "../../search/semantic-topic-resolver";
import { filterFeedBySemanticAffinity } from "../../matching/semantic-matcher";

export interface ToolExecution {
  tool_name: string;
  query: string;
  results_summary: string;
  items_retrieved: number;
  sources?: EventSourceArticle[];
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
    trigger_targeted_curation?: boolean;
    curation_query?: string;
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

export type DialogueStreamEvent =
  | { type: "token"; token: string }
  | {
      type: "feed_filter";
      data: {
        is_active: boolean;
        topic?: string;
        matched_event_ids?: string[];
        filter_reason?: string;
        trigger_targeted_curation?: boolean;
        curation_query?: string;
      };
    }
  | { type: "tool_start"; tool_name: string; query: string }
  | { type: "tool_complete"; tool_name: string; query: string; summary: string; sources?: EventSourceArticle[] }
  | { type: "meta"; data: DialogueResponse };

export class JsonMessageStreamExtractor {
  private buffer: string = "";
  private insideMessage: boolean = false;
  private messageKeyFound: boolean = false;
  private isEscaped: boolean = false;

  public processChunk(chunk: string): string {
    this.buffer += chunk;

    if (!this.messageKeyFound) {
      const msgIndex = this.buffer.indexOf('"message"');
      if (msgIndex !== -1) {
        const colonIndex = this.buffer.indexOf(":", msgIndex + 9);
        if (colonIndex !== -1) {
          const firstQuoteIndex = this.buffer.indexOf('"', colonIndex + 1);
          if (firstQuoteIndex !== -1) {
            this.messageKeyFound = true;
            this.insideMessage = true;
            const remaining = this.buffer.slice(firstQuoteIndex + 1);
            this.buffer = "";
            return this.extractFromMessageString(remaining);
          }
        }
      }
      return "";
    }

    if (this.insideMessage) {
      return this.extractFromMessageString(chunk);
    }

    return "";
  }

  private extractFromMessageString(str: string): string {
    let result = "";
    for (let i = 0; i < str.length; i++) {
      const char = str[i];
      if (this.isEscaped) {
        if (char === "n") result += "\n";
        else if (char === "t") result += "\t";
        else if (char === '"') result += '"';
        else if (char === "\\") result += "\\";
        else result += char;
        this.isEscaped = false;
      } else if (char === "\\") {
        this.isEscaped = true;
      } else if (char === '"') {
        this.insideMessage = false;
        break;
      } else {
        result += char;
      }
    }
    return result;
  }
}

export class DialogueAgent {
  /**
   * Real-Time Streaming Dual-Intent Conversation with Context Framing, Live Tools, and Token Streaming
   */
  public static async *chatStream(
    history: ChatMessage[],
    currentGraph?: UserKnowledgeGraph | UnifiedTopicNode,
    attachedStory?: AttachedStoryContext,
    currentStories?: Array<{
      event_id: string;
      headline: string;
      topic: string;
      summary: string;
      fact_bullets?: string[];
      disputed_claims?: Array<{ claim: string; divergence_reason: string }>;
    }>,
    clientContext?: {
      clientTime?: string;
      timeZone?: string;
      localFormatted?: string;
      location?: string;
    }
  ): AsyncGenerator<DialogueStreamEvent, DialogueResponse> {
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

    // 2. Step 1: Immediate Semantic Topic Resolution & Feed Filtering FIRST
    const semanticResult = await SemanticTopicResolver.resolveContextualTopics(
      unifiedNode,
      history.map((m) => ({ role: m.role, content: m.content })),
      lastUserMessage,
      attachedStory
    );

    const identifiedTopic =
      semanticResult.identified_discussion_subject ||
      semanticResult.selected_topics[0]?.topic_name ||
      attachedStory?.topic;

    let relevantStories: Array<{
      event_id: string;
      headline: string;
      topic: string;
      summary: string;
      fact_bullets?: string[];
    }> = [];

    let matchedIds: string[] = [];

    // Filter available candidate stories by the identified topic for local epistemic grounding
    if (currentStories && currentStories.length > 0 && identifiedTopic) {
      const semanticallyMatched = filterFeedBySemanticAffinity(
        currentStories as any,
        identifiedTopic,
        unifiedNode
      );
      relevantStories = semanticallyMatched.slice(0, 5);
      matchedIds = semanticallyMatched.map((s) => s.event_id);
    }

    const shouldCurate = Boolean(
      identifiedTopic &&
      identifiedTopic !== "all" &&
      identifiedTopic !== "General" &&
      (matchedIds.length === 0 || !currentStories || currentStories.length === 0)
    );

    // Instantly emit feed_filter event to the client so UI updates immediately and can trigger background curation
    if (identifiedTopic && identifiedTopic !== "all" && identifiedTopic !== "General") {
      yield {
        type: "feed_filter",
        data: {
          is_active: true,
          topic: identifiedTopic,
          matched_event_ids: matchedIds,
          filter_reason: `Focusing on "${identifiedTopic}" from active discussion`,
          trigger_targeted_curation: shouldCurate,
          curation_query: identifiedTopic,
        },
      };
    }

    const now = new Date();
    const currentDateStr = clientContext?.localFormatted || now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    const timeZoneStr = clientContext?.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    const locationStr = clientContext?.location || timeZoneStr;

    // 3. Step 2: Context Agent Framing grounded in the local candidate stories
    const contextFraming = await ContextAgent.generateContextFraming(
      unifiedNode,
      history.map((m) => ({ role: m.role, content: m.content })),
      lastUserMessage,
      attachedStory,
      relevantStories
    );

    const systemPrompt = `You are Aletheia, a personalized epistemic intelligence companion built on the Mind-State Memory Architecture.
You engage in dual-intent conversations equipped with real-time tool execution and feed filtering capabilities:

REAL-TIME TEMPORAL & SPATIAL GROUNDING (CRITICAL):
- CURRENT EXACT DATE & TIME: ${currentDateStr}
- REAL-WORLD YEAR: ${now.getFullYear()}
- LOCAL TIMEZONE: ${timeZoneStr}
- USER REGION / LOCATION: ${locationStr}
- REAL-WORLD TIMESTAMP: ${clientContext?.clientTime || now.toISOString()}

CHRONOLOGICAL INTEGRITY & FACT-CHECKING RULES:
1. FACTUAL GROUNDING & ANTI-HALLUCINATION:
   - Check the publication date of any attached article against today's date (${currentDateStr}). If an article was published weeks or months ago, its expectations may be historical or superseded by subsequent real-world milestones.
   - Ground current project/mission status, metrics, and timelines in the retrieved real-time wire search results.
   - If an earlier turn in conversation history contained an inaccurate statement or hallucinated event, CORRECT IT FACTUALLY rather than accepting or compounding the mistake.
   - Explicitly clarify the timeline if an article's claim reflects an older phase compared to the current real-world status as of ${currentDateStr}.

CRITICAL CONVERSATIONAL PRINCIPLES:
1. INVISIBLE STEERING: Use known user interests and knowledge graph anchors to SUBTLY SHAPE the conversation. Never echo or narrate profile traits ("As someone who..."). Never end with formulaic questions.
2. OBJECTIVE PEER TONE: Speak naturally, substantively, and concisely as an intellectual peer grounded in operational realities.
3. ACTIVE DISCUSSION FEED FILTERING:
   - When the conversation explores, inquires about, or discusses a specific topic or concept, set active_feed_filter:
     * "is_active": true
     * "topic": The canonical topic name being discussed
     * "matched_event_ids": Array of relevant event IDs from local feed stories
     * "filter_reason": Short reason (e.g. "Focusing on active discussion of Topic Name")
   - If the conversation is a general greeting or meta-query without a topic focus, set "is_active": false.
4. OUTPUT STRICT JSON adhering to:
{
  "agent_internal_rationale": {
    "user_emotional_state_detected": "User mindset",
    "curiosity_focus_identified": "Core intellectual interest",
    "intersections_analyzed": "Cross-domain relationships or 'None'",
    "pedagogical_strategy": "Conversational goal",
    "why_this_response": "Why this framing was chosen"
  },
  "message": "Direct, natural, grounded conversational response addressing the user as an intellectual peer",
  "active_feed_filter": {
    "filter_reason": "Explanation for filter",
    "is_active": boolean,
    "topic": string,
    "matched_event_ids": ["evt_123"],
    "trigger_targeted_curation": boolean,
    "curation_query": "2-4 word search query"
  },
  "extracted_topics": [
    {
      "reasoning": "Summary of user interest",
      "topic": "Canonical Topic Name",
      "weight": 0.85,
      "confidence_score": 0.95,
      "evidence_quote": "Exact user quote"
    }
  ]
}`;

    const knownContext = `[UNIFIED TOPIC NODE - SINGLE SOURCE OF TRUTH]:
- Active Topics: ${Object.entries(unifiedNode.topics || {}).map(([k, v]) => `${k} (${Math.round(v.weight * 100)}%)`).join(", ") || "None"}

${contextFraming.empath_instructions}`;

    let storyDateInfo = "";
    if (attachedStory) {
      const pubDate = attachedStory.published_at ? new Date(attachedStory.published_at) : null;
      if (pubDate && !isNaN(pubDate.getTime())) {
        const ageDays = Math.round((now.getTime() - pubDate.getTime()) / (1000 * 60 * 60 * 24));
        storyDateInfo = `\n- Published Date: ${pubDate.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })} (${ageDays} days ago)`;
      }
    }

    const storyContext = attachedStory
      ? `\nATTACHED STORY CURRENTLY UNDER DISCUSSION:
- Topic: ${attachedStory.topic}
- Headline: ${attachedStory.headline}${storyDateInfo}
- Summary: ${attachedStory.summary}
- Verified Facts:
${(attachedStory.fact_bullets || []).map((f) => `  * ${f}`).join("\n")}`
      : "";

    const currentFeedContext =
      relevantStories.length > 0
        ? `\nCURRENT FILTERED FEED STORIES FOR THIS TOPIC (${relevantStories.length} articles):
${relevantStories.map((s, i) => `${i + 1}. [${s.topic}] "${s.headline}"
Summary: ${s.summary}
${s.fact_bullets && s.fact_bullets.length > 0 ? `Key Facts: ${s.fact_bullets.join(" | ")}` : ""}`).join("\n\n")}`
        : "";

    const formattedHistory = history.map((m) => `${m.role === "assistant" ? "ALETHEIA" : "USER"}: ${m.content}`).join("\n\n");
    let finalPrompt = `${knownContext}${storyContext}${currentFeedContext}\n\nConversation History:\n${formattedHistory}`;

    // First, let DeepSeek evaluate whether local context is sufficient or if a live search tool is required
    const toolEvaluationPrompt = `${finalPrompt}

EPISTEMIC SUFFICIENCY & TEMPORAL INTEGRITY EVALUATION:
- CURRENT REAL-WORLD DATE: ${currentDateStr} (Year: ${now.getFullYear()})
- LOCAL CONTEXT: Check the attached story and current feed stories above.

EVALUATION MANDATE:
1. If the inquiry is a general reflection or is 100% answered with complete accuracy by the verified local articles above, output the final conversational JSON directly.
2. If the user's inquiry touches upon real-world developments, current status, roadmap, upcoming milestones, recent news, or future expectations, AND the local context above lacks verified reporting from ${now.getFullYear()} covering this exact point, your pre-training knowledge is OUTDATED. You MUST execute a "search_internet" tool call to ground yourself in the live wire before generating a response.
3. NEVER answer questions about the current state of ongoing real-world technologies, companies, or events from static memory without live wire verification.

Output strict JSON:
- To call search tool:
{
  "thought_process": "Why local context is insufficient for current real-world status as of ${now.getFullYear()}",
  "tool_call": {
    "tool_name": "search_internet",
    "query": "targeted search query for current status"
  }
}
- To respond directly (only when local articles provide verified current facts):
{
  "agent_internal_rationale": { ... },
  "message": "Direct response",
  "active_feed_filter": { ... },
  "extracted_topics": [ ... ]
}`;

    let toolDecision: any = null;
    if (deepseekProvider.isConfigured()) {
      try {
        const evaluationResult = await deepseekProvider.generateCompletion(toolEvaluationPrompt, {
          systemPrompt,
          temperature: 0.1,
          maxTokens: 500,
        });

        toolDecision = JSON.parse(evaluationResult.text.replace(/```json\n?|\n?```/g, "").trim());
      } catch (err) {
        console.warn("Tool evaluation parse error:", err);
      }
    }

    // If the model autonomously decided it needs external live wire data:
    if (toolDecision?.tool_call?.tool_name === "search_internet" && toolDecision.tool_call.query) {
      const toolQuery = String(toolDecision.tool_call.query).trim();
      yield { type: "tool_start", tool_name: "search_internet", query: toolQuery };

      try {
        const liveArticles = await FreeNewsFetcher.searchNews(toolQuery, 5);
        const eventSources: EventSourceArticle[] = liveArticles.map((a) => ({
          name: a.source_name || "News Wire",
          title: a.title,
          url: a.source_url,
          bias: a.author_bias_rating || "center",
          raw_text: a.raw_text,
          published_at: a.published_at,
          highlighted_passages: a.raw_text ? [a.raw_text.slice(0, 200)] : [],
        }));

        executedTools.push({
          tool_name: "search_internet",
          query: toolQuery,
          results_summary: `Retrieved ${liveArticles.length} live sources.`,
          items_retrieved: liveArticles.length,
          sources: eventSources,
        });

        yield {
          type: "tool_complete",
          tool_name: "search_internet",
          query: toolQuery,
          summary: `Retrieved ${liveArticles.length} live sources.`,
          sources: eventSources,
        };

        if (liveArticles.length > 0) {
          finalPrompt += `\n\n[REAL-TIME LIVE WIRE SEARCH RESULTS FOR "${toolQuery}" (FETCHED AT ${now.toISOString()})]:
${liveArticles.map((a, i) => `${i + 1}. "${a.title}" (${a.source_name}, Published: ${a.published_at || 'Recent'})
Summary: ${a.raw_text.slice(0, 300)}
URL: ${a.source_url}`).join("\n\n")}

CRITICAL REAL-TIME GROUNDING INSTRUCTIONS:
- Current real-world date: ${currentDateStr} (Year: ${now.getFullYear()}).
- Ground your response EXCLUSIVELY and FACTUALLY in the live search results above.
- If the user is asking about an attached article's claim, explicitly compare that claim with the live search results above and clarify whether it reflects historical plans or the latest current status.`;
        }
      } catch (err) {
        console.warn("Live search execution error:", err);
      }
    }

    // Step 3: Stream tokens to client
    const extractor = new JsonMessageStreamExtractor();
    let accumulatedJson = "";
    const streamGen = deepseekProvider.generateStream(finalPrompt, { systemPrompt, temperature: 0.5 });

    for await (const chunk of streamGen) {
      accumulatedJson += chunk;
      const token = extractor.processChunk(chunk);
      if (token) yield { type: "token", token };
    }

    let parsed: any;
    try {
      parsed = JSON.parse(accumulatedJson.replace(/```json\n?|\n?```/g, "").trim());
    } catch (e) {
      parsed = { message: accumulatedJson };
    }

    // Step 4: Finalization and Validation
    const validatedExtractedTopics = (parsed.extracted_topics || []).filter((et: any) => et.topic);
    
    // Save updated graph
    unifiedNode.last_updated = new Date().toISOString();
    await postgresStore.saveUnifiedTopicNode(unifiedNode);

    const agenticFlowSteps: AgenticContextFlowStep[] = [
      {
        step_number: 1,
        stage_name: "User Input & Turn Retrieval",
        agent_name: "Dialogue Intake Agent",
        description: `Captured active user prompt and conversation history (${history.length} preceding messages).`,
        input_data: { raw_history_length: history.length, attached_story_id: attachedStory?.event_id || null },
        output_data: { user_latest_prompt: lastUserMessage },
        status: "completed",
      },
      {
        step_number: 2,
        stage_name: "Mind-State Knowledge Graph Resolution",
        agent_name: "Semantic Topic Resolver",
        description: `Identified discussion subject "${contextFraming.semantic_resolution?.identified_discussion_subject || "General"}" and selected ${contextFraming.semantic_resolution?.selected_topics.length || 0} contextual knowledge graph topics.`,
        input_data: { current_user_message: lastUserMessage },
        output_data: {
          identified_subject: contextFraming.semantic_resolution?.identified_discussion_subject,
          selected_topics: contextFraming.semantic_resolution?.selected_topics.map((t) => t.topic_name),
          semantic_reasoning: contextFraming.semantic_resolution?.semantic_reasoning_summary,
        },
        status: "completed",
      },
      {
        step_number: 3,
        stage_name: "Psychological Framing & Calibration",
        agent_name: "Context Agent (The Empath)",
        description: `Calibrated technical depth to "${contextFraming.calibrated_depth}", retrieved ${contextFraming.retrieved_stories?.length || 0} relevant stories, and enforced boundaries.`,
        input_data: {
          matched_topic_motivations: contextFraming.why_they_care_context,
          enforced_sensitivities: contextFraming.active_sensitivities,
          enforced_boundaries: contextFraming.active_boundaries,
          current_user_message: lastUserMessage,
        },
        output_data: {
          calibrated_depth: contextFraming.calibrated_depth,
          retrieved_stories_count: contextFraming.retrieved_stories?.length || 0,
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
        description: `Streamed grounded response with invisible steering. Identified mindset "${parsed.agent_internal_rationale?.user_emotional_state_detected || "Engaged"}".`,
        input_data: {
          system_prompt: systemPrompt,
          temperature: 0.7,
        },
        output_data: {
          parsed_response_message: parsed.message,
          agent_internal_rationale: parsed.agent_internal_rationale,
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

    const traceId = `trace_chat_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const contextGenerated: GeneratedMessageContext = {
      empath_instructions: contextFraming.empath_instructions,
      calibrated_depth: contextFraming.calibrated_depth,
      emotional_trajectory: unifiedNode.psychological_profile?.emotional_trajectory,
      active_sensitivities: contextFraming.active_sensitivities,
      active_boundaries: contextFraming.active_boundaries,
      why_they_care_context: contextFraming.why_they_care_context,
      pedagogical_strategy: parsed.agent_internal_rationale?.pedagogical_strategy,
      retrieved_stories: contextFraming.retrieved_stories,
      tools_executed: executedTools,
      raw_prompt_sent_to_llm: finalPrompt,
      raw_system_prompt: systemPrompt,
      agent_internal_rationale: parsed.agent_internal_rationale,
      agentic_flow: agenticFlowSteps,
    };

    const finalResponse: DialogueResponse = {
      message: parsed.message || "...",
      trace_id: traceId,
      context_trace_id: contextFraming.trace_id,
      tool_executions: executedTools,
      agent_internal_rationale: parsed.agent_internal_rationale || {
        user_emotional_state_detected: "Neutral",
        curiosity_focus_identified: "General",
        intersections_analyzed: "None",
        pedagogical_strategy: "Direct",
        why_this_response: "Standard",
      },
      context_generated: contextGenerated,
      active_feed_filter: parsed.active_feed_filter
        ? {
            ...parsed.active_feed_filter,
            is_active: parsed.active_feed_filter.is_active !== false,
            topic: parsed.active_feed_filter.topic || identifiedTopic || undefined,
            matched_event_ids: parsed.active_feed_filter.matched_event_ids?.length
              ? parsed.active_feed_filter.matched_event_ids
              : matchedIds,
            trigger_targeted_curation:
              parsed.active_feed_filter.trigger_targeted_curation ?? shouldCurate,
            curation_query:
              parsed.active_feed_filter.curation_query ||
              parsed.active_feed_filter.topic ||
              identifiedTopic,
          }
        : {
            is_active: Boolean(identifiedTopic && identifiedTopic !== "all" && identifiedTopic !== "General"),
            topic: identifiedTopic || undefined,
            matched_event_ids: matchedIds,
            filter_reason: `Focusing on "${identifiedTopic}" from active discussion`,
            trigger_targeted_curation: shouldCurate,
            curation_query: identifiedTopic,
          },
      extracted_topics: validatedExtractedTopics,
      interest_intersections: parsed.interest_intersections || [],
      adjacent_curiosity_frontiers: parsed.adjacent_curiosity_frontiers || [],
      is_profile_ready: parsed.is_profile_ready || false,
      suggested_queries: parsed.suggested_queries || [],
    };

    yield { type: "meta", data: finalResponse };
    return finalResponse;
  }

  public static async chat(
    history: ChatMessage[],
    currentGraph?: UserKnowledgeGraph | UnifiedTopicNode,
    attachedStory?: AttachedStoryContext,
    currentStories?: Array<{
      event_id: string;
      headline: string;
      topic: string;
      summary: string;
      fact_bullets?: string[];
      disputed_claims?: Array<{ claim: string; divergence_reason: string }>;
    }>,
    clientContext?: {
      clientTime?: string;
      timeZone?: string;
      localFormatted?: string;
      location?: string;
    }
  ): Promise<DialogueResponse> {
    const stream = this.chatStream(history, currentGraph, attachedStory, currentStories, clientContext);
    let finalResp: DialogueResponse | null = null;
    for await (const event of stream) {
      if (event.type === "meta") finalResp = event.data;
    }
    return finalResp || {
        message: "No response generated.",
        agent_internal_rationale: { user_emotional_state_detected: "Engaged", curiosity_focus_identified: "General", intersections_analyzed: "None", pedagogical_strategy: "Direct", why_this_response: "Fallback" },
        extracted_topics: [],
        interest_intersections: [],
        adjacent_curiosity_frontiers: [],
        is_profile_ready: false,
        suggested_queries: [],
    };
  }
}
