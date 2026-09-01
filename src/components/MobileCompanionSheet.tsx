"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  X,
  Send,
  MessageSquare,
  Brain,
  Sliders,
  RotateCcw,
  Sparkles,
  ChevronDown,
  ChevronUp,
  User,
  RefreshCw,
  ShieldCheck,
  Compass,
  FileText,
  AlertTriangle,
  Minimize2,
  Maximize2,
} from "lucide-react";
import {
  AttachedStoryContext,
  TopicMetadata,
  TopicEvolutionEntry,
  UnifiedTopicNode,
  UserKnowledgeGraph,
} from "@/core/types/contracts";
import { ChatMessage } from "@/core/agents/intake/dialogue-agent";

interface MobileCompanionSheetProps {
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  companionTab: "chat" | "interests";
  setCompanionTab: (tab: "chat" | "interests") => void;
  session: any;
  signIn: (provider?: string, options?: any) => Promise<any> | void;
  messages: ChatMessage[];
  chatInput: string;
  setChatInput: (val: string) => void;
  isSendingChat: boolean;
  chatError: string | null;
  handleSendMessage: (e?: React.FormEvent, customHistory?: ChatMessage[]) => void;
  handleInspectChatTurn: (msg: ChatMessage) => void;
  chatScrollContainerRef: React.RefObject<HTMLDivElement>;
  attachedStory: AttachedStoryContext | null;
  setAttachedStory: (story: AttachedStoryContext | null) => void;
  unifiedTopicNode: UnifiedTopicNode | null;
  userGraph: UserKnowledgeGraph | null;
  extractedTopics: Array<{ topic: string; weight: number; reasoning: string }>;
  totalInterestsCount: number;
  handleInspectTopic: (topic: any) => void;
  setSelectedTopicFilter: (topic: string) => void;
  handleHarmonizeInterests: () => void;
  isHarmonizing: boolean;
  handleResetProfileAndSession: () => void;
  isResettingProfile: boolean;
  setSelectedContext: (ctx: any) => void;
  setIsDevToolsOpen: (open: boolean) => void;
}

