import { describe, it, expect, beforeEach } from "vitest";
import { traceLogger } from "../core/observability/trace-logger";
import { DocWorker } from "../core/observability/doc-worker";
import fs from "fs";
import path from "path";
import os from "os";

describe("Observability & Living Documentation Pipeline", () => {
  beforeEach(() => {
    traceLogger.clearTraces();
  });

  it("records structured JSON trace logs with input, output, and reasoning rationale", () => {
    const trace = traceLogger.logTrace({
      session_id: "test-session-123",
      node_name: "node_c_serendipity",
      input_summary: { topic: "Quantum Computing", weight: 0.8 },
      output_summary: { decision: "explore", selected_topic: "Naval Strategy" },
      reasoning_rationale: "Serendipity bandit triggered 20% exploration threshold.",
      latency_ms: 45,
    });

    expect(trace).toBeDefined();
    expect(trace.trace_id).toBeDefined();
    expect(trace.node_name).toBe("node_c_serendipity");
    expect(trace.reasoning_rationale).toContain("Serendipity bandit");

    const recent = traceLogger.getRecentTraces();
    expect(recent.length).toBeGreaterThan(0);
    expect(recent[0].trace_id).toBe(trace.trace_id);
  });

  it("DocWorker generates valid state_graph.mermaid and system_architecture.md", () => {
    // Record a sample trace
    traceLogger.logTrace({
      session_id: "test-session-sync",
      node_name: "node_a_epistemology",
      input_summary: { articles: 3 },
      output_summary: { facts_extracted: 2 },
      reasoning_rationale: "Node A filtered 3 sources and stripped emotional framing.",
      latency_ms: 60,
    });

    const testDocsDir = path.join(os.tmpdir(), `aletheia-docs-test-${Date.now()}`);
    const testDocWorker = new DocWorker(testDocsDir);
    const report = testDocWorker.syncDocs({ force: true });
    expect(report.architecture_updated).toBe(true);
    expect(report.mermaid_updated).toBe(true);
    expect(report.recent_traces_count).toBeGreaterThan(0);

    const mermaidFile = path.join(testDocsDir, "state_graph.mermaid");
    const archFile = path.join(testDocsDir, "system_architecture.md");

    expect(fs.existsSync(mermaidFile)).toBe(true);
    expect(fs.existsSync(archFile)).toBe(true);

    const mermaidContent = fs.readFileSync(mermaidFile, "utf-8");
    const archContent = fs.readFileSync(archFile, "utf-8");

    expect(mermaidContent).toContain("stateDiagram-v2");
    expect(mermaidContent).toContain("Node A: Epistemology Agent");
    expect(mermaidContent).toContain("Node C: Serendipity Agent");

    expect(archContent).toContain("Project Aletheia: Living System Architecture");
    expect(archContent).toContain("node_a_epistemology");

    try {
      fs.rmSync(testDocsDir, { recursive: true, force: true });
    } catch {}
  });
});
