import fs from "fs";
import path from "path";
import { AgentTraceLog, AgentTraceLogSchema } from "../types/contracts";

export type TraceListener = (trace: AgentTraceLog) => void;

export class TraceLogger {
  private static instance: TraceLogger;
  private memoryTraces: AgentTraceLog[] = [];
  private logDirectory: string;
  private logFilePath: string;
  private listeners: Set<TraceListener> = new Set();

  private constructor() {
    this.logDirectory = path.resolve(process.cwd(), "traces");
    this.logFilePath = path.join(this.logDirectory, "trace_latest.jsonl");
    this.ensureDirectory();
  }

  public static getInstance(): TraceLogger {
    if (!TraceLogger.instance) {
      TraceLogger.instance = new TraceLogger();
    }
    return TraceLogger.instance;
  }

  public subscribe(listener: TraceListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private diskWriteDisabled: boolean = false;

  private ensureDirectory(): boolean {
    if (this.diskWriteDisabled) return false;
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
   * Log an agent node transition or LLM execution with structured JSON
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
      input_summary: trace.input_summary,
      output_summary: trace.output_summary,
      reasoning_rationale: trace.reasoning_rationale,
      latency_ms: trace.latency_ms,
      llm_tokens_used: trace.llm_tokens_used ?? 0,
      metadata: trace.metadata || {},
    };

    // Validate schema
    const validated = AgentTraceLogSchema.parse(fullTrace);

    // Push to in-memory trace ring
    this.memoryTraces.push(validated);
    if (this.memoryTraces.length > 200) {
      this.memoryTraces.shift();
    }

    // Append to audit JSONL file
    if (!this.diskWriteDisabled) {
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
    try {
      import("../storage/postgres-store").then(({ postgresStore }) => {
        postgresStore.logTrace(validated).catch((err) => {
          console.warn("TraceLogger: Could not persist trace to postgres:", err);
        });
      });
    } catch (err) {
      // Ignore in isolated environments
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
   * Clear traces (useful for tests)
   */
  public clearTraces(): void {
    this.memoryTraces = [];
  }
}

export const traceLogger = TraceLogger.getInstance();