export default function MobileCompanionSheet({
  isOpen,
  onOpen,
  onClose,
  companionTab,
  setCompanionTab,
  session,
  signIn,
  messages,
  chatInput,
  setChatInput,
  isSendingChat,
  chatError,
  handleSendMessage,
  handleInspectChatTurn,
  chatScrollContainerRef,
  attachedStory,
  setAttachedStory,
  unifiedTopicNode,
  userGraph,
  extractedTopics,
  totalInterestsCount,
  handleInspectTopic,
  setSelectedTopicFilter,
  handleHarmonizeInterests,
  isHarmonizing,
  handleResetProfileAndSession,
  isResettingProfile,
  setSelectedContext,
  setIsDevToolsOpen,
}: MobileCompanionSheetProps) {
  const [isStoryExpanded, setIsStoryExpanded] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [expandedTopicTimelines, setExpandedTopicTimelines] = useState<Set<string>>(new Set());
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const toggleTopicTimeline = (topic: string) => {
    setExpandedTopicTimelines((prev) => {
      const next = new Set(prev);
      if (next.has(topic)) {
        next.delete(topic);
      } else {
        next.add(topic);
      }
      return next;
    });
  };

  // Auto-scroll to the end of conversation whenever sheet is opened or messages change
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [isOpen, messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && mobileInputRef.current) {
      setTimeout(() => mobileInputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  return (
    <>
      {/* 1. PERSISTENT FLOATING AMBIENT COMPANION QUICK BAR (When sheet is closed on mobile) */}
      {!isOpen && (
        <div className="fixed bottom-16 left-0 right-0 z-30 px-3 py-2 pointer-events-none lg:hidden">
          <div className="max-w-xl mx-auto pointer-events-auto">
            <div className="bg-slate-900/90 backdrop-blur-2xl border border-cyan-500/30 rounded-2xl p-2 shadow-2xl shadow-cyan-950/40 space-y-1.5 transition transform hover:scale-[1.01]">
              {/* Attached Story Pill if active */}
              {attachedStory && (
                <div className="px-2.5 py-1 rounded-xl bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-between text-[11px] text-cyan-200">
                  <div className="flex items-center gap-1.5 truncate">
                    <MessageSquare className="w-3 h-3 text-cyan-400 flex-shrink-0" />
                    <span className="truncate font-medium">Discussing: {attachedStory.headline}</span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setAttachedStory(null);
                    }}
                    className="p-0.5 rounded hover:bg-white/10 text-slate-400 hover:text-white transition flex-shrink-0"
                    title="Detach Story"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}

              {/* Floating Quick Bar Content */}
              <div className="flex items-center gap-2">
                <button
                  onClick={onOpen}
                  className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-violet-500 flex items-center justify-center font-bold text-white text-xs flex-shrink-0 shadow-md shadow-cyan-500/20 hover:opacity-90 transition"
                  title="Expand AI Companion Dialogue Sheet"
                >
                  α
                </button>

                <div
                  onClick={onOpen}
                  className="flex-1 bg-slate-950/80 border border-white/10 rounded-xl px-3 py-2 flex items-center justify-between cursor-pointer text-xs text-slate-400 hover:border-cyan-500/40 transition"
                >
                  <span className="truncate">
                    {chatInput ? chatInput : "Ask Aletheia about this feed or topics..."}
                  </span>
                  <span className="text-[10px] font-mono text-cyan-400 flex items-center gap-1 flex-shrink-0 ml-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Adaptive
                  </span>
                </div>

                <button
                  onClick={onOpen}
                  className="px-3 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 flex-shrink-0 shadow-md shadow-cyan-500/20 hover:opacity-90 transition"
                  title="Open Chat"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Chat</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. EXPANDABLE CONVERSATIONAL BOTTOM SHEET / DRAWER */}
      {isOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden flex flex-col justify-end bg-slate-950/80 backdrop-blur-md transition-opacity animate-in fade-in duration-200">
          {/* Backdrop Tap to Dismiss / Peek Feed */}
          <div className="flex-1" onClick={onClose} />

          {/* Drawer Container */}
          <div
            className={`w-full bg-slate-900/98 backdrop-blur-3xl border-t border-cyan-500/40 rounded-t-3xl shadow-2xl flex flex-col transition-all duration-300 ${
              isFullScreen ? "h-[94dvh]" : "h-[85dvh]"
            }`}
          >
            {/* Top Sheet Header & Drag Handle */}
            <div className="p-3 border-b border-white/10 flex-shrink-0 space-y-2">
              {/* Drag Pill Handle */}
              <div
                onClick={onClose}
                className="w-12 h-1.5 bg-slate-700 rounded-full mx-auto cursor-pointer hover:bg-cyan-400 transition"
                title="Tap or drag down to peek feed"
              />

              <div className="flex items-center justify-between pt-1">
                {/* Segmented Switcher inside Sheet */}
                <div className="flex items-center gap-1 bg-slate-950/90 p-1 rounded-xl border border-white/10 text-xs font-mono">
                  <button
                    onClick={() => setCompanionTab("chat")}
                    className={`px-3 py-1 rounded-lg font-semibold flex items-center gap-1.5 transition ${
                      companionTab === "chat"
                        ? "bg-cyan-500 text-slate-950 shadow-sm shadow-cyan-500/20 font-bold"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Dialogue</span>
                  </button>

                  <button
                    onClick={() => setCompanionTab("interests")}
                    className={`px-3 py-1 rounded-lg font-semibold flex items-center gap-1.5 transition ${
                      companionTab === "interests"
                        ? "bg-cyan-500 text-slate-950 shadow-sm shadow-cyan-500/20 font-bold"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <Brain className="w-3.5 h-3.5" />
                    <span>Interests ({totalInterestsCount})</span>
                  </button>
                </div>

                {/* Sheet Window Controls */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setIsFullScreen((prev) => !prev)}
                    className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white border border-white/5 transition"
                    title={isFullScreen ? "Collapse to standard sheet" : "Expand full screen"}
                  >
                    {isFullScreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                  </button>

                  <button
                    onClick={onClose}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 hover:text-white border border-white/5 text-xs font-mono flex items-center gap-1 transition"
                    title="Minimize sheet to peek feed"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                    <span>Peek Feed</span>
                  </button>
                </div>
              </div>

              {/* Attached Story Collapsible Context Bar */}
              {companionTab === "chat" && attachedStory && (
                <div className="rounded-xl bg-cyan-950/70 border border-cyan-500/40 overflow-hidden text-xs">
                  <div
                    onClick={() => setIsStoryExpanded((prev) => !prev)}
                    className="p-2.5 flex items-center justify-between gap-2 cursor-pointer hover:bg-cyan-900/40 transition"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <MessageSquare className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                      <span className="truncate text-cyan-200 font-medium">
                        Discussing: {attachedStory.headline}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {isStoryExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5 text-cyan-400" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-cyan-400" />
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setAttachedStory(null);
                        }}
                        className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white transition"
                        title="Detach Story"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Expanded Story Facts & Disputed Claims */}
                  {isStoryExpanded && (
                    <div className="p-3 bg-slate-950/90 border-t border-cyan-500/20 space-y-2.5 max-h-48 overflow-y-auto">
                      <p className="text-slate-300 text-xs leading-relaxed">{attachedStory.summary}</p>

                      {attachedStory.fact_bullets && attachedStory.fact_bullets.length > 0 && (
                        <div className="space-y-1">
                          <span className="text-[10px] font-mono text-cyan-300 font-bold uppercase flex items-center gap-1">
                            <FileText className="w-3 h-3 text-cyan-400" />
                            Verified Facts:
                          </span>
                          <ul className="space-y-1 pl-1">
                            {attachedStory.fact_bullets.map((f, i) => (
                              <li key={i} className="text-xs text-slate-300 flex items-start gap-1.5">
                                <span className="text-cyan-400 mt-1">•</span>
                                <span>{f}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {attachedStory.disputed_claims && attachedStory.disputed_claims.length > 0 && (
                        <div className="space-y-1 pt-1 border-t border-white/5">
                          <span className="text-[10px] font-mono text-amber-300 font-bold uppercase flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-amber-400" />
                            Disputed Claims / Nuances:
                          </span>
                          <ul className="space-y-1 pl-1">
                            {attachedStory.disputed_claims.map((d: any, i: number) => (
                              <li key={i} className="text-xs text-amber-200/90 flex items-start gap-1.5">
                                <span className="text-amber-400 mt-1">•</span>
                                <span>{typeof d === "string" ? d : d.claim || JSON.stringify(d)}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* TAB 1: DIALOGUE VIEW */}
            {companionTab === "chat" ? (
              !session?.user ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-4 bg-slate-900/40 my-auto">
                  <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div className="space-y-1.5 max-w-[280px]">
                    <h3 className="text-sm font-bold text-white font-mono">Sign In to Activate Aletheia</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Authentication is required to converse with the AI companion and build your persistent Mind-State memory graph.
                    </p>
                  </div>
                  <button
                    onClick={() => signIn("google", { callbackUrl: "/" })}
                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-blue-500/20 transition"
                  >
                    <span>Sign In with Google</span>
                  </button>
                </div>
              ) : (
                <div className="flex-1 flex flex-col overflow-hidden">
                  {/* Messages Scroll Area */}
                  <div
                    ref={chatScrollContainerRef}
                    className="flex-1 overflow-y-auto p-4 space-y-3 text-xs sm:text-sm"
                  >
                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex items-start gap-2.5 ${
                          msg.role === "user" ? "justify-end" : "justify-start"
                        }`}
                      >
                        {msg.role === "assistant" && (
                          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-cyan-500 to-violet-500 flex items-center justify-center font-bold text-white text-xs flex-shrink-0">
                            α
                          </div>
                        )}

                        {msg.role === "assistant" ? (
                          <div className="flex flex-col gap-1.5 max-w-[88%]">
                            {/* Live Tool Execution Badges */}
                            {msg.tool_executions && msg.tool_executions.length > 0 && (
                              <div className="space-y-1 mb-1">
                                {msg.tool_executions.map((tool: any, tIdx: number) => (
                                  <div
                                    key={tIdx}
                                    className="px-2.5 py-1 rounded-lg bg-cyan-950/60 border border-cyan-500/40 text-[10px] font-mono text-cyan-300 flex items-center gap-1.5 shadow-sm"
                                  >
                                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                                    <span className="font-bold">
                                      {tool.tool_name === "search_internet" ? "🌐 Live Search:" : "🧠 Knowledge Lookup:"}
                                    </span>
                                    <span className="text-slate-300 truncate max-w-[130px]">&quot;{tool.query}&quot;</span>
                                  </div>
                                ))}
                              </div>
                            )}

                            <div className="p-3.5 rounded-2xl leading-relaxed bg-slate-900/90 text-slate-200 border border-white/10 rounded-tl-none whitespace-pre-wrap">
                              {msg.content}
                            </div>

                            <div className="flex flex-wrap items-center gap-2 pl-1 pt-0.5">
                              <button
                                onClick={() => {
                                  handleInspectChatTurn(msg);
                                  setIsDevToolsOpen(true);
                                }}
                                className="text-[10px] font-mono text-cyan-300 hover:text-cyan-100 bg-cyan-950/60 hover:bg-cyan-900/80 px-2 py-0.5 rounded-lg border border-cyan-500/40 flex items-center gap-1 transition"
                              >
                                <Brain className="w-3 h-3 text-cyan-400" />
                                <span>Inspect Context</span>
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="max-w-[88%] p-3.5 rounded-2xl leading-relaxed bg-gradient-to-r from-cyan-600 to-teal-600 text-white rounded-tr-none shadow-lg shadow-cyan-900/20">
                            {msg.attached_story && (
                              <div className="text-[10px] font-mono text-cyan-200 pb-1 mb-1 border-b border-white/20 truncate">
                                Re: {msg.attached_story.headline}
                              </div>
                            )}
                            {msg.content}
                          </div>
                        )}

                        {msg.role === "user" && (
                          <div className="w-7 h-7 rounded-lg bg-slate-800 border border-white/10 flex items-center justify-center text-slate-300 text-xs flex-shrink-0">
                            <User className="w-3.5 h-3.5" />
                          </div>
                        )}
                      </div>
                    ))}

                    {isSendingChat && (
                      <div className="flex items-center gap-2 text-xs text-slate-400 pl-9">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                        <span>Aletheia is reflecting & synthesizing...</span>
                      </div>
                    )}

                    {chatError && (
                      <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-xs text-rose-300 flex items-center justify-between">
                        <span>{chatError}</span>
                        <button
                          onClick={() => handleSendMessage()}
                          className="px-2 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-xs font-bold"
                        >
                          Retry
                        </button>
                      </div>
                    )}

                    {/* Auto-scroll bottom anchor */}
                    <div ref={messagesEndRef} className="h-4 flex-shrink-0" />
                  </div>

                  {/* Input Form at bottom of sheet */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSendMessage();
                    }}
                    className="p-3.5 pb-safe pb-5 bg-slate-950/98 border-t border-cyan-500/30 flex items-center gap-2 flex-shrink-0 shadow-2xl"
                  >
                    <input
                      ref={mobileInputRef}
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder={
                        attachedStory ? `Ask about "${attachedStory.topic}"...` : "Discuss stories, ask questions..."
                      }
                      className="flex-1 bg-slate-900 border border-white/15 rounded-xl px-4 py-3 text-xs sm:text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50 transition shadow-inner"
                      disabled={isSendingChat}
                    />

                    <button
                      type="submit"
                      disabled={isSendingChat || !chatInput.trim()}
                      className="p-3 rounded-xl bg-gradient-to-r from-cyan-400 to-teal-400 text-slate-950 font-bold hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-cyan-500/25 flex-shrink-0"
                      title="Send message"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                </div>
              )
            ) : (
              /* TAB 2: INTERESTS & KNOWLEDGE GRAPH VIEW */
              <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-mono text-cyan-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <Brain className="w-3.5 h-3.5 text-cyan-400" />
                    Active Interests:
                  </div>
                  {totalInterestsCount > 0 && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleHarmonizeInterests()}
                        disabled={isHarmonizing}
                        className="text-[10px] font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-500/30"
                      >
                        <Sparkles className={`w-3 h-3 text-cyan-400 ${isHarmonizing ? "animate-spin" : ""}`} />
                        <span>{isHarmonizing ? "Harmonizing..." : "Harmonize"}</span>
                      </button>
                      <button
                        onClick={() => handleResetProfileAndSession()}
                        disabled={isResettingProfile}
                        className="text-[10px] font-mono text-rose-400 hover:text-rose-300 flex items-center gap-1 transition"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Reset</span>
                      </button>
                    </div>
                  )}
                </div>

                {(() => {
                  const topicMap = new Map<string, TopicMetadata>();

                  // Unified Topic Node (Authoritative Single Source of Truth)
                  if (unifiedTopicNode?.topics) {
                    for (const [topic, meta] of Object.entries(unifiedTopicNode.topics)) {
                      topicMap.set(topic, meta);
                    }
                  }

                  const entries = Array.from(topicMap.entries()).sort((a, b) => b[1].weight - a[1].weight);

                  if (entries.length === 0) {
                    return (
                      <div className="p-6 rounded-xl bg-slate-900/50 border border-white/5 text-center text-slate-400 space-y-2">
                        <p>No explicit interests revealed yet.</p>
                        <p className="text-[11px] text-slate-500">
                          Chat with Aletheia about topics you care about to build your interests.
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-3">
                      {entries.map(([topic, data], idx) => {
                        const pct = Math.round(data.weight * 100);
                        const isTimelineOpen = expandedTopicTimelines.has(topic);
                        const timeline = data.evolution_timeline || [];

                        return (
                          <div
                            key={idx}
                            className="p-3.5 rounded-xl bg-slate-900/90 border border-white/10 space-y-2.5"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-slate-100 text-sm">{topic}</span>
                                {data.technical_depth && (
                                  <span className="px-1.5 py-0.5 rounded bg-cyan-950/60 text-cyan-300 font-mono text-[9px] border border-cyan-500/30 uppercase">
                                    {data.technical_depth}
                                  </span>
                                )}
                              </div>
                              <span className="font-mono text-xs font-bold text-cyan-300 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-500/30">
                                {pct}%
                              </span>
                            </div>

                            {/* Affinity Weight Bar */}
                            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-cyan-500 to-teal-400 rounded-full"
                                style={{ width: `${pct}%` }}
                              />
                            </div>

                            <div className="space-y-1.5 pt-0.5">
                              {/* Pillar 1: What the user is interested in */}
                              <div className="text-[11px] leading-relaxed bg-slate-900/60 p-2 rounded-lg border border-white/5 space-y-0.5">
                                <span className="text-cyan-400 font-mono text-[9px] uppercase font-bold block">
                                  1. What They Are Interested In (Focus & Scope):
                                </span>
                                <p className="text-slate-200">
                                  {data.what_they_care_about || `Core focus on ${topic} developments, technical architecture, and real-world implications.`}
                                </p>
                              </div>

                              {/* Pillar 2: Why they care */}
                              <div className="text-[11px] leading-relaxed bg-slate-900/60 p-2 rounded-lg border border-white/5 space-y-0.5">
                                <span className="text-emerald-400 font-mono text-[9px] uppercase font-bold block">
                                  2. Why They Care (Intellectual Stakes & Worldview):
                                </span>
                                <p className="text-slate-200">{data.why_they_care}</p>
                              </div>

                              {/* Living Dossier Synthesis & Narrative */}
                              {data.living_narrative && data.living_narrative !== data.why_they_care && data.living_narrative !== data.what_they_care_about && (
                                <div className="text-[11px] leading-relaxed bg-indigo-950/20 p-2 rounded-lg border border-indigo-500/20 space-y-0.5">
                                  <span className="text-indigo-400 font-mono text-[9px] uppercase font-bold block">
                                    Living Dossier (Cumulative Narrative Synthesis):
                                  </span>
                                  <p className="text-slate-200 text-[10.5px] leading-normal">{data.living_narrative}</p>
                                </div>
                              )}

                              {/* Pillar 3: How best to present stories */}
                              <div className="text-[11px] leading-relaxed bg-slate-900/60 p-2 rounded-lg border border-white/5 space-y-1">
                                <span className="text-amber-400 font-mono text-[9px] uppercase font-bold block">
                                  3. How Best To Present Stories:
                                </span>
                                <p className="text-slate-300">
                                  {data.presentation_strategy || `Curate with ${data.technical_depth || "practitioner"} depth, focusing on verified empirical milestones and substantive trade-offs.`}
                                </p>

                                {(data.likes_and_angles?.length || 0) > 0 && (
                                  <div className="flex flex-wrap items-center gap-1 pt-0.5">
                                    <span className="text-[9px] font-mono text-slate-500">Preferred:</span>
                                    {data.likes_and_angles?.map((like: string, lIdx: number) => (
                                      <span
                                        key={lIdx}
                                        className="text-[9px] font-mono text-emerald-300 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-500/20"
                                      >
                                        ✓ {like}
                                      </span>
                                    ))}
                                  </div>
                                )}

                                {(data.dislikes_and_critiques?.length || 0) > 0 && (
                                  <div className="flex flex-wrap items-center gap-1 pt-0.5">
                                    <span className="text-[9px] font-mono text-slate-500">Filter out:</span>
                                    {data.dislikes_and_critiques?.map((dislike: string, dIdx: number) => (
                                      <span
                                        key={dIdx}
                                        className="text-[9px] font-mono text-rose-300 bg-rose-950/60 px-1.5 py-0.5 rounded border border-rose-500/20"
                                      >
                                        ✕ {dislike}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Curiosity Vectors Tags */}
                            {data.curiosity_vectors && data.curiosity_vectors.length > 0 && (
                              <div className="flex flex-wrap gap-1 pt-0.5">
                                {data.curiosity_vectors.map((vec: string, vIdx: number) => (
                                  <span
                                    key={vIdx}
                                    className="px-1.5 py-0.5 rounded bg-slate-900 text-[9px] font-mono text-slate-400 border border-white/5"
                                  >
                                    #{vec}
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* Living Evolution Timeline */}
                            {timeline.length > 0 && (
                              <div className="pt-1.5 border-t border-white/5 space-y-1.5">
                                <button
                                  onClick={() => toggleTopicTimeline(topic)}
                                  className="text-[10px] font-mono text-slate-400 hover:text-cyan-300 flex items-center justify-between w-full transition py-0.5"
                                >
                                  <span className="flex items-center gap-1.5">
                                    <RotateCcw className="w-3 h-3 text-cyan-400" />
                                    <span>Evolution Timeline ({timeline.length})</span>
                                  </span>
                                  <ChevronDown
                                    className={`w-3 h-3 transition transform ${isTimelineOpen ? "rotate-180" : ""}`}
                                  />
                                </button>

                                {isTimelineOpen && (
                                  <div className="space-y-1.5 pl-2 border-l border-cyan-500/30 text-[11px] font-mono text-slate-300 pt-1">
                                    {timeline.map((entry: TopicEvolutionEntry, eIdx: number) => (
                                      <div key={eIdx} className="space-y-0.5 pb-1">
                                        <div className="flex items-center justify-between text-[9px] text-slate-500">
                                          <span>
                                            {new Date(entry.timestamp).toLocaleDateString(undefined, {
                                              month: "short",
                                              day: "numeric",
                                              hour: "numeric",
                                              minute: "2-digit",
                                            })}
                                          </span>
                                        </div>
                                        <p className="text-slate-300 font-sans leading-tight text-xs">
                                          {entry.insight}
                                        </p>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}

                            <div className="pt-1 flex items-center justify-between border-t border-white/5">
                              <button
                                onClick={() => {
                                  handleInspectTopic({
                                    topic,
                                    weight: data.weight,
                                    reasoning: data.living_narrative || data.why_they_care,
                                    technical_depth: data.technical_depth as any,
                                  });
                                  setIsDevToolsOpen(true);
                                }}
                                className="text-[10px] font-mono text-cyan-300 bg-cyan-950/70 px-2 py-0.5 rounded border border-cyan-500/30 flex items-center gap-1"
                              >
                                <Sliders className="w-2.5 h-2.5 text-cyan-400" />
                                <span>Inspect Node</span>
                              </button>

                              <button
                                onClick={() => {
                                  setSelectedTopicFilter(topic);
                                  onClose();
                                }}
                                className="text-[10px] font-mono text-cyan-400 hover:underline flex items-center gap-1 font-semibold"
                              >
                                Filter Feed →
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}

                {/* Thematic Bridges */}
                {(userGraph?.interest_intersections || []).length > 0 && (
                  <div className="space-y-2 pt-3 border-t border-white/10">
                    <span className="text-[11px] font-mono text-violet-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                      <Compass className="w-3.5 h-3.5 text-violet-400" />
                      Thematic Bridges:
                    </span>
                    {userGraph?.interest_intersections?.map((b, i) => (
                      <div key={i} className="p-3 rounded-xl bg-violet-950/20 border border-violet-500/20 space-y-1">
                        <div className="font-semibold text-violet-200">{b.intersection_theme}</div>
                        <p className="text-slate-300 text-xs">{b.hypothesis}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Knowledge Graph Harmonization History */}
                {(unifiedTopicNode?.harmonization_runs || []).length > 0 && (
                  <div className="space-y-3 pt-3 border-t border-white/10">
                    <span className="text-[11px] font-mono text-cyan-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                      Harmonization History ({unifiedTopicNode?.harmonization_runs?.length || 0}):
                    </span>

                    <div className="space-y-2">
                      {unifiedTopicNode?.harmonization_runs?.map((run, rIdx) => (
                        <div
                          key={rIdx}
                          className="p-3 rounded-xl bg-slate-900/80 border border-white/10 space-y-1.5"
                        >
                          <div className="flex items-center justify-between text-xs">
                            <span
                              className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase border ${
                                run.trigger_source === "background_observer"
                                  ? "bg-amber-950/70 text-amber-300 border-amber-500/30"
                                  : "bg-emerald-950/70 text-emerald-300 border-emerald-500/30"
                              }`}
                            >
                              {run.trigger_source === "background_observer" ? "Background" : "Manual"}
                            </span>
                            <button
                              onClick={() => {
                                setSelectedContext({
                                  type: "harmonization_run",
                                  run,
                                });
                                setIsDevToolsOpen(true);
                              }}
                              className="text-[10px] font-mono text-cyan-300 hover:text-cyan-100"
                            >
                              Inspect →
                            </button>
                          </div>
                          <p className="text-slate-200 text-xs">{run.summary}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
