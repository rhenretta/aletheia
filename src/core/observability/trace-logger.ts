import fs from "fs";
import path from "path";
import { AgentTraceLog, AgentTraceLogSchema, AgentRunFlow } from "../types/contracts";

export type TraceListener = (trace: AgentTraceLog) => void;

const globalForTraceLogger = globalThis as unknown as {
  __traceLoggerInstance?: TraceLogger;
};

export class TraceLogger {
  private static instance: TraceLogger;
  private memoryTraces: AgentTraceLog[] = [];
  private logDirectory: string;
  private logFilePath: string;
  private listeners: Set<TraceListener> = new Set();

  private constructor() {
    if (typeof window === "undefined" && typeof process !== "undefined") {
      this.logDirectory = path.resolve(process.cwd(), "traces");
      this.logFilePath = path.join(this.logDirectory, "trace_latest.jsonl");
      this.ensureDirectory();
      this.loadInitialTracesFromDisk();
    } else {
      this.diskWriteDisabled = true;
      this.logDirectory = "";
      this.logFilePath = "";
    }
  }

  public static getInstance(): TraceLogger {
    if (!globalForTraceLogger.__traceLoggerInstance) {
      globalForTraceLogger.__traceLoggerInstance = new TraceLogger();
    }
    return globalForTraceLogger.__traceLoggerInstance;
  }

