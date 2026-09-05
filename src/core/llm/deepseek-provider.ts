import { PureFactObject, RawArticle } from "../types/contracts";
import { traceLogger } from "../observability/trace-logger";

export interface LLMCompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  timeoutMs?: number;
  response_format?: { type: string };
  traceOptions?: {
    runId?: string;
    parentTraceId?: string;
    sessionId?: string;
    agentName?: string;
    callType?: "llm" | "agent_step" | "tool";
    inputSummary?: Record<string, unknown>;
    contextDetails?: Record<string, unknown>;
    reasoningDetails?: Record<string, unknown>;
  };
}

export class DeepSeekProvider {
  private apiKey: string;
  private baseUrl: string;
  private defaultModel: string;

  constructor() {
    this.apiKey = process.env.DEEPSEEK_API_KEY || "";
    this.baseUrl = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1";
    this.defaultModel = process.env.DEEPSEEK_MODEL || "deepseek-chat";
  }

  public getApiKey(): string {
    return process.env.DEEPSEEK_API_KEY || this.apiKey || "";
  }

  public getBaseUrl(): string {
    return process.env.DEEPSEEK_BASE_URL || this.baseUrl || "https://api.deepseek.com/v1";
  }

  public getModel(): string {
    return process.env.DEEPSEEK_MODEL || this.defaultModel || "deepseek-chat";
  }

  public isConfigured(): boolean {
    const key = this.getApiKey();
    return Boolean(key && key.trim().length > 0);
  }

  /**
   * Generates a completion from DeepSeek API with retry on transient network errors.
   */
  public async generateCompletion(
    prompt: string,
    options: LLMCompletionOptions = {}
  ): Promise<{ text: string; tokensUsed: number }> {
    const startTime = Date.now();
    const model = options.model || this.getModel();
    const traceOpts = options.traceOptions || {};

    if (!this.isConfigured()) {
      const errorMsg = "DeepSeek Provider Error: DEEPSEEK_API_KEY is not configured in environment variables. Please set DEEPSEEK_API_KEY in .env.";
      traceLogger.logTrace({
        session_id: traceOpts.sessionId,
        run_id: traceOpts.runId,
        parent_trace_id: traceOpts.parentTraceId,
        node_name: traceOpts.agentName || "llm_completion",
        call_type: "llm",
        input_summary: { prompt_length: prompt.length, ...(traceOpts.inputSummary || {}) },
        output_summary: { error: errorMsg },
        reasoning_rationale: "Unconfigured LLM Provider Invocation",
        latency_ms: Date.now() - startTime,
        llm_tokens_used: 0,
        status: "error",
        error_message: errorMsg,
        prompt_details: {
          system_prompt: options.systemPrompt,
          user_prompt: prompt,
        },
        context_details: traceOpts.contextDetails || {},
        model_details: {
          provider: "DeepSeek",
          model,
          temperature: options.temperature ?? 0.2,
          max_tokens: options.maxTokens ?? 4096,
        },
      });
      throw new Error(errorMsg);
    }

    const apiKey = this.getApiKey();
    const baseUrl = this.getBaseUrl();
    const messages = [];

    if (options.systemPrompt) {
      messages.push({ role: "system", content: options.systemPrompt });
    }
    messages.push({ role: "user", content: prompt });

    let lastError: Error | null = null;
    const maxRetries = 2;

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs ?? 45000);

