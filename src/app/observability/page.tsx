"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import {
  Terminal,
  Cpu,
  Database,
  Layers,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Clock,
  Sparkles,
  Zap,
  Brain,
  CheckCircle2,
  X,
  Activity,
  Radio,
  Globe,
  Compass,
  FileCheck,
  Filter,
  Eye,
  ArrowLeft,
  Search,
  Copy,
  Check,
  Play,
  Pause,
  Trash2,
  ExternalLink,
  ShieldAlert,
  Code,
  FileText,
  Sliders,
  ChevronRight,
  GitCommit,
  Flame,
} from "lucide-react";
import { AgentTraceLog, AgentRunFlow } from "@/core/types/contracts";

export default function ObservabilityStudioPage() {
  const [flows, setFlows] = useState<AgentRunFlow[]>([]);
  const [traces, setTraces] = useState<AgentTraceLog[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);
  const [activeInspectorTab, setActiveInspectorTab] = useState<
    "reasonings" | "prompt_context" | "response" | "telemetry"
  >("reasonings");

  // Filters & Controls
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAgentFilter, setSelectedAgentFilter] = useState<string>("all");
  const [selectedCallTypeFilter, setSelectedCallTypeFilter] = useState<string>("all");
  const [isLiveStreamActive, setIsLiveStreamActive] = useState<boolean>(true);
  const [isConnectedSSE, setIsConnectedSSE] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const terminalScrollRef = useRef<HTMLDivElement>(null);

  // Copy helper
  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Fetch initial snapshot data
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/observability?flowLimit=40&limit=100");
      const data = await res.json();
      if (data.success) {
        setFlows(data.flows || []);
        setTraces(data.traces || []);
        if (!selectedRunId && data.flows?.length > 0) {
          setSelectedRunId(data.flows[0].run_id);
          setSelectedTraceId(data.flows[0].steps[0]?.trace_id || null);
        }
      }
    } catch (err) {
      console.warn("Failed to fetch observability data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // SSE Live Streaming Connection
  useEffect(() => {
    let es: EventSource | null = null;
    if (isLiveStreamActive) {
      try {
        es = new EventSource("/api/devtools/stream");

        es.onopen = () => setIsConnectedSSE(true);

        es.addEventListener("connected", (e) => {
          setIsConnectedSSE(true);
          try {
            const parsed = JSON.parse(e.data);
            if (parsed.recent_traces) {
              setTraces((prev) => {
                const map = new Map<string, AgentTraceLog>();
                prev.forEach((t) => map.set(t.trace_id, t));
                parsed.recent_traces.forEach((t: AgentTraceLog) => map.set(t.trace_id, t));
                return Array.from(map.values()).sort(
                  (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
                );
              });
            }
          } catch {}
        });

        es.addEventListener("trace", (e) => {
          try {
            const trace = JSON.parse(e.data) as AgentTraceLog;
            setTraces((prev) => [trace, ...prev.filter((t) => t.trace_id !== trace.trace_id)]);

            // Dynamically update or insert into flow groups
            setFlows((prevFlows) => {
              const runKey = trace.run_id || trace.session_id || `flow_${trace.trace_id}`;
              const existingIdx = prevFlows.findIndex((f) => f.run_id === runKey);

              if (existingIdx !== -1) {
                const updatedFlow = { ...prevFlows[existingIdx] };
                const existingStepIdx = updatedFlow.steps.findIndex((s) => s.trace_id === trace.trace_id);
                if (existingStepIdx !== -1) {
                  updatedFlow.steps[existingStepIdx] = trace;
                } else {
                  updatedFlow.steps.push(trace);
                }
                updatedFlow.steps.sort(
                  (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
                );
                updatedFlow.total_latency_ms = updatedFlow.steps.reduce((acc, s) => acc + s.latency_ms, 0);
                updatedFlow.total_tokens = updatedFlow.steps.reduce((acc, s) => acc + (s.llm_tokens_used || 0), 0);
                if (trace.status === "error") updatedFlow.status = "error";

                const newFlows = [...prevFlows];
                newFlows[existingIdx] = updatedFlow;
                return newFlows;
              } else {
                // New flow creation
                const newFlow: AgentRunFlow = {
                  run_id: runKey,
                  session_id: trace.session_id || runKey,
                  flow_name:
                    trace.node_name === "agent_dialogue"
                      ? `Chat: "${(trace.prompt_details?.user_prompt || "").slice(0, 35)}..."`
                      : `${trace.node_name.replace("node_", "").toUpperCase()} Flow`,
                  start_time: trace.timestamp,
                  end_time: trace.timestamp,
                  total_latency_ms: trace.latency_ms,
                  total_tokens: trace.llm_tokens_used || 0,
                  status: trace.status === "error" ? "error" : "success",
                  steps: [trace],
                  root_trace: trace,
                };
                return [newFlow, ...prevFlows];
              }
            });
          } catch {}
        });

        es.onerror = () => setIsConnectedSSE(false);
      } catch (err) {
        console.warn("SSE init error:", err);
      }
    }

    return () => {
      es?.close();
    };
  }, [isLiveStreamActive]);

  useEffect(() => {
    fetchData();
  }, []);

  // Clear traces
  const handleClearTraces = async () => {
    if (confirm("Are you sure you want to clear all in-memory traces?")) {
      try {
        await fetch("/api/observability", { method: "DELETE" });
        setFlows([]);
        setTraces([]);
        setSelectedRunId(null);
        setSelectedTraceId(null);
      } catch (err) {
        console.warn("Error clearing traces:", err);
      }
    }
  };

  // Filtered flows
  const filteredFlows = useMemo(() => {
    return flows.filter((f) => {
      if (selectedAgentFilter !== "all") {
        const hasAgent = f.steps.some((s) => s.node_name === selectedAgentFilter);
        if (!hasAgent) return false;
      }
      if (selectedCallTypeFilter !== "all") {
        const hasType = f.steps.some((s) => s.call_type === selectedCallTypeFilter);
        if (!hasType) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = f.flow_name.toLowerCase().includes(q);
        const matchesStep = f.steps.some(
          (s) =>
            s.node_name.toLowerCase().includes(q) ||
            s.reasoning_rationale.toLowerCase().includes(q) ||
            Boolean(s.prompt_details?.user_prompt?.toLowerCase().includes(q)) ||
            (typeof s.response_details?.raw_completion === "string" && s.response_details.raw_completion.toLowerCase().includes(q))
        );
        if (!matchesName && !matchesStep) return false;
      }
      return true;
    });
  }, [flows, selectedAgentFilter, selectedCallTypeFilter, searchQuery]);

  // Active selected flow & trace
  const activeFlow = useMemo(() => {
    return flows.find((f) => f.run_id === selectedRunId) || filteredFlows[0] || null;
  }, [flows, selectedRunId, filteredFlows]);

  const activeTrace = useMemo(() => {
    if (!activeFlow) return null;
    return activeFlow.steps.find((s) => s.trace_id === selectedTraceId) || activeFlow.steps[0] || null;
  }, [activeFlow, selectedTraceId]);

  // Overall metrics
  const totalTokens = traces.reduce((acc, t) => acc + (t.llm_tokens_used || 0), 0);
  const avgLatency =
    traces.length > 0 ? Math.round(traces.reduce((acc, t) => acc + t.latency_ms, 0) / traces.length) : 0;
  const errorCount = traces.filter((t) => t.status === "error").length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* 1. TOP HEADER & METRICS BAR */}
      <header className="border-b border-white/10 bg-slate-900/90 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-[1720px] mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition flex items-center gap-1.5 text-xs font-mono"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Aletheia Home</span>
            </Link>

            <div className="h-4 w-[1px] bg-white/10 hidden sm:block" />

            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-600/30 border border-cyan-500/40 text-cyan-400 shadow-sm">
                <Terminal className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-sm font-bold tracking-wider font-mono text-slate-100">
                    AGENTIC OBSERVABILITY STUDIO
                  </h1>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-semibold">
                    v2.0 LIVE
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 font-mono hidden md:block">
                  Hierarchical Multi-Agent Flow & Deep Epistemic Reasoning Inspector
                </p>
              </div>
            </div>
          </div>

          {/* Metrics & Stream Status */}
          <div className="flex items-center gap-3 text-xs font-mono flex-wrap">
            {/* Live SSE Status Indicator */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-950 border border-white/10">
              <span
                className={`w-2 h-2 rounded-full ${
                  isLiveStreamActive && isConnectedSSE ? "bg-emerald-400 animate-pulse" : "bg-rose-500"
                }`}
              />
              <span className={isLiveStreamActive && isConnectedSSE ? "text-emerald-400 font-semibold" : "text-rose-400"}>
                {isLiveStreamActive && isConnectedSSE ? "SSE STREAM CONNECTED" : "OFFLINE / PAUSED"}
              </span>
            </div>

            {/* Quick Metrics */}
            <div className="hidden lg:flex items-center gap-4 px-3 py-1.5 rounded-lg bg-slate-950 border border-white/10 text-slate-400">
              <div className="flex items-center gap-1.5">
                <GitCommit className="w-3.5 h-3.5 text-cyan-400" />
                <span>Runs: <strong className="text-slate-100">{flows.length}</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                <span>Tokens: <strong className="text-slate-100">{totalTokens.toLocaleString()}</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-violet-400" />
                <span>Avg Latency: <strong className="text-slate-100">{avgLatency}ms</strong></span>
              </div>
              {errorCount > 0 && (
                <div className="flex items-center gap-1.5 text-rose-400">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Errors: <strong>{errorCount}</strong></span>
                </div>
              )}
            </div>

            {/* Control Buttons */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setIsLiveStreamActive(!isLiveStreamActive)}
                className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold flex items-center gap-1 transition ${
                  isLiveStreamActive
                    ? "bg-slate-800 hover:bg-slate-700 text-slate-300 border-white/10"
                    : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                }`}
                title={isLiveStreamActive ? "Pause Stream" : "Resume Stream"}
              >
                {isLiveStreamActive ? <Pause className="w-3 h-3 text-amber-400" /> : <Play className="w-3 h-3 text-emerald-400" />}
                <span className="hidden sm:inline">{isLiveStreamActive ? "Pause" : "Live"}</span>
              </button>

              <button
                onClick={fetchData}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-white/10 transition"
                title="Refresh Data"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-cyan-400" : ""}`} />
              </button>

              <button
                onClick={handleClearTraces}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 border border-white/10 transition"
                title="Clear All Traces"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* 2. SEARCH & FILTER TOOLBAR */}
      <div className="border-b border-white/5 bg-slate-900/60 backdrop-blur-sm px-4 py-2.5">
        <div className="max-w-[1720px] mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Search bar */}
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search prompts, reasonings, responses, topics..."
              className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-950/80 border border-white/10 text-xs font-mono placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50 text-slate-200"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono">
            <span className="text-slate-500 text-[11px] mr-1 hidden sm:inline">Filter Agent:</span>
            {[
              { id: "all", label: "All Agents" },
              { id: "agent_dialogue", label: "Dialogue" },
              { id: "node_observer", label: "Observer" },
              { id: "node_context", label: "Context" },
              { id: "tool_search", label: "Tool Search" },
              { id: "node_discovery", label: "Discovery" },
              { id: "llm_completion", label: "Raw LLM" },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setSelectedAgentFilter(f.id)}
                className={`px-2.5 py-1 rounded-lg transition text-[11px] font-medium border ${
                  selectedAgentFilter === f.id
                    ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-sm"
                    : "bg-slate-950 text-slate-400 hover:text-white border-white/5"
                }`}
              >
                {f.label}
              </button>
            ))}

            <div className="h-3.5 w-[1px] bg-white/10 mx-1 hidden sm:block" />

            {/* Call type pills */}
            {[
              { id: "all", label: "All Types" },
              { id: "llm", label: "LLM Calls" },
              { id: "tool", label: "Tools" },
              { id: "agent_step", label: "Steps" },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedCallTypeFilter(t.id)}
                className={`px-2.5 py-1 rounded-lg transition text-[11px] font-medium border ${
                  selectedCallTypeFilter === t.id
                    ? "bg-violet-500/20 text-violet-300 border-violet-500/40 shadow-sm"
                    : "bg-slate-950 text-slate-400 hover:text-white border-white/5"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 3. SPLIT-PANE WORKSPACE */}
      <div className="flex-1 max-w-[1720px] mx-auto w-full p-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* LEFT COLUMN: RUN EXPLORER & STEP WATERFALL (5 COLUMNS ON DESKTOP) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {/* Run Flows List */}
          <div className="rounded-xl bg-slate-900/80 border border-white/10 p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
              <div className="flex items-center gap-2">
                <GitCommit className="w-4 h-4 text-cyan-400" />
                <h2 className="text-xs font-mono font-bold text-slate-200 uppercase">
                  Agent Interaction Runs ({filteredFlows.length})
                </h2>
              </div>
              <span className="text-[10px] font-mono text-slate-500">Chronological</span>
            </div>

            <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
              {filteredFlows.map((flow) => {
                const isSelected = selectedRunId === flow.run_id;
                return (
                  <div
                    key={flow.run_id}
                    onClick={() => {
                      setSelectedRunId(flow.run_id);
                      setSelectedTraceId(flow.steps[0]?.trace_id || null);
                    }}
                    className={`p-3 rounded-lg border transition cursor-pointer space-y-1.5 ${
                      isSelected
                        ? "bg-slate-800/90 border-cyan-500/50 shadow-md ring-1 ring-cyan-500/30"
                        : "bg-slate-950 border-white/5 hover:border-white/20 hover:bg-slate-900"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-100 font-mono truncate">
                        {flow.flow_name}
                      </span>
                      <span
                        className={`text-[9px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                          flow.status === "error"
                            ? "bg-rose-950/80 text-rose-300 border border-rose-500/40"
                            : "bg-emerald-950/80 text-emerald-300 border border-emerald-500/40"
                        }`}
                      >
                        {flow.status}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400">
                      <span>{flow.steps.length} steps</span>
                      <span>•</span>
                      <span className="text-emerald-400">{flow.total_tokens} tok</span>
                      <span>•</span>
                      <span className="text-violet-400">{flow.total_latency_ms}ms</span>
                      <span>•</span>
                      <span className="text-slate-500">
                        {new Date(flow.start_time).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                );
              })}

              {filteredFlows.length === 0 && (
                <div className="p-8 text-center text-slate-500 text-xs font-mono">
                  No agent runs found matching filter.
                </div>
              )}
            </div>
          </div>

          {/* Step Flow Waterfall DAG */}
          {activeFlow && (
            <div className="rounded-xl bg-slate-900/80 border border-white/10 p-4 space-y-3 flex-1">
              <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-xs font-mono font-bold text-slate-200 uppercase">
                    Execution Flow Sequence ({activeFlow.steps.length} Steps)
                  </h3>
                </div>
                <span className="text-[10px] font-mono text-cyan-400">Click step to inspect</span>
              </div>

              <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                {activeFlow.steps.map((step, idx) => {
                  const isStepSelected = selectedTraceId === step.trace_id;
                  const isLlm = step.call_type === "llm";
                  const isTool = step.call_type === "tool";

                  return (
                    <div
                      key={step.trace_id}
                      onClick={() => setSelectedTraceId(step.trace_id)}
                      className={`p-3 rounded-lg border transition cursor-pointer flex items-center justify-between gap-3 ${
                        isStepSelected
                          ? "bg-slate-800 border-cyan-400/60 shadow-md ring-1 ring-cyan-400/30"
                          : "bg-slate-950/80 border-white/5 hover:border-white/20 hover:bg-slate-900/70"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Step number badge */}
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-mono font-bold flex-shrink-0 ${
                            isStepSelected
                              ? "bg-cyan-500 text-slate-950"
                              : "bg-slate-800 text-slate-400 border border-white/10"
                          }`}
                        >
                          {idx + 1}
                        </div>

                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold uppercase border ${
                                isLlm
                                  ? "bg-violet-950/70 text-violet-300 border-violet-500/40"
                                  : isTool
                                  ? "bg-amber-950/70 text-amber-300 border-amber-500/40"
                                  : "bg-cyan-950/70 text-cyan-300 border-cyan-500/40"
                              }`}
                            >
                              {step.call_type?.toUpperCase() || "STEP"}
                            </span>
                            <span className="text-xs font-mono font-bold text-slate-200 truncate">
                              {step.node_name.replace("node_", "").replace("agent_", "")}
                            </span>
                          </div>

                          <p className="text-[11px] text-slate-400 truncate max-w-[260px]">
                            {step.reasoning_rationale || "Completed step execution"}
                          </p>
                        </div>
                      </div>

                      <div className="text-right font-mono flex flex-col items-end flex-shrink-0">
                        <span className="text-xs text-violet-400">{step.latency_ms}ms</span>
                        {step.llm_tokens_used ? (
                          <span className="text-[10px] text-emerald-400">
                            {step.llm_tokens_used} tok
                          </span>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: DEEP CALL INSPECTOR WORKBENCH (7 COLUMNS ON DESKTOP) */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          {activeTrace ? (
            <div className="rounded-xl bg-slate-900/90 border border-white/10 flex flex-col flex-1 shadow-2xl overflow-hidden">
              {/* Selected Step Header */}
              <div className="p-4 border-b border-white/10 bg-slate-950/70 flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${
                        activeTrace.call_type === "llm"
                          ? "bg-violet-950/70 text-violet-300 border-violet-500/40"
                          : activeTrace.call_type === "tool"
                          ? "bg-amber-950/70 text-amber-300 border-amber-500/40"
                          : "bg-cyan-950/70 text-cyan-300 border-cyan-500/40"
                      }`}
                    >
                      {activeTrace.call_type || "STEP"}
                    </span>
                    <h2 className="text-sm font-mono font-bold text-slate-100">
                      {activeTrace.node_name}
                    </h2>
                    <span className="text-xs text-slate-500 font-mono">•</span>
                    <span className="text-xs text-cyan-300 font-mono">
                      {activeTrace.trace_id}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed font-mono">
                    {activeTrace.reasoning_rationale}
                  </p>
                </div>

                <div className="flex items-center gap-2 font-mono text-xs">
                  <span className="px-2.5 py-1 rounded bg-slate-900 border border-white/10 text-emerald-400">
                    {activeTrace.llm_tokens_used || 0} tokens
                  </span>
                  <span className="px-2.5 py-1 rounded bg-slate-900 border border-white/10 text-violet-400">
                    {activeTrace.latency_ms}ms
                  </span>
                  <button
                    onClick={() => handleCopy(JSON.stringify(activeTrace, null, 2), "trace_json")}
                    className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-white/10 transition"
                    title="Copy Full Trace JSON"
                  >
                    {copiedKey === "trace_json" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Inspector Sub-Tabs */}
              <div className="flex border-b border-white/10 bg-slate-950/50 px-4 pt-2 gap-2 text-xs font-mono">
                <button
                  onClick={() => setActiveInspectorTab("reasonings")}
                  className={`px-3 py-2 border-b-2 font-semibold flex items-center gap-1.5 transition ${
                    activeInspectorTab === "reasonings"
                      ? "border-cyan-400 text-cyan-300 bg-cyan-500/10 rounded-t-lg"
                      : "border-transparent text-slate-400 hover:text-white"
                  }`}
                >
                  <Brain className="w-3.5 h-3.5 text-cyan-400" />
                  <span>1. Flow & Reasonings</span>
                </button>

                <button
                  onClick={() => setActiveInspectorTab("prompt_context")}
                  className={`px-3 py-2 border-b-2 font-semibold flex items-center gap-1.5 transition ${
                    activeInspectorTab === "prompt_context"
                      ? "border-cyan-400 text-cyan-300 bg-cyan-500/10 rounded-t-lg"
                      : "border-transparent text-slate-400 hover:text-white"
                  }`}
                >
                  <FileText className="w-3.5 h-3.5 text-amber-400" />
                  <span>2. Prompt & Injected Context</span>
                </button>

                <button
                  onClick={() => setActiveInspectorTab("response")}
                  className={`px-3 py-2 border-b-2 font-semibold flex items-center gap-1.5 transition ${
                    activeInspectorTab === "response"
                      ? "border-cyan-400 text-cyan-300 bg-cyan-500/10 rounded-t-lg"
                      : "border-transparent text-slate-400 hover:text-white"
                  }`}
                >
                  <Zap className="w-3.5 h-3.5 text-violet-400" />
                  <span>3. Model Response & Outputs</span>
                </button>

                <button
                  onClick={() => setActiveInspectorTab("telemetry")}
                  className={`px-3 py-2 border-b-2 font-semibold flex items-center gap-1.5 transition ${
                    activeInspectorTab === "telemetry"
                      ? "border-cyan-400 text-cyan-300 bg-cyan-500/10 rounded-t-lg"
                      : "border-transparent text-slate-400 hover:text-white"
                  }`}
                >
                  <Database className="w-3.5 h-3.5 text-emerald-400" />
                  <span>4. Telemetry & JSON</span>
                </button>
              </div>

              {/* Inspector Content Panes */}
              <div className="p-5 overflow-y-auto max-h-[620px] space-y-4 text-xs font-mono">
                {/* TAB 1: FLOW & REASONINGS */}
                {activeInspectorTab === "reasonings" && (
                  <div className="space-y-4">
                    {/* Primary Decision Rationale */}
                    <div className="p-4 rounded-xl bg-slate-950 border border-cyan-500/30 space-y-1.5 shadow-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                          <Brain className="w-3.5 h-3.5" />
                          PRIMARY AGENT REASONING & DECISION RATIONALE
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          Trace {activeTrace.trace_id}
                        </span>
                      </div>
                      <p className="text-slate-200 text-xs leading-relaxed">
                        {activeTrace.reasoning_rationale}
                      </p>
                    </div>

                    {/* Internal Rationale Breakdown if present */}
                    {activeTrace.reasoning_details && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {activeTrace.reasoning_details.emotional_state && (
                          <div className="p-3 rounded-lg bg-slate-950 border border-white/5 space-y-1">
                            <span className="text-[10px] text-slate-400 uppercase">
                              Detected User Mindset
                            </span>
                            <p className="text-cyan-300 font-semibold text-xs">
                              {activeTrace.reasoning_details.emotional_state}
                            </p>
                          </div>
                        )}

                        {activeTrace.reasoning_details.curiosity_focus && (
                          <div className="p-3 rounded-lg bg-slate-950 border border-white/5 space-y-1">
                            <span className="text-[10px] text-slate-400 uppercase">
                              Identified Curiosity Focus
                            </span>
                            <p className="text-amber-300 font-semibold text-xs">
                              {activeTrace.reasoning_details.curiosity_focus}
                            </p>
                          </div>
                        )}

                        {activeTrace.reasoning_details.pedagogical_strategy && (
                          <div className="p-3 rounded-lg bg-slate-950 border border-white/5 space-y-1">
                            <span className="text-[10px] text-slate-400 uppercase">
                              Pedagogical Strategy
                            </span>
                            <p className="text-violet-300 font-semibold text-xs">
                              {activeTrace.reasoning_details.pedagogical_strategy}
                            </p>
                          </div>
                        )}

                        {activeTrace.reasoning_details.why_this_response && (
                          <div className="p-3 rounded-lg bg-slate-950 border border-white/5 space-y-1">
                            <span className="text-[10px] text-slate-400 uppercase">
                              Why This Framing
                            </span>
                            <p className="text-emerald-300 font-semibold text-xs">
                              {activeTrace.reasoning_details.why_this_response}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Topic Update Diffs if present */}
                    {activeTrace.reasoning_details?.topic_diffs &&
                      (activeTrace.reasoning_details.topic_diffs as any[]).length > 0 && (
                        <div className="p-4 rounded-xl bg-slate-950 border border-white/5 space-y-2">
                          <span className="text-[10px] text-amber-400 uppercase font-bold block">
                            Mind-State Topic Diffs Generated:
                          </span>
                          <div className="space-y-1.5">
                            {(activeTrace.reasoning_details.topic_diffs as any[]).map((d, i) => (
                              <div
                                key={i}
                                className="p-2 rounded bg-slate-900 border border-white/5 flex items-center justify-between text-xs"
                              >
                                <span className="text-slate-200 font-semibold">{d.topic_name}</span>
                                <span className="text-cyan-400 font-mono">
                                  weight Δ{d.weight_delta > 0 ? `+${d.weight_delta}` : d.weight_delta}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                    {/* Input Summary & Output Summary cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="p-3.5 rounded-lg bg-slate-950 border border-teal-500/20 space-y-1.5">
                        <span className="text-[10px] text-teal-400 font-bold uppercase block">
                          Step Input Summary
                        </span>
                        <pre className="p-2.5 rounded bg-slate-900 text-[10px] text-slate-300 whitespace-pre-wrap max-h-[180px] overflow-y-auto">
                          {JSON.stringify(activeTrace.input_summary, null, 2)}
                        </pre>
                      </div>

                      <div className="p-3.5 rounded-lg bg-slate-950 border border-emerald-500/20 space-y-1.5">
                        <span className="text-[10px] text-emerald-400 font-bold uppercase block">
                          Step Output Summary
                        </span>
                        <pre className="p-2.5 rounded bg-slate-900 text-[10px] text-slate-300 whitespace-pre-wrap max-h-[180px] overflow-y-auto">
                          {JSON.stringify(activeTrace.output_summary, null, 2)}
                        </pre>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 2: PROMPT & INJECTED CONTEXT */}
                {activeInspectorTab === "prompt_context" && (
                  <div className="space-y-4">
                    {/* System Prompt */}
                    {activeTrace.prompt_details?.system_prompt && (
                      <div className="p-4 rounded-xl bg-slate-950 border border-white/10 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-cyan-400 font-bold uppercase flex items-center gap-1">
                            <Code className="w-3.5 h-3.5" />
                            System Instructions & Framing Prompt
                          </span>
                          <button
                            onClick={() =>
                              handleCopy(activeTrace.prompt_details?.system_prompt || "", "sys_prompt")
                            }
                            className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-white/10 text-[10px] flex items-center gap-1 transition"
                          >
                            {copiedKey === "sys_prompt" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            <span>Copy System Prompt</span>
                          </button>
                        </div>
                        <pre className="p-3 rounded-lg bg-slate-900 text-[11px] text-slate-300 whitespace-pre-wrap max-h-[220px] overflow-y-auto border border-white/5">
                          {activeTrace.prompt_details.system_prompt}
                        </pre>
                      </div>
                    )}

                    {/* User Prompt / Assembled Input */}
                    {activeTrace.prompt_details?.user_prompt && (
                      <div className="p-4 rounded-xl bg-slate-950 border border-white/10 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-amber-400 font-bold uppercase flex items-center gap-1">
                            <FileText className="w-3.5 h-3.5" />
                            User Prompt & Injected Context Assembly
                          </span>
                          <button
                            onClick={() =>
                              handleCopy(activeTrace.prompt_details?.user_prompt || "", "user_prompt")
                            }
                            className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-white/10 text-[10px] flex items-center gap-1 transition"
                          >
                            {copiedKey === "user_prompt" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            <span>Copy User Prompt</span>
                          </button>
                        </div>
                        <pre className="p-3 rounded-lg bg-slate-900 text-[11px] text-slate-300 whitespace-pre-wrap max-h-[260px] overflow-y-auto border border-white/5">
                          {activeTrace.prompt_details.user_prompt}
                        </pre>
                      </div>
                    )}

                    {/* Context Details Explorer */}
                    {activeTrace.context_details && Object.keys(activeTrace.context_details).length > 0 && (
                      <div className="p-4 rounded-xl bg-slate-950 border border-white/10 space-y-2">
                        <span className="text-[10px] text-teal-400 font-bold uppercase block">
                          Injected Context Variables (Mind-State, Tools, Feed):
                        </span>
                        <pre className="p-3 rounded-lg bg-slate-900 text-[11px] text-teal-200 whitespace-pre-wrap max-h-[200px] overflow-y-auto border border-white/5">
                          {JSON.stringify(activeTrace.context_details, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 3: MODEL RESPONSE & OUTPUTS */}
                {activeInspectorTab === "response" && (
                  <div className="space-y-4">
                    {/* Raw Model Completion Text */}
                    {Boolean(activeTrace.response_details?.raw_completion) && (
                      <div className="p-4 rounded-xl bg-slate-950 border border-violet-500/30 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-violet-400 font-bold uppercase flex items-center gap-1">
                            <Zap className="w-3.5 h-3.5" />
                            Raw Model LLM Output
                          </span>
                          <button
                            onClick={() =>
                              handleCopy(String(activeTrace.response_details?.raw_completion || ""), "raw_resp")
                            }
                            className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-white/10 text-[10px] flex items-center gap-1 transition"
                          >
                            {copiedKey === "raw_resp" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            <span>Copy Raw Completion</span>
                          </button>
                        </div>
                        <pre className="p-3 rounded-lg bg-slate-900 text-[11px] text-violet-200 whitespace-pre-wrap max-h-[240px] overflow-y-auto border border-white/5">
                          {String(activeTrace.response_details?.raw_completion || "")}
                        </pre>
                      </div>
                    )}

                    {/* Parsed JSON Output */}
                    {Boolean(activeTrace.response_details?.parsed_output) && (
                      <div className="p-4 rounded-xl bg-slate-950 border border-white/10 space-y-2">
                        <span className="text-[10px] text-emerald-400 font-bold uppercase block">
                          Parsed Structured Output & Emitted Decisions:
                        </span>
                        <pre className="p-3 rounded-lg bg-slate-900 text-[11px] text-emerald-200 whitespace-pre-wrap max-h-[240px] overflow-y-auto border border-white/5">
                          {JSON.stringify(activeTrace.response_details?.parsed_output, null, 2)}
                        </pre>
                      </div>
                    )}

                    {/* Sources retrieved / tool outputs */}
                    {Array.isArray(activeTrace.response_details?.sources) &&
                      (activeTrace.response_details.sources as any[]).length > 0 && (
                        <div className="p-4 rounded-xl bg-slate-950 border border-white/10 space-y-3">
                          <span className="text-[10px] text-cyan-400 font-bold uppercase block">
                            Grounding Sources Retrieved ({(activeTrace.response_details.sources as any[]).length}):
                          </span>
                          <div className="space-y-2">
                            {(activeTrace.response_details.sources as any[]).map((s, idx) => (
                              <div
                                key={idx}
                                className="p-3 rounded-lg bg-slate-900 border border-white/5 space-y-1 text-xs"
                              >
                                <div className="flex items-center justify-between">
                                  <a
                                    href={s.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-cyan-400 font-semibold hover:underline flex items-center gap-1"
                                  >
                                    <span>{s.title || s.name || s.url}</span>
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                  <span className="text-[10px] text-slate-500">{s.name}</span>
                                </div>
                                {Boolean(s.raw_text) && (
                                  <p className="text-slate-400 text-[11px] line-clamp-2">
                                    {String(s.raw_text)}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                  </div>
                )}

                {/* TAB 4: TELEMETRY & FULL JSON */}
                {activeInspectorTab === "telemetry" && (
                  <div className="space-y-4">
                    {/* Execution Metrics Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3 rounded-lg bg-slate-950 border border-white/5 space-y-0.5">
                        <span className="text-[10px] text-slate-500 uppercase">Duration</span>
                        <p className="text-sm font-bold text-violet-400">{activeTrace.latency_ms} ms</p>
                      </div>
                      <div className="p-3 rounded-lg bg-slate-950 border border-white/5 space-y-0.5">
                        <span className="text-[10px] text-slate-500 uppercase">Tokens</span>
                        <p className="text-sm font-bold text-emerald-400">{activeTrace.llm_tokens_used || 0}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-slate-950 border border-white/5 space-y-0.5">
                        <span className="text-[10px] text-slate-500 uppercase">Provider</span>
                        <p className="text-sm font-bold text-cyan-400">
                          {activeTrace.model_details?.provider || "DeepSeek"}
                        </p>
                      </div>
                      <div className="p-3 rounded-lg bg-slate-950 border border-white/5 space-y-0.5">
                        <span className="text-[10px] text-slate-500 uppercase">Model</span>
                        <p className="text-sm font-bold text-slate-200 truncate">
                          {activeTrace.model_details?.model || "deepseek-chat"}
                        </p>
                      </div>
                    </div>

                    {/* Identifiers */}
                    <div className="p-3.5 rounded-lg bg-slate-950 border border-white/5 space-y-1.5 text-[11px] text-slate-400">
                      <div>Trace ID: <strong className="text-cyan-300">{activeTrace.trace_id}</strong></div>
                      <div>Run ID: <strong className="text-slate-200">{activeTrace.run_id || "N/A"}</strong></div>
                      <div>Session ID: <strong className="text-slate-300">{activeTrace.session_id}</strong></div>
                      <div>Timestamp: <strong className="text-slate-300">{activeTrace.timestamp}</strong></div>
                    </div>

                    {/* Full Raw Trace JSON */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-400 uppercase font-bold">
                          Complete Trace JSON Payload
                        </span>
                        <button
                          onClick={() => handleCopy(JSON.stringify(activeTrace, null, 2), "trace_full")}
                          className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-white/10 text-[10px] flex items-center gap-1 transition"
                        >
                          {copiedKey === "trace_full" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          <span>Copy JSON</span>
                        </button>
                      </div>
                      <pre className="p-3 rounded-lg bg-slate-950 text-[10px] text-slate-300 whitespace-pre-wrap max-h-[300px] overflow-y-auto border border-white/5">
                        {JSON.stringify(activeTrace, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-xl bg-slate-900/40 border border-white/5 p-12 text-center text-slate-500 font-mono text-xs flex flex-col items-center justify-center gap-2">
              <Terminal className="w-8 h-8 text-slate-600" />
              <span>Select an agent run or execution step on the left to inspect its reasonings, prompt, context, and responses.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