  public subscribe(listener: TraceListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private diskWriteDisabled: boolean = false;

  private loadInitialTracesFromDisk() {
    if (this.diskWriteDisabled || typeof window !== "undefined" || !fs?.existsSync) return;
    try {
      if (!fs.existsSync(this.logFilePath)) return;
      const content = fs.readFileSync(this.logFilePath, "utf8");
      if (!content.trim()) return;
      const lines = content.trim().split("\n");
      // Load the last 500 lines
      const recentLines = lines.slice(-500);
      const loaded: AgentTraceLog[] = [];
      for (const line of recentLines) {
        if (!line.trim()) continue;
        try {
          const raw = JSON.parse(line);
          const parsed = AgentTraceLogSchema.safeParse(raw);
          if (parsed.success) {
            loaded.push(parsed.data as AgentTraceLog);
          }
        } catch {
          // ignore corrupted lines
        }
      }
      this.memoryTraces = loaded;
    } catch (err) {
      console.warn("TraceLogger: Could not load initial traces from disk:", err);
    }
  }

  private ensureDirectory(): boolean {
    if (this.diskWriteDisabled || typeof window !== "undefined" || !fs?.existsSync) return false;
    try {
      if (!fs.existsSync(this.logDirectory)) {
        fs.mkdirSync(this.logDirectory, { recursive: true });
      }
      return true;
    } catch {
      this.diskWriteDisabled = true;
      return false;
    }
  }

  /**
   * Log an agent node transition, tool call, or LLM execution with structured JSON
   */
  public logTrace(
    trace: Omit<AgentTraceLog, "trace_id" | "timestamp" | "session_id"> & {
      trace_id?: string;
      timestamp?: string;
      session_id?: string;
    }
  ): AgentTraceLog {
    const fullTrace: AgentTraceLog = {
      trace_id: trace.trace_id || `tr_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      session_id: trace.session_id || `sess_${Date.now()}`,
      timestamp: trace.timestamp || new Date().toISOString(),
      node_name: trace.node_name,
      input_summary: trace.input_summary || {},
      output_summary: trace.output_summary || {},
      reasoning_rationale:
        typeof trace.reasoning_rationale === "string"
          ? trace.reasoning_rationale
          : Array.isArray(trace.reasoning_rationale)
          ? (trace.reasoning_rationale as string[]).join("; ")
          : String(trace.reasoning_rationale || ""),
      latency_ms: trace.latency_ms ?? 0,
      llm_tokens_used: trace.llm_tokens_used ?? 0,
      run_id: trace.run_id,
      parent_trace_id: trace.parent_trace_id,
      call_type: (trace.call_type as string) === "tool_call" ? "tool" : (trace.call_type || "agent_step"),
      prompt_details: trace.prompt_details,
      context_details: trace.context_details,
      reasoning_details: trace.reasoning_details,
      response_details: trace.response_details,
      model_details: trace.model_details,
      status: trace.status || "success",
      error_message: trace.error_message,
      metadata: trace.metadata || {},
    };

    // Validate schema
    const validated = AgentTraceLogSchema.parse(fullTrace) as AgentTraceLog;

    // Push to in-memory trace ring (up to 500 items)
    this.memoryTraces.push(validated);
    if (this.memoryTraces.length > 500) {
      this.memoryTraces.shift();
    }

    // Append to audit JSONL file
    if (!this.diskWriteDisabled && typeof window === "undefined" && fs?.appendFileSync) {
      try {
        if (this.ensureDirectory()) {
          const line = JSON.stringify(validated) + "\n";
          fs.appendFileSync(this.logFilePath, line, "utf-8");
        }
      } catch (err) {
        this.diskWriteDisabled = true;
        console.warn("TraceLogger: Could not write trace to disk, disabling file logging:", err);
      }
    }

    // Persist asynchronously to PostgreSQL store
    if (typeof window === "undefined" && typeof process !== "undefined" && process.env?.DATABASE_URL) {
      try {
        import("../storage/postgres-store").then(({ postgresStore }) => {
          postgresStore.logTrace(validated).catch((err) => {
            console.warn("TraceLogger: Could not persist trace to postgres:", err);
          });
        }).catch(() => {});
      } catch {
        // Ignore in isolated environments
      }
    }

    // Notify all real-time stream subscribers
    this.listeners.forEach((listener) => {
      try {
        listener(validated);
      } catch (err) {
        console.warn("Trace listener error:", err);
      }
    });

    return validated;
  }

  /**
   * Retrieve recent traces from memory
   */
  public getRecentTraces(limit: number = 50): AgentTraceLog[] {
    return this.memoryTraces.slice(-limit);
  }

  /**
   * Group recent traces into aggregated Agent Run Flows
   */
  public getRecentFlows(limit: number = 30): AgentRunFlow[] {
    const flowsMap = new Map<string, AgentTraceLog[]>();

    // Iterate backwards so most recent traces are prioritized
    for (let i = this.memoryTraces.length - 1; i >= 0; i--) {
      const trace = this.memoryTraces[i];
      const key = trace.run_id || trace.session_id || `flow_${trace.trace_id}`;
      if (!flowsMap.has(key)) {
        flowsMap.set(key, []);
      }
      flowsMap.get(key)!.push(trace);
    }

    const flows: AgentRunFlow[] = [];
    flowsMap.forEach((traces, runId) => {
      // Sort chronologically ascending
      traces.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      const rootTrace = traces.find((t) => t.call_type === "flow_root") || traces[0];
      const startTime = traces[0]?.timestamp || new Date().toISOString();
      const endTime = traces[traces.length - 1]?.timestamp || startTime;
      const totalLatency = traces.reduce((acc, t) => acc + (t.latency_ms || 0), 0);
      const totalTokens = traces.reduce((acc, t) => acc + (t.llm_tokens_used || 0), 0);
      const hasError = traces.some((t) => t.status === "error");
      const isRunning = traces.some((t) => t.status === "running");

      // Derive human-readable flow name
      let flowName = "Agent Execution";
      const synthesisTrace = traces.find((t) => t.node_name === "node_d_synthesis");
      const epistemologyTrace = traces.find((t) => t.node_name === "node_a_epistemology");

      if (synthesisTrace || epistemologyTrace) {
        const topics = (synthesisTrace?.output_summary?.topics_synthesized as string[]) || [];
        const uniqueTopics = Array.from(new Set(topics.filter(Boolean)));
        const count = synthesisTrace?.output_summary?.feed_cards_count;
        if (uniqueTopics.length > 0) {
          flowName = `News Card Generation: ${uniqueTopics.slice(0, 2).join(", ")}${count ? ` (${count} cards)` : ""}`;
        } else {
          flowName = "News Card Generation Pipeline";
        }
      } else if (rootTrace?.node_name === "agent_dialogue" || rootTrace?.node_name === "node_context") {
        const query =
          (rootTrace.prompt_details?.user_prompt as string) ||
          (rootTrace.input_summary?.last_user_message as string) ||
          "";
        flowName = query ? `Chat: "${query.slice(0, 45)}${query.length > 45 ? "..." : ""}"` : "Companion Dialogue Turn";
      } else if (rootTrace?.node_name === "node_observer" || rootTrace?.node_name === "agent_observer") {
        flowName = "Mind-State Observer Adaptation";
      } else if (rootTrace?.node_name === "node_discovery" || rootTrace?.node_name === "agent_discovery") {
        flowName = "Autonomous News Curation & Discovery";
      } else if (rootTrace?.node_name === "agent_card_evolution" || traces.some((t) => t.node_name === "agent_card_evolution")) {
        const cardTrace = traces.find((t) => t.node_name === "agent_card_evolution") || rootTrace;
        const topic = (cardTrace?.context_details?.topic || cardTrace?.input_summary?.topic) as string;
        flowName = topic ? `Topic Card Evolution: "${topic}"` : "Topic Card Evolution";
      } else if (rootTrace?.node_name === "agent_brief_synthesizer" || traces.some((t) => t.node_name === "agent_brief_synthesizer")) {
        const briefTrace = traces.find((t) => t.node_name === "agent_brief_synthesizer") || rootTrace;
        const topic = briefTrace?.context_details?.topic as string;
        flowName = topic ? `Topic Brief Synthesis: "${topic}"` : "Topic Deep Dive Synthesis";
      } else if (rootTrace?.node_name === "llm_completion") {
        const model = (rootTrace.model_details?.model || rootTrace.input_summary?.model) as string;
        const rationale = rootTrace.reasoning_rationale;
        flowName = rationale && rationale !== "LLM Completion" ? rationale : `LLM Call (${model || "DeepSeek"})`;
      } else {
        flowName = `${rootTrace?.node_name.replace("node_", "").replace("agent_", "").toUpperCase()} Flow`;
      }

      flows.push({
        run_id: runId,
        session_id: rootTrace?.session_id || runId,
        flow_name: flowName,
        start_time: startTime,
        end_time: endTime,
        total_latency_ms: totalLatency,
        total_tokens: totalTokens,
        status: hasError ? "error" : isRunning ? "running" : "success",
        steps: traces,
        root_trace: rootTrace,
      });
    });

    // Sort flows by start_time descending (newest first)
    flows.sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());
    return flows.slice(0, limit);
  }

  /**
   * Search traces with flexible filters (query text in prompt, reasoning, response)
   */
  public searchTraces(params: {
    q?: string;
    agent?: string;
    callType?: string;
    runId?: string;
    limit?: number;
  }): AgentTraceLog[] {
    const q = params.q?.toLowerCase().trim();
    const limit = params.limit || 50;

    return this.memoryTraces
      .filter((t) => {
        if (params.runId && t.run_id !== params.runId && t.session_id !== params.runId) {
          return false;
        }
        if (params.agent && params.agent !== "all" && t.node_name !== params.agent) {
          return false;
        }
        if (params.callType && params.callType !== "all" && t.call_type !== params.callType) {
          return false;
        }
        if (q) {
          const matchPrompt =
            t.prompt_details?.user_prompt?.toLowerCase().includes(q) ||
            t.prompt_details?.system_prompt?.toLowerCase().includes(q);
          const matchRationale = t.reasoning_rationale.toLowerCase().includes(q);
          const matchResponse =
            t.response_details?.raw_completion?.toLowerCase().includes(q) ||
            JSON.stringify(t.response_details?.parsed_output || "").toLowerCase().includes(q);
          const matchNode = t.node_name.toLowerCase().includes(q);
          const matchTraceId = t.trace_id.toLowerCase().includes(q);
          return Boolean(matchPrompt || matchRationale || matchResponse || matchNode || matchTraceId);
        }
        return true;
      })
      .slice(-limit);
  }

  /**
   * Clear traces (useful for tests)
   */
  public clearTraces(): void {
    this.memoryTraces = [];
  }
}

export const traceLogger = TraceLogger.getInstance();
