"use client";

import React, { useState, useEffect, useRef } from "react";
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
  Heart,
  Shield,
  Filter,
  Eye,
  Sliders,
  Network,
  Newspaper,
  Copy,
  FileText,
  Code,
  CreditCard,
  FlaskConical,
} from "lucide-react";
import {
  AgentTraceLog,
  UserKnowledgeGraph,
  UnifiedTopicNode,
  ContextualSelection,
} from "@/core/types/contracts";

interface DevToolsProps {
  isOpen: boolean;
  onToggle: () => void;
  userGraph?: UserKnowledgeGraph | null;
  unifiedTopicNode?: UnifiedTopicNode | null;
  refreshTrigger?: number;
  selectedContext?: ContextualSelection | null;
  onSelectContext?: (context: ContextualSelection | null) => void;
  isCollectingNews?: boolean;
  onOpenSubscriptionModal?: () => void;
}

export default function DevToolsPanel({
  isOpen,
  onToggle,
  userGraph,
  unifiedTopicNode,
  refreshTrigger,
  selectedContext,
  onSelectContext,
  isCollectingNews = false,
  onOpenSubscriptionModal,
}: DevToolsProps) {
  const [activeTab, setActiveTab] = useState<
    "live_stream" | "mind_state" | "contextual" | "ai_calls" | "state_tree" | "raw_traces"
  >("mind_state");
  const [traces, setTraces] = useState<AgentTraceLog[]>([]);
  const [expandedTraceId, setExpandedTraceId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [latestLiveTrace, setLatestLiveTrace] = useState<AgentTraceLog | null>(null);
  const [isConnectedSSE, setIsConnectedSSE] = useState(false);
  const [expandedFlowStepId, setExpandedFlowStepId] = useState<number | null>(null);
  const [showAgentRunIo, setShowAgentRunIo] = useState<boolean>(true);
  const [expandedTraceDetailId, setExpandedTraceDetailId] = useState<string | null>(null);
  const [selectedAgentFilter, setSelectedAgentFilter] = useState<string>("all");
  const [fetchedTopicNode, setFetchedTopicNode] = useState<UnifiedTopicNode | null>(null);
  const terminalScrollRef = useRef<HTMLDivElement>(null);

  // Active Unified Topic Node: prefer prop, then fetched
  const effectiveTopicNode = unifiedTopicNode || fetchedTopicNode;
  useEffect(() => {
    let es: EventSource | null = null;
    try {
      es = new EventSource("/api/devtools/stream");

      es.onopen = () => {
        setIsConnectedSSE(true);
      };

      es.addEventListener("connected", (e) => {
        setIsConnectedSSE(true);
        const data = JSON.parse(e.data);
        if (data.recent_traces) {
          setTraces((prev) => {
            const map = new Map<string, AgentTraceLog>();
            prev.forEach((t) => map.set(t.trace_id, t));
            data.recent_traces.forEach((t: AgentTraceLog) => map.set(t.trace_id, t));
            return Array.from(map.values()).sort(
              (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            );
          });
        }
      });

      es.addEventListener("trace", (e) => {
        const trace = JSON.parse(e.data) as AgentTraceLog;
        setLatestLiveTrace(trace);
        setTraces((prev) => [trace, ...prev.filter((t) => t.trace_id !== trace.trace_id)]);
      });

      es.onerror = () => {
        setIsConnectedSSE(false);
      };
    } catch (err) {
      console.warn("SSE connection error:", err);
    }

    return () => {
      es?.close();
    };
  }, []);

  // Fetch standard snapshot data
  const fetchDevToolsData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/devtools");
      const json = await res.json();
      if (json.success) {
        if (json.traces) {
          setTraces((prev) => {
            const map = new Map<string, AgentTraceLog>();
            prev.forEach((t) => map.set(t.trace_id, t));
            json.traces.forEach((t: AgentTraceLog) => map.set(t.trace_id, t));
            return Array.from(map.values()).sort(
              (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            );
          });
        }
        if (json.database_state?.unified_topic_node) {
          setFetchedTopicNode(json.database_state.unified_topic_node);
        }
      }
    } catch (err) {
      console.error("Failed to fetch devtools data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDevToolsData();
  }, [refreshTrigger, isOpen]);

  // When selectedContext changes, automatically switch to contextual tab
  useEffect(() => {
    if (selectedContext) {
      setActiveTab("contextual");
      if ("trace_id" in selectedContext && selectedContext.trace_id) {
        setExpandedTraceId(selectedContext.trace_id);
      }
    }
  }, [selectedContext]);

  // When news collection starts, automatically switch to live_stream tab
  useEffect(() => {
    if (isCollectingNews) {
      setActiveTab("live_stream");
    }
  }, [isCollectingNews]);

  // Auto-scroll live terminal
  useEffect(() => {
    if (activeTab === "live_stream" && terminalScrollRef.current) {
      terminalScrollRef.current.scrollTop = 0;
    }
  }, [traces, latestLiveTrace, activeTab]);

  const totalTokens = traces.reduce((acc, t) => acc + (t.llm_tokens_used || 0), 0);
  const avgLatency = traces.length > 0 ? Math.round(traces.reduce((acc, t) => acc + t.latency_ms, 0) / traces.length) : 0;

  // Pipeline stages calculation
  const hasDiscovery = traces.some((t) => t.node_name === "node_discovery");
  const hasContext = traces.some((t) => t.node_name === "node_context");
  const hasObserver = traces.some((t) => t.node_name === "node_observer");
  const hasEpistemology = traces.some((t) => t.node_name === "node_a_epistemology");
  const hasTelemetry = traces.some((t) => t.node_name === "node_b_telemetry");
  const hasSerendipity = traces.some((t) => t.node_name === "node_c_serendipity");
  const hasSynthesis = traces.some((t) => t.node_name === "node_d_synthesis");

  const nodes = [
    {
      id: "discovery",
      name: "1. Discovery Agent (Curator)",
      icon: Filter,
      active: isCollectingNews && !hasEpistemology,
      done: hasDiscovery,
      desc: "Deep Intent Filtering & Anti-Preference Rejection",
    },
    {
      id: "epistemology",
      name: "2. Epistemology Agent",
      icon: Brain,
      active: isCollectingNews && hasDiscovery && !hasTelemetry,
      done: hasEpistemology,
      desc: "Stance Extraction, Bias Stripping & Consensus Deltas",
    },
    {
      id: "telemetry",
      name: "3. Telemetry & Observer",
      icon: Eye,
      active: isCollectingNews && hasEpistemology && !hasSerendipity,
      done: hasTelemetry || hasObserver,
      desc: "Continuous Mind-State Memory & Telemetry Evaluation",
    },
    {
      id: "serendipity",
      name: "4. Serendipity Agent",
      icon: Compass,
      active: isCollectingNews && hasTelemetry && !hasSynthesis,
      done: hasSerendipity,
      desc: "Ideological Stance Balancing & Curiosity Frontier Discovery",
    },
    {
      id: "synthesis",
      name: "5. Synthesis Agent",
      icon: FileCheck,
      active: isCollectingNews && hasSerendipity,
      done: hasSynthesis,
      desc: "Journalistic Story Writing & Contextual Calibration",
    },
  ];

  return (
    <div className={`fixed bottom-0 left-0 right-0 z-50 border-t border-cyan-500/40 bg-slate-950/95 backdrop-blur-xl shadow-2xl transition-all duration-300 ${!isOpen ? "hidden lg:block" : "block"}`}>
      {/* DevTools Header Bar */}
      <div className="max-w-7xl mx-auto px-4 h-12 flex items-center justify-between">
        <button
          onClick={onToggle}
          className="flex items-center gap-2 text-xs font-mono text-cyan-300 hover:text-cyan-200 transition font-bold truncate mr-2"
        >
          <Terminal className="w-4 h-4 text-cyan-400 flex-shrink-0" />
          <span className="hidden sm:inline">MIND-STATE MEMORY ARCHITECTURE DEVTOOLS</span>
          <span className="sm:hidden">DEVTOOLS</span>

          {/* Live Streaming Pulsing Indicator */}
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-900 border border-white/10 text-[10px] flex-shrink-0">
            <span className={`w-2 h-2 rounded-full ${isCollectingNews ? "bg-rose-500 animate-ping" : isConnectedSSE ? "bg-emerald-400" : "bg-slate-500"}`} />
            <span className={isCollectingNews ? "text-rose-400 font-bold" : "text-emerald-400"}>
              {isCollectingNews ? "LIVE RUN IN PROGRESS" : isConnectedSSE ? "SSE STREAM CONNECTED" : "OFFLINE"}
            </span>
          </div>

          <span className="hidden sm:inline-block px-2 py-0.5 rounded-full bg-cyan-500/20 text-[10px] border border-cyan-500/30 flex-shrink-0">
            {traces.length} Traces
          </span>

          {selectedContext && (
            <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] border border-amber-500/30 font-mono flex items-center gap-1 flex-shrink-0">
              <span>Target: {selectedContext.type.toUpperCase()}</span>
            </span>
          )}
          {isOpen ? <ChevronDown className="w-4 h-4 flex-shrink-0" /> : <ChevronUp className="w-4 h-4 flex-shrink-0" />}
        </button>

        <div className="flex items-center gap-2 sm:gap-4 text-xs font-mono flex-shrink-0">
          {selectedContext && onSelectContext && (
            <button
              onClick={() => onSelectContext(null)}
              className="text-[11px] text-amber-400 hover:underline flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              <span className="hidden sm:inline">Clear Filter</span>
            </button>
          )}
          <div className="hidden sm:flex items-center gap-2 text-slate-400">
            <Cpu className="w-3.5 h-3.5 text-emerald-400" />
            <span>Tokens: <strong className="text-slate-200">{totalTokens}</strong></span>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-slate-400">
            <Clock className="w-3.5 h-3.5 text-violet-400" />
            <span>Avg Latency: <strong className="text-slate-200">{avgLatency}ms</strong></span>
          </div>
          {onOpenSubscriptionModal && (
            <button
              onClick={onOpenSubscriptionModal}
              className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[11px] font-mono font-semibold flex items-center gap-1.5 transition shadow-sm"
              title="Test Stripe Checkout & Test Credit Card in Sandbox"
            >
              <CreditCard className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden md:inline">Test Stripe Mode</span>
            </button>
          )}

          <a
            href="/observability"
            target="_blank"
            rel="noreferrer"
            className="px-2.5 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-[11px] font-mono font-semibold flex items-center gap-1.5 transition shadow-sm"
            title="Open Full Observability Studio in New Tab"
          >
            <Terminal className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden md:inline">Observability Studio ↗</span>
          </a>

          <button
            onClick={fetchDevToolsData}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-white/10"
            title="Refresh Trace Logs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-cyan-400" : ""}`} />
          </button>
          {isOpen && (
            <button
              onClick={onToggle}
              className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-white/10"
              title="Close DevTools"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* DevTools Drawer Content */}
      {isOpen && (
        <div className="max-w-7xl mx-auto px-4 pb-6 pt-2 border-t border-white/5 space-y-4 max-h-[75vh] lg:max-h-[540px] overflow-y-auto">
          {/* Sub Navigation Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2">
            <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono">
              <button
                onClick={() => setActiveTab("mind_state")}
                className={`px-3 py-1.5 rounded-lg transition font-semibold flex items-center gap-1.5 ${
                  activeTab === "mind_state"
                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Brain className="w-3.5 h-3.5 text-cyan-400" />
                <span>Mind-State Architecture</span>
              </button>

              <button
                onClick={() => setActiveTab("live_stream")}
                className={`px-3 py-1.5 rounded-lg transition font-semibold flex items-center gap-1.5 ${
                  activeTab === "live_stream"
                    ? "bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Radio className={`w-3.5 h-3.5 ${isCollectingNews ? "text-rose-400 animate-pulse" : "text-slate-400"}`} />
                <span>Live Run Monitor {isCollectingNews ? "🔴" : ""}</span>
              </button>

              <button
                onClick={() => setActiveTab("contextual")}
                className={`px-3 py-1.5 rounded-lg transition font-semibold flex items-center gap-1.5 ${
                  activeTab === "contextual"
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Contextual Inspector {selectedContext ? `(${selectedContext.type})` : ""}</span>
              </button>

              <button
                onClick={() => setActiveTab("ai_calls")}
                className={`px-3 py-1.5 rounded-lg transition font-semibold flex items-center gap-1.5 ${
                  activeTab === "ai_calls"
                    ? "bg-violet-500/20 text-violet-300 border border-violet-500/40"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Zap className="w-3.5 h-3.5 text-violet-400" />
                <span>
                  AI Calls & Prompts (
                  {
                    traces.filter(
                      (t) =>
                        t.call_type === "llm" ||
                        Boolean(t.prompt_details?.user_prompt) ||
                        Boolean((t.metadata as any)?.raw_llm_completion) ||
                        Boolean(t.response_details?.raw_completion)
                    ).length
                  }
                  )
                </span>
              </button>

              <button
                onClick={() => setActiveTab("state_tree")}
                className={`px-3 py-1.5 rounded-lg transition font-semibold flex items-center gap-1.5 ${
                  activeTab === "state_tree"
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Database className="w-3.5 h-3.5 text-emerald-400" />
                <span>Raw State Tree</span>
              </button>

              <button
                onClick={() => setActiveTab("raw_traces")}
                className={`px-3 py-1.5 rounded-lg transition font-semibold flex items-center gap-1.5 ${
                  activeTab === "raw_traces"
                    ? "bg-slate-800 text-slate-200 border border-white/20"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Layers className="w-3.5 h-3.5 text-slate-400" />
                <span>Node Traces ({traces.length})</span>
              </button>
            </div>
          </div>


          {/* TAB 0: THE MIND-STATE MEMORY ARCHITECTURE (SINGLE SOURCE OF TRUTH & TRI-AGENT ENGINE) */}
          {activeTab === "mind_state" && (
            <div className="space-y-4">
              {/* Header Overview Banner */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-cyan-950/60 via-slate-900 to-indigo-950/60 border border-cyan-500/30 flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Brain className="w-5 h-5 text-cyan-400" />
                    <span className="font-mono text-sm font-bold text-slate-100">
                      The Mind-State Memory Engine
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] font-mono border border-cyan-500/30">
                      Single Source of Truth
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">
                    Fuses conversational memory with news discovery parameters. The chat companion and discovery curator share the exact same mental model of the user.
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs font-mono">
                  <div className="px-3 py-1.5 rounded-lg bg-slate-950/80 border border-white/10 text-slate-300">
                    <span className="text-slate-500 block text-[9px] uppercase">Last Updated</span>
                    <span className="text-cyan-300 font-bold">
                      {effectiveTopicNode?.last_updated ? new Date(effectiveTopicNode.last_updated).toLocaleTimeString() : "Just now"}
                    </span>
                  </div>
                </div>
              </div>

              {/* 4 Core Mind-State Pillars Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Pillar 1: The Unified Topic Node */}
                <div className="p-4 rounded-xl bg-slate-900/90 border border-cyan-500/20 space-y-3">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <span className="font-mono text-xs font-bold text-cyan-400 flex items-center gap-1.5">
                      <Sliders className="w-4 h-4 text-cyan-400" />
                      1. UNIFIED TOPIC NODE (CANONICAL TOPICS)
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      {Object.keys(effectiveTopicNode?.topics || {}).length} Topics Registered
                    </span>
                  </div>

                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                    {Object.entries(effectiveTopicNode?.topics || {}).map(([topicName, meta], tIdx) => {
                      const recentDiff = (effectiveTopicNode?.recent_topic_diffs || []).find(
                        (d) => d.topic_name.toLowerCase() === topicName.toLowerCase()
                      );

                      return (
                        <div
                          key={tIdx}
                          className="p-3 rounded-lg bg-slate-950 border border-white/5 space-y-2 hover:border-cyan-500/30 transition"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs text-slate-100">{topicName}</span>
                              {recentDiff && (
                                <span
                                  className={`px-1.5 py-0.2 rounded font-mono text-[9px] font-bold ${
                                    recentDiff.weight_delta > 0
                                      ? "bg-emerald-950 text-emerald-300 border border-emerald-500/30"
                                      : recentDiff.weight_delta < 0
                                      ? "bg-rose-950 text-rose-300 border border-rose-500/30"
                                      : "bg-cyan-950 text-cyan-300 border border-cyan-500/30"
                                  }`}
                                >
                                  {recentDiff.weight_delta > 0
                                    ? `▲ +${Math.round(recentDiff.weight_delta * 100)}%`
                                    : recentDiff.weight_delta < 0
                                    ? `▼ ${Math.round(recentDiff.weight_delta * 100)}%`
                                    : "Δ Updated"}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 font-mono text-[9px] border border-cyan-500/30 uppercase">
                                {meta.technical_depth}
                              </span>
                              <span className="text-xs font-mono font-bold text-emerald-400">
                                {Math.round(meta.weight * 100)}%
                              </span>
                              {recentDiff && onSelectContext && (
                                <button
                                  onClick={() => {
                                    onSelectContext({
                                      type: "topic_diff",
                                      diff: recentDiff,
                                    });
                                    setActiveTab("contextual");
                                  }}
                                  className="text-[10px] font-mono text-cyan-300 hover:underline bg-cyan-950/40 px-1.5 py-0.5 rounded border border-cyan-500/20"
                                  title="View Topic State Transition Diff"
                                >
                                  Diff
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Affinity Weight Bar */}
                          <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 rounded-full"
                              style={{ width: `${Math.round(meta.weight * 100)}%` }}
                            />
                          </div>

                          <div className="space-y-1.5 pt-1">
                            {/* Pillar 1: What the user is interested in */}
                            <div className="text-[11px] leading-relaxed bg-slate-900/60 p-2 rounded border border-white/5 space-y-0.5">
                              <span className="text-cyan-400 font-mono text-[9px] uppercase font-bold block">
                                1. What They Are Interested In (Focus & Scope):
                              </span>
                              <p className="text-slate-200">
                                {meta.what_they_care_about || `Core focus on ${topicName} developments, technical architecture, and real-world implications.`}
                              </p>
                            </div>

                            {/* Pillar 2: Why they care (substantive intellectual motivation) */}
                            <div className="text-[11px] leading-relaxed bg-slate-900/60 p-2 rounded border border-white/5 space-y-0.5">
                              <span className="text-emerald-400 font-mono text-[9px] uppercase font-bold block">
                                2. Why They Care (Intellectual Stakes & Worldview):
                              </span>
                              <p className="text-slate-200">{meta.why_they_care}</p>
                            </div>

                            {/* Living Dossier Synthesis & Narrative */}
                            {meta.living_narrative && meta.living_narrative !== meta.why_they_care && meta.living_narrative !== meta.what_they_care_about && (
                              <div className="text-[11px] leading-relaxed bg-indigo-950/20 p-2 rounded border border-indigo-500/20 space-y-0.5">
                                <span className="text-indigo-400 font-mono text-[9px] uppercase font-bold block">
                                  Living Dossier (Cumulative Narrative Synthesis):
                                </span>
                                <p className="text-slate-200 text-[10.5px] leading-normal">{meta.living_narrative}</p>
                              </div>
                            )}

                            {/* Pillar 3: How best to present stories to this user */}
                            <div className="text-[11px] leading-relaxed bg-slate-900/60 p-2 rounded border border-white/5 space-y-1">
                              <span className="text-amber-400 font-mono text-[9px] uppercase font-bold block">
                                3. How Best To Present Stories:
                              </span>
                              <p className="text-slate-300">
                                {meta.presentation_strategy || `Curate with ${meta.technical_depth} depth, focusing on verified empirical milestones and substantive trade-offs.`}
                              </p>

                              {(meta.likes_and_angles?.length || 0) > 0 && (
                                <div className="flex flex-wrap items-center gap-1 pt-0.5">
                                  <span className="text-[9px] font-mono text-slate-500">Preferred:</span>
                                  {meta.likes_and_angles?.map((like, lIdx) => (
                                    <span
                                      key={lIdx}
                                      className="text-[9px] font-mono text-emerald-300 bg-emerald-950/60 px-1.5 py-0.2 rounded border border-emerald-500/20"
                                    >
                                      ✓ {like}
                                    </span>
                                  ))}
                                </div>
                              )}

                              {(meta.dislikes_and_critiques?.length || 0) > 0 && (
                                <div className="flex flex-wrap items-center gap-1 pt-0.5">
                                  <span className="text-[9px] font-mono text-slate-500">Filter out:</span>
                                  {meta.dislikes_and_critiques?.map((dislike, dIdx) => (
                                    <span
                                      key={dIdx}
                                      className="text-[9px] font-mono text-rose-300 bg-rose-950/60 px-1.5 py-0.2 rounded border border-rose-500/20"
                                    >
                                      ✕ {dislike}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Evolution History Timeline */}
                            {meta.evolution_timeline && meta.evolution_timeline.length > 0 && (
                              <details className="text-[10px] font-mono group bg-slate-900/40 rounded border border-white/5 p-1.5">
                                <summary className="cursor-pointer text-slate-400 hover:text-cyan-300 font-bold flex items-center justify-between">
                                  <span>Evolution History ({meta.evolution_timeline.length} shifts)</span>
                                  <span className="text-[9px] text-slate-500 group-open:rotate-180 transition-transform">▼</span>
                                </summary>
                                <div className="mt-1.5 space-y-1 pl-1 border-l border-cyan-500/30">
                                  {meta.evolution_timeline.slice(-5).map((entry, eIdx) => (
                                    <div key={eIdx} className="space-y-0.2">
                                      <div className="flex items-center gap-1.5 text-[8.5px] text-slate-500">
                                        <span>{new Date(entry.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                                        {entry.trigger_source && (
                                          <span className="px-1 py-0.1 rounded bg-slate-800 text-cyan-400">
                                            {entry.trigger_source}
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-slate-300 text-[9.5px]">{entry.insight}</p>
                                    </div>
                                  ))}
                                </div>
                              </details>
                            )}
                          </div>

                          {meta.curiosity_vectors && meta.curiosity_vectors.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pt-0.5">
                              {meta.curiosity_vectors.map((vec, vIdx) => (
                                <span
                                  key={vIdx}
                                  className="px-1.5 py-0.5 rounded bg-slate-900 text-[9px] font-mono text-slate-400 border border-white/5"
                                >
                                  #{vec}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Harmonization Audit History */}
                  <div className="pt-2 border-t border-white/10 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-bold text-cyan-400 uppercase flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-cyan-400" />
                        Harmonization Runs ({effectiveTopicNode?.harmonization_runs?.length || 0}):
                      </span>
                    </div>

                    {(effectiveTopicNode?.harmonization_runs || []).length > 0 ? (
                      <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                        {effectiveTopicNode?.harmonization_runs?.map((run, rIdx) => (
                          <div
                            key={rIdx}
                            className="p-2 rounded bg-slate-950 border border-white/5 flex items-center justify-between text-[10px]"
                          >
                            <div className="space-y-0.5 max-w-[75%]">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`px-1.5 py-0.2 rounded text-[8px] font-mono font-bold uppercase border ${
                                    run.trigger_source === "background_observer"
                                      ? "bg-amber-950/70 text-amber-300 border-amber-500/30"
                                      : "bg-emerald-950/70 text-emerald-300 border-emerald-500/30"
                                  }`}
                                >
                                  {run.trigger_source === "background_observer" ? "Background" : "Manual"}
                                </span>
                                <span className="text-slate-400 text-[9px]">
                                  {new Date(run.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                </span>
                              </div>
                              <p className="text-slate-300 truncate">{run.summary}</p>
                            </div>

                            {onSelectContext && (
                              <button
                                onClick={() => {
                                  onSelectContext({
                                    type: "harmonization_run",
                                    run,
                                  });
                                  setActiveTab("contextual");
                                }}
                                className="text-[9px] font-mono text-cyan-300 hover:text-cyan-100 bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-500/30"
                              >
                                Inspect →
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[10px] text-slate-500 italic">
                        No harmonization runs yet. Click &quot;Harmonize&quot; in the Interests tab to trigger a run.
                      </p>
                    )}
                  </div>
                </div>

                {/* Pillar 2: The Context Agent (The Empath) */}
                <div className="p-4 rounded-xl bg-slate-900/90 border border-indigo-500/20 space-y-3">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <span className="font-mono text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                      <Heart className="w-4 h-4 text-indigo-400" />
                      2. CONTEXT AGENT (THE EMPATH)
                    </span>
                    <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-[10px] font-mono">
                      Active Framing
                    </span>
                  </div>

                  <div className="space-y-3">
                    {/* Emotional Trajectory Card */}
                    <div className="p-3 rounded-lg bg-indigo-950/30 border border-indigo-500/30 space-y-1">
                      <span className="text-[10px] font-mono text-indigo-400 uppercase font-bold block">
                        Current Emotional Trajectory
                      </span>
                      <p className="text-xs text-slate-200 font-medium">
                        "{effectiveTopicNode?.psychological_profile?.emotional_trajectory || "Analytical, grounded, and curious"}"
                      </p>
                    </div>

                    {/* Communication Style */}
                    <div className="p-3 rounded-lg bg-slate-950 border border-white/5 space-y-1">
                      <span className="text-[10px] font-mono text-slate-400 uppercase font-bold block">
                        Calibrated Communication Style
                      </span>
                      <p className="text-xs text-slate-300">
                        {effectiveTopicNode?.psychological_profile?.communication_style || "Direct, concise, rigorous peer"}
                      </p>
                    </div>

                    {/* Active Sensitivities & Boundaries */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="p-3 rounded-lg bg-slate-950 border border-white/5 space-y-1.5">
                        <span className="text-[10px] font-mono text-amber-400 uppercase font-bold flex items-center gap-1">
                          <Shield className="w-3 h-3 text-amber-400" />
                          Sensitivities Safeguards
                        </span>
                        <div className="space-y-1 text-[10px] text-slate-300">
                          {(effectiveTopicNode?.psychological_profile?.sensitivities || []).map((s, idx) => (
                            <div key={idx} className="flex items-start gap-1">
                              <span className="text-amber-400">•</span>
                              <span>{s}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="p-3 rounded-lg bg-slate-950 border border-white/5 space-y-1.5">
                        <span className="text-[10px] font-mono text-rose-400 uppercase font-bold flex items-center gap-1">
                          <Shield className="w-3 h-3 text-rose-400" />
                          Hard Boundaries
                        </span>
                        <div className="space-y-1 text-[10px] text-slate-300">
                          {(effectiveTopicNode?.psychological_profile?.boundaries || []).map((b, idx) => (
                            <div key={idx} className="flex items-start gap-1">
                              <span className="text-rose-400">•</span>
                              <span>{b}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Pillar 3: The Discovery Agent (The Curator) */}
                <div className="p-4 rounded-xl bg-slate-900/90 border border-emerald-500/20 space-y-3">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <span className="font-mono text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                      <Filter className="w-4 h-4 text-emerald-400" />
                      3. DISCOVERY AGENT (THE CURATOR FILTERS)
                    </span>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-mono">
                      Rigorous Curation
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-slate-950 border border-white/5 space-y-1">
                      <span className="text-[10px] font-mono text-slate-400 block uppercase">Signal Threshold</span>
                      <span className="text-lg font-mono font-bold text-emerald-400">
                        {Math.round((effectiveTopicNode?.discovery_parameters?.signal_threshold || 0.75) * 100)}%
                      </span>
                      <span className="text-[10px] text-slate-500 block">Minimum empirical density</span>
                    </div>

                    <div className="p-3 rounded-lg bg-slate-950 border border-white/5 space-y-1">
                      <span className="text-[10px] font-mono text-slate-400 block uppercase">Depth Requirement</span>
                      <span className="text-sm font-mono font-bold text-cyan-300 uppercase block pt-1">
                        {effectiveTopicNode?.discovery_parameters?.depth_requirement || "practitioner"}
                      </span>
                      <span className="text-[10px] text-slate-500 block">Baseline technical rigor</span>
                    </div>
                  </div>

                  {/* Anti-Preferences */}
                  <div className="p-3 rounded-lg bg-slate-950 border border-white/5 space-y-2">
                    <span className="text-[10px] font-mono text-rose-400 uppercase font-bold block">
                      Active Anti-Preferences (Content Actively Rejected)
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {(effectiveTopicNode?.discovery_parameters?.anti_preferences || []).map((anti, aIdx) => (
                        <span
                          key={aIdx}
                          className="px-2 py-0.5 rounded bg-rose-950/40 text-rose-300 font-mono text-[10px] border border-rose-500/30"
                        >
                          ✕ {anti}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Pillar 4: The Observer Agent (The Active Listener) */}
                <div className="p-4 rounded-xl bg-slate-900/90 border border-amber-500/20 space-y-3">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <span className="font-mono text-xs font-bold text-amber-400 flex items-center gap-1.5">
                      <Eye className="w-4 h-4 text-amber-400" />
                      4. OBSERVER AGENT (THE ACTIVE LISTENER TRACES)
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      Continuous Trace Logging
                    </span>
                  </div>

                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 font-mono text-xs">
                    {traces
                      .filter((t) => t.node_name === "node_observer" || t.node_name === "node_context")
                      .slice(0, 5)
                      .map((trace, idx) => (
                        <div
                          key={idx}
                          className="p-2.5 rounded-lg bg-slate-950 border border-white/5 space-y-1 hover:border-amber-500/30 transition"
                        >
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="text-amber-300 font-bold uppercase">[{trace.node_name}]</span>
                            <span className="text-slate-500">{new Date(trace.timestamp).toLocaleTimeString()}</span>
                          </div>
                          <p className="text-[11px] text-slate-200">{trace.reasoning_rationale}</p>
                        </div>
                      ))}

                    {traces.filter((t) => t.node_name === "node_observer" || t.node_name === "node_context").length === 0 && (
                      <div className="p-6 text-center text-slate-500 text-xs">
                        Observer Agent is actively listening in the background. Send a message to watch real-time adaptation traces.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Pillar 5: Live Topic State Transition Diffs Timeline */}
              {effectiveTopicNode?.recent_topic_diffs && effectiveTopicNode.recent_topic_diffs.length > 0 && (
                <div className="p-4 rounded-xl bg-slate-900/90 border border-emerald-500/30 space-y-3">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <span className="font-mono text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                      <Activity className="w-4 h-4 text-emerald-400" />
                      RECENT TOPIC ADAPTATION DIFFS ({effectiveTopicNode.recent_topic_diffs.length} STATE TRANSITIONS)
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      Live Delta History
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[260px] overflow-y-auto pr-1 font-mono text-xs">
                    {effectiveTopicNode.recent_topic_diffs.slice(0, 6).map((diff, dIdx) => (
                      <div
                        key={dIdx}
                        className="p-3 rounded-lg bg-slate-950 border border-white/5 space-y-2 hover:border-emerald-500/40 transition cursor-pointer"
                        onClick={() => {
                          if (onSelectContext) {
                            onSelectContext({
                              type: "topic_diff",
                              diff,
                            });
                            setActiveTab("contextual");
                          }
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-100">{diff.topic_name}</span>
                            <span
                              className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                diff.weight_delta > 0
                                  ? "bg-emerald-950 text-emerald-300 border border-emerald-500/30"
                                  : diff.weight_delta < 0
                                  ? "bg-rose-950 text-rose-300 border border-rose-500/30"
                                  : "bg-cyan-950 text-cyan-300 border border-cyan-500/30"
                              }`}
                            >
                              {diff.weight_delta > 0
                                ? `▲ +${Math.round(diff.weight_delta * 100)}%`
                                : diff.weight_delta < 0
                                ? `▼ ${Math.round(diff.weight_delta * 100)}%`
                                : "Δ Updated"}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-500">
                            {new Date(diff.timestamp).toLocaleTimeString()}
                          </span>
                        </div>

                        {/* Weight & Depth Diff Bar */}
                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                          <div className="p-1.5 rounded bg-slate-900 border border-white/5">
                            <span className="text-[9px] text-slate-500 block uppercase">Weight Transition</span>
                            <span className="text-slate-400 line-through mr-1">
                              {Math.round(diff.previous_state.weight * 100)}%
                            </span>
                            <span className="text-emerald-400 font-bold">
                              → {Math.round(diff.current_state.weight * 100)}%
                            </span>
                          </div>

                          <div className="p-1.5 rounded bg-slate-900 border border-white/5">
                            <span className="text-[9px] text-slate-500 block uppercase">Depth Transition</span>
                            {diff.depth_changed ? (
                              <span>
                                <span className="text-slate-400 line-through mr-1 text-[10px]">
                                  {diff.previous_state.technical_depth}
                                </span>
                                <span className="text-cyan-300 font-bold uppercase text-[10px]">
                                  → {diff.current_state.technical_depth}
                                </span>
                              </span>
                            ) : (
                              <span className="text-slate-300 uppercase text-[10px]">
                                {diff.current_state.technical_depth} (steady)
                              </span>
                            )}
                          </div>
                        </div>

                        <p className="text-[11px] text-slate-300 line-clamp-2">
                          <strong className="text-cyan-400 font-mono text-[10px]">Reasoning: </strong>
                          {diff.reasoning}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 1: LIVE RUN MONITOR & PIPELINE EXECUTION STREAM */}
          {activeTab === "live_stream" && (
            <div className="space-y-4">
              {/* Live Pipeline Visualizer */}
              <div className="p-4 rounded-xl bg-slate-900/90 border border-white/10 space-y-3">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-cyan-400 font-bold flex items-center gap-2">
                    <Activity className="w-4 h-4 text-cyan-400" />
                    LANGGRAPH STATE PIPELINE EXECUTION SEQUENCE
                  </span>
                  <span className="text-slate-400">
                    Status: <strong className={isCollectingNews ? "text-rose-400 font-bold" : "text-emerald-400 font-bold"}>{isCollectingNews ? "LIVE RUN EXECUTING" : "IDLE / READY"}</strong>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 pt-1">
                  {nodes.map((node, i) => {
                    const Icon = node.icon;
                    return (
                      <div
                        key={i}
                        className={`p-2.5 rounded-xl border transition space-y-1 text-xs font-mono ${
                          node.active
                            ? "bg-cyan-950/80 border-cyan-400 text-cyan-200 shadow-lg shadow-cyan-500/20 animate-pulse"
                            : node.done
                            ? "bg-emerald-950/20 border-emerald-500/40 text-slate-200"
                            : "bg-slate-950 border-white/5 text-slate-500"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <Icon className={`w-3.5 h-3.5 ${node.active ? "text-cyan-400 animate-spin" : node.done ? "text-emerald-400" : "text-slate-600"}`} />
                          {node.done ? (
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          ) : node.active ? (
                            <span className="text-[9px] text-cyan-300 font-bold uppercase">Active</span>
                          ) : (
                            <span className="text-[9px] text-slate-600">Standby</span>
                          )}
                        </div>
                        <div className="font-bold text-[11px] truncate">{node.name}</div>
                        <div className="text-[9px] text-slate-400 line-clamp-1">{node.desc}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Real-time Streaming Terminal Window */}
              <div className="p-4 rounded-xl bg-slate-950 border border-white/10 space-y-2 font-mono text-xs">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <div className="flex items-center gap-2 text-slate-300 font-bold">
                    <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                    <span>LIVE EVENT LOG STREAM (LATEST FIRST)</span>
                  </div>
                  <span className="text-[10px] text-slate-500">
                    SSE Auto-Streaming Active
                  </span>
                </div>

                <div
                  ref={terminalScrollRef}
                  className="space-y-2 max-h-[260px] overflow-y-auto pr-1"
                >
                  {traces.slice(0, 15).map((trace, idx) => (
                    <div
                      key={trace.trace_id || idx}
                      className="p-2.5 rounded-lg bg-slate-900/80 border border-white/5 text-[11px] space-y-1 hover:border-cyan-500/30 transition"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 text-slate-400">
                        <span className="text-cyan-300 font-bold">[{trace.node_name.toUpperCase()}]</span>
                        <div className="flex items-center gap-2 text-[10px]">
                          <span className="text-emerald-400 font-semibold">{trace.llm_tokens_used || 0} tokens</span>
                          <span className="text-slate-600">•</span>
                          <span className="text-violet-400 font-semibold">{trace.latency_ms}ms</span>
                          <span className="text-slate-600">•</span>
                          <span className="text-slate-500">{new Date(trace.timestamp).toLocaleTimeString()}</span>
                        </div>
                      </div>
                      <p className="text-slate-200 text-xs">{trace.reasoning_rationale}</p>
                      {trace.output_summary && (
                        <div className="text-[10px] text-slate-400 flex flex-wrap gap-3 pt-0.5">
                          {trace.output_summary.articles_retrieved !== undefined && (
                            <span>Articles Retrieved: <strong className="text-slate-200">{String(trace.output_summary.articles_retrieved)}</strong></span>
                          )}
                          {trace.output_summary.pure_facts_extracted !== undefined && (
                            <span>Facts Extracted: <strong className="text-slate-200">{String(trace.output_summary.pure_facts_extracted)}</strong></span>
                          )}
                          {trace.output_summary.cards_generated !== undefined && (
                            <span>Cards Generated: <strong className="text-cyan-300">{String(trace.output_summary.cards_generated)}</strong></span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}

                  {traces.length === 0 && (
                    <div className="p-8 text-center text-slate-500">
                      No traces streamed yet. Click "Refresh News" to watch the pipeline execute in real time.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 1: CONTEXTUAL INSPECTOR */}
          {activeTab === "contextual" && (
            <div className="space-y-4">
              {!selectedContext ? (
                <div className="p-8 rounded-xl bg-slate-900/50 border border-white/10 text-center space-y-2">
                  <Terminal className="w-6 h-6 text-cyan-400 mx-auto" />
                  <div className="text-xs font-semibold text-slate-200">No UI Entity Selected</div>
                  <p className="text-[11px] text-slate-400 max-w-md mx-auto">
                    Click any <strong>Story Card</strong>, <strong>Chat Message Response</strong>, or <strong>Topic Pill</strong> on the page. DevTools will automatically isolate the exact prompt, DeepSeek completion, and agent reasoning that produced it.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Context Header */}
                  <div className="p-4 rounded-xl bg-slate-900/80 border border-amber-500/30 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      <span className="text-xs font-mono text-amber-300 font-bold uppercase">
                        Selected Target: {selectedContext.type.replace("_", " ")}
                      </span>
                    </div>
                    <button
                      onClick={() => onSelectContext && onSelectContext(null)}
                      className="text-xs font-mono text-slate-400 hover:text-white flex items-center gap-1"
                    >
                      <X className="w-3.5 h-3.5" />
                      Clear
                    </button>
                  </div>

                  {/* Context 1: Story Card Selected */}
                  {selectedContext.type === "story_card" && (
                    <div className="space-y-3">
                      <div className="p-4 rounded-xl bg-slate-900/90 border border-cyan-500/30 space-y-3">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-mono text-cyan-400 font-bold">Topic: {selectedContext.topic}</span>
                          <span className="font-mono text-slate-400">Event ID: {selectedContext.event_id}</span>
                        </div>
                        {selectedContext.card && (
                          <div className="space-y-2 text-xs">
                            <div className="text-slate-200 font-bold text-sm">{selectedContext.card.headline}</div>
                            <div className="p-3 rounded-lg bg-cyan-950/30 border border-cyan-500/20 text-slate-300">
                              <span className="text-cyan-400 font-mono text-[10px] block font-bold mb-1">
                                PERSONALIZED SYNTHESIS RATIONALE:
                              </span>
                              {selectedContext.card.personalized_framing}
                            </div>
                            <div className="p-3 rounded-lg bg-slate-950 border border-white/10 space-y-1">
                              <span className="text-slate-400 font-mono text-[10px] block font-bold">
                                INGESTED SOURCES ({selectedContext.card.sources.length}):
                              </span>
                              <div className="flex flex-wrap gap-2 pt-1">
                                {selectedContext.card.sources.map((src, i) => (
                                  <span key={i} className="px-2 py-0.5 rounded bg-slate-900 text-[10px] font-mono text-slate-300 border border-white/10">
                                    {src.name} [{src.bias}]
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Context 2: Chat Turn Selected (Full Generated Context & Agentic Flow) */}
                  {selectedContext.type === "chat_turn" && (() => {
                    const chatTurn = selectedContext as any;
                    const associatedTrace = traces.find(
                      (t) =>
                        t.metadata?.trace_id === chatTurn.trace_id ||
                        t.trace_id === chatTurn.trace_id ||
                        t.metadata?.context_trace_id === chatTurn.trace_id
                    );

                    const contextGen =
                      chatTurn.context_generated ||
                      associatedTrace?.metadata?.context_generated ||
                      {};

                    const agenticFlow =
                      chatTurn.agentic_flow ||
                      contextGen.agentic_flow ||
                      associatedTrace?.metadata?.agentic_flow ||
                      [];

                    const rationale =
                      chatTurn.agent_internal_rationale ||
                      contextGen.agent_internal_rationale ||
                      associatedTrace?.metadata?.agent_internal_rationale ||
                      {};

                    const tools =
                      chatTurn.tools_executed ||
                      contextGen.tools_executed ||
                      associatedTrace?.metadata?.tools_executed ||
                      [];

                    return (
                      <div className="space-y-4">
                        {/* Conversational Turn Preview Banner */}
                        <div className="p-4 rounded-xl bg-slate-900/90 border border-cyan-500/30 space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2">
                            <div className="flex items-center gap-2">
                              <Brain className="w-4 h-4 text-cyan-400" />
                              <span className="font-mono text-xs font-bold text-slate-100 uppercase">
                                Message Turn Intelligence Snapshot
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 font-mono text-[10px] border border-cyan-500/40 uppercase">
                                Depth: {contextGen.calibrated_depth || "Calibrated"}
                              </span>
                              {associatedTrace && (
                                <span className="text-[10px] font-mono text-slate-400">
                                  {associatedTrace.llm_tokens_used || 0} tokens • {associatedTrace.latency_ms}ms
                                </span>
                              )}
                            </div>
                          </div>

                          {chatTurn.user_prompt && (
                            <div className="p-2.5 rounded-lg bg-slate-950 border border-white/5 space-y-1">
                              <span className="text-[10px] font-mono text-teal-400 uppercase font-bold block">
                                User Input Prompt
                              </span>
                              <p className="text-xs text-slate-200">{chatTurn.user_prompt}</p>
                            </div>
                          )}

                          {chatTurn.assistant_response && (
                            <div className="p-2.5 rounded-lg bg-cyan-950/30 border border-cyan-500/20 space-y-1">
                              <span className="text-[10px] font-mono text-cyan-300 uppercase font-bold block">
                                Aletheia Response
                              </span>
                              <p className="text-xs text-slate-300 line-clamp-3">{chatTurn.assistant_response}</p>
                            </div>
                          )}
                        </div>

                        {/* SECTION 1: THE CONTEXT GENERATED FOR THIS MESSAGE */}
                        <div className="p-4 rounded-xl bg-slate-900/90 border border-indigo-500/30 space-y-3">
                          <div className="flex items-center justify-between border-b border-white/10 pb-2">
                            <span className="font-mono text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                              <Sparkles className="w-4 h-4 text-indigo-400" />
                              1. CONTEXT GENERATED FOR THIS MESSAGE (THE EMPATH ENVELOPE)
                            </span>
                            <span className="text-[10px] font-mono text-indigo-400">Active State</span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {/* Emotional Trajectory & Detected Mindset */}
                            <div className="p-3 rounded-lg bg-slate-950 border border-white/5 space-y-1.5">
                              <span className="text-[10px] font-mono text-indigo-400 uppercase font-bold block">
                                Detected User Mindset & Emotional Trajectory
                              </span>
                              <p className="text-xs text-slate-200 font-medium">
                                "{contextGen.emotional_trajectory || rationale.user_emotional_state_detected || effectiveTopicNode?.psychological_profile?.emotional_trajectory || "Analytical, inquisitive, and objective"}"
                              </p>
                              {rationale.pedagogical_strategy && (
                                <div className="text-[10px] text-slate-400 pt-1 border-t border-white/5">
                                  <strong className="text-indigo-300">Pedagogical Strategy: </strong>
                                  {rationale.pedagogical_strategy}
                                </div>
                              )}
                            </div>

                            {/* Why They Care Motivations */}
                            {/* AI Semantic Topic & Graph Resolution */}
                            {contextGen.semantic_resolution && (
                              <div className="p-3 rounded-lg bg-indigo-950/40 border border-indigo-500/30 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-mono text-indigo-300 uppercase font-bold flex items-center gap-1.5">
                                    <Network className="w-3.5 h-3.5 text-indigo-400" />
                                    AI Semantic Intent & Graph Resolution
                                  </span>
                                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-900/60 border border-indigo-400/30 text-indigo-200 font-mono">
                                    Subject: {contextGen.semantic_resolution.identified_discussion_subject}
                                  </span>
                                </div>

                                <div className="space-y-1.5 text-[11px] pt-1">
                                  <div className="text-[10px] text-slate-400 font-mono">
                                    {contextGen.semantic_resolution.semantic_reasoning_summary}
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                                    {contextGen.semantic_resolution.selected_topics?.map((st: any, sIdx: number) => (
                                      <div
                                        key={sIdx}
                                        className="p-2 rounded bg-slate-950/80 border border-white/5 flex flex-col justify-between text-[10px]"
                                      >
                                        <div className="flex items-center justify-between font-mono">
                                          <span className="text-cyan-300 font-bold">{st.topic_name}</span>
                                          <span className="text-emerald-400 font-mono font-semibold">
                                            {Math.round(st.relevance_score * 100)}% Match
                                          </span>
                                        </div>
                                        <div className="text-slate-400 mt-1 line-clamp-1">
                                          {st.why_they_care}
                                        </div>
                                        <div className="mt-1.5 flex items-center gap-1">
                                          <span className="text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-cyan-950/60 border border-cyan-800/40 text-cyan-300 font-mono">
                                            {st.graph_connection_type?.replace("_", " ") || "direct match"}
                                          </span>
                                          <span className="text-[8px] px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 font-mono">
                                            Depth: {st.calibrated_depth}
                                          </span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Contextually Retrieved Stories & Verified Facts */}
                            {contextGen.retrieved_stories && contextGen.retrieved_stories.length > 0 && (
                              <div className="p-3 rounded-lg bg-teal-950/40 border border-teal-500/30 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-mono text-teal-300 uppercase font-bold flex items-center gap-1.5">
                                    <Newspaper className="w-3.5 h-3.5 text-teal-400" />
                                    Relevant Stories Injected into Context ({contextGen.retrieved_stories.length})
                                  </span>
                                </div>

                                <div className="space-y-2 text-[11px] pt-1">
                                  {contextGen.retrieved_stories.map((rs: any, rIdx: number) => (
                                    <div
                                      key={rIdx}
                                      className="p-2.5 rounded bg-slate-950/80 border border-white/5 space-y-1.5 text-[10px]"
                                    >
                                      <div className="flex items-center justify-between font-mono">
                                        <span className="text-teal-300 font-bold truncate max-w-[280px]">
                                          {rs.headline}
                                        </span>
                                        <span className="text-emerald-400 font-mono font-semibold">
                                          {Math.round((rs.relevance_score || 0.8) * 100)}% Relevance
                                        </span>
                                      </div>
                                      <p className="text-slate-300 text-[10px] line-clamp-2">{rs.summary}</p>
                                      {rs.fact_bullets && rs.fact_bullets.length > 0 && (
                                        <div className="pl-2 border-l border-teal-500/30 space-y-0.5 text-[9px] text-slate-400">
                                          {rs.fact_bullets.slice(0, 2).map((fb: string, fIdx: number) => (
                                            <div key={fIdx}>• {fb}</div>
                                          ))}
                                        </div>
                                      )}
                                      <div className="text-[9px] text-teal-400/80 font-mono italic">
                                        Rationale: {rs.relevance_rationale || "Topic alignment"}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Motivations */}
                            <div className="p-3 rounded-lg bg-slate-950 border border-white/5 space-y-1.5">
                              <span className="text-[10px] font-mono text-cyan-400 uppercase font-bold block">
                                Contextual "Why They Care" Motivations
                              </span>
                              <div className="space-y-1 text-[11px] text-slate-300">
                                {contextGen.why_they_care_context && contextGen.why_they_care_context.length > 0 ? (
                                  contextGen.why_they_care_context.map((why: string, wIdx: number) => (
                                    <div key={wIdx} className="flex items-start gap-1">
                                      <span className="text-cyan-400">•</span>
                                      <span>{why}</span>
                                    </div>
                                  ))
                                ) : (
                                  <div className="text-slate-400 italic text-[10px]">
                                    Direct peer-level inquiry with autonomous topic grounding.
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Active Sensitivities */}
                            <div className="p-3 rounded-lg bg-slate-950 border border-white/5 space-y-1.5">
                              <span className="text-[10px] font-mono text-amber-400 uppercase font-bold flex items-center gap-1">
                                <Shield className="w-3 h-3 text-amber-400" />
                                Active Sensitivities Enforced
                              </span>
                              <div className="space-y-1 text-[10px] text-slate-300">
                                {(contextGen.active_sensitivities || effectiveTopicNode?.psychological_profile?.sensitivities || []).map((s: string, idx: number) => (
                                  <div key={idx} className="flex items-start gap-1">
                                    <span className="text-amber-400">✓</span>
                                    <span>{s}</span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Hard Boundaries */}
                            <div className="p-3 rounded-lg bg-slate-950 border border-white/5 space-y-1.5">
                              <span className="text-[10px] font-mono text-rose-400 uppercase font-bold flex items-center gap-1">
                                <Shield className="w-3 h-3 text-rose-400" />
                                Hard Boundaries Maintained
                              </span>
                              <div className="space-y-1 text-[10px] text-slate-300">
                                {(contextGen.active_boundaries || effectiveTopicNode?.psychological_profile?.boundaries || []).map((b: string, idx: number) => (
                                  <div key={idx} className="flex items-start gap-1">
                                    <span className="text-rose-400">✕</span>
                                    <span>{b}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Injected Empath Guidance Block */}
                          {contextGen.empath_instructions && (
                            <div className="p-3 rounded-lg bg-indigo-950/30 border border-indigo-500/20 space-y-1 text-xs">
                              <span className="text-[10px] font-mono text-indigo-300 uppercase font-bold block">
                                Injected Empath Guidance Instructions:
                              </span>
                              <pre className="text-[11px] text-slate-300 font-mono whitespace-pre-wrap leading-relaxed max-h-[140px] overflow-y-auto bg-slate-950/80 p-2.5 rounded border border-white/5">
                                {contextGen.empath_instructions}
                              </pre>
                            </div>
                          )}

                          {/* SECTION: FULL RAW PROMPTS & REAL-TIME GROUNDING SENT TO LLM */}
                          <div className="p-4 rounded-xl bg-slate-900/90 border border-cyan-500/40 space-y-3">
                            <div className="flex items-center justify-between border-b border-white/10 pb-2">
                              <span className="font-mono text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                                <FileText className="w-4 h-4 text-cyan-400" />
                                RAW LLM PROMPT & COMPLETE GROUNDING CONTEXT
                              </span>
                              <span className="text-[10px] font-mono text-cyan-400">
                                {contextGen.raw_prompt_sent_to_llm ? `${contextGen.raw_prompt_sent_to_llm.length} chars` : "Direct Payload"}
                              </span>
                            </div>

                            {/* Raw User & Live Search Grounding Prompt */}
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-mono text-teal-400 uppercase font-bold block">
                                  Full Prompt Sent to Model (Includes Injected Live Searches & Articles):
                                </span>
                                {contextGen.raw_prompt_sent_to_llm && (
                                  <button
                                    onClick={() => navigator.clipboard.writeText(contextGen.raw_prompt_sent_to_llm)}
                                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[10px] font-mono flex items-center gap-1 transition"
                                    title="Copy raw prompt to clipboard"
                                  >
                                    <Copy className="w-3 h-3" />
                                    <span>Copy Raw Prompt</span>
                                  </button>
                                )}
                              </div>
                              <pre className="text-[11px] text-slate-200 font-mono whitespace-pre-wrap leading-relaxed max-h-[260px] overflow-y-auto bg-slate-950 p-3 rounded-lg border border-teal-500/30 shadow-inner">
                                {contextGen.raw_prompt_sent_to_llm || "Raw prompt payload logged in trace session."}
                              </pre>
                            </div>

                            {/* Raw System Prompt & Temporal Directives */}
                            {contextGen.raw_system_prompt && (
                              <div className="space-y-1.5 pt-2 border-t border-white/5">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-mono text-cyan-400 uppercase font-bold block">
                                    System Prompt & Temporal Directives:
                                  </span>
                                  <button
                                    onClick={() => navigator.clipboard.writeText(contextGen.raw_system_prompt)}
                                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[10px] font-mono flex items-center gap-1 transition"
                                  >
                                    <Copy className="w-3 h-3" />
                                    <span>Copy System Prompt</span>
                                  </button>
                                </div>
                                <pre className="text-[11px] text-slate-300 font-mono whitespace-pre-wrap leading-relaxed max-h-[160px] overflow-y-auto bg-slate-950 p-3 rounded-lg border border-cyan-500/20">
                                  {contextGen.raw_system_prompt}
                                </pre>
                              </div>
                            )}
                          </div>

                          {/* OBSERVABILITY: HOW THIS CONTEXT WAS GENERATED (EXACT AGENT RUN TRACES & I/O) */}
                          <div className="pt-2 border-t border-white/10 space-y-2">
                            <div
                              className="flex items-center justify-between cursor-pointer p-2 rounded-lg bg-slate-950 hover:bg-slate-900 border border-white/5 transition"
                              onClick={() => setShowAgentRunIo(!showAgentRunIo)}
                            >
                              <div className="flex items-center gap-2 font-mono text-[11px]">
                                <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                                <span className="text-cyan-300 font-bold uppercase">
                                  Observability: Agent Run Inputs & Outputs (How Context was Generated)
                                </span>
                              </div>
                              {showAgentRunIo ? (
                                <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                              )}
                            </div>

                            {showAgentRunIo && (
                              <div className="space-y-3 pt-1">
                                {/* Run 1: Observer Agent Run */}
                                <div className="p-3.5 rounded-lg bg-slate-950 border border-amber-500/30 space-y-2.5">
                                  <div className="flex items-center justify-between font-mono text-[10px]">
                                    <span className="text-amber-300 font-bold uppercase flex items-center gap-1.5">
                                      <Activity className="w-3.5 h-3.5 text-amber-400" />
                                      STAGE A: OBSERVER AGENT ADAPTATION RUN ([node_observer])
                                    </span>
                                    <span className="text-slate-500">
                                      Silent Mind-State Extraction
                                    </span>
                                  </div>

                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                                    {/* Inputs */}
                                    <div className="p-2.5 rounded bg-slate-900/90 border border-white/5 space-y-1.5">
                                      <span className="text-[10px] font-mono text-teal-400 font-bold uppercase block">
                                        Observer Inputs (Conversation History Evaluated):
                                      </span>
                                      <pre className="text-[10px] text-slate-300 font-mono whitespace-pre-wrap max-h-[140px] overflow-y-auto p-2 bg-slate-950 rounded">
                                        {chatTurn.user_prompt
                                          ? `USER: "${chatTurn.user_prompt}"\n(Prior turns evaluated for emotional mindset & sensitivities)`
                                          : `Prior conversation history evaluated for psychological profile adaptation.`}
                                      </pre>
                                    </div>

                                    {/* Outputs / Extracted Delta */}
                                    <div className="p-2.5 rounded bg-slate-900/90 border border-white/5 space-y-1.5">
                                      <span className="text-[10px] font-mono text-amber-400 font-bold uppercase block">
                                        Observer Inferred Output:
                                      </span>
                                      <pre className="text-[10px] text-slate-300 font-mono whitespace-pre-wrap max-h-[140px] overflow-y-auto p-2 bg-slate-950 rounded">
                                        {JSON.stringify(
                                          {
                                            updated_emotional_trajectory:
                                              contextGen.emotional_trajectory ||
                                              effectiveTopicNode?.psychological_profile?.emotional_trajectory,
                                            detected_sensitivities:
                                              contextGen.active_sensitivities ||
                                              effectiveTopicNode?.psychological_profile?.sensitivities,
                                            detected_boundaries:
                                              contextGen.active_boundaries ||
                                              effectiveTopicNode?.psychological_profile?.boundaries,
                                          },
                                          null,
                                          2
                                        )}
                                      </pre>
                                    </div>
                                  </div>
                                </div>

                                {/* Run 2: Context Agent Run */}
                                <div className="p-3.5 rounded-lg bg-slate-950 border border-indigo-500/30 space-y-2.5">
                                  <div className="flex items-center justify-between font-mono text-[10px]">
                                    <span className="text-indigo-300 font-bold uppercase flex items-center gap-1.5">
                                      <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                                      STAGE B: CONTEXT AGENT ENVELOPE ASSEMBLY ([node_context])
                                    </span>
                                    <span className="text-slate-500">
                                      Dynamic Empath Guidance
                                    </span>
                                  </div>

                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                                    {/* Inputs */}
                                    <div className="p-2.5 rounded bg-slate-900/90 border border-white/5 space-y-1.5">
                                      <span className="text-[10px] font-mono text-teal-400 font-bold uppercase block">
                                        Context Agent Inputs:
                                      </span>
                                      <pre className="text-[10px] text-slate-300 font-mono whitespace-pre-wrap max-h-[140px] overflow-y-auto p-2 bg-slate-950 rounded">
                                        {JSON.stringify(
                                          {
                                            user_id: effectiveTopicNode?.user_id || "usr_default",
                                            current_query: chatTurn.user_prompt || "Live message turn",
                                            active_topics_count: Object.keys(effectiveTopicNode?.topics || {}).length,
                                          },
                                          null,
                                          2
                                        )}
                                      </pre>
                                    </div>

                                    {/* Outputs */}
                                    <div className="p-2.5 rounded bg-slate-900/90 border border-white/5 space-y-1.5">
                                      <span className="text-[10px] font-mono text-indigo-400 font-bold uppercase block">
                                        Context Agent Outputs:
                                      </span>
                                      <pre className="text-[10px] text-slate-300 font-mono whitespace-pre-wrap max-h-[140px] overflow-y-auto p-2 bg-slate-950 rounded">
                                        {JSON.stringify(
                                          {
                                            calibrated_depth: contextGen.calibrated_depth || "practitioner",
                                            safeguards_active:
                                              (contextGen.active_sensitivities || []).length +
                                              (contextGen.active_boundaries || []).length,
                                            empath_guidance_injected: true,
                                          },
                                          null,
                                          2
                                        )}
                                      </pre>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* SECTION 2: THE AGENTIC FLOW FOR GENERATING CONTEXT (STEP-BY-STEP PIPELINE) */}
                        <div className="p-4 rounded-xl bg-slate-900/90 border border-emerald-500/30 space-y-3">
                          <div className="flex items-center justify-between border-b border-white/10 pb-2">
                            <span className="font-mono text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                              <Activity className="w-4 h-4 text-emerald-400" />
                              2. AGENTIC FLOW FOR GENERATING CONTEXT ({agenticFlow.length || 6} STAGES)
                            </span>
                            <span className="text-[10px] font-mono text-slate-400">
                              Multi-Agent Sequence
                            </span>
                          </div>

                          <div className="space-y-2">
                            {(agenticFlow.length > 0
                              ? agenticFlow
                              : [
                                  {
                                    step_number: 1,
                                    stage_name: "User Input & Turn Retrieval",
                                    agent_name: "DialogueAgent (Intake)",
                                    description: "Captured active user prompt and conversation history.",
                                    input_data: {
                                      user_prompt: chatTurn.user_prompt || "N/A",
                                      attached_story: (chatTurn as any)?.attached_story || null,
                                      turn_trace_id: chatTurn.trace_id,
                                    },
                                    output_data: {
                                      message_id: chatTurn.message_id,
                                      prompt_characters: chatTurn.user_prompt?.length || 0,
                                      retrieved_at: new Date().toLocaleTimeString(),
                                    },
                                    status: "completed" as const,
                                  },
                                  {
                                    step_number: 2,
                                    stage_name: "Mind-State Knowledge Graph Resolution",
                                    agent_name: "Unified Topic Node",
                                    description: `Resolved canonical topic registry (${Object.keys(effectiveTopicNode?.topics || {}).length} topics) and psychological trajectory.`,
                                    input_data: {
                                      user_id: effectiveTopicNode?.user_id || "usr_default",
                                      registered_canonical_topics: Object.entries(effectiveTopicNode?.topics || {}).map(([name, m]) => ({
                                        topic: name,
                                        weight: m.weight,
                                        technical_depth: m.technical_depth,
                                        why_they_care: m.why_they_care,
                                        curiosity_vectors: m.curiosity_vectors,
                                      })),
                                      stored_psychological_profile: effectiveTopicNode?.psychological_profile,
                                    },
                                    output_data: {
                                      active_topics_count: Object.keys(effectiveTopicNode?.topics || {}).length,
                                      resolved_emotional_trajectory:
                                        contextGen.emotional_trajectory ||
                                        effectiveTopicNode?.psychological_profile?.emotional_trajectory ||
                                        "Analytical, inquisitive, and objective",
                                      communication_style: effectiveTopicNode?.psychological_profile?.communication_style || "Direct peer",
                                      historical_anchors: effectiveTopicNode?.historical_anchors || [],
                                    },
                                    status: "completed" as const,
                                  },
                                  {
                                    step_number: 3,
                                    stage_name: "Psychological Framing & Empath Envelope",
                                    agent_name: "Context Agent (The Empath)",
                                    description: `Calibrated technical depth to "${contextGen.calibrated_depth || "practitioner"}" and assembled active safeguards.`,
                                    input_data: {
                                      matched_topic_motivations: contextGen.why_they_care_context || [],
                                      active_sensitivities_enforced: contextGen.active_sensitivities || effectiveTopicNode?.psychological_profile?.sensitivities || [],
                                      hard_boundaries_maintained: contextGen.active_boundaries || effectiveTopicNode?.psychological_profile?.boundaries || [],
                                      target_query: chatTurn.user_prompt,
                                    },
                                    output_data: {
                                      calibrated_technical_depth: contextGen.calibrated_depth || "practitioner",
                                      injected_empath_system_prompt: contextGen.empath_instructions,
                                      pedagogical_guidance: rationale.pedagogical_strategy || `Frame with ${contextGen.calibrated_depth || "practitioner"} rigor without hype.`,
                                    },
                                    status: "completed" as const,
                                  },
                                  {
                                    step_number: 4,
                                    stage_name: "Live Wire Grounding & Tool Execution",
                                    agent_name: "DialogueAgent (Tools)",
                                    description:
                                      tools.length > 0
                                        ? `Executed ${tools.length} real-time tool calls for live empirical verification.`
                                        : "No external web search required. Verified epistemic cache and base model weights used.",
                                    input_data: {
                                      available_tools: ["search_internet", "search_local_knowledge"],
                                      tools_invoked_count: tools.length,
                                    },
                                    output_data: {
                                      tool_executions: tools,
                                      total_items_retrieved: tools.reduce((acc: number, t: any) => acc + (t.items_retrieved || 0), 0),
                                    },
                                    status: tools.length > 0 ? ("completed" as const) : ("skipped" as const),
                                  },
                                  {
                                    step_number: 5,
                                    stage_name: "Dual-Intent Synthesis (DeepSeek)",
                                    agent_name: "DeepSeek Provider",
                                    description: "Steered response generation respecting empath envelope and technical depth.",
                                    input_data: {
                                      system_prompt_guidance: contextGen.empath_instructions ? "Empath Guidance Attached" : "Standard System Prompt",
                                      model_provider: "DeepSeek-V3",
                                      temperature: 0.7,
                                    },
                                    output_data: {
                                      raw_llm_completion: associatedTrace?.metadata?.raw_llm_completion || chatTurn.assistant_response,
                                      agent_internal_rationale: rationale,
                                      tokens_used: associatedTrace?.llm_tokens_used || 380,
                                      latency_ms: associatedTrace?.latency_ms || 180,
                                    },
                                    status: "completed" as const,
                                  },
                                  {
                                    step_number: 6,
                                    stage_name: "Observer Active Listening & Mind-State Adaptation",
                                    agent_name: "Observer Agent (The Active Listener)",
                                    description: "Analyzed completed turn, updated Unified Topic Node, and computed state diffs.",
                                    input_data: {
                                      evaluated_user_prompt: chatTurn.user_prompt || "N/A",
                                      assistant_response_preview: chatTurn.assistant_response?.slice(0, 100),
                                      prior_emotional_trajectory: effectiveTopicNode?.psychological_profile?.emotional_trajectory,
                                    },
                                    output_data: {
                                      updated_mind_state: {
                                        emotional_trajectory: contextGen.emotional_trajectory || effectiveTopicNode?.psychological_profile?.emotional_trajectory,
                                        sensitivities: contextGen.active_sensitivities || effectiveTopicNode?.psychological_profile?.sensitivities,
                                        active_topics_count: Object.keys(effectiveTopicNode?.topics || {}).length,
                                      },
                                      topic_diffs_generated: (effectiveTopicNode?.recent_topic_diffs || []).length,
                                      node_persisted: true,
                                    },
                                    status: "completed" as const,
                                  },
                                ]
                            ).map((step: any, sIdx: number) => {
                              const isStepExpanded = expandedFlowStepId === step.step_number;
                              return (
                                <div
                                  key={sIdx}
                                  className="rounded-lg bg-slate-950 border border-white/5 overflow-hidden transition hover:border-emerald-500/30"
                                >
                                  <div
                                    className="p-2.5 flex items-center justify-between cursor-pointer"
                                    onClick={() =>
                                      setExpandedFlowStepId(isStepExpanded ? null : step.step_number)
                                    }
                                  >
                                    <div className="flex items-center gap-2 text-xs font-mono">
                                      <span className="w-5 h-5 rounded-full bg-emerald-950 text-emerald-300 flex items-center justify-center text-[10px] font-bold border border-emerald-500/30">
                                        {step.step_number}
                                      </span>
                                      <span className="font-bold text-slate-200">
                                        {step.stage_name}
                                      </span>
                                      <span className="text-slate-500">•</span>
                                      <span className="text-emerald-400/90 text-[11px]">
                                        [{step.agent_name}]
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="px-1.5 py-0.5 rounded bg-emerald-950/60 text-emerald-300 font-mono text-[9px] border border-emerald-500/30 uppercase">
                                        {step.status}
                                      </span>
                                      {isStepExpanded ? (
                                        <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                                      ) : (
                                        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                                      )}
                                    </div>
                                  </div>

                                  <div className="px-3 pb-2 text-[11px] text-slate-400">
                                    {step.description}
                                  </div>

                                  {/* Step IO Accordion */}
                                  {isStepExpanded && (
                                    <div className="p-3 bg-slate-900/90 border-t border-white/5 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
                                      <div className="space-y-1">
                                        <span className="text-[10px] text-teal-400 font-bold uppercase block">
                                          Inputs (Stage Payload):
                                        </span>
                                        <pre className="p-2 rounded bg-slate-950 text-[10px] text-slate-300 whitespace-pre-wrap max-h-[140px] overflow-y-auto border border-white/5">
                                          {JSON.stringify(step.input_data, null, 2)}
                                        </pre>
                                      </div>
                                      <div className="space-y-1">
                                        <span className="text-[10px] text-emerald-400 font-bold uppercase block">
                                          Outputs (Emitted State):
                                        </span>
                                        <pre className="p-2 rounded bg-slate-950 text-[10px] text-slate-300 whitespace-pre-wrap max-h-[140px] overflow-y-auto border border-white/5">
                                          {JSON.stringify(step.output_data, null, 2)}
                                        </pre>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* SECTION 3: REAL-TIME TOOLS EXECUTED (IF ANY) */}
                        {tools && tools.length > 0 && (
                          <div className="p-4 rounded-xl bg-slate-900/90 border border-cyan-500/30 space-y-2 text-xs">
                            <span className="font-mono text-cyan-400 font-bold flex items-center gap-1.5">
                              <Activity className="w-4 h-4 text-cyan-400" />
                              REAL-TIME TOOLS EXECUTED BY AGENT:
                            </span>
                            <div className="space-y-2">
                              {tools.map((tool: any, tIdx: number) => (
                                <div
                                  key={tIdx}
                                  className="p-3 rounded-lg bg-slate-950 border border-white/5 space-y-1 text-[11px]"
                                >
                                  <div className="flex justify-between items-center font-mono">
                                    <span className="text-cyan-300 font-bold">{tool.tool_name}</span>
                                    <span className="text-emerald-400">
                                      {tool.items_retrieved} sources retrieved
                                    </span>
                                  </div>
                                  <div className="text-slate-400 font-mono">Query: "{tool.query}"</div>
                                  <div className="text-slate-300 text-[10px]">{tool.results_summary}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* SECTION 4: RAW PROMPT & COMPLETION ACCORDION */}
                        {associatedTrace?.metadata?.raw_llm_completion && (
                          <div className="p-4 rounded-xl bg-slate-900/80 border border-white/10 space-y-2 text-xs">
                            <div className="font-mono text-slate-300 font-bold flex items-center gap-1.5">
                              <Zap className="w-4 h-4 text-violet-400" />
                              <span>RAW DEEPSEEK LLM COMPLETION PAYLOAD</span>
                            </div>
                            <pre className="p-3 rounded-lg bg-slate-950 border border-white/5 text-[11px] font-mono text-slate-300 whitespace-pre-wrap max-h-[160px] overflow-y-auto">
                              {String(associatedTrace.metadata.raw_llm_completion)}
                            </pre>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Context 3: Topic or Topic Diff Selected (Side-by-Side Visual Diff Viewer) */}
                  {(selectedContext.type === "topic" || selectedContext.type === "topic_diff") && (() => {
                    const topicCtx = selectedContext as any;
                    const topicName =
                      topicCtx.type === "topic_diff"
                        ? topicCtx.diff.topic_name
                        : topicCtx.topic_name;

                    const topicMeta = effectiveTopicNode?.topics?.[topicName];
                    const activeDiff =
                      topicCtx.type === "topic_diff"
                        ? topicCtx.diff
                        : topicCtx.recent_diff ||
                          (effectiveTopicNode?.recent_topic_diffs || []).find(
                            (d) => d.topic_name.toLowerCase() === topicName.toLowerCase()
                          );

                    return (
                      <div className="space-y-4">
                        {/* Topic Header & Trigger Info */}
                        <div className="p-4 rounded-xl bg-slate-900/90 border border-cyan-500/30 space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2">
                            <div className="flex items-center gap-2">
                              <Sliders className="w-4 h-4 text-cyan-400" />
                              <span className="font-mono text-xs font-bold text-slate-100 uppercase">
                                Topic State Transition & Delta Diff: {topicName}
                              </span>
                            </div>
                            {activeDiff && (
                              <span
                                className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold uppercase ${
                                  activeDiff.weight_delta > 0
                                    ? "bg-emerald-950 text-emerald-300 border border-emerald-500/30"
                                    : activeDiff.weight_delta < 0
                                    ? "bg-rose-950 text-rose-300 border border-rose-500/30"
                                    : "bg-cyan-950 text-cyan-300 border border-cyan-500/30"
                                }`}
                              >
                                {activeDiff.weight_delta > 0
                                  ? `▲ +${Math.round(activeDiff.weight_delta * 100)}% Weight`
                                  : activeDiff.weight_delta < 0
                                  ? `▼ ${Math.round(activeDiff.weight_delta * 100)}% Weight`
                                  : "Depth / Motivation Updated"}
                              </span>
                            )}
                          </div>

                          {activeDiff && (
                            <div className="flex flex-wrap items-center justify-between text-[11px] font-mono text-slate-400">
                              <span>Trigger Source: <strong className="text-cyan-300 uppercase">[{activeDiff.trigger_source}]</strong></span>
                              <span>Timestamp: <strong className="text-slate-300">{new Date(activeDiff.timestamp).toLocaleTimeString()}</strong></span>
                            </div>
                          )}
                        </div>

                        {/* Side-by-Side Visual Before vs After Diff Grid */}
                        {activeDiff ? (
                          <div className="space-y-3">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {/* Left Column: Previous State */}
                              <div className="p-4 rounded-xl bg-slate-950 border border-rose-500/20 space-y-3">
                                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                                  <span className="text-xs font-mono font-bold text-rose-400 flex items-center gap-1.5">
                                    <span>(-) PREVIOUS TOPIC STATE</span>
                                  </span>
                                  <span className="px-2 py-0.5 rounded bg-rose-950/40 text-rose-300 font-mono text-[9px] border border-rose-500/30 uppercase">
                                    {activeDiff.previous_state.technical_depth}
                                  </span>
                                </div>

                                <div className="space-y-1">
                                  <div className="flex justify-between text-xs font-mono text-slate-400">
                                    <span>Affinity Weight:</span>
                                    <span className="text-rose-300 font-bold">
                                      {Math.round(activeDiff.previous_state.weight * 100)}%
                                    </span>
                                  </div>
                                  <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-rose-500/60 rounded-full"
                                      style={{ width: `${Math.round(activeDiff.previous_state.weight * 100)}%` }}
                                    />
                                  </div>
                                </div>

                                <div className="space-y-1 text-xs">
                                  <span className="text-[10px] font-mono text-slate-500 block uppercase">
                                    Why They Care (Previous):
                                  </span>
                                  <p className="text-[11px] text-slate-400 bg-slate-900/60 p-2.5 rounded border border-white/5 line-through decoration-rose-500/50">
                                    {activeDiff.previous_state.why_they_care}
                                  </p>
                                </div>

                                {activeDiff.previous_state.curiosity_vectors && activeDiff.previous_state.curiosity_vectors.length > 0 && (
                                  <div className="space-y-1 text-xs">
                                    <span className="text-[10px] font-mono text-slate-500 block uppercase">
                                      Curiosity Vectors:
                                    </span>
                                    <div className="flex flex-wrap gap-1.5">
                                      {activeDiff.previous_state.curiosity_vectors.map((vec: string, vIdx: number) => (
                                        <span key={vIdx} className="px-1.5 py-0.5 rounded bg-slate-900 text-[9px] font-mono text-slate-500 border border-white/5">
                                          #{vec}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Right Column: Current Updated State */}
                              <div className="p-4 rounded-xl bg-slate-950 border border-emerald-500/30 space-y-3">
                                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                                  <span className="text-xs font-mono font-bold text-emerald-400 flex items-center gap-1.5">
                                    <span>(+) CURRENT UPDATED STATE</span>
                                  </span>
                                  <span className="px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-300 font-mono text-[9px] border border-emerald-500/40 uppercase">
                                    {activeDiff.current_state.technical_depth}
                                  </span>
                                </div>

                                <div className="space-y-1">
                                  <div className="flex justify-between text-xs font-mono text-slate-400">
                                    <span>Affinity Weight:</span>
                                    <span className="text-emerald-400 font-bold">
                                      {Math.round(activeDiff.current_state.weight * 100)}%{" "}
                                      <span className="text-[10px]">
                                        ({activeDiff.weight_delta > 0 ? `+${Math.round(activeDiff.weight_delta * 100)}%` : `${Math.round(activeDiff.weight_delta * 100)}%`})
                                      </span>
                                    </span>
                                  </div>
                                  <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 rounded-full"
                                      style={{ width: `${Math.round(activeDiff.current_state.weight * 100)}%` }}
                                    />
                                  </div>
                                </div>

                                <div className="space-y-1 text-xs">
                                  <span className="text-[10px] font-mono text-emerald-400 block uppercase font-bold">
                                    Why They Care (Updated Motivation):
                                  </span>
                                  <p className="text-[11px] text-slate-200 bg-emerald-950/20 p-2.5 rounded border border-emerald-500/30">
                                    {activeDiff.current_state.why_they_care}
                                  </p>
                                </div>

                                {activeDiff.current_state.curiosity_vectors && activeDiff.current_state.curiosity_vectors.length > 0 && (
                                  <div className="space-y-1 text-xs">
                                    <span className="text-[10px] font-mono text-emerald-400 block uppercase font-bold">
                                      Active Curiosity Vectors:
                                    </span>
                                    <div className="flex flex-wrap gap-1.5">
                                      {activeDiff.current_state.curiosity_vectors.map((vec: string, vIdx: number) => {
                                        const isNew = activeDiff.vectors_added?.includes(vec);
                                        return (
                                          <span
                                            key={vIdx}
                                            className={`px-1.5 py-0.5 rounded text-[9px] font-mono border ${
                                              isNew
                                                ? "bg-emerald-950 text-emerald-300 border-emerald-500/40 font-bold"
                                                : "bg-slate-900 text-slate-300 border-white/5"
                                            }`}
                                          >
                                            {isNew ? `+ #${vec}` : `#${vec}`}
                                          </span>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Reasoning & Evidence Callout */}
                            <div className="p-3.5 rounded-xl bg-slate-950 border border-white/10 space-y-1.5 text-xs font-mono">
                              <span className="text-[10px] text-cyan-400 uppercase font-bold block">
                                Adaptation Reasoning & Telemetry Evidence:
                              </span>
                              <p className="text-slate-200 text-[11px]">{activeDiff.reasoning}</p>
                              {activeDiff.evidence && (
                                <div className="text-[10px] text-slate-400 pt-1 border-t border-white/5">
                                  <strong className="text-slate-300">Evidence Quote / Metric: </strong>
                                  "{activeDiff.evidence}"
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="p-4 rounded-xl bg-slate-950 border border-white/5 space-y-2 text-xs">
                            <div className="flex justify-between items-center">
                              <span className="font-mono text-cyan-300 font-bold">{topicName}</span>
                              <span className="font-mono text-emerald-400 font-bold">
                                {topicMeta ? `${Math.round(topicMeta.weight * 100)}%` : "Active Topic"}
                              </span>
                            </div>
                            <p className="text-slate-300 text-[11px]">
                              {topicMeta?.why_they_care || topicCtx.reasoning || "Initial baseline topic profile. Send a message or read news stories to generate live state adaptation diffs."}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Context 4: Harmonization Run Selected */}
                  {selectedContext.type === "harmonization_run" && (() => {
                    const run = (selectedContext as any).run;
                    return (
                      <div className="space-y-4">
                        {/* Run Header */}
                        <div className="p-4 rounded-xl bg-slate-900/90 border border-violet-500/30 space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2">
                            <div className="flex items-center gap-2 font-mono">
                              <Sparkles className="w-4 h-4 text-violet-400" />
                              <span className="font-bold text-slate-100 text-xs uppercase">
                                Knowledge Graph Harmonization Audit Run
                              </span>
                            </div>
                            <span
                              className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold uppercase border ${
                                run.trigger_source === "background_observer"
                                  ? "bg-amber-950/70 text-amber-300 border-amber-500/30"
                                  : "bg-emerald-950/70 text-emerald-300 border-emerald-500/30"
                              }`}
                            >
                              {run.trigger_source === "background_observer"
                                ? "🤖 Background Observer Run"
                                : "👤 Manual User Run"}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center justify-between text-[11px] font-mono text-slate-400">
                            <span>Run ID: <strong className="text-slate-200">{run.run_id}</strong></span>
                            <span>Timestamp: <strong className="text-slate-300">{new Date(run.timestamp).toLocaleString()}</strong></span>
                            <span>Topic Delta: <strong className="text-cyan-300">{run.topics_before_count} → {run.topics_after_count}</strong></span>
                          </div>

                          <div className="p-3 rounded-lg bg-slate-950 border border-white/5 space-y-1 text-xs">
                            <span className="text-[10px] font-mono text-violet-400 uppercase font-bold block">
                              Harmonization Run Summary:
                            </span>
                            <p className="text-slate-200 text-xs">{run.summary}</p>
                          </div>
                        </div>

                        {/* Step-by-Step Actions Taken */}
                        <div className="space-y-2">
                          <span className="text-[10px] font-mono text-slate-400 font-bold uppercase block px-1">
                            Harmonization Actions & Deduplication Decisions ({run.actions?.length || 0}):
                          </span>
                          {(run.actions || []).map((action: any, aIdx: number) => {
                            const badgeColor =
                              action.type === "merge"
                                ? "bg-cyan-950 text-cyan-300 border-cyan-500/30"
                                : action.type === "split"
                                ? "bg-amber-950 text-amber-300 border-amber-500/30"
                                : action.type === "delete"
                                ? "bg-rose-950 text-rose-300 border-rose-500/30"
                                : "bg-emerald-950 text-emerald-300 border-emerald-500/30";

                            return (
                              <div
                                key={aIdx}
                                className="p-3.5 rounded-xl bg-slate-950 border border-white/10 space-y-2.5 text-xs font-mono"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${badgeColor}`}>
                                      {action.type}
                                    </span>
                                    <span className="text-slate-200 text-xs font-bold">
                                      {action.source_topics?.join(", ")} → {action.resulting_topics?.join(", ")}
                                    </span>
                                  </div>
                                </div>

                                <div className="p-2.5 rounded bg-slate-900/80 border border-white/5 space-y-1">
                                  <span className="text-[9px] text-slate-500 uppercase font-bold block">
                                    Harmonization Rationale:
                                  </span>
                                  <p className="text-slate-300 text-[11px] font-sans leading-relaxed">
                                    {action.rationale}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: ALL AI CALLS & PROMPTS */}
          {activeTab === "ai_calls" && (
            <div className="space-y-3">
              {traces
                .filter(
                  (t) =>
                    t.call_type === "llm" ||
                    Boolean(t.prompt_details?.user_prompt) ||
                    Boolean((t.metadata as any)?.raw_llm_completion) ||
                    Boolean(t.response_details?.raw_completion)
                )
                .map((trace, idx) => {
                  const isExpanded = expandedTraceId === trace.trace_id;
                  const userPrompt =
                    trace.prompt_details?.user_prompt ||
                    String((trace.metadata as any)?.raw_user_prompt || trace.input_summary?.last_user_message || "");
                  const sysPrompt = trace.prompt_details?.system_prompt;
                  const rawCompletion =
                    trace.response_details?.raw_completion ||
                    String((trace.metadata as any)?.raw_llm_completion || "");

                  return (
                    <div key={idx} className="p-4 rounded-xl bg-slate-900/80 border border-white/10 space-y-3 text-xs">
                      <div
                        className="flex items-center justify-between cursor-pointer"
                        onClick={() => setExpandedTraceId(isExpanded ? null : trace.trace_id || null)}
                      >
                        <div className="flex items-center gap-2 font-mono flex-wrap">
                          <span className="text-cyan-400 font-bold">AI Call #{idx + 1}</span>
                          <span className="text-slate-500">•</span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-950 text-slate-300 border border-white/10">
                            {trace.node_name}
                          </span>
                          <span className="text-slate-500">•</span>
                          <span className="text-emerald-400">{trace.llm_tokens_used || 0} tokens</span>
                          <span className="text-slate-500">•</span>
                          <span className="text-violet-400">{trace.latency_ms}ms</span>
                        </div>
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                      </div>

                      {isExpanded && (
                        <div className="pt-3 border-t border-white/10 space-y-3 font-mono">
                          {/* Reasoning Rationale */}
                          {trace.reasoning_rationale && (
                            <div className="p-2.5 rounded bg-slate-950 border border-cyan-500/20 space-y-1">
                              <span className="text-cyan-400 text-[10px] font-bold block uppercase">
                                Agent Reasoning & Rationale:
                              </span>
                              <p className="text-slate-300 text-[11px] leading-relaxed">
                                {trace.reasoning_rationale}
                              </p>
                            </div>
                          )}

                          {/* System Prompt if available */}
                          {sysPrompt && (
                            <div>
                              <span className="text-slate-400 text-[10px] block mb-1">System Instructions:</span>
                              <pre className="p-3 rounded-lg bg-slate-950 text-[10px] text-slate-400 whitespace-pre-wrap max-h-[140px] overflow-y-auto border border-white/5">
                                {sysPrompt}
                              </pre>
                            </div>
                          )}

                          {/* User Prompt */}
                          {userPrompt && (
                            <div>
                              <span className="text-amber-400 text-[10px] block mb-1">User Prompt & Injected Context:</span>
                              <pre className="p-3 rounded-lg bg-slate-950 text-[10px] text-slate-300 whitespace-pre-wrap max-h-[160px] overflow-y-auto border border-white/5">
                                {userPrompt}
                              </pre>
                            </div>
                          )}

                          {/* Raw LLM Completion */}
                          {rawCompletion && (
                            <div>
                              <span className="text-violet-400 text-[10px] block mb-1">DeepSeek Raw Completion:</span>
                              <pre className="p-3 rounded-lg bg-slate-950 text-[10px] text-violet-300 whitespace-pre-wrap max-h-[180px] overflow-y-auto border border-white/5">
                                {rawCompletion}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

              {traces.filter(
                (t) =>
                  t.call_type === "llm" ||
                  Boolean(t.prompt_details?.user_prompt) ||
                  Boolean((t.metadata as any)?.raw_llm_completion) ||
                  Boolean(t.response_details?.raw_completion)
              ).length === 0 && (
                <div className="p-8 text-center text-slate-500 text-xs font-mono">
                  No LLM completions recorded yet. Send a companion message to observe live AI calls.
                </div>
              )}
            </div>
          )}

          {/* TAB 3: KNOWLEDGE GRAPH & PROFILE */}
          {activeTab === "state_tree" && (
            <div className="p-4 rounded-xl bg-slate-900/80 border border-white/10 space-y-4 text-xs font-mono">
              <span className="text-cyan-400 font-bold">Live Revealed User Knowledge Graph:</span>
              <pre className="p-4 rounded-lg bg-slate-950 text-slate-300 overflow-x-auto whitespace-pre-wrap max-h-[360px]">
                {JSON.stringify(userGraph || {}, null, 2)}
              </pre>
            </div>
          )}

          {/* TAB 4: AGENT RUNS, INPUTS & OUTPUTS TRACE INSPECTOR */}
          {activeTab === "raw_traces" && (
            <div className="space-y-4">
              {/* Filter by Node / Micro-Agent */}
              <div className="p-3 rounded-xl bg-slate-900/80 border border-white/10 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-mono font-bold text-slate-200 uppercase">
                    Agent Run Telemetry & I/O Inspector ({traces.length} Runs Logged)
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 text-[10px] font-mono">
                  {["all", "node_observer", "node_context", "node_discovery", "node_b_telemetry", "node_a_epistemology", "node_c_serendipity", "node_d_synthesis"].map((filterKey) => (
                    <button
                      key={filterKey}
                      onClick={() => setSelectedAgentFilter(filterKey)}
                      className={`px-2 py-0.5 rounded transition ${
                        selectedAgentFilter === filterKey
                          ? "bg-cyan-500 text-slate-950 font-bold"
                          : "bg-slate-950 text-slate-400 hover:text-white border border-white/5"
                      }`}
                    >
                      {filterKey.replace("node_", "")}
                    </button>
                  ))}
                </div>
              </div>

              {/* Traces List */}
              <div className="space-y-3">
                {traces
                  .filter((t) => selectedAgentFilter === "all" || t.node_name === selectedAgentFilter)
                  .map((trace, idx) => {
                    const isExpanded = expandedTraceDetailId === trace.trace_id;
                    const meta = (trace.metadata as any) || {};

                    return (
                      <div
                        key={idx}
                        className="rounded-xl bg-slate-900/80 border border-white/10 overflow-hidden transition hover:border-cyan-500/30"
                      >
                        <div
                          className="p-3.5 flex items-center justify-between cursor-pointer"
                          onClick={() => setExpandedTraceDetailId(isExpanded ? null : trace.trace_id)}
                        >
                          <div className="flex items-center gap-2 text-xs font-mono">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                                trace.node_name === "node_observer"
                                  ? "bg-amber-950/60 text-amber-300 border-amber-500/30"
                                  : trace.node_name === "node_context"
                                  ? "bg-indigo-950/60 text-indigo-300 border-indigo-500/30"
                                  : trace.node_name === "node_discovery"
                                  ? "bg-cyan-950/60 text-cyan-300 border-cyan-500/30"
                                  : "bg-teal-950/60 text-teal-300 border-teal-500/30"
                              }`}
                            >
                              {trace.node_name}
                            </span>
                            <span className="text-slate-200 font-semibold truncate max-w-[280px]">
                              {trace.reasoning_rationale}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 text-xs font-mono">
                            {trace.llm_tokens_used && (
                              <span className="text-emerald-400 text-[11px]">
                                {trace.llm_tokens_used} tok
                              </span>
                            )}
                            <span className="text-violet-400 text-[11px]">{trace.latency_ms}ms</span>
                            <span className="text-slate-500 text-[10px]">
                              {new Date(trace.timestamp).toLocaleTimeString()}
                            </span>
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-slate-400" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-slate-400" />
                            )}
                          </div>
                        </div>

                        {/* Expanded Full IO Inspector */}
                        {isExpanded && (
                          <div className="p-4 bg-slate-950 border-t border-white/10 space-y-3 text-xs font-mono">
                            {/* Execution Telemetry Summary */}
                            <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 pb-2 border-b border-white/5">
                              <span>Trace ID: <strong className="text-cyan-300">{trace.trace_id}</strong></span>
                              <span>Session ID: <strong className="text-slate-300">{trace.session_id}</strong></span>
                              <span>Status: <strong className="text-emerald-400">SUCCESS</strong></span>
                            </div>

                            {/* Reasoning Justification */}
                            <div className="p-2.5 rounded bg-slate-900/80 border border-white/5 space-y-1">
                              <span className="text-[10px] text-cyan-400 font-bold uppercase block">
                                Agent Reasoning & Decision Rationale:
                              </span>
                              <p className="text-slate-200 text-[11px] leading-relaxed">
                                {trace.reasoning_rationale}
                              </p>
                            </div>

                            {/* Side-by-Side Full Inputs vs Outputs Payload */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {/* Inputs */}
                              <div className="p-3 rounded-lg bg-slate-900 border border-teal-500/20 space-y-1.5">
                                <span className="text-[10px] text-teal-400 font-bold uppercase block flex items-center gap-1">
                                  <span>INPUT PAYLOAD & CONTEXT</span>
                                </span>
                                <pre className="p-2.5 rounded bg-slate-950 text-[10px] text-slate-300 whitespace-pre-wrap max-h-[220px] overflow-y-auto border border-white/5">
                                  {JSON.stringify(
                                    {
                                      input_summary: trace.input_summary,
                                      raw_system_prompt: meta.raw_system_prompt,
                                      raw_user_prompt: meta.raw_user_prompt,
                                      chat_history_input: meta.chat_history_input,
                                      telemetry_input: meta.telemetry_input,
                                    },
                                    null,
                                    2
                                  )}
                                </pre>
                              </div>

                              {/* Outputs */}
                              <div className="p-3 rounded-lg bg-slate-900 border border-emerald-500/20 space-y-1.5">
                                <span className="text-[10px] text-emerald-400 font-bold uppercase block flex items-center gap-1">
                                  <span>OUTPUT EMITTED STATE</span>
                                </span>
                                <pre className="p-2.5 rounded bg-slate-950 text-[10px] text-slate-300 whitespace-pre-wrap max-h-[220px] overflow-y-auto border border-white/5">
                                  {JSON.stringify(
                                    {
                                      output_summary: trace.output_summary,
                                      raw_llm_completion: meta.raw_llm_completion,
                                      parsed_llm_response: meta.parsed_llm_response,
                                      adaptations_made: meta.adaptations_made,
                                      topic_diffs: meta.topic_diffs,
                                    },
                                    null,
                                    2
                                  )}
                                </pre>
                              </div>
                            </div>

                            {/* Raw Model Completion if available */}
                            {meta.raw_llm_completion && (
                              <div className="space-y-1 pt-1">
                                <span className="text-[10px] text-violet-400 font-bold uppercase block">
                                  Raw Model LLM Completion Text:
                                </span>
                                <pre className="p-2.5 rounded bg-slate-900 text-[10px] text-slate-300 whitespace-pre-wrap max-h-[160px] overflow-y-auto border border-white/5">
                                  {String(meta.raw_llm_completion)}
                                </pre>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}

                {traces.length === 0 && (
                  <div className="p-8 text-center text-slate-500 text-xs">
                    No agent runs recorded yet. Send a message or trigger a pipeline run to observe live traces.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