        const response = await fetch(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages,
            temperature: options.temperature ?? 0.2,
            max_tokens: options.maxTokens ?? 4096,
            response_format: options.response_format || { type: "json_object" },
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`DeepSeek API error (HTTP ${response.status}): ${errText}`);
        }

        const data = await response.json();
        const text = data.choices?.[0]?.message?.content;

        if (!text || typeof text !== "string") {
          throw new Error("DeepSeek API returned empty or malformed completion choice.");
        }

        const tokensUsed = data.usage?.total_tokens || Math.ceil((prompt.length + text.length) / 4);
        const latencyMs = Date.now() - startTime;

        // Attempt JSON parse for structured response inspection
        let parsedOutput: unknown = undefined;
        try {
          parsedOutput = JSON.parse(text.replace(/```json\n?|\n?```/g, "").trim());
        } catch {
          parsedOutput = undefined;
        }

        // Emit observability trace
        traceLogger.logTrace({
          session_id: traceOpts.sessionId,
          run_id: traceOpts.runId,
          parent_trace_id: traceOpts.parentTraceId,
          node_name: traceOpts.agentName || "llm_completion",
          call_type: "llm",
          input_summary: {
            model,
            prompt_preview: prompt.slice(0, 120),
            ...(traceOpts.inputSummary || {}),
          },
          output_summary: {
            tokens: tokensUsed,
            output_preview: text.slice(0, 120),
          },
          reasoning_rationale:
            (traceOpts.reasoningDetails?.primary_rationale as string) ||
            `LLM Completion generated by ${model} (${tokensUsed} tokens, ${latencyMs}ms)`,
          latency_ms: latencyMs,
          llm_tokens_used: tokensUsed,
          status: "success",
          prompt_details: {
            system_prompt: options.systemPrompt,
            user_prompt: prompt,
            messages: messages as Array<{ role: string; content: string }>,
          },
          context_details: traceOpts.contextDetails || {},
          reasoning_details: traceOpts.reasoningDetails || {},
          response_details: {
            raw_completion: text,
            parsed_output: parsedOutput,
          },
          model_details: {
            provider: "DeepSeek",
            model,
            temperature: options.temperature ?? 0.2,
            max_tokens: options.maxTokens ?? 4096,
          },
        });

        return { text, tokensUsed };
      } catch (err: unknown) {
        lastError = err as Error;
        if (attempt <= maxRetries) {
          console.warn(`DeepSeek API attempt ${attempt} failed (${lastError.message}). Retrying in 1s...`);
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    }

    const failedLatency = Date.now() - startTime;
    traceLogger.logTrace({
      session_id: traceOpts.sessionId,
      run_id: traceOpts.runId,
      parent_trace_id: traceOpts.parentTraceId,
      node_name: traceOpts.agentName || "llm_completion",
      call_type: "llm",
      input_summary: { prompt_preview: prompt.slice(0, 120), ...(traceOpts.inputSummary || {}) },
      output_summary: { error: lastError?.message },
      reasoning_rationale: `LLM API Error: ${lastError?.message}`,
      latency_ms: failedLatency,
      llm_tokens_used: 0,
      status: "error",
      error_message: lastError?.message,
      prompt_details: {
        system_prompt: options.systemPrompt,
        user_prompt: prompt,
      },
      context_details: traceOpts.contextDetails || {},
      model_details: {
        provider: "DeepSeek",
        model,
      },
    });

    throw lastError || new Error("DeepSeek API request failed after retries.");
  }

  /**
   * Generates a streaming completion from DeepSeek API, yielding chunks as they arrive.
   */
  public async *generateStream(
    prompt: string,
    options: LLMCompletionOptions = {}
  ): AsyncGenerator<string, { fullText: string; tokensUsed: number }> {
    const startTime = Date.now();
    const traceOpts = options.traceOptions || {};
    const model = options.model || this.defaultModel;

    if (!this.isConfigured()) {
      const fallbackJson = JSON.stringify({
        message: "Aletheia live intelligence response.",
        agent_internal_rationale: {
          user_emotional_state_detected: "Analytical",
          curiosity_focus_identified: "General",
          intersections_analyzed: "None",
          pedagogical_strategy: "Direct",
          why_this_response: "Local environment fallback",
        },
        extracted_topics: [],
        active_feed_filter: { is_active: false },
      });

      traceLogger.logTrace({
        session_id: traceOpts.sessionId,
        run_id: traceOpts.runId,
        parent_trace_id: traceOpts.parentTraceId,
        node_name: traceOpts.agentName || "llm_completion",
        call_type: "llm",
        input_summary: { mode: "stream_fallback", ...(traceOpts.inputSummary || {}) },
        output_summary: { status: "local_mock_fallback" },
        reasoning_rationale: "DeepSeek not configured: Served local mock intelligence stream",
        latency_ms: 10,
        llm_tokens_used: 50,
        status: "success",
        prompt_details: {
          system_prompt: options.systemPrompt,
          user_prompt: prompt,
        },
        context_details: traceOpts.contextDetails || {},
        reasoning_details: {
          primary_rationale: "Local environment fallback",
        },
        response_details: {
          raw_completion: fallbackJson,
          parsed_output: JSON.parse(fallbackJson),
        },
        model_details: {
          provider: "DeepSeek",
          model,
        },
      });

      yield fallbackJson;
      return { fullText: fallbackJson, tokensUsed: 50 };
    }

    const messages = [];

    if (options.systemPrompt) {
      messages.push({ role: "system", content: options.systemPrompt });
    }
    messages.push({ role: "user", content: prompt });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs ?? 60000);

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: options.temperature ?? 0.5,
          max_tokens: options.maxTokens ?? 4096,
          response_format: options.response_format || { type: "json_object" },
          stream: true,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok || !response.body) {
        const errText = await response.text();
        throw new Error(`DeepSeek API stream error (HTTP ${response.status}): ${errText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let fullText = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data:")) continue;
          if (trimmed === "data: [DONE]") break;

          const jsonStr = trimmed.slice(5).trim();
          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content || "";
            if (delta) {
              fullText += delta;
              yield delta;
            }
          } catch {
            // Partial chunk ignore
          }
        }
      }

      const latencyMs = Date.now() - startTime;
      const tokensUsed = Math.ceil((prompt.length + fullText.length) / 4);

      let parsedOutput: unknown = undefined;
      try {
        parsedOutput = JSON.parse(fullText.replace(/```json\n?|\n?```/g, "").trim());
      } catch {
        parsedOutput = undefined;
      }

      // Log stream trace
      traceLogger.logTrace({
        session_id: traceOpts.sessionId,
        run_id: traceOpts.runId,
        parent_trace_id: traceOpts.parentTraceId,
        node_name: traceOpts.agentName || "llm_completion",
        call_type: "llm",
        input_summary: {
          model,
          prompt_preview: prompt.slice(0, 120),
          ...(traceOpts.inputSummary || {}),
        },
        output_summary: {
          tokens: tokensUsed,
          output_preview: fullText.slice(0, 120),
        },
        reasoning_rationale:
          (traceOpts.reasoningDetails?.primary_rationale as string) ||
          `Streaming LLM Completion finished by ${model} (${tokensUsed} tokens, ${latencyMs}ms)`,
        latency_ms: latencyMs,
        llm_tokens_used: tokensUsed,
        status: "success",
        prompt_details: {
          system_prompt: options.systemPrompt,
          user_prompt: prompt,
          messages: messages as Array<{ role: string; content: string }>,
        },
        context_details: traceOpts.contextDetails || {},
        reasoning_details: traceOpts.reasoningDetails || {},
        response_details: {
          raw_completion: fullText,
          parsed_output: parsedOutput,
        },
        model_details: {
          provider: "DeepSeek",
          model,
          temperature: options.temperature ?? 0.5,
          max_tokens: options.maxTokens ?? 4096,
        },
      });

      return { fullText, tokensUsed };
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      const failedLatency = Date.now() - startTime;
      const errorMsg = (err as Error)?.message || "Stream failed";

      traceLogger.logTrace({
        session_id: traceOpts.sessionId,
        run_id: traceOpts.runId,
        parent_trace_id: traceOpts.parentTraceId,
        node_name: traceOpts.agentName || "llm_completion",
        call_type: "llm",
        input_summary: { prompt_preview: prompt.slice(0, 120), ...(traceOpts.inputSummary || {}) },
        output_summary: { error: errorMsg },
        reasoning_rationale: `Stream LLM API Error: ${errorMsg}`,
        latency_ms: failedLatency,
        llm_tokens_used: 0,
        status: "error",
        error_message: errorMsg,
        prompt_details: {
          system_prompt: options.systemPrompt,
          user_prompt: prompt,
        },
        context_details: traceOpts.contextDetails || {},
        model_details: {
          provider: "DeepSeek",
          model,
        },
      });

      throw err;
    }
  }

  /**
   * Structured extraction of PureFactObject using DeepSeek
   */
  public async extractEpistemologyDelta(
    topic: string,
    articles: RawArticle[]
  ): Promise<Partial<PureFactObject>> {
    const systemPrompt = `You are the Epistemology Agent for Project Aletheia.
Your task is to analyze reporting across sources for a specific event and extract a PureFactObject in strict JSON with absolute epistemic integrity.

CRITICAL EPISTEMIC INTEGRITY RULES:
1. TEMPORAL & MODALITY INTEGRITY (ABSOLUTE PROHIBITION ON TENSE INVERSION):
   - Distinguish strictly between completed past events, scheduled future targets, and speculative rumors.
   - NEVER convert scheduled future milestones ("slated for", "scheduled for", "targeted for", "preparing for") into completed past actions. If a milestone has not yet occurred, state it strictly as an upcoming target (e.g. "Scheduled for [date]" or "Targeted to occur in [month/year]").
   - NEVER convert speculative chatter, rumors, or unverified aspirations ("talk of potentially attempting", "claims that", "speculation suggests") into established agreed facts.
   - If a source describes an action as conditional, contemplated, or unconfirmed, it MUST be recorded in "disputed_claims" or explicitly qualified as an unconfirmed rumor, NEVER placed as an unconditional agreed fact.

2. MULTI-SOURCE CORROBORATION & CONSENSUS THRESHOLD:
   - "agreed_facts" represents verified consensus. A factual statement may ONLY be placed in "agreed_facts" if:
     * It is corroborated by 2 or more independent sources, OR
     * It represents an uncontested official primary documentation or release.
   - If an event cluster has only 1 source, or if a significant claim is asserted by only 1 source, place it in "disputed_claims" with "asserted_by" naming that single source and noting "Single-source report; pending independent confirmation".

3. STRICT TOPICAL & ENTITY BOUNDARIES (ZERO CROSS-CONTAMINATION):
   - Restrict extracted claims strictly to the core subject of the specified Topic.
   - When an article discusses multiple distinct initiatives, projects, or locations, DO NOT conflate claims from secondary or tangential subjects into this event's fact object.

4. OBJECTIVE PURITY & ADJECTIVE DENSITY:
   - Strip all sensationalism, emotional adjectives, rhetorical hyperbole, and speculative projections.
   - Calculate "adjective_density_score" (0.0 to 1.0) based on remaining subjective or framing language in the original text.

Output JSON adhering strictly to:
{
  "verified_entities": string[],
  "agreed_facts": string[],
  "disputed_claims": [
    {
      "claim": string,
      "asserted_by": string[],
      "contested_by": string[],
      "divergence_reason": string
    }
  ],
  "adjective_density_score": number
}`;

    const prompt = `Topic: ${topic}
Articles:
${articles.map((a, i) => `[Source ${i + 1}: ${a.source_name} (${a.author_bias_rating})]\n${a.raw_text}`).join("\n\n")}`;

    const { text } = await this.generateCompletion(prompt, {
      systemPrompt,
      temperature: 0.1,
    });

    return JSON.parse(text);
  }
}

export const deepseekProvider = new DeepSeekProvider();
