import { deepseekProvider } from "../../llm/deepseek-provider";
import {
  UserKnowledgeGraph,
  UnifiedTopicNode,
  InterestIntersection,
  AdjacentCuriosityFrontier,
  AttachedStoryContext,
  AttachedTopicBriefContext,
  AgenticContextFlowStep,
  GeneratedMessageContext,
  EventSourceArticle,
  RawArticle,
  generateTopicId,
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
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  run_id?: string;
  trace_id?: string;
  context_trace_id?: string;
  attached_story?: AttachedStoryContext;
  attached_topic_brief?: AttachedTopicBriefContext;
  tool_executions?: ToolExecution[];
  suggested_queries?: string[];
  context_generated?: GeneratedMessageContext;
  agent_internal_rationale?: {
    user_emotional_state_detected?: string;
    curiosity_focus_identified?: string;
    intersections_analyzed?: string;
    pedagogical_strategy?: string;
    why_this_response?: string;
  };
  reasoning_details?: {
    user_intent: string;
    topics_activated: string[];
    intersections_analyzed: string;
    pedagogical_strategy: string;
    why_this_response: string;
  };
}

export interface DialogueResponse {
  message: string;
  run_id?: string;
  trace_id?: string;
  context_trace_id?: string;
  tool_executions?: ToolExecution[];
  agent_internal_rationale?: {
    user_emotional_state_detected?: string;
    curiosity_focus_identified?: string;
    intersections_analyzed?: string;
    pedagogical_strategy?: string;
    why_this_response?: string;
  };
  reasoning_details?: {
    user_intent?: string;
    topics_activated?: string[];
    intersections_analyzed?: string;
    pedagogical_strategy?: string;
    why_this_response?: string;
  };
  active_feed_filter?: {
    is_active: boolean;
    topic?: string;
    topic_id?: string;
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
        topic_id?: string;
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
    },
    attachedTopicBrief?: AttachedTopicBriefContext
  ): AsyncGenerator<DialogueStreamEvent, DialogueResponse> {
    const startTime = Date.now();
    const executedTools: ToolExecution[] = [];
    const lastUserMessage = history[history.length - 1]?.content || "";
    const runId = `run_chat_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    // 1. Resolve Unified Topic Node
    let unifiedNode: UnifiedTopicNode;
    if (currentGraph && "psychological_profile" in currentGraph) {
      unifiedNode = currentGraph as UnifiedTopicNode;
    } else {
      unifiedNode = await postgresStore.getUnifiedTopicNode("usr_default");
    }

    const sessionId = unifiedNode?.user_id ? `sess_${unifiedNode.user_id}` : `sess_${Date.now()}`;

    // 2. Step 1: Immediate Semantic Topic Resolution & Feed Filtering FIRST
    const semanticResult = await SemanticTopicResolver.resolveContextualTopics(
      unifiedNode,
      history.map((m) => ({ role: m.role, content: m.content })),
      lastUserMessage,
      attachedStory
    );

    // 1. Direct canonical topic from user knowledge graph
    const matchedSelectedTopic =
      semanticResult.selected_topics?.find((t) => t.graph_connection_type === "direct_match") ||
      semanticResult.selected_topics?.[0];

    const canonicalGraphTopic = matchedSelectedTopic?.topic_name;
    const canonicalTopicId =
      matchedSelectedTopic?.topic_id ||
      (canonicalGraphTopic ? (unifiedNode.topics?.[canonicalGraphTopic]?.topic_id || generateTopicId(canonicalGraphTopic)) : undefined);

    // 2. Structured novel candidate topic from semantic resolver
    const candidateTopic =
      canonicalGraphTopic ||
      semanticResult.new_topic_candidates?.[0]?.topic_name ||
      attachedStory?.topic;

    const candidateTopicId =
      canonicalTopicId ||
      semanticResult.new_topic_candidates?.[0]?.topic_id ||
      (attachedStory?.topic ? generateTopicId(attachedStory.topic) : undefined);

    // 3. Normalize raw subject by stripping parenthetical acronyms and conversational noise
    const rawTopic = candidateTopic || semanticResult.identified_discussion_subject;
    const identifiedTopic = rawTopic
      ? rawTopic.replace(/\([^)]*\)/g, "").replace(/\s+/g, " ").trim()
      : undefined;

    const identifiedTopicId = candidateTopicId || (identifiedTopic ? generateTopicId(identifiedTopic) : undefined);

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
          topic_id: identifiedTopicId,
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
      relevantStories,
      attachedTopicBrief
    );

    // Log Context Agent step trace
    const whyCareText = Array.isArray(contextFraming.why_they_care_context)
      ? contextFraming.why_they_care_context.join("; ")
      : String(contextFraming.why_they_care_context || "");

    traceLogger.logTrace({
      run_id: runId,
      session_id: sessionId,
      node_name: "node_context",
      call_type: "agent_step",
      reasoning_rationale:
        whyCareText ||
        `Context resolved for "${identifiedTopic || "General"}" (calibrated depth: ${contextFraming.calibrated_depth})`,
      latency_ms: 5,
      input_summary: {
        last_user_message: lastUserMessage.slice(0, 150),
        identified_topic: identifiedTopic,
        attached_story: attachedStory?.headline || (attachedStory as any)?.title || null,
        history_length: history.length,
      },
      output_summary: {
        calibrated_depth: contextFraming.calibrated_depth,
        empath_instructions: contextFraming.empath_instructions,
        selected_topics_count: contextFraming.semantic_resolution?.selected_topics?.length || 0,
        selected_topics: (contextFraming.semantic_resolution?.selected_topics || []).map((t) => t.topic_name),
        relevant_stories_found: relevantStories.length,
        safeguards_active: contextFraming.active_boundaries.length,
      },
      context_details: {
        emotional_trajectory: unifiedNode.psychological_profile?.emotional_trajectory,
        active_topics: Object.keys(unifiedNode.topics || {}),
        sensitivities: contextFraming.active_sensitivities,
        boundaries: contextFraming.active_boundaries,
        why_they_care: contextFraming.why_they_care_context,
      },
    });

    const systemPrompt = `You are Aletheia, a personalized epistemic intelligence companion built on the Mind-State Memory Architecture.
You engage in dual-intent conversations equipped with real-time tool execution and feed filtering capabilities:

REAL-TIME TEMPORAL & SPATIAL GROUNDING (CRITICAL):
- CURRENT EXACT DATE & TIME: ${currentDateStr}
- REAL-WORLD YEAR: ${now.getFullYear()}
- LOCAL TIMEZONE: ${timeZoneStr}
- USER REGION / LOCATION: ${locationStr}
- REAL-WORLD TIMESTAMP: ${clientContext?.clientTime || now.toISOString()}

CHRONOLOGICAL INTEGRITY, INLINE CITATIONS & FACT-CHECKING RULES:
1. FACTUAL GROUNDING & ANTI-HALLUCINATION:
   - Check the publication date of any attached article against today's date (${currentDateStr}). If an article was published weeks or months ago, its expectations may be historical or superseded by subsequent real-world milestones.
   - Ground current project/mission status, metrics, and timelines in the retrieved real-time wire search results.
   - If an earlier turn in conversation history contained an inaccurate statement or hallucinated event, CORRECT IT FACTUALLY rather than accepting or compounding the mistake.
   - Explicitly clarify the timeline if an article's claim reflects an older phase compared to the current real-world status as of ${currentDateStr}.

2. INLINE CITATION MANDATE (CRITICAL):
   - EVERY factual statement, milestone claim, status update, or hardware expectation MUST include an inline markdown hyperlink to the specific original article reporting it: [Source Name](URL).
   - Only use real URLs provided in the live search observations or attached story. NEVER invent URLs.

3. GRANULAR CLAIM DECOMPOSITION & ZERO EXTRAPOLATION:
   - When an inquiry asks about multiple entities, claims, or milestones (e.g. "both a booster catch and a ship catch"):
     * Verify each claim independently against the retrieved search passages.
     * If search passages confirm Claim A, cite the source [Source Name](URL).
     * If search passages make NO mention of Claim B (or indicate it is uncertain/delayed), you MUST explicitly state that there is no verified evidence or reporting for Claim B.
     * You are STRICTLY FORBIDDEN from guessing, extrapolating, or assuming that an unmentioned entity or milestone is taking place based on past mission precedent. State the absence of verified evidence factually.

4. CHRONOLOGICAL RECENCY & LATEST STATUS FOCUS (CRITICAL):
   - When the user asks "what's the latest with [X]", "latest news", "current status", or inquires about ongoing technical/operational progress:
     * Lead with and prioritize the MOST RECENT DEVELOPMENTS, current active operational state, and upcoming milestones as of ${currentDateStr}.
     * NEVER recount superseded historical iterations, previous tests, or months-old events (e.g. tests, flights, or versions from months or years ago) as the primary answer to "what's the latest".
     * If search observations contain both recent news and older background articles, clearly distinguish between the current active state and prior completed history.

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
4. TOPIC EXTRACTION INTEGRITY (SUBSTANTIVE REAL-WORLD DOMAIN VS. COGNITIVE/RHETORICAL FRAME):
   - A trackable topic MUST represent a concrete, ongoing real-world subject domain, technology, industry, organization, public figure, product, or event field that can be monitored via news wires and journalistic reporting (e.g., "Renewable Energy Infrastructure", "Quantum Computing", "Commercial Spaceflight", "Solid-State Battery Technology").
   - STRICT PROHIBITION: NEVER extract cognitive thinking styles, epistemic inquiry modes, statistical analysis methods, or rhetorical/debate framing devices as trackable topics (e.g., NEVER extract "Evidence Evaluation", "Critical Thinking", "Statistical Inference", "Fact Verification", "Anecdotal Comparison", "Debate Analysis", "Methodology").
   - When a user applies an analytical framework or compares evidence types (e.g., comparing personal trial anecdotes vs double-blind clinical statistics in oncology), the TOPIC is strictly the underlying real-world subject domain (e.g., "Immunotherapy Oncology" or "mRNA Therapeutics"). The cognitive methodology belongs in the conversational response or curiosity vectors, NEVER as an independent user topic.
5. OUTPUT STRICT JSON adhering to:
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

    const topicBriefContext = attachedTopicBrief
      ? `\nATTACHED LIVING EVENT TOPIC DOSSIER UNDER DISCUSSION:
- Event Topic: "${attachedTopicBrief.topic_title}" (Parent Domain: "${attachedTopicBrief.parent_interest}")
- Lifecycle State: ${attachedTopicBrief.lifecycle_label} (${attachedTopicBrief.lifecycle_phase}) · Gravity: ${attachedTopicBrief.gravity_score}/100
- Current Focus ("The Now"): ${attachedTopicBrief.current_focus}
- Executive Summary: ${attachedTopicBrief.executive_summary}
${
  attachedTopicBrief.public_sentiment
    ? `- Community Sentiment & Public Reception:
  * Tone: ${attachedTopicBrief.public_sentiment.tone.toUpperCase()}
  * Consensus: ${attachedTopicBrief.public_sentiment.summary}
  * Representative Public Quotes:
${attachedTopicBrief.public_sentiment.representative_quotes.map((q) => `    • "${q.quote}" [${q.speaker_or_community}]`).join("\n")}`
    : ""
}
${
  attachedTopicBrief.historical_arc && attachedTopicBrief.historical_arc.length > 0
    ? `- Anchored Historical Arc:
${attachedTopicBrief.historical_arc.map((m) => `  * [${m.time_label}] ${m.milestone}`).join("\n")}`
    : ""
}
${
  attachedTopicBrief.key_facts && attachedTopicBrief.key_facts.length > 0
    ? `- Verified Key Facts:
${attachedTopicBrief.key_facts.map((f) => `  * ${f}`).join("\n")}`
    : ""}`
      : "";

    const currentFeedContext =
      relevantStories.length > 0
        ? `\nCURRENT FILTERED FEED STORIES FOR THIS TOPIC (${relevantStories.length} articles):
${relevantStories.map((s, i) => `${i + 1}. [${s.topic}] "${s.headline}"
Summary: ${s.summary}
${s.fact_bullets && s.fact_bullets.length > 0 ? `Key Facts: ${s.fact_bullets.join(" | ")}` : ""}`).join("\n\n")}`
        : "";

    const formattedHistory = history.map((m) => `${m.role === "assistant" ? "ALETHEIA" : "USER"}: ${m.content}`).join("\n\n");
    let finalPrompt = `${knownContext}${storyContext}${topicBriefContext}${currentFeedContext}\n\nConversation History:\n${formattedHistory}`;

    // First, let DeepSeek evaluate whether local context is sufficient or if a live search tool is required
    const toolEvaluationPrompt = `${finalPrompt}

EPISTEMIC SUFFICIENCY & TEMPORAL INTEGRITY EVALUATION:
- CURRENT REAL-WORLD DATE: ${currentDateStr} (Year: ${now.getFullYear()})
- LOCAL CONTEXT: Check the attached story and current feed stories above.

EVALUATION MANDATE:
1. If the inquiry is a general reflection or is 100% answered with complete accuracy by the verified local articles above, output the final conversational JSON directly.
2. If the user's inquiry touches upon real-world developments, current status, roadmap, upcoming milestones, recent news, or future expectations, AND the local context above lacks verified reporting from ${now.getFullYear()} covering this exact point, your pre-training knowledge is OUTDATED. You MUST execute a "search_internet" tool call to ground yourself in the live wire before generating a response.
3. NEVER answer questions about the current state of ongoing real-world technologies, companies, or events from static memory without live wire verification.
4. QUERY FORMULATION MANDATE: Keep search queries concise, objective, and entity-focused (e.g. "[Entity Name] latest developments", "[Technology Name] benchmark results"). Do NOT append current calendar months (e.g. "September 2026") or conversational question words unless the user explicitly requested that specific month, as exact month strings severely over-constrain search engines.

Output strict JSON:
- To call search tool:
{
  "thought_process": "Why local context is insufficient for current real-world status as of ${now.getFullYear()}",
  "tool_call": {
    "tool_name": "search_internet",
    "query": "targeted entity-focused search query"
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

    // Agentic Tool Loop: Evaluate information sufficiency, execute tools (search or deep crawl), observe outputs, and actively explore until satisfied (up to 3 turns)
    let totalItemsFound = 0;
    const MAX_TOOL_TURNS = 3;
    let nextToolAction: { tool_name: "search_internet" | "crawl_web_page"; param: string } | null =
      toolDecision?.tool_call?.query
        ? { tool_name: "search_internet", param: String(toolDecision.tool_call.query).trim() }
        : null;

    for (let turn = 0; turn < MAX_TOOL_TURNS && nextToolAction; turn++) {
      const currentAction = nextToolAction;
      nextToolAction = null; // Clear so it only continues if sufficiency evaluation explicitly decides to explore further

      if (currentAction.tool_name === "search_internet") {
        const currentQuery = currentAction.param;
        yield { type: "tool_start", tool_name: "search_internet", query: currentQuery };

        const toolStartTime = Date.now();
        let liveArticles: RawArticle[] = [];
        try {
          liveArticles = await FreeNewsFetcher.searchNews(currentQuery, 5);
        } catch (err) {
          console.warn(`Agentic search error for "${currentQuery}":`, err);
        }
        const toolDuration = Date.now() - toolStartTime;

        totalItemsFound += liveArticles.length;

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
          query: currentQuery,
          results_summary: liveArticles.length > 0 ? `Retrieved ${liveArticles.length} live sources.` : "Zero sources found for query.",
          items_retrieved: liveArticles.length,
          sources: eventSources,
        });

        // Log tool execution trace
        traceLogger.logTrace({
          run_id: runId,
          session_id: sessionId,
          node_name: "tool_search",
          call_type: "tool",
          latency_ms: toolDuration,
          reasoning_rationale: `Live web wire search retrieved ${liveArticles.length} candidate sources for query "${currentQuery}".`,
          input_summary: {
            tool_name: "search_internet",
            query: currentQuery,
          },
          output_summary: {
            items_retrieved: liveArticles.length,
            sources: eventSources.map((s) => ({ name: s.name, title: s.title, url: s.url })),
          },
          response_details: {
            sources: eventSources,
          },
        });

        yield {
          type: "tool_complete",
          tool_name: "search_internet",
          query: currentQuery,
          summary: liveArticles.length > 0 ? `Retrieved ${liveArticles.length} live sources.` : "Zero sources found for query.",
          sources: eventSources,
        };

        if (liveArticles.length > 0) {
          finalPrompt += `\n\n[LIVE SEARCH OBSERVATION FOR "${currentQuery}" (${liveArticles.length} SOURCES)]:
${liveArticles.map((a, i) => `Source ${i + 1}: [${a.source_name}](${a.source_url})
Title: "${a.title}" (Published: ${a.published_at || 'Recent'})
Snippet: ${a.raw_text}`).join("\n\n")}`;
        } else {
          finalPrompt += `\n\n[LIVE SEARCH OBSERVATION FOR "${currentQuery}"]:
Zero sources found. No verified global news or reporting matched this exact query.`;
        }
      } else if (currentAction.tool_name === "crawl_web_page") {
        const targetUrl = currentAction.param;
        yield { type: "tool_start", tool_name: "crawl_web_page", query: targetUrl };

        const crawlStartTime = Date.now();
        let crawledArticles: RawArticle[] = [];
        try {
          const { DirectContentCrawler } = await import("../../ingestion/direct-crawler");
          const crawlRes = await DirectContentCrawler.crawl({
            id: `crawl_${Date.now()}`,
            topic: "Direct Web Crawl",
            source_type: "www_page",
            url: targetUrl,
            title: targetUrl,
            publisher_name: new URL(targetUrl).hostname.replace(/^www\./, ""),
            status: "active",
            reliability_score: 1.0,
            consecutive_failures: 0,
            created_at: new Date().toISOString(),
          }, 2);
          crawledArticles = crawlRes.articles;
        } catch (err) {
          console.warn(`Agentic crawl error for "${targetUrl}":`, err);
        }
        const crawlDuration = Date.now() - crawlStartTime;

        totalItemsFound += crawledArticles.length;

        const eventSources: EventSourceArticle[] = crawledArticles.map((a) => ({
          name: a.source_name || "Direct Web",
          title: a.title,
          url: a.source_url,
          bias: a.author_bias_rating || "center",
          raw_text: a.raw_text,
          published_at: a.published_at,
          highlighted_passages: a.raw_text ? [a.raw_text.slice(0, 200)] : [],
        }));

        executedTools.push({
          tool_name: "crawl_web_page",
          query: targetUrl,
          results_summary: crawledArticles.length > 0 ? `Crawled full article from ${crawledArticles[0].source_name}.` : "Could not extract body text from page.",
          items_retrieved: crawledArticles.length,
          sources: eventSources,
        });

        // Log crawl execution trace
        traceLogger.logTrace({
          run_id: runId,
          session_id: sessionId,
          node_name: "tool_execution",
          call_type: "tool",
          latency_ms: crawlDuration,
          reasoning_rationale: `Direct web crawler extracted content from ${targetUrl}`,
          input_summary: {
            tool_name: "crawl_web_page",
            url: targetUrl,
          },
          output_summary: {
            items_retrieved: crawledArticles.length,
            title: crawledArticles[0]?.title,
          },
          response_details: {
            sources: eventSources,
          },
        });

        yield {
          type: "tool_complete",
          tool_name: "crawl_web_page",
          query: targetUrl,
          summary: crawledArticles.length > 0 ? `Crawled full article from ${crawledArticles[0].source_name}.` : "Could not extract body text from page.",
          sources: eventSources,
        };

        if (crawledArticles.length > 0) {
          finalPrompt += `\n\n[DIRECT WEB CRAWL OBSERVATION FOR "${targetUrl}"]:
Source: [${crawledArticles[0].source_name}](${targetUrl})
Title: "${crawledArticles[0].title}"
Full Extracted Text: ${crawledArticles[0].raw_text}`;
        }
      }

      // If we haven't reached the turn limit, ask the LLM to evaluate epistemic sufficiency & decide whether to explore further
      if (turn < MAX_TOOL_TURNS - 1 && deepseekProvider.isConfigured()) {
        try {
          const userInquiry = history[history.length - 1]?.content || "";
          const sufficiencyPrompt = `${finalPrompt}

EPISTEMIC SUFFICIENCY & MULTI-TURN EXPLORATION EVALUATION:
User Inquiry: "${userInquiry}"

Examine the accumulated observations above carefully.
Evaluate whether ALL dimensions of the user's inquiry are thoroughly answered with specific empirical facts.

EXPLORATION MANDATES:
1. NON-GROUNDED OBSERVATIONS:
If the search observations returned only generic company homepages, Wikipedia entries, or irrelevant overviews that do NOT contain the specific version numbers, user feedback, or facts asked by the user, you MUST NOT synthesize an unhelpful "I cannot confirm" or "the search results don't specify" response! You MUST choose "explore" with an alternative or refined query (e.g. appending "reviews", "owner impressions", "release notes", or trying alternative keyword combinations) to actively find the answer.

2. COMPOUND INQUIRY REQUIREMENT:
If the user's inquiry contains multiple questions (e.g. "What is X, and how has it been received?"):
- Check if BOTH the version/fact AND the reception/reviews/testing feedback have been found.
- If the current observations only cover one aspect (e.g. the version number is found, but user feedback, safety reviews, or community reception are still missing), you MUST choose "explore" to execute a targeted search (e.g. "[Subject] [Version] user reception reviews" or "[Subject] [Attribute] impressions test") before synthesizing!

Output strict JSON:
- If ALL questions are thoroughly answered with verified evidence:
{
  "decision": "synthesize",
  "reasoning": "All dimensions of the inquiry are thoroughly grounded in the observations."
}
- If information is missing, or if observations only contain generic homepages:
{
  "decision": "explore",
  "reasoning": "What specific information is still missing and how to find it",
  "tool_call": {
    "tool_name": "search_internet" (to search a missing aspect) OR "crawl_web_page" (with the specific URL of a promising search result above to read its full text)
    "query": "targeted search query OR specific URL to crawl"
  }
}`;

          const evalRes = await deepseekProvider.generateCompletion(sufficiencyPrompt, {
            systemPrompt,
            temperature: 0.1,
            maxTokens: 800,
          });

          let parsedEval: any = null;
          const jsonMatch = evalRes.text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              parsedEval = JSON.parse(jsonMatch[0]);
            } catch {}
          }

          if (parsedEval?.decision === "explore" && parsedEval?.tool_call?.query) {
            const toolName = parsedEval.tool_call.tool_name === "crawl_web_page" ? "crawl_web_page" : "search_internet";
            const param = String(parsedEval.tool_call.query).trim();
            if (param.length > 0) {
              nextToolAction = {
                tool_name: toolName,
                param,
              };
            }
          }
        } catch (e) {
          console.warn("Sufficiency evaluation error:", e);
        }
      }
    }

    // Epistemic grounding directives based on overall tool execution findings
    if (executedTools.length > 0) {
      if (totalItemsFound === 0) {
        finalPrompt += `\n\nCRITICAL REAL-TIME GROUNDING INSTRUCTIONS:
- Current real-world date: ${currentDateStr} (Year: ${now.getFullYear()}).
- EMPIRICAL VERIFICATION RESULT: Live wire search across global reporting returned NO verified announcements, official documentation, or confirmed reports supporting the inquired claims as of ${currentDateStr}.
- You MUST explicitly state that this claim is unverified, unconfirmed, or speculative.
- Do NOT assume, extrapolate, or assert planned mission parameters or status from static memory. If there is no verified public confirmation, clearly tell the user so.`;
      } else {
        finalPrompt += `\n\nCRITICAL REAL-TIME GROUNDING & INLINE CITATION MANDATE:
- Current real-world date: ${currentDateStr} (Year: ${now.getFullYear()}).
- Ground your response EXCLUSIVELY and FACTUALLY in the empirical search passages above.
- MANDATORY LATEST STATUS FOCUS: When asked "what's the latest with [X]", lead directly with the most recent developments, current operational state, and upcoming milestones as of ${currentDateStr}. Do NOT recount superseded historical events or tests from earlier quarters/months as the primary answer.
- MANDATORY INLINE CITATIONS: Every factual claim, status update, milestone, or timeline assertion MUST include an inline markdown link to the specific original article reporting it, e.g. [Source Name](URL).
- GRANULAR CLAIM DECOMPOSITION: If the inquiry involves multiple components (e.g. both X and Y):
  * Check each component independently against the passages above.
  * For any component supported by a passage: Cite the exact source link [Source Name](URL).
  * For any component NOT explicitly confirmed in the passages: You MUST explicitly state that there is NO verified reporting or documentation confirming it.
  * ABSOLUTE PROHIBITION ON EXTRAPOLATION: NEVER assume an unmentioned component is happening based on past precedent. If articles only report a ship catch, DO NOT assert that a booster catch is happening unless a cited source explicitly states it.
- Never invent URLs. Only use URLs provided in the live search observation passages above.`;
      }
    }

    // Step 3: Stream tokens to client
    const extractor = new JsonMessageStreamExtractor();
    let accumulatedJson = "";
    const streamGen = deepseekProvider.generateStream(finalPrompt, {
      systemPrompt,
      temperature: 0.5,
      maxTokens: 4096,
      traceOptions: {
        runId,
        sessionId,
        agentName: "agent_dialogue",
        callType: "llm",
        inputSummary: {
          identified_topic: identifiedTopic,
          tools_executed_count: executedTools.length,
        },
        contextDetails: {
          calibrated_depth: contextFraming.calibrated_depth,
          empath_instructions: contextFraming.empath_instructions,
        },
        reasoningDetails: {
          primary_rationale: "Dialogue response generation and live news synthesis",
        },
      },
    });

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
      run_id: runId,
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
            topic: parsed.active_feed_filter.topic
              ? parsed.active_feed_filter.topic.replace(/\([^)]*\)/g, "").replace(/\s+/g, " ").trim()
              : identifiedTopic || undefined,
            topic_id:
              identifiedTopicId ||
              (parsed.active_feed_filter.topic
                ? generateTopicId(parsed.active_feed_filter.topic)
                : undefined),
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
            topic_id: identifiedTopicId,
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

    // Log root flow trace to traceLogger
    traceLogger.logTrace({
      trace_id: traceId,
      run_id: runId,
      session_id: sessionId,
      node_name: "agent_dialogue",
      call_type: "flow_root",
      reasoning_rationale:
        parsed.agent_internal_rationale?.why_this_response ||
        `Companion dialogue turn completed with ${executedTools.length} tool executions.`,
      latency_ms: Date.now() - startTime,
      llm_tokens_used: Math.ceil((finalPrompt.length + accumulatedJson.length) / 4),
      status: "success",
      input_summary: {
        last_user_message: lastUserMessage.slice(0, 150),
        history_length: history.length,
      },
      output_summary: {
        message_length: parsed.message?.length || 0,
        tools_executed_count: executedTools.length,
        extracted_topics: validatedExtractedTopics.length,
      },
      prompt_details: {
        system_prompt: systemPrompt,
        user_prompt: finalPrompt,
        messages: history.map((m) => ({ role: m.role, content: m.content })),
      },
      context_details: {
        identified_topic: identifiedTopic,
        calibrated_depth: contextFraming.calibrated_depth,
        empath_instructions: contextFraming.empath_instructions,
        tools_executed_count: executedTools.length,
        extracted_topics: validatedExtractedTopics.map((t: any) => t.topic),
        active_feed_filter: finalResponse.active_feed_filter,
      },
      reasoning_details: {
        primary_rationale: parsed.agent_internal_rationale?.why_this_response,
        emotional_state: parsed.agent_internal_rationale?.user_emotional_state_detected,
        curiosity_focus: parsed.agent_internal_rationale?.curiosity_focus_identified,
        pedagogical_strategy: parsed.agent_internal_rationale?.pedagogical_strategy,
        why_this_response: parsed.agent_internal_rationale?.why_this_response,
      },
      response_details: {
        raw_completion: accumulatedJson,
        parsed_output: parsed,
        sources: executedTools.flatMap((t) => t.sources || []),
      },
      model_details: {
        provider: "DeepSeek",
        model: deepseekProvider.getModel(),
      },
      metadata: {
        agentic_flow_steps: agenticFlowSteps,
      },
    });

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
    },
    attachedTopicBrief?: AttachedTopicBriefContext
  ): Promise<DialogueResponse> {
    const stream = this.chatStream(history, currentGraph, attachedStory, currentStories, clientContext, attachedTopicBrief);
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
