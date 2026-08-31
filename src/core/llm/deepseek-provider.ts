import { PureFactObject, RawArticle } from "../types/contracts";

export interface LLMCompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  timeoutMs?: number;
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

  public isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  /**
   * Generates a completion from DeepSeek API with retry on transient network errors.
   */
  public async generateCompletion(
    prompt: string,
    options: LLMCompletionOptions = {}
  ): Promise<{ text: string; tokensUsed: number }> {
    if (!this.isConfigured()) {
      throw new Error(
        "DeepSeek Provider Error: DEEPSEEK_API_KEY is not configured in environment variables. Please set DEEPSEEK_API_KEY in .env."
      );
    }

    const model = options.model || this.defaultModel;
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

        const response = await fetch(`${this.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages,
            temperature: options.temperature ?? 0.2,
            max_tokens: options.maxTokens ?? 1500,
            response_format: { type: "json_object" },
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

        const tokensUsed = data.usage?.total_tokens || 0;
        return { text, tokensUsed };
      } catch (err: unknown) {
        lastError = err as Error;
        if (attempt <= maxRetries) {
          console.warn(`DeepSeek API attempt ${attempt} failed (${lastError.message}). Retrying in 1s...`);
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    }

    throw lastError || new Error("DeepSeek API request failed after retries.");
  }

  /**
   * Generates a streaming completion from DeepSeek API, yielding chunks as they arrive.
   */
  public async *generateStream(
    prompt: string,
    options: LLMCompletionOptions = {}
  ): AsyncGenerator<string, { fullText: string; tokensUsed: number }> {
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
      yield fallbackJson;
      return { fullText: fallbackJson, tokensUsed: 50 };
    }

    const model = options.model || this.defaultModel;
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
          max_tokens: options.maxTokens ?? 1500,
          response_format: { type: "json_object" },
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
          } catch (e) {}
        }
      }

      return { fullText, tokensUsed: Math.ceil(fullText.length / 4) };
    } catch (err: unknown) {
      clearTimeout(timeoutId);
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
Your task is to analyze multi-source articles across the ideological spectrum for an event and extract a PureFactObject in strict JSON.
Rules:
1. Strip all emotional framing, adjectives, sensationalism, and speculation.
2. Identify undisputed facts agreed upon by sources.
3. Identify disputed claims, noting which sources assert or contest them, and why they diverge.
4. Extract key verified entities and timeline events.
Output JSON adhering strictly to:
{
  "verified_entities": string[],
  "agreed_facts": string[],
  "disputed_claims": [{"claim": string, "asserted_by": string[], "contested_by": string[], "divergence_reason": string}],
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
