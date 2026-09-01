"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Send,
  Sparkles,
  ShieldCheck,
  Brain,
  Compass,
  Layers,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
  Terminal,
  Activity,
  User,
  ArrowRight,
  Flame,
  MessageSquare,
  X,
  Sliders,
  Filter,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  BookOpen,
  Clock,
  RotateCcw,
  Menu,
  Newspaper,
  Zap,
} from "lucide-react";
import {
  NewsStateContext,
  UserKnowledgeGraph,
  UnifiedTopicNode,
  TopicMetadata,
  TopicEvolutionEntry,
  PureFactObject,
  SynthesizedEventCard,
  AttachedStoryContext,
  ContextualSelection,
  EventSourceArticle,
} from "@/core/types/contracts";
import { ChatMessage } from "@/core/agents/intake/dialogue-agent";
import DevToolsPanel from "@/components/DevToolsPanel";
import SourceReaderModal from "@/components/SourceReaderModal";
import MobileCompanionSheet from "@/components/MobileCompanionSheet";
import { filterFeedBySemanticAffinity } from "@/core/matching/semantic-matcher";
import { buildTopicBriefs, TopicBrief } from "@/core/matching/topic-brief-builder";
import { useSession, signIn, signOut } from "next-auth/react";

function sanitizeDisplay(input?: string): string {
  if (!input) return "";
  return input
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/&nbsp;/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export default function AletheiaHome() {
  const { data: session, status: authStatus } = useSession();
  const effectiveUserId = session?.user?.email
    ? `usr_${session.user.email.replace(/[^a-zA-Z0-9]/g, "_")}`
    : "usr_guest";

  const defaultWelcomeMessage: ChatMessage = {
    id: "welcome-msg",
    role: "assistant",
    content:
      "Welcome to Aletheia. I'm your personalized epistemic companion built on the Mind-State Memory Architecture.\n\nExplore your curated news feed on the left, or discuss any story directly with me. As we talk, the Context Agent calibrates tone and safeguards, the Discovery Agent filters out sensationalist fluff, and the Observer Agent silently adapts to your evolving mindset.",
    timestamp: new Date().toISOString(),
  };

  const [messages, setMessages] = useState<ChatMessage[]>([defaultWelcomeMessage]);
  const [inputPrompt, setInputPrompt] = useState("");
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [attachedStory, setAttachedStory] = useState<AttachedStoryContext | null>(null);
  const [selectedReadingSource, setSelectedReadingSource] = useState<{
    source: EventSourceArticle;
    card: SynthesizedEventCard;
  } | null>(null);
  const [userGraph, setUserGraph] = useState<UserKnowledgeGraph | null>(null);
  const [unifiedTopicNode, setUnifiedTopicNode] = useState<UnifiedTopicNode | null>(null);
  const [extractedTopics, setExtractedTopics] = useState<Array<{ topic: string; weight: number; reasoning: string }>>([]);
  const [companionTab, setCompanionTab] = useState<"chat" | "interests">("chat");
  const [mobileTab, setMobileTab] = useState<"feed" | "dialogue" | "interests">("feed");
  const [isMobileCompanionOpen, setIsMobileCompanionOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Pipeline & Feed state
  const [isCollectingNews, setIsCollectingNews] = useState(false);
  const [pipelineResult, setPipelineResult] = useState<NewsStateContext | null>(null);
  const [selectedTopicFilter, setSelectedTopicFilter] = useState<string>("all");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<
    "all" | "revealed_preference" | "thematic_intersection" | "curiosity_frontier"
  >("all");
  const [activeViewMode, setActiveViewMode] = useState<"stories" | "briefs">("stories");
  const [cognitiveLoad, setCognitiveLoad] = useState<"low" | "balanced" | "deep_dive">("balanced");
  const [isTopicDropdownOpen, setIsTopicDropdownOpen] = useState(false);
  const [aiFeedFilter, setAiFeedFilter] = useState<{
    is_active?: boolean;
    topic?: string;
    matched_event_ids?: string[];
    filter_reason?: string;
  } | null>(null);

  // Contextual DevTools State
  const [isDevToolsOpen, setIsDevToolsOpen] = useState(false);
  const [selectedContext, setSelectedContext] = useState<ContextualSelection | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Expandable Stories State (Accordion/Expansion per card)
  const [expandedCardIds, setExpandedCardIds] = useState<Set<string>>(new Set());
  const [expandedTopicTimelines, setExpandedTopicTimelines] = useState<Set<string>>(new Set());

  const toggleCardExpansion = (eventId: string) => {
    setExpandedCardIds((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
  };

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

  const chatScrollContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat internally
  useEffect(() => {
    if (chatScrollContainerRef.current) {
      chatScrollContainerRef.current.scrollTop = chatScrollContainerRef.current.scrollHeight;
    }
  }, [messages, isSendingChat]);

  // Rehydrate existing persisted session & knowledge graph on mount or when auth user switches
  useEffect(() => {
    // Reset state for new user / guest
    setMessages([defaultWelcomeMessage]);
    setUserGraph(null);
    setUnifiedTopicNode(null);
    setExtractedTopics([]);
    setPipelineResult(null);
    setAttachedStory(null);
    setSelectedContext(null);

    if (effectiveUserId && effectiveUserId !== "usr_guest") {
      try {
        const localCached = localStorage.getItem(`aletheia_chat_session_${effectiveUserId}`);
        if (localCached) {
          const parsed = JSON.parse(localCached);
          if (parsed.messages && parsed.messages.length > 0) setMessages(parsed.messages);
          if (parsed.unifiedTopicNode) setUnifiedTopicNode(parsed.unifiedTopicNode);
          if (parsed.userGraph) setUserGraph(parsed.userGraph);
          if (parsed.extractedTopics && parsed.extractedTopics.length > 0) setExtractedTopics(parsed.extractedTopics);
          if (parsed.pipelineResult) setPipelineResult(parsed.pipelineResult);
        }
      } catch (e) {}
    }

    const loadSession = async () => {
      try {
        const res = await fetch(`/api/session?userId=${encodeURIComponent(effectiveUserId)}`);
        const data = await res.json();
        if (data.success) {
          if (data.is_authenticated) {
            if (data.messages && data.messages.length > 0) {
              setMessages(data.messages);
            }
            if (data.unified_topic_node) setUnifiedTopicNode(data.unified_topic_node);
            if (data.user_graph) setUserGraph(data.user_graph);
            if (data.extracted_topics && data.extracted_topics.length > 0) setExtractedTopics(data.extracted_topics);
          } else {
            // Unauthenticated Guest: ensure clean slate
            setMessages([defaultWelcomeMessage]);
            setUserGraph(null);
            setUnifiedTopicNode(null);
            setExtractedTopics([]);
            setPipelineResult(null);
          }
        }
      } catch (err) {
        console.error("Failed to load session:", err);
      }
    };
    loadSession();
  }, [effectiveUserId]);

  // Save to browser localStorage whenever state changes (only for authenticated users)
  useEffect(() => {
    if (
      effectiveUserId !== "usr_guest" &&
      (messages.length > 1 ||
        extractedTopics.length > 0 ||
        unifiedTopicNode ||
        userGraph ||
        pipelineResult)
    ) {
      try {
        localStorage.setItem(
          `aletheia_chat_session_${effectiveUserId}`,
          JSON.stringify({
            messages,
            unifiedTopicNode,
            userGraph,
            extractedTopics,
            pipelineResult,
            lastSaved: new Date().toISOString(),
          })
        );
      } catch (e) {}
    }
  }, [messages, unifiedTopicNode, userGraph, extractedTopics, pipelineResult, effectiveUserId]);

  // Derived accurate count of all tracked interests across Unified Topic Node, User Graph, and extracted topics
  const totalInterestsCount = (() => {
    const set = new Set<string>();
    if (unifiedTopicNode?.topics) {
      Object.keys(unifiedTopicNode.topics).forEach((t) => set.add(t));
    }
    if (userGraph?.topic_weights) {
      Object.keys(userGraph.topic_weights).forEach((t) => set.add(t));
    }
    extractedTopics.forEach((et) => {
      if (et.topic) set.add(et.topic);
    });
    return set.size;
  })();

  // Deletes only generated news content from state and storage (keeps chat & interests intact)
  const handleClearFeedContent = () => {
    setIsCollectingNews(false);
    setPipelineResult(null);
    setAttachedStory(null);
    setSelectedContext(null);
    setAiFeedFilter(null);

    try {
      const storageKey = `aletheia_chat_session_${effectiveUserId}`;
      const localCached = localStorage.getItem(storageKey);
      if (localCached) {
        const parsed = JSON.parse(localCached);
        parsed.pipelineResult = null;
        localStorage.setItem(storageKey, JSON.stringify(parsed));
      }
    } catch (e) {}
  };

  // Clean run: wipes previous feed and executes fresh content finding across all current active topics
  const handleFindNewsClean = async () => {
    setIsCollectingNews(false);
    setPipelineResult(null);
    setAttachedStory(null);
    setSelectedContext(null);
    setAiFeedFilter(null);

    try {
      const storageKey = `aletheia_chat_session_${effectiveUserId}`;
      const localCached = localStorage.getItem(storageKey);
      if (localCached) {
        const parsed = JSON.parse(localCached);
        parsed.pipelineResult = null;
        localStorage.setItem(storageKey, JSON.stringify(parsed));
      }
    } catch (e) {}

    await handleCollectNews();
  };

  const [isResettingProfile, setIsResettingProfile] = useState(false);
  const [isHarmonizing, setIsHarmonizing] = useState(false);

  // Harmonize & clean up interests (merges near-duplicates & splits compound topics)
  const handleHarmonizeInterests = async () => {
    setIsHarmonizing(true);
    try {
      const res = await fetch("/api/interests/harmonize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: effectiveUserId }),
      });
      const json = await res.json();
      if (json.success) {
        if (json.unified_topic_node) setUnifiedTopicNode(json.unified_topic_node);
        if (json.user_graph) setUserGraph(json.user_graph);
        setRefreshTrigger((prev) => prev + 1);
      }
    } catch (err) {
      console.error("Harmonization error:", err);
    } finally {
      setIsHarmonizing(false);
    }
  };

  // On-demand targeted curation pipeline execution for topics with no feed cards
  const handleTargetedCuration = async (curationQuery: string, canonicalTopic?: string) => {
    setIsCollectingNews(true);
    try {
      const res = await fetch("/api/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topics: [curationQuery],
          userId: effectiveUserId,
        }),
      });
      const json = await res.json();
      if (json.success && json.data?.feed_cards && json.data.feed_cards.length > 0) {
        const newCards = json.data.feed_cards;
        setPipelineResult((prev) => {
          if (!prev) return json.data;
          const prevCards = prev.feed_cards || [];
          const existingIds = new Set(prevCards.map((c: any) => c.event_id));
          const uniqueNew = newCards.filter((c: any) => !existingIds.has(c.event_id));
          return {
            ...prev,
            feed_cards: [...uniqueNew, ...prevCards],
          };
        });

        setAiFeedFilter({
          is_active: true,
          topic: canonicalTopic || curationQuery,
          matched_event_ids: newCards.map((c: any) => c.event_id),
          filter_reason: `Curated ${newCards.length} live stories for "${canonicalTopic || curationQuery}" matching our discussion.`,
        });
      }
    } catch (err) {
      console.warn("handleTargetedCuration error:", err);
    } finally {
      setIsCollectingNews(false);
    }
  };

  // Full reset (wipes user profile, mind-state memory, chat session in database & storage)
  const handleResetProfileAndSession = async () => {
    if (!window.confirm("Are you sure you want to reset your profile and start from scratch? This will clear your learned interests, psychological profile, chat history, and feed.")) {
      return;
    }

    setIsResettingProfile(true);
    try {
      try {
        localStorage.removeItem("aletheia_chat_session");
      } catch (e) {}

      const res = await fetch(`/api/session?userId=${effectiveUserId || "usr_guest"}`, {
        method: "DELETE",
      });
      const json = await res.json();

      const defaultWelcome: ChatMessage = {
        id: "welcome-msg",
        role: "assistant" as const,
        content:
          "Welcome to Aletheia. I'm your personalized epistemic companion built on the Mind-State Memory Architecture.\n\nExplore your curated news feed on the left, or discuss any story directly with me. As we talk, the Context Agent calibrates tone and safeguards, the Discovery Agent filters out sensationalist fluff, and the Observer Agent silently adapts to your evolving mindset.",
        timestamp: new Date().toISOString(),
      };

      setMessages([defaultWelcome]);
      setUserGraph(
        json.user_graph || {
          user_id: effectiveUserId || "usr_guest",
          topic_weights: {},
          cognitive_load_state: "balanced",
          historical_anchors: [],
          dwell_history: [],
          last_updated: new Date().toISOString(),
        }
      );
      setUnifiedTopicNode(json.unified_topic_node || null);
      setExtractedTopics([]);
      setPipelineResult(null);
      setAttachedStory(null);
      setSelectedContext(null);
      setAiFeedFilter(null);
      setRefreshTrigger((prev) => prev + 1);
    } catch (err) {
      console.error("Failed to reset profile:", err);
    } finally {
      setIsResettingProfile(false);
    }
  };

  const [chatError, setChatError] = useState<string | null>(null);

  // Send message to dual-intent conversational AI
  const handleSendMessage = async (e?: React.FormEvent, customHistory?: ChatMessage[]) => {
    if (e) e.preventDefault();
    const promptToSend = inputPrompt.trim();
    if (!promptToSend && (!customHistory || customHistory.length === 0)) return;

    let newHistory: ChatMessage[] = customHistory || messages;
    if (promptToSend) {
      const userMessage: ChatMessage = {
        id: `usr_${Date.now()}`,
        role: "user",
        content: promptToSend,
        timestamp: new Date().toISOString(),
        attached_story: attachedStory || undefined,
      };
      newHistory = [...messages, userMessage];
      setMessages(newHistory);
      setInputPrompt("");
    }

    setIsSendingChat(true);
    setChatError(null);

    try {
      const currentStoriesPayload =
        pipelineResult?.feed_cards?.map((c) => ({
          event_id: c.event_id,
          headline: c.headline,
          topic: c.topic,
          summary: c.summary,
          fact_bullets: c.fact_bullets,
          disputed_claims: c.disputed_claims,
        })) || [];

      const now = new Date();
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      const clientContext = {
        clientTime: now.toISOString(),
        timeZone: tz,
        localFormatted: now.toLocaleString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          timeZoneName: "short",
        }),
        location: tz.replace(/_/g, " "),
      };

      const botMessageId = `bot_${Date.now()}`;
      const initialBotMessage: ChatMessage = {
        id: botMessageId,
        role: "assistant",
        content: "",
        timestamp: new Date().toISOString(),
        attached_story: attachedStory || undefined,
      };

      setMessages([...newHistory, initialBotMessage]);

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          history: newHistory,
          userId: effectiveUserId,
          attachedStory: attachedStory || undefined,
          currentStories: currentStoriesPayload,
          clientContext,
        }),
      });

      if (!res.ok) {
        throw new Error(`Server responded with status ${res.status}`);
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      let accumulatedContent = "";

      if (!reader) throw new Error("ReadableStream not supported");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() || "";

        for (const block of blocks) {
          const eventMatch = /^event:\s*(\w+)/m.exec(block);
          const dataMatch = /^data:\s*(.+)$/m.exec(block);
          if (!eventMatch || !dataMatch) continue;

          const eventType = eventMatch[1];
          let data: any = {};
          try {
            data = JSON.parse(dataMatch[1]);
          } catch (e) {}

          if (eventType === "tool_start" && data.tool_name) {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === botMessageId
                  ? {
                      ...msg,
                      tool_executions: [
                        {
                          tool_name: data.tool_name,
                          query: data.query,
                          results_summary: "Searching live web wire...",
                          items_retrieved: 0,
                        },
                      ],
                    }
                  : msg
              )
            );
          } else if (eventType === "tool_complete" && data.tool_name) {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === botMessageId
                  ? {
                      ...msg,
                      tool_executions: [
                        {
                          tool_name: data.tool_name,
                          query: data.query,
                          results_summary: data.summary || "Retrieved live sources",
                          items_retrieved: data.sources?.length || 5,
                          sources: data.sources || [],
                        },
                      ],
                    }
                  : msg
              )
            );
          } else if (eventType === "token" && data.token) {
            accumulatedContent += data.token;
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === botMessageId
                  ? { ...msg, content: accumulatedContent }
                  : msg
              )
            );
          } else if (eventType === "meta" && data.success) {
            const metaData = data.data;
            if (data.unified_topic_node) setUnifiedTopicNode(data.unified_topic_node);
            if (data.user_graph) setUserGraph(data.user_graph);

            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === botMessageId
                  ? {
                      ...msg,
                      content: metaData.message || accumulatedContent,
                      trace_id: metaData.trace_id,
                      context_trace_id: metaData.context_trace_id,
                      tool_executions: metaData.tool_executions,
                      agent_internal_rationale: metaData.agent_internal_rationale,
                      context_generated: metaData.context_generated,
                    }
                  : msg
              )
            );

            if (
              metaData.active_feed_filter &&
              metaData.active_feed_filter.is_active &&
              (metaData.active_feed_filter.matched_event_ids?.length || metaData.active_feed_filter.topic)
            ) {
              setAiFeedFilter(metaData.active_feed_filter);

              if (
                metaData.active_feed_filter.trigger_targeted_curation &&
                (metaData.active_feed_filter.curation_query || metaData.active_feed_filter.topic)
              ) {
                handleTargetedCuration(
                  metaData.active_feed_filter.curation_query || metaData.active_feed_filter.topic,
                  metaData.active_feed_filter.topic
                );
              }
            } else {
              setAiFeedFilter(null);
            }

            if (metaData.extracted_topics && metaData.extracted_topics.length > 0) {
              setExtractedTopics((prev) => {
                const map = new Map<string, { topic: string; weight: number; reasoning: string }>();
                prev.forEach((t) => map.set(t.topic.toLowerCase(), t));
                metaData.extracted_topics.forEach((t: any) =>
                  map.set(t.topic.toLowerCase(), {
                    topic: t.topic,
                    weight: t.weight || 0.8,
                    reasoning: t.reasoning || "Learned from dialogue.",
                  })
                );
                return Array.from(map.values());
              });
            }
          } else if (eventType === "error") {
            throw new Error(data.message || "Chat streaming error");
          }
        }
      }

      setRefreshTrigger((prev) => prev + 1);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setChatError(errMsg);
    } finally {
      setIsSendingChat(false);
    }
  };

  // Run autonomous news ingestion across all active user topics
  const handleCollectNews = async (targetTopics?: string[]) => {
    setIsCollectingNews(true);
    try {
      const activeTopics = Array.from(
        new Set([
          ...(unifiedTopicNode ? Object.keys(unifiedTopicNode.topics || {}) : []),
          ...extractedTopics.map((t) => t.topic),
          ...(userGraph ? Object.keys(userGraph.topic_weights || {}) : []),
        ])
      );

      const topicsToFetch =
        targetTopics ||
        (activeTopics.length > 0
          ? activeTopics
          : ["Technology", "Science", "World News", "Artificial Intelligence"]);

      const res = await fetch("/api/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topics: topicsToFetch,
          userGraph: userGraph || undefined,
          userId: effectiveUserId,
          sessionId: `sess_${Date.now()}`,
        }),
      });

      const json = await res.json();
      if (json.success && json.data) {
        setPipelineResult(json.data);
        if (json.unified_topic_node) {
          setUnifiedTopicNode(json.unified_topic_node);
        } else if (json.data.unified_topic_node) {
          setUnifiedTopicNode(json.data.unified_topic_node);
        }
        if (json.data.user_graph) {
          setUserGraph(json.data.user_graph);
        }
      }
      setRefreshTrigger((prev) => prev + 1);
    } catch (err) {
      console.error("Pipeline run failed:", err);
    } finally {
      setIsCollectingNews(false);
    }
  };

  // Attach a specific story to the conversational companion
  const handleDiscussStory = (card: SynthesizedEventCard) => {
    const storyContext: AttachedStoryContext = {
      event_id: card.event_id,
      topic: card.topic,
      headline: card.headline,
      summary: card.summary,
      fact_bullets: card.fact_bullets,
      disputed_claims: card.disputed_claims,
      sources: card.sources,
    };
    setAttachedStory(storyContext);
    setCompanionTab("chat");
    setIsMobileCompanionOpen(true);

    // Set contextual target for devtools
    setSelectedContext({
      type: "story_card",
      event_id: card.event_id,
      topic: card.topic,
      card,
    });
  };

  // Inspect chat message in contextual DevTools (Context Envelope & Agentic Flow)
  const handleInspectChatTurn = (msg: ChatMessage) => {
    // Find preceding user prompt if available
    const msgIdx = messages.findIndex((m) => m.id === msg.id);
    const precedingUserMsg =
      msgIdx > 0 && messages[msgIdx - 1]?.role === "user"
        ? messages[msgIdx - 1].content
        : msg.role === "user"
        ? msg.content
        : undefined;

    setSelectedContext({
      type: "chat_turn",
      trace_id: msg.trace_id || msg.context_trace_id || `trace_${msg.id}`,
      message_id: msg.id,
      user_prompt: precedingUserMsg,
      assistant_response: msg.role === "assistant" ? msg.content : undefined,
      context_generated: msg.context_generated,
      agentic_flow: msg.context_generated?.agentic_flow,
      agent_internal_rationale: msg.agent_internal_rationale,
      tools_executed: msg.tool_executions,
    });
    setIsDevToolsOpen(true);
  };

  // Inspect topic in contextual DevTools
  const handleInspectTopic = (topic: { topic: string; weight: number; reasoning?: string; technical_depth?: any }) => {
    const topicMeta = unifiedTopicNode?.topics?.[topic.topic];
    const recentDiff = (unifiedTopicNode?.recent_topic_diffs || []).find(
      (d) => d.topic_name.toLowerCase() === topic.topic.toLowerCase()
    );

    setSelectedContext({
      type: "topic",
      topic_name: topic.topic,
      weight: topic.weight,
      reasoning: topic.reasoning || topicMeta?.why_they_care,
      technical_depth: topicMeta?.technical_depth,
      why_they_care: topicMeta?.why_they_care,
      curiosity_vectors: topicMeta?.curiosity_vectors,
      recent_diff: recentDiff,
    });
    setIsDevToolsOpen(true);
  };

  const rawFeedCards = pipelineResult?.feed_cards || [];
  
  // Categorize cards into revealed preferences, thematic bridges, and curiosity frontiers
  const feedCards = React.useMemo(() => {
    return rawFeedCards.map((card, idx) => {
      let category = card.discovery_category;
      if (!category) {
        const text = `${card.topic} ${card.headline}`.toLowerCase();
        if (
          text.includes("game") ||
          text.includes("steam") ||
          text.includes("quantum") ||
          text.includes("frontier") ||
          text.includes("fusion") ||
          card.is_exploration
        ) {
          category = "curiosity_frontier";
        } else if (
          text.includes("strategy") ||
          text.includes("trade") ||
          text.includes("naval") ||
          text.includes("doctrine") ||
          text.includes("asymmetry") ||
          (idx % 4 === 1)
        ) {
          category = "thematic_intersection";
        } else {
          category = "revealed_preference";
        }
      }
      return { ...card, discovery_category: category };
    });
  }, [rawFeedCards]);

  const distinctTopics = Array.from(new Set(feedCards.map((c) => c.topic)));

  const prefCount = feedCards.filter((c) => c.discovery_category === "revealed_preference").length;
  const bridgeCount = feedCards.filter((c) => c.discovery_category === "thematic_intersection").length;
  const frontierCount = feedCards.filter((c) => c.discovery_category === "curiosity_frontier").length;

  const filteredFeedCards = React.useMemo(() => {
    let pool = feedCards;

    // 1. AI conversational feed filter (if active and manual filter not explicitly set)
    if (selectedTopicFilter === "all" && aiFeedFilter && aiFeedFilter.is_active !== false) {
      const topicToFilter = aiFeedFilter.topic;
      if (topicToFilter && topicToFilter !== "all") {
        const semanticallyFiltered = filterFeedBySemanticAffinity(pool, topicToFilter, unifiedTopicNode, selectedCategoryFilter);
        if (semanticallyFiltered.length > 0) {
          return semanticallyFiltered;
        }
      }
      if (aiFeedFilter.matched_event_ids && aiFeedFilter.matched_event_ids.length > 0) {
        return pool.filter((c) => aiFeedFilter.matched_event_ids!.includes(c.event_id));
      }
    }

    // 2. Multi-Vector Semantic Affinity Filtering & Neural Graph Ranking
    return filterFeedBySemanticAffinity(pool, selectedTopicFilter, unifiedTopicNode, selectedCategoryFilter);
  }, [feedCards, selectedTopicFilter, selectedCategoryFilter, aiFeedFilter, unifiedTopicNode]);

  const topicBriefs = React.useMemo(() => {
    return buildTopicBriefs(feedCards, unifiedTopicNode);
  }, [feedCards, unifiedTopicNode]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col p-3 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 pb-24 lg:pb-8">
      {/* Platform Header Bar */}
      <header className="flex items-center justify-between gap-3 border-b border-white/10 pb-3 sm:pb-4">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-cyan-400 via-teal-400 to-indigo-500 flex items-center justify-center font-bold text-slate-950 text-base sm:text-lg shadow-lg shadow-cyan-500/20 flex-shrink-0">
            α
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white font-mono">ALETHEIA</h1>
              <span className="hidden sm:inline-flex px-1.5 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/30 text-[9px] font-mono text-emerald-400">
                ● Adaptive
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-400 font-medium truncate max-w-[200px] sm:max-w-none">
              Personalized Epistemic News & Intelligence
            </p>
          </div>
        </div>

        {/* Desktop Global Controls */}
        <div className="hidden lg:flex items-center gap-2.5">
          <a
            href="https://ciclops.io"
            target="_blank"
            rel="noreferrer"
            className="px-3 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-white/10 text-xs font-mono text-slate-300 hover:text-white flex items-center gap-1.5 transition"
            title="Switch to ciclops.io AI Resume Generator"
          >
            <Compass className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-semibold">ciclops.io</span>
            <ExternalLink className="w-3 h-3 text-slate-500" />
          </a>

          <button
            onClick={() => handleFindNewsClean()}
            disabled={isCollectingNews}
            className="px-3.5 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-semibold flex items-center gap-2 transition disabled:opacity-40"
            title="Fetches fresh news across your active interests"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isCollectingNews ? "animate-spin text-cyan-400" : ""}`} />
            <span>{isCollectingNews ? "Fetching News..." : "Refresh News"}</span>
          </button>

          <button
            onClick={() => handleClearFeedContent()}
            disabled={isCollectingNews}
            className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-white/10 text-xs transition"
            title="Clear the current news feed"
          >
            Clear Feed
          </button>

          <button
            onClick={() => handleResetProfileAndSession()}
            disabled={isResettingProfile}
            className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-rose-950/40 text-slate-400 hover:text-rose-300 border border-white/10 hover:border-rose-500/30 text-xs flex items-center gap-1.5 transition disabled:opacity-40"
            title="Clear your profile, learned topics, chat memory, and start from scratch"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isResettingProfile ? "animate-spin text-rose-400" : ""}`} />
            <span>{isResettingProfile ? "Resetting..." : "Reset Profile"}</span>
          </button>

          <button
            onClick={() => setIsDevToolsOpen(!isDevToolsOpen)}
            className={`px-3.5 py-2 rounded-xl text-xs font-mono font-semibold flex items-center gap-2 border transition ${
              isDevToolsOpen
                ? "bg-amber-500/20 text-amber-300 border-amber-500/50"
                : "bg-slate-900 text-slate-300 border-white/10 hover:border-cyan-500/30"
            }`}
          >
            <Terminal className="w-3.5 h-3.5 text-amber-400" />
            <span>DevTools {selectedContext ? `[${selectedContext.type}]` : ""}</span>
          </button>

          {/* Google OAuth Single Sign-On / Profile */}
          {authStatus === "loading" ? (
            <div className="w-24 h-8 rounded-xl bg-slate-900 animate-pulse border border-white/5" />
          ) : session?.user ? (
            <div className="flex items-center gap-2 bg-slate-900/90 border border-white/10 p-1.5 pl-2.5 rounded-xl text-xs font-mono">
              {session.user.image ? (
                <img
                  src={session.user.image}
                  alt={session.user.name || "User"}
                  className="w-5 h-5 rounded-full border border-white/20"
                />
              ) : (
                <User className="w-4 h-4 text-cyan-400" />
              )}
              <span className="text-slate-200 font-medium max-w-[130px] truncate">
                {session.user.name || session.user.email}
              </span>
              <button
                onClick={async () => {
                  try {
                    Object.keys(localStorage).forEach((key) => {
                      if (key.startsWith("aletheia_")) {
                        localStorage.removeItem(key);
                      }
                    });
                  } catch (e) {}
                  setMessages([defaultWelcomeMessage]);
                  setUserGraph(null);
                  setUnifiedTopicNode(null);
                  setExtractedTopics([]);
                  setPipelineResult(null);
                  setAttachedStory(null);
                  setSelectedContext(null);
                  await signOut();
                }}
                className="px-2 py-1 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/30 text-[10px] text-rose-300 transition"
                title="Sign out of ciclops.io"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <button
              onClick={() => signIn("google")}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-blue-500/20 transition"
              title="Sign in with your ciclops.io Google Account"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Sign In</span>
            </button>
          )}
        </div>

        {/* Mobile Header Quick Actions */}
        <div className="flex lg:hidden items-center gap-1.5">
          <button
            onClick={() => handleFindNewsClean()}
            disabled={isCollectingNews}
            className="p-2 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-500/30 transition disabled:opacity-40"
            title="Refresh News"
          >
            <RefreshCw className={`w-4 h-4 ${isCollectingNews ? "animate-spin text-cyan-400" : ""}`} />
          </button>

          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 rounded-xl bg-slate-900 border border-white/10 text-slate-200 hover:text-white transition"
            title="Open Menu"
          >
            <Menu className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Mobile Slide-Over Menu Sheet */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex justify-end">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="relative w-72 max-w-[85vw] bg-slate-950 border-l border-white/10 h-full p-5 flex flex-col justify-between shadow-2xl z-10 animate-in slide-in-from-right duration-200">
            <div className="space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-cyan-400 to-indigo-500 flex items-center justify-center font-bold text-slate-950 text-xs">
                    α
                  </div>
                  <span className="font-mono font-bold text-sm text-white">Menu & Controls</span>
                </div>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white bg-slate-900 border border-white/10"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* User Identity / Auth */}
              <div className="p-3 rounded-xl bg-slate-900/80 border border-white/5">
                {session?.user ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      {session.user.image ? (
                        <img
                          src={session.user.image}
                          alt={session.user.name || "User"}
                          className="w-7 h-7 rounded-full border border-white/20"
                        />
                      ) : (
                        <User className="w-6 h-6 text-cyan-400" />
                      )}
                      <div className="truncate">
                        <div className="text-xs font-semibold text-white truncate">{session.user.name}</div>
                        <div className="text-[10px] text-slate-400 truncate">{session.user.email}</div>
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        setIsMobileMenuOpen(false);
                        try {
                          Object.keys(localStorage).forEach((key) => {
                            if (key.startsWith("aletheia_")) localStorage.removeItem(key);
                          });
                        } catch (e) {}
                        setMessages([defaultWelcomeMessage]);
                        setUserGraph(null);
                        setUnifiedTopicNode(null);
                        setExtractedTopics([]);
                        setPipelineResult(null);
                        setAttachedStory(null);
                        setSelectedContext(null);
                        await signOut();
                      }}
                      className="w-full py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/30 text-xs text-rose-300 transition text-center font-medium"
                    >
                      Sign Out
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      signIn("google");
                    }}
                    className="w-full py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
                  >
                    <span>Sign In with Google</span>
                  </button>
                )}
              </div>

              {/* Navigation & Actions */}
              <div className="space-y-2 text-xs">
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    handleFindNewsClean();
                  }}
                  disabled={isCollectingNews}
                  className="w-full p-2.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 flex items-center gap-2.5 font-medium transition text-left"
                >
                  <RefreshCw className={`w-4 h-4 ${isCollectingNews ? "animate-spin text-cyan-400" : ""}`} />
                  <span>{isCollectingNews ? "Fetching News..." : "Refresh News Feed"}</span>
                </button>

                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    handleClearFeedContent();
                  }}
                  className="w-full p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-white/10 flex items-center gap-2.5 transition text-left"
                >
                  <Filter className="w-4 h-4 text-slate-400" />
                  <span>Clear Feed Stories</span>
                </button>

                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    handleResetProfileAndSession();
                  }}
                  disabled={isResettingProfile}
                  className="w-full p-2.5 rounded-xl bg-slate-900 hover:bg-rose-950/40 text-rose-300 border border-rose-500/20 flex items-center gap-2.5 transition text-left"
                >
                  <RotateCcw className={`w-4 h-4 ${isResettingProfile ? "animate-spin" : ""}`} />
                  <span>Reset Profile & Memory</span>
                </button>

                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    setIsDevToolsOpen(true);
                  }}
                  className="w-full p-2.5 rounded-xl bg-slate-900 hover:bg-amber-950/40 text-amber-300 border border-amber-500/20 flex items-center gap-2.5 transition text-left"
                >
                  <Terminal className="w-4 h-4 text-amber-400" />
                  <span>Inspect System DevTools</span>
                </button>

                <a
                  href="https://ciclops.io"
                  target="_blank"
                  rel="noreferrer"
                  className="w-full p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-white/10 flex items-center justify-between transition"
                >
                  <div className="flex items-center gap-2.5">
                    <Compass className="w-4 h-4 text-cyan-400" />
                    <span>ciclops.io</span>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                </a>
              </div>
            </div>

            <div className="pt-4 border-t border-white/10 text-center text-[10px] text-slate-500 font-mono">
              ALETHEIA v0.1 • Mind-State Memory
            </div>
          </div>
        </div>
      )}

      {/* MAIN UNIFIED DASHBOARD: FEED (Left 62%) + AMBIENT COMPANION (Right 38%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start pb-20 lg:pb-0">
        {/* LEFT COLUMN: THE PERSONALIZED EPISTEMIC FEED (7 of 12 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Primary View Switcher: Story Feed vs Topic Briefs */}
          <div className="flex items-center justify-between gap-3 bg-slate-900/60 p-1.5 rounded-2xl border border-white/10">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setActiveViewMode("stories")}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                  activeViewMode === "stories"
                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Newspaper className="w-3.5 h-3.5" />
                <span>Story Feed</span>
                <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                  {filteredFeedCards.length}
                </span>
              </button>

              <button
                onClick={() => setActiveViewMode("briefs")}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                  activeViewMode === "briefs"
                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Topic Briefs</span>
                <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                  {topicBriefs.length}
                </span>
              </button>
            </div>

            <span className="text-[11px] font-mono text-slate-400 hidden sm:inline-block pr-2">
              {activeViewMode === "stories" ? "Granular Wire Stream" : "Aggregated Topic Intelligence"}
            </span>
          </div>

          {/* Unified Epistemic Filter Command Bar (for Story Feed view) */}
          {activeViewMode === "stories" && (
            <div className="glass-panel rounded-2xl p-3 sm:p-4 border border-white/10 flex flex-wrap items-center justify-between gap-3">
              {/* Left: Discovery Horizon Segmented Switcher */}
              <div className="flex flex-wrap items-center gap-1 bg-slate-900/80 p-1 rounded-xl border border-white/5 text-xs font-mono">
                <button
                  onClick={() => setSelectedCategoryFilter("all")}
                  className={`px-3 py-1.5 rounded-lg transition font-medium ${
                    selectedCategoryFilter === "all"
                      ? "bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40 shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  All ({feedCards.length})
                </button>
                <button
                  onClick={() => setSelectedCategoryFilter("revealed_preference")}
                  className={`px-3 py-1.5 rounded-lg transition font-medium ${
                    selectedCategoryFilter === "revealed_preference"
                      ? "bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40 shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  🎯 Preferences ({prefCount})
                </button>
              <button
                onClick={() => setSelectedCategoryFilter("thematic_intersection")}
                className={`px-3 py-1.5 rounded-lg transition font-medium ${
                  selectedCategoryFilter === "thematic_intersection"
                    ? "bg-violet-500/20 text-violet-300 font-bold border border-violet-500/40 shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                🌉 Bridges ({bridgeCount})
              </button>
              <button
                onClick={() => setSelectedCategoryFilter("curiosity_frontier")}
                className={`px-3 py-1.5 rounded-lg transition font-medium ${
                  selectedCategoryFilter === "curiosity_frontier"
                    ? "bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40 shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                🚀 Frontiers ({frontierCount})
              </button>
            </div>

            {/* Right Controls: Topic Popover & Cognitive Mode */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Topic Filter Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setIsTopicDropdownOpen(!isTopicDropdownOpen)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-mono flex items-center gap-2 border transition ${
                    selectedTopicFilter !== "all"
                      ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40 font-bold"
                      : "bg-slate-900/80 text-slate-300 border-white/10 hover:border-cyan-500/30"
                  }`}
                >
                  <Filter className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="max-w-[150px] truncate">
                    {selectedTopicFilter === "all" ? "All Topics" : selectedTopicFilter}
                  </span>
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                </button>

                {/* Popover Dropdown Menu */}
                {isTopicDropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-20"
                      onClick={() => setIsTopicDropdownOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-72 glass-panel bg-slate-950/95 border border-white/20 rounded-xl shadow-2xl p-2 z-30 space-y-1 text-xs font-mono animate-in fade-in zoom-in-95 duration-150">
                      <button
                        onClick={() => {
                          setSelectedTopicFilter("all");
                          setIsTopicDropdownOpen(false);
                        }}
                        className={`w-full px-3 py-2 rounded-lg text-left flex items-center justify-between transition ${
                          selectedTopicFilter === "all"
                            ? "bg-cyan-500/20 text-cyan-300 font-bold"
                            : "text-slate-300 hover:bg-slate-900"
                        }`}
                      >
                        <span>All Topics</span>
                        <span className="text-slate-500 font-bold">({feedCards.length})</span>
                      </button>

                      {distinctTopics.map((topic, i) => {
                        const count = feedCards.filter((c) => c.topic.toLowerCase() === topic.toLowerCase()).length;
                        return (
                          <button
                            key={i}
                            onClick={() => {
                              setSelectedTopicFilter(topic);
                              setIsTopicDropdownOpen(false);
                            }}
                            className={`w-full px-3 py-2 rounded-lg text-left flex items-center justify-between transition ${
                              selectedTopicFilter.toLowerCase() === topic.toLowerCase()
                                ? "bg-cyan-500/20 text-cyan-300 font-bold"
                                : "text-slate-300 hover:bg-slate-900"
                            }`}
                          >
                            <span className="truncate pr-2">{topic}</span>
                            <span className="text-slate-500">({count})</span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              {/* Cognitive Load Mode Switcher */}
              <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-xl border border-white/5 text-xs font-mono">
                {(["low", "balanced", "deep_dive"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setCognitiveLoad(mode)}
                    className={`px-2.5 py-1 rounded-lg capitalize text-[11px] transition ${
                      cognitiveLoad === mode
                        ? "bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold shadow-sm"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {mode.replace("_", " ")}
                  </button>
                ))}
              </div>
            </div>
          </div>
          )}

          {/* TOPIC BRIEFS DASHBOARD (when activeViewMode === 'briefs') */}
          {activeViewMode === "briefs" ? (
            <div className="space-y-4 animate-in fade-in duration-200">
              {topicBriefs.length === 0 ? (
                <div className="glass-panel rounded-2xl p-12 text-center border border-white/10 space-y-4">
                  <BookOpen className="w-8 h-8 text-cyan-400 mx-auto opacity-80" />
                  <div className="text-sm font-semibold text-slate-200">
                    No topic dossiers available yet. Refresh or converse with Aletheia to generate briefs.
                  </div>
                </div>
              ) : (
                topicBriefs.map((brief, bIdx) => {
                  const isHighVelocity = brief.velocity_status === "breaking" || brief.velocity_status === "active";

                  return (
                    <div
                      key={bIdx}
                      className={`glass-panel rounded-2xl p-5 border transition duration-200 space-y-4 ${
                        isHighVelocity
                          ? "border-cyan-500/40 shadow-lg shadow-cyan-950/30"
                          : "border-white/10 hover:border-white/20"
                      }`}
                    >
                      {/* Topic Header & Velocity Badge */}
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-2 max-w-xl">
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                              <span>{brief.topic}</span>
                            </h3>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-semibold">
                              {Math.round(brief.weight * 100)}% Priority
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono capitalize bg-slate-800 text-slate-300 border border-white/5">
                              {brief.technical_depth}
                            </span>
                          </div>

                          {/* Living Narrative */}
                          <p className="text-xs text-slate-300 font-sans leading-relaxed">
                            {brief.living_narrative || brief.why_they_care}
                          </p>

                          {/* Likes & Angles / Critiques & Anti-Preferences */}
                          <div className="flex flex-wrap items-center gap-1.5 pt-1">
                            {brief.likes_and_angles && brief.likes_and_angles.map((like, lIdx) => (
                              <span
                                key={lIdx}
                                className="px-2 py-0.5 rounded-md bg-emerald-950/60 border border-emerald-500/30 text-[10px] font-mono text-emerald-300 flex items-center gap-1"
                              >
                                <span>✓</span>
                                <span>{like}</span>
                              </span>
                            ))}
                            {brief.dislikes_and_critiques && brief.dislikes_and_critiques.map((dislike, dIdx) => (
                              <span
                                key={dIdx}
                                className="px-2 py-0.5 rounded-md bg-rose-950/60 border border-rose-500/30 text-[10px] font-mono text-rose-300 flex items-center gap-1"
                              >
                                <span>✕</span>
                                <span>{dislike}</span>
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Velocity Status Pill */}
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-3 py-1 rounded-xl text-xs font-mono font-semibold flex items-center gap-1.5 border ${
                              brief.velocity_status === "breaking"
                                ? "bg-rose-950/70 border-rose-500/50 text-rose-300"
                                : brief.velocity_status === "active"
                                ? "bg-emerald-950/70 border-emerald-500/50 text-emerald-300"
                                : brief.velocity_status === "recent"
                                ? "bg-amber-950/70 border-amber-500/50 text-amber-300"
                                : "bg-slate-900 border-white/10 text-slate-400"
                            }`}
                          >
                            {brief.velocity_label}
                          </span>
                        </div>
                      </div>

                      {/* Key Development Highlights */}
                      {brief.key_highlights.length > 0 ? (
                        <div className="space-y-3 pt-2 border-t border-white/5">
                          <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                            <Flame className="w-3.5 h-3.5 text-amber-400" />
                            Recent Development Highlights ({brief.key_highlights.length})
                          </span>

                          <div className="space-y-2.5">
                            {brief.key_highlights.map((highlight, hIdx) => (
                              <div
                                key={hIdx}
                                className="p-3.5 rounded-xl bg-slate-900/80 border border-white/5 space-y-2 hover:border-cyan-500/20 transition"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <h4 className="text-sm font-bold text-slate-100 hover:text-cyan-300 transition">
                                    {sanitizeDisplay(highlight.headline)}
                                  </h4>
                                  <span className="text-[10px] font-mono text-slate-400 flex-shrink-0">
                                    {highlight.recency_label}
                                  </span>
                                </div>

                                <p className="text-xs text-slate-300 leading-relaxed">
                                  {sanitizeDisplay(highlight.summary)}
                                </p>

                                {/* Fact Bullets */}
                                {highlight.facts.length > 0 && (
                                  <div className="space-y-1 pt-1">
                                    {highlight.facts.slice(0, 2).map((fact, fIdx) => (
                                      <div key={fIdx} className="flex items-start gap-1.5 text-xs text-slate-300 font-mono">
                                        <span className="text-emerald-400">•</span>
                                        <span>{sanitizeDisplay(fact.replace(/^[•\s-]+/, ""))}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 rounded-xl bg-slate-900/40 border border-white/5 text-center text-xs text-slate-400 font-mono">
                          No major new developments detected this week. Wire is actively monitoring for updates.
                        </div>
                      )}

                      {/* Sources & Action Controls Footer */}
                      <div className="pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs">
                        {/* Corroborating Primary Sources */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[10px] font-mono text-slate-500">Sources:</span>
                          {brief.all_sources.slice(0, 4).map((src, sIdx) => (
                            <button
                              key={sIdx}
                              onClick={() => setSelectedReadingSource({ source: src, card: brief.stories[0] || ({} as any) })}
                              className="px-2 py-0.5 rounded bg-slate-900 hover:bg-cyan-950/60 hover:text-cyan-300 border border-white/5 text-[11px] text-slate-300 font-mono transition"
                            >
                              {src.name}
                            </button>
                          ))}
                          {brief.all_sources.length > 4 && (
                            <span className="text-[10px] font-mono text-slate-500">
                              +{brief.all_sources.length - 4} more
                            </span>
                          )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2">
                          {brief.story_count > 0 && (
                            <button
                              onClick={() => {
                                setSelectedTopicFilter(brief.topic);
                                setSelectedCategoryFilter("all");
                                setActiveViewMode("stories");
                              }}
                              className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-white/10 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition"
                            >
                              <Newspaper className="w-3.5 h-3.5 text-slate-400" />
                              <span>View Stories ({brief.story_count})</span>
                            </button>
                          )}
                          <button
                            onClick={() => {
                              const synthStory = brief.stories[0];
                              if (synthStory) {
                                handleDiscussStory(synthStory);
                              }
                            }}
                            className="px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 text-xs font-semibold flex items-center gap-1.5 transition"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>Discuss Topic</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            <>
              {/* AI Focus Filter Banner (if active) */}
              {aiFeedFilter && aiFeedFilter.is_active !== false && (
                <div className="p-3.5 rounded-2xl bg-cyan-950/70 border border-cyan-500/40 flex items-center justify-between shadow-xl shadow-cyan-950/50 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="flex items-center gap-2.5 text-xs text-cyan-200">
                    <Sparkles className="w-4 h-4 text-cyan-400 flex-shrink-0 animate-pulse" />
                    <span>
                      <strong className="text-cyan-300 font-semibold">AI Feed Focus:</strong>{" "}
                      {aiFeedFilter.filter_reason || `Focusing on "${aiFeedFilter.topic}"`}
                      <span className="text-cyan-400/80 text-[11px] ml-1.5 font-mono">
                        ({filteredFeedCards.length} matching {filteredFeedCards.length === 1 ? "story" : "stories"})
                      </span>
                    </span>
                  </div>
                  <button
                    onClick={() => setAiFeedFilter(null)}
                    className="px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white text-xs border border-white/10 flex items-center gap-1.5 transition font-medium flex-shrink-0"
                    title="Override and view all news stories"
                  >
                    <X className="w-3.5 h-3.5 text-slate-400" />
                    <span>Show All Stories</span>
                  </button>
                </div>
              )}

              {/* Active Manual Topic Filter Banner */}
              {selectedTopicFilter !== "all" && (
                <div className="p-3.5 rounded-2xl bg-cyan-950/80 border border-cyan-500/50 flex items-center justify-between shadow-xl shadow-cyan-950/50 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="flex items-center gap-2.5 text-xs text-cyan-200">
                    <Filter className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                    <span>
                      <span className="text-slate-400">Filtering by Topic:</span>{" "}
                      <strong className="text-cyan-300 font-bold text-sm font-mono">&quot;{selectedTopicFilter}&quot;</strong>
                      <span className="text-cyan-400/90 text-xs ml-2 font-mono px-2 py-0.5 rounded bg-cyan-900/60 border border-cyan-500/30">
                        {filteredFeedCards.length} {filteredFeedCards.length === 1 ? "story" : "stories"}
                      </span>
                    </span>
                  </div>
                  <button
                    onClick={() => setSelectedTopicFilter("all")}
                    className="px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 hover:text-white text-xs border border-white/15 flex items-center gap-1.5 transition font-mono font-medium flex-shrink-0"
                    title="Clear topic filter"
                  >
                    <X className="w-3.5 h-3.5 text-slate-400" />
                    <span>Show All ({feedCards.length})</span>
                  </button>
                </div>
              )}

          {/* Stories Stream */}
          {filteredFeedCards.length === 0 ? (
            <div className="glass-panel rounded-2xl p-12 text-center border border-white/10 space-y-4">
              {isCollectingNews ? (
                <>
                  <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mx-auto" />
                  <div className="text-sm font-semibold text-slate-200">
                    Finding & synthesizing fresh news stories across active interests...
                  </div>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-8 h-8 text-cyan-400 mx-auto opacity-80" />
                  <div className="text-sm font-semibold text-slate-200">
                    {feedCards.length === 0 ? "Feed Cleared" : `No stories found for "${selectedTopicFilter}".`}
                  </div>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    {feedCards.length === 0
                      ? `Your news stream is empty. Your conversation history and ${totalInterestsCount} tracked interests are preserved.`
                      : "Try clearing your topic filter or selecting All Topics from the dropdown."}
                  </p>
                  <div className="flex items-center justify-center gap-3 pt-2">
                    {selectedTopicFilter !== "all" && (
                      <button
                        onClick={() => setSelectedTopicFilter("all")}
                        className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-mono text-xs inline-flex items-center gap-1.5 transition border border-white/10"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Clear Topic Filter</span>
                      </button>
                    )}
                    <button
                      onClick={() => handleFindNewsClean()}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-400 to-teal-400 text-slate-950 font-bold text-xs inline-flex items-center gap-2 hover:opacity-90 transition shadow-lg shadow-cyan-500/20"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Refresh News</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {filteredFeedCards.map((card) => {
                const isExpanded = expandedCardIds.has(card.event_id);
                const isAttached = attachedStory?.event_id === card.event_id;

                return (
                  <article
                    key={card.event_id}
                    className={`glass-panel rounded-2xl p-4 sm:p-6 border transition-all duration-300 ${
                      isAttached
                        ? "border-cyan-500/60 shadow-2xl shadow-cyan-950/40 ring-1 ring-cyan-500/30"
                        : "border-white/10 hover:border-white/20"
                    }`}
                  >
                    {/* Top Metadata Row: Topic Badge, Time Ago, Sources, & Action Buttons */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-3 sm:pb-4 border-b border-white/5">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTopicFilter(card.topic);
                            setSelectedCategoryFilter("all");
                            setAiFeedFilter(null);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-300 text-[11px] font-mono font-semibold transition cursor-pointer flex items-center gap-1 shadow-sm"
                          title={`Filter feed by "${card.topic}"`}
                        >
                          <Filter className="w-3 h-3 text-cyan-400" />
                          <span>{card.topic}</span>
                        </button>
                        <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
                          <Clock className="w-3.5 h-3.5 text-amber-400" />
                          <span>{card.recency_label || "Today"}</span>
                          <span>•</span>
                          <span className="text-slate-400">
                            {card.sources.length} sources corroborating
                          </span>
                        </div>
                      </div>

                      {/* Card Action Controls */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleDiscussStory(card)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition border ${
                            isAttached
                              ? "bg-cyan-500 text-slate-950 border-cyan-400 font-bold"
                              : "bg-cyan-500/20 text-cyan-300 border-cyan-500/30 hover:bg-cyan-500/30"
                          }`}
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>{isAttached ? "Active in Chat" : "Discuss with Aletheia"}</span>
                        </button>
                        <button
                          onClick={() => {
                            setSelectedContext({
                              type: "story_card",
                              event_id: card.event_id,
                              topic: card.topic,
                              card,
                            });
                            setIsDevToolsOpen(true);
                          }}
                          className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-amber-300 border border-white/10 transition"
                          title="Inspect Agent Reasoning in DevTools"
                        >
                          <Terminal className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Semantic Match Reason Callout (when filtering by topic) */}
                    {selectedTopicFilter !== "all" && (card as any).semantic_match_reason && (
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-cyan-950/40 border border-cyan-500/25 text-[11px] font-mono text-cyan-200 mt-2.5">
                        <Sparkles className="w-3 h-3 text-cyan-400 flex-shrink-0 animate-pulse" />
                        <span className="truncate">
                          <strong className="text-cyan-300 font-semibold">Semantic Context:</strong> {(card as any).semantic_match_reason}
                        </span>
                      </div>
                    )}

                    {/* Cognitive Load Mode: LOW (Executive Distill Mode) */}
                    {cognitiveLoad === "low" ? (
                      <div className="space-y-2.5 pt-1">
                        {/* Compact Headline */}
                        <h3
                          className="text-lg font-bold text-white tracking-tight leading-snug hover:text-cyan-300 transition cursor-pointer"
                          onClick={() => toggleCardExpansion(card.event_id)}
                        >
                          {sanitizeDisplay(card.headline)}
                        </h3>

                        {/* 1-Sentence Executive Bottom Line */}
                        <p className="text-sm text-slate-200 font-normal leading-relaxed">
                          {sanitizeDisplay(card.summary.split(/(?<=[.!?])\s+/)[0] || card.summary)}
                        </p>

                        {/* Top 2 Key Fact Bullets */}
                        {card.fact_bullets && card.fact_bullets.length > 0 && (
                          <div className="space-y-1.5 pt-1">
                            {card.fact_bullets.slice(0, 2).map((bullet, bIdx) => (
                              <div key={bIdx} className="flex items-start gap-2 text-xs text-slate-300 font-mono">
                                <span className="text-emerald-400 font-bold">•</span>
                                <span>{sanitizeDisplay(bullet.replace(/^[•\s-]+/, ""))}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Compact Sources Strip */}
                        <div className="pt-2 flex items-center justify-between text-[11px] font-mono text-slate-500 border-t border-white/5">
                          <span>{card.sources[0]?.name || "Verified Wire"} ({card.sources.length} sources)</span>
                          <button
                            onClick={() => handleDiscussStory(card)}
                            className="text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1 transition"
                          >
                            <MessageSquare className="w-3 h-3" />
                            Discuss
                          </button>
                        </div>
                      </div>
                    ) : cognitiveLoad === "deep_dive" ? (
                      /* Cognitive Load Mode: DEEP DIVE (Comprehensive Intelligence Memo) */
                      <div className="space-y-4 pt-1">
                        {/* Cinematic Image Banner */}
                        {card.image_url && (
                          <div className="relative w-full h-48 sm:h-56 rounded-xl overflow-hidden border border-white/10 bg-slate-900 mt-2">
                            <img
                              src={card.image_url}
                              alt={card.headline}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                              loading="lazy"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = "none";
                              }}
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-transparent" />
                            <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between text-[11px] font-mono text-white/90">
                              <span className="px-2.5 py-1 rounded-md bg-indigo-950/90 border border-indigo-500/40 text-indigo-200 font-bold flex items-center gap-1.5">
                                <Sparkles className="w-3 h-3 text-indigo-400" />
                                Deep Epistemic Memo
                              </span>
                              <span className="px-2 py-0.5 rounded-md bg-slate-950/80 backdrop-blur-md border border-white/10 text-slate-300">
                                {card.sources[0]?.name || "Verified Wire"}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Full Headline */}
                        <h3 className="text-xl font-bold text-white tracking-tight leading-snug">
                          {sanitizeDisplay(card.headline)}
                        </h3>

                        {/* Full Epistemic Synthesis Narrative */}
                        <div className="space-y-3 font-sans">
                          <p className="text-base text-slate-100 font-normal leading-relaxed">
                            {card.summary
                              .split(/(?<=[.!?])\s+/)
                              .filter((s) => s.trim().length > 0)
                              .map((sentence, sIdx) => (
                                <span
                                  key={sIdx}
                                  onClick={() => {
                                    const clean = sentence.toLowerCase();
                                    const matchingSource =
                                      card.sources.find((src) =>
                                        (src.raw_text || "").toLowerCase().includes(clean.slice(0, 25))
                                      ) || card.sources[0];
                                    const enriched: EventSourceArticle = {
                                      ...matchingSource,
                                      highlighted_passages: [sentence, ...(matchingSource.highlighted_passages || [])],
                                    };
                                    setSelectedReadingSource({ source: enriched, card });
                                  }}
                                  className="hover:bg-cyan-500/20 hover:text-cyan-100 cursor-pointer transition rounded px-1 -mx-1 inline-block"
                                  title="Click to view original source reporting and highlighted passage"
                                >
                                  {sanitizeDisplay(sentence)}{" "}
                                </span>
                              ))}
                          </p>

                          {card.expansion_text && card.expansion_text.trim().length > 20 && (
                            <p className="text-sm text-slate-300 leading-relaxed border-l-2 border-indigo-500/40 pl-3">
                              {sanitizeDisplay(card.expansion_text)}
                            </p>
                          )}
                        </div>

                        {/* Verified Key Facts Matrix */}
                        {card.fact_bullets && card.fact_bullets.length > 0 && (
                          <div className="p-3 rounded-xl bg-slate-900/80 border border-white/10 space-y-2">
                            <span className="text-[11px] font-mono text-emerald-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Verified Consensus Facts
                            </span>
                            <div className="space-y-1.5 text-xs text-slate-200 font-sans">
                              {card.fact_bullets.map((bullet, bIdx) => (
                                <div key={bIdx} className="flex items-start gap-2">
                                  <span className="text-emerald-400 font-bold">•</span>
                                  <span>{sanitizeDisplay(bullet.replace(/^[•\s-]+/, ""))}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Disputed Claims / Divergence Analysis (if present) */}
                        {card.disputed_claims && card.disputed_claims.length > 0 && (
                          <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/30 space-y-2">
                            <span className="text-[11px] font-mono text-amber-300 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                              <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                              Contested Assertions & Partisan Divergence
                            </span>
                            <div className="space-y-1.5 text-xs text-amber-100 font-sans">
                              {card.disputed_claims.map((claim, cIdx) => (
                                <div key={cIdx} className="flex items-start gap-2">
                                  <span className="text-amber-400 font-bold">⚠</span>
                                  <span>{sanitizeDisplay(typeof claim === "string" ? claim : (claim as any).claim || JSON.stringify(claim))}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Comprehensive Sources Grid */}
                        <div className="pt-3 border-t border-white/10 space-y-2">
                          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1">
                            <BookOpen className="w-3 h-3 text-slate-400" />
                            Corroborating Primary Sources ({card.sources.length}):
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {card.sources.map((src, i) => (
                              <button
                                key={i}
                                onClick={() => setSelectedReadingSource({ source: src, card })}
                                className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-cyan-950/60 hover:text-cyan-200 border border-white/10 text-xs text-slate-300 flex items-center gap-1.5 transition hover:border-cyan-500/40 font-mono group"
                              >
                                <span className="group-hover:underline font-semibold">{src.name}</span>
                                <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 group-hover:text-cyan-400">
                                  {src.bias.replace("_", " ")}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* Cognitive Load Mode: BALANCED (Standard Epistemic Flow) */
                      <>
                        {/* Cinematic News Image Banner */}
                        {card.image_url && (
                          <div
                            className="relative w-full h-44 sm:h-52 rounded-xl overflow-hidden cursor-pointer group/img border border-white/10 bg-slate-900 mt-3"
                            onClick={() => toggleCardExpansion(card.event_id)}
                          >
                            <img
                              src={card.image_url}
                              alt={card.headline}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-500"
                              loading="lazy"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = "none";
                              }}
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-transparent" />
                            <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between text-[11px] font-mono text-white/90">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedTopicFilter(card.topic);
                                  setSelectedCategoryFilter("all");
                                  setAiFeedFilter(null);
                                }}
                                className="px-2 py-0.5 rounded-md bg-slate-950/80 hover:bg-cyan-950 border border-cyan-500/40 text-cyan-300 font-semibold cursor-pointer transition"
                                title={`Filter feed by "${card.topic}"`}
                              >
                                {card.topic}
                              </button>
                              <span className="px-2 py-0.5 rounded-md bg-slate-950/80 backdrop-blur-md border border-white/10 text-slate-300">
                                {card.sources[0]?.name || "Verified Wire"}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Headline */}
                        <h3
                          className="text-xl font-bold text-white tracking-tight leading-snug hover:text-cyan-300 transition cursor-pointer"
                          onClick={() => toggleCardExpansion(card.event_id)}
                        >
                          {sanitizeDisplay(card.headline)}
                        </h3>

                        {/* Lead Paragraph Hook */}
                        <div className="space-y-3 font-sans pt-1">
                          <p className="text-base text-slate-100 font-normal leading-relaxed">
                            {card.summary
                              .split(/(?<=[.!?])\s+/)
                              .filter((s) => s.trim().length > 0)
                              .map((sentence, sIdx) => (
                                <span
                                  key={sIdx}
                                  onClick={() => {
                                    const clean = sentence.toLowerCase();
                                    const matchingSource =
                                      card.sources.find((src) =>
                                        (src.raw_text || "").toLowerCase().includes(clean.slice(0, 25))
                                      ) || card.sources[0];

                                    const enriched: EventSourceArticle = {
                                      ...matchingSource,
                                      highlighted_passages: [sentence, ...(matchingSource.highlighted_passages || [])],
                                    };
                                    setSelectedReadingSource({ source: enriched, card });
                                  }}
                                  className="hover:bg-cyan-500/20 hover:text-cyan-100 cursor-pointer transition rounded px-1 -mx-1 inline-block"
                                  title="Click to view original source reporting and highlighted passage"
                                >
                                  {sanitizeDisplay(sentence)}{" "}
                                </span>
                              ))}
                          </p>
                        </div>

                        {/* Expand / Collapse Action Bar */}
                        <div className="pt-2 flex items-center justify-between border-t border-white/5">
                          <button
                            onClick={() => toggleCardExpansion(card.event_id)}
                            className="text-xs font-mono text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1.5 transition py-1 group"
                          >
                            {isExpanded ? (
                              <>
                                <span>Collapse Story</span>
                                <ChevronUp className="w-3.5 h-3.5 group-hover:-translate-y-0.5 transition" />
                              </>
                            ) : (
                              <>
                                <span>Read Full Story & Sources ({card.sources.length})</span>
                                <ChevronDown className="w-3.5 h-3.5 group-hover:translate-y-0.5 transition" />
                              </>
                            )}
                          </button>

                          {!isExpanded && (
                            <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-500">
                              <span>
                                {card.sources.map((s) => s.name).slice(0, 2).join(", ")}
                                {card.sources.length > 2 ? ` +${card.sources.length - 2} more` : ""}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Expandable Body Narrative & Sources Section */}
                        {isExpanded && (
                          <div className="space-y-4 pt-2 border-t border-white/10 animate-in fade-in duration-200">
                            {/* Detailed Narrative Paragraphs */}
                            {card.expansion_text && card.expansion_text.trim().length > 20 && (
                              <p className="text-sm text-slate-300 leading-relaxed">
                                {card.expansion_text
                                  .split(/(?<=[.!?])\s+/)
                                  .filter((s) => s.trim().length > 0)
                                  .map((sentence, sIdx) => (
                                    <span
                                      key={sIdx}
                                      onClick={() => {
                                        const clean = sentence.toLowerCase();
                                        const matchingSource =
                                          card.sources.find((src) =>
                                            (src.raw_text || "").toLowerCase().includes(clean.slice(0, 25))
                                          ) || card.sources[0];

                                        const enriched: EventSourceArticle = {
                                          ...matchingSource,
                                          highlighted_passages: [sentence, ...(matchingSource.highlighted_passages || [])],
                                        };
                                        setSelectedReadingSource({ source: enriched, card });
                                      }}
                                      className="hover:bg-cyan-500/20 hover:text-cyan-100 cursor-pointer transition rounded px-1 -mx-1 inline-block"
                                      title="Click to view original source reporting and highlighted passage"
                                    >
                                      {sanitizeDisplay(sentence)}{" "}
                                    </span>
                                  ))}
                              </p>
                            )}

                            {/* Minimalist Sources Footer */}
                            <div className="pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-[10px] font-mono text-slate-500 flex items-center gap-1">
                                  <BookOpen className="w-3 h-3 text-slate-400" />
                                  Sources:
                                </span>
                                {card.sources.map((src, i) => (
                                  <button
                                    key={i}
                                    onClick={() => setSelectedReadingSource({ source: src, card })}
                                    className="px-2.5 py-1 rounded-lg bg-slate-900/90 hover:bg-cyan-950/60 hover:text-cyan-200 border border-white/10 text-[11px] text-slate-300 flex items-center gap-1.5 transition hover:border-cyan-500/40 group font-mono"
                                    title="Click to read original article and see highlighted passages"
                                  >
                                    <span className="group-hover:underline">{src.name}</span>
                                    <span className="text-[9px] uppercase text-slate-500 group-hover:text-cyan-400">
                                      [{src.bias.replace("_", " ")}]
                                    </span>
                                  </button>
                                ))}
                              </div>

                              <span className="text-[10px] font-mono text-slate-500 italic">
                                Click any sentence above to inspect source passage
                              </span>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </article>
                );
              })}
            </div>
          )}
          </>
          )}
        </div>

        {/* RIGHT COLUMN: AMBIENT CONVERSATIONAL COMPANION & GRAPH (5 of 12 cols, desktop only) */}
        <div
          className="hidden lg:flex lg:col-span-5 glass-panel rounded-2xl p-4 sm:p-5 border border-white/10 flex-col h-[calc(100vh-140px)] min-h-[640px] max-h-[850px] sticky top-4"
        >
          {/* Header & Tab Switcher (Conversation vs Interests & Why) */}
          <div className="border-b border-white/10 pb-3 mb-3 flex-shrink-0 space-y-2">
            <div className="flex items-center justify-between">
              {/* Segmented View Switcher */}
              <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-white/10 text-xs font-mono">
                <button
                  onClick={() => {
                    setCompanionTab("chat");
                    setMobileTab("dialogue");
                  }}
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
                  onClick={() => {
                    setCompanionTab("interests");
                    setMobileTab("interests");
                  }}
                  className={`px-3 py-1 rounded-lg font-semibold flex items-center gap-1.5 transition ${
                    companionTab === "interests"
                      ? "bg-cyan-500 text-slate-950 shadow-sm shadow-cyan-500/20 font-bold"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Brain className="w-3.5 h-3.5" />
                  <span>
                    Interests ({totalInterestsCount})
                  </span>
                </button>
              </div>

              <span className="text-[10px] font-mono text-cyan-400 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Adaptive
              </span>
            </div>

            {/* Attached Story Pill Banner (in chat mode) */}
            {companionTab === "chat" && (
              attachedStory ? (
                <div className="p-2.5 rounded-xl bg-cyan-950/60 border border-cyan-500/40 flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 truncate">
                    <MessageSquare className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                    <span className="truncate text-cyan-200 font-medium">
                      Discussing: {attachedStory.headline}
                    </span>
                  </div>
                  <button
                    onClick={() => setAttachedStory(null)}
                    className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white transition flex-shrink-0"
                    title="Detach Story"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="text-[11px] text-slate-400 font-mono">
                  General dialogue active. Click <em>"Discuss"</em> on any news card to focus.
                </div>
              )
            )}
          </div>

          {/* VIEW 1: DIALOGUE CHAT */}
          {companionTab === "chat" ? (
            !session?.user ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-4 bg-slate-900/40 rounded-2xl border border-white/5 my-auto">
                <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div className="space-y-1.5 max-w-[280px]">
                  <h3 className="text-sm font-bold text-white font-mono">Sign In to Activate Aletheia</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Authentication is required to converse with the AI companion, calibrate technical depth, and build your persistent Mind-State memory graph.
                  </p>
                </div>
                <button
                  onClick={() => signIn("google")}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-blue-500/20 transition"
                  title="Sign in with your Google account"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="currentColor"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Sign In with Google</span>
                </button>
              </div>
            ) : (
              <>
                {/* Message History (Internal Scroll Container) */}
                <div ref={chatScrollContainerRef} className="flex-1 overflow-y-auto space-y-4 pr-2">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex items-start gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      {msg.role === "assistant" && (
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-cyan-500 to-violet-500 flex items-center justify-center font-bold text-white text-xs flex-shrink-0">
                          α
                        </div>
                      )}
                      {msg.role === "assistant" ? (
                        <div className="flex flex-col gap-1.5 max-w-[88%]">
                          {/* Live Tool Execution Badges & Clickable Sources */}
                          {msg.tool_executions && msg.tool_executions.length > 0 && (
                            <div className="space-y-1.5 mb-1.5">
                              {msg.tool_executions.map((tool, tIdx) => (
                                <div
                                  key={tIdx}
                                  className="p-2.5 rounded-xl bg-cyan-950/70 border border-cyan-500/40 text-[10px] font-mono text-cyan-300 space-y-2 shadow-md shadow-black/20"
                                >
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className={`w-1.5 h-1.5 rounded-full ${tool.items_retrieved > 0 ? "bg-emerald-400" : "bg-cyan-400 animate-ping"}`} />
                                    <span className="font-bold">
                                      {tool.tool_name === "search_internet" ? "🌐 Live Web Wire Search:" : "🧠 Local Knowledge Lookup:"}
                                    </span>
                                    <span className="text-slate-300 truncate max-w-[200px]" title={tool.query}>"{tool.query}"</span>
                                    <span className={`font-bold ml-auto ${tool.items_retrieved > 0 ? "text-emerald-400" : "text-cyan-400 animate-pulse"}`}>
                                      {tool.items_retrieved > 0 ? `(${tool.items_retrieved} sources)` : "Searching live..."}
                                    </span>
                                  </div>

                                  {/* Clickable Retrieved Sources Tray */}
                                  {tool.sources && tool.sources.length > 0 && (
                                    <div className="pt-1.5 border-t border-cyan-500/20 flex flex-wrap items-center gap-1.5">
                                      <span className="text-[9px] text-slate-400 uppercase tracking-wider font-semibold">Sources:</span>
                                      {tool.sources.map((src, sIdx) => (
                                        <button
                                          key={sIdx}
                                          onClick={() =>
                                            setSelectedReadingSource({
                                              source: src,
                                              card: {
                                                event_id: `live_${sIdx}`,
                                                topic: tool.query,
                                                headline: src.title || src.name,
                                                personalized_framing: "Live wire search source reporting.",
                                                summary: src.raw_text || src.title || "Live reporting ingested from search wire.",
                                                fact_bullets: src.highlighted_passages || [src.raw_text?.slice(0, 150) || src.title || ""],
                                                disputed_claims: [],
                                                verified_entities: [],
                                                sources: [src],
                                                format: "bulleted_distillation",
                                                published_at: src.published_at || new Date().toISOString(),
                                              },
                                            })
                                          }
                                          className="px-2 py-0.5 rounded-md bg-slate-900/90 hover:bg-cyan-900/80 text-slate-200 hover:text-cyan-200 border border-white/10 hover:border-cyan-400/50 flex items-center gap-1 text-[10px] transition group"
                                          title={`Click to read original reporting from ${src.name}: "${src.title || src.name}"`}
                                        >
                                          <span className="truncate max-w-[130px] font-sans font-medium">{src.name || "Wire"}</span>
                                          <ExternalLink className="w-2.5 h-2.5 text-cyan-400 group-hover:text-cyan-200 flex-shrink-0" />
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed bg-slate-900/90 text-slate-200 border border-white/10 rounded-tl-none whitespace-pre-wrap">
                            {msg.content}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 pl-1 pt-0.5">
                            <button
                              onClick={() => handleInspectChatTurn(msg)}
                              className="text-[10px] font-mono text-cyan-300 hover:text-cyan-100 bg-cyan-950/60 hover:bg-cyan-900/80 px-2.5 py-1 rounded-lg border border-cyan-500/40 flex items-center gap-1.5 transition font-semibold shadow-sm"
                              title="Inspect Context Envelope and Agentic Flow for this Message"
                            >
                              <Brain className="w-3 h-3 text-cyan-400" />
                              <span>Inspect Context & Flow</span>
                              {msg.context_generated?.calibrated_depth && (
                                <span className="px-1.5 py-0.2 rounded bg-cyan-900/80 text-cyan-200 text-[9px] uppercase border border-cyan-400/30">
                                  {msg.context_generated.calibrated_depth}
                                </span>
                              )}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="max-w-[88%] p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed bg-gradient-to-r from-cyan-600 to-teal-600 text-white rounded-tr-none shadow-lg shadow-cyan-900/20">
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
                    <div className="flex items-center gap-2.5 text-xs text-slate-400 pl-9">
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
                </div>

                {/* Chat Input Form (Pinned Bottom) */}
                <form onSubmit={handleSendMessage} className="pt-2 border-t border-white/10 flex items-center gap-2 flex-shrink-0">
                  <input
                    type="text"
                    value={inputPrompt}
                    onChange={(e) => setInputPrompt(e.target.value)}
                    placeholder={attachedStory ? "Ask a question about this story..." : "Share a thought, curiosity, or question..."}
                    className="flex-1 bg-slate-900/80 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition"
                  />
                  <button
                    type="submit"
                    disabled={!inputPrompt.trim() || isSendingChat}
                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 to-teal-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 hover:opacity-90 transition disabled:opacity-40 flex-shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
              </>
            )
          ) : (
            /* VIEW 2: MY INTERESTS (EPISTEMIC KNOWLEDGE GRAPH MODEL) */
            <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs">
              <div className="space-y-3">
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
                        className="text-[10px] font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-500/30 hover:border-cyan-500/50"
                        title="Harmonize and clean up interests (merges near-duplicates & splits compound topics)"
                      >
                        <Sparkles className={`w-3 h-3 text-cyan-400 ${isHarmonizing ? "animate-spin" : ""}`} />
                        <span>{isHarmonizing ? "Harmonizing..." : "Harmonize"}</span>
                      </button>
                      <button
                        onClick={() => handleResetProfileAndSession()}
                        disabled={isResettingProfile}
                        className="text-[10px] font-mono text-rose-400 hover:text-rose-300 flex items-center gap-1 transition"
                        title="Clear interests and start from scratch"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Reset</span>
                      </button>
                    </div>
                  )}
                </div>

                {(() => {
                  const topicMap = new Map<string, TopicMetadata>();

                  // 1. Unified Topic Node (Primary Source of Truth)
                  if (unifiedTopicNode?.topics) {
                    for (const [topic, meta] of Object.entries(unifiedTopicNode.topics)) {
                      topicMap.set(topic, meta);
                    }
                  }

                  // 2. User Graph (Legacy fallback)
                  if (userGraph?.topic_weights) {
                    for (const [topic, weight] of Object.entries(userGraph.topic_weights)) {
                      if (!topicMap.has(topic)) {
                        topicMap.set(topic, {
                          weight,
                          why_they_care: `Explicit dialogue interest in ${topic}.`,
                          technical_depth: "practitioner",
                          living_narrative: `Explicit dialogue interest in ${topic}.`,
                        });
                      }
                    }
                  }

                  // 3. Extracted Topics
                  for (const et of extractedTopics) {
                    if (et.topic && !topicMap.has(et.topic)) {
                      topicMap.set(et.topic, {
                        weight: et.weight || 0.6,
                        why_they_care: et.reasoning || `Identified from conversational focus on ${et.topic}.`,
                        technical_depth: "practitioner",
                        living_narrative: et.reasoning || `Identified from conversational focus on ${et.topic}.`,
                      });
                    }
                  }

                  const entries = Array.from(topicMap.entries()).sort((a, b) => b[1].weight - a[1].weight);

                  if (entries.length === 0) {
                    return (
                      <div className="p-6 rounded-xl bg-slate-900/50 border border-white/5 text-center text-slate-400 space-y-2">
                        <p>No explicit interests revealed yet.</p>
                        <p className="text-[11px] text-slate-500">
                          Chat with Aletheia about topics you care about to map your interests here.
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
                            className="p-4 rounded-xl bg-slate-900/90 border border-white/10 space-y-3 hover:border-cyan-500/40 transition shadow-lg shadow-black/20"
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

                            {/* Living Perspective / Narrative */}
                            <div className="space-y-1">
                              <span className="text-[10px] font-mono text-cyan-400 font-semibold flex items-center gap-1">
                                <Sparkles className="w-3 h-3 text-cyan-400" />
                                <span>Living Perspective:</span>
                              </span>
                              <p className="text-slate-300 text-xs leading-relaxed">
                                {data.living_narrative || data.why_they_care}
                              </p>
                            </div>

                            {/* What You Value (Likes & Angles) */}
                            {data.likes_and_angles && data.likes_and_angles.length > 0 && (
                              <div className="space-y-1 pt-0.5">
                                <span className="text-[10px] font-mono text-emerald-400 font-semibold block">
                                  What You Value:
                                </span>
                                <div className="flex flex-wrap gap-1">
                                  {data.likes_and_angles.map((like: string, lIdx: number) => (
                                    <span
                                      key={lIdx}
                                      className="px-2 py-0.5 rounded-md bg-emerald-950/50 border border-emerald-500/30 text-[10px] font-mono text-emerald-300 flex items-center gap-1"
                                    >
                                      <span>✓</span>
                                      <span>{like}</span>
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Critiques & Anti-Preferences (Dislikes) */}
                            {data.dislikes_and_critiques && data.dislikes_and_critiques.length > 0 && (
                              <div className="space-y-1 pt-0.5">
                                <span className="text-[10px] font-mono text-rose-400 font-semibold block">
                                  Critiques & Anti-Preferences:
                                </span>
                                <div className="flex flex-wrap gap-1">
                                  {data.dislikes_and_critiques.map((dislike: string, dIdx: number) => (
                                    <span
                                      key={dIdx}
                                      className="px-2 py-0.5 rounded-md bg-rose-950/50 border border-rose-500/30 text-[10px] font-mono text-rose-300 flex items-center gap-1"
                                    >
                                      <span>✕</span>
                                      <span>{dislike}</span>
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Curiosity Vectors Tags */}
                            {data.curiosity_vectors && data.curiosity_vectors.length > 0 && (
                              <div className="flex flex-wrap gap-1 pt-0.5">
                                {data.curiosity_vectors.map((vec: string, vIdx: number) => (
                                  <span
                                    key={vIdx}
                                    className="px-1.5 py-0.5 rounded bg-slate-800 text-[9px] font-mono text-slate-400 border border-white/5"
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
                                    <span>Evolution Timeline ({timeline.length} {timeline.length === 1 ? "entry" : "entries"})</span>
                                  </span>
                                  <ChevronDown
                                    className={`w-3 h-3 transition transform ${isTimelineOpen ? "rotate-180" : ""}`}
                                  />
                                </button>

                                {isTimelineOpen && (
                                  <div className="space-y-1.5 pl-2 border-l border-cyan-500/30 text-[11px] font-mono text-slate-300 pt-1 animate-in fade-in duration-150">
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

                            {/* Topic Actions */}
                            <div className="pt-1.5 flex items-center justify-between border-t border-white/5">
                              <button
                                onClick={() =>
                                  handleInspectTopic({
                                    topic,
                                    weight: data.weight,
                                    reasoning: data.living_narrative || data.why_they_care,
                                    technical_depth: data.technical_depth as any,
                                  })
                                }
                                className="text-[10px] font-mono text-cyan-300 hover:text-cyan-100 bg-cyan-950/70 hover:bg-cyan-900/90 px-2 py-0.5 rounded border border-cyan-500/30 flex items-center gap-1 transition"
                              >
                                <Sliders className="w-2.5 h-2.5 text-cyan-400" />
                                <span>Inspect Node</span>
                              </button>

                              <button
                                onClick={() => {
                                  setSelectedTopicFilter(topic);
                                  setSelectedCategoryFilter("all");
                                  setAiFeedFilter(null);
                                  setActiveViewMode("stories");
                                  setMobileTab("feed");
                                  setCompanionTab("chat");
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

                {/* Curiosity Frontiers */}
                {(userGraph?.adjacent_curiosity_frontiers || []).length > 0 && (
                  <div className="space-y-2 pt-3 border-t border-white/10">
                    <span className="text-[11px] font-mono text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                      Curiosity Frontiers:
                    </span>
                    {userGraph?.adjacent_curiosity_frontiers?.map((f, i) => (
                      <div key={i} className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/20 space-y-1">
                        <div className="font-semibold text-emerald-200">{f.topic}</div>
                        <p className="text-slate-300 text-xs">{f.rationale}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Knowledge Graph Harmonization History & Audit Trail */}
                {(unifiedTopicNode?.harmonization_runs || []).length > 0 && (
                  <div className="space-y-3 pt-3 border-t border-white/10">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono text-cyan-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                        Harmonization Audit Trail ({unifiedTopicNode?.harmonization_runs?.length || 0}):
                      </span>
                    </div>

                    <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
                      {unifiedTopicNode?.harmonization_runs?.map((run, rIdx) => (
                        <div
                          key={rIdx}
                          className="p-3.5 rounded-xl bg-slate-900/80 border border-white/10 hover:border-violet-500/40 transition space-y-2"
                        >
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2 font-mono">
                              <span
                                className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase border ${
                                  run.trigger_source === "background_observer"
                                    ? "bg-amber-950/70 text-amber-300 border-amber-500/30"
                                    : "bg-emerald-950/70 text-emerald-300 border-emerald-500/30"
                                }`}
                              >
                                {run.trigger_source === "background_observer" ? "Background Run" : "Manual Run"}
                              </span>
                              <span className="text-slate-400 text-[10px]">
                                {new Date(run.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            </div>

                            <button
                              onClick={() => {
                                setSelectedContext({
                                  type: "harmonization_run",
                                  run,
                                });
                                setIsDevToolsOpen(true);
                              }}
                              className="text-[10px] font-mono text-cyan-300 hover:text-cyan-100 bg-cyan-950/70 hover:bg-cyan-900 px-2 py-0.5 rounded border border-cyan-500/30 transition flex items-center gap-1"
                            >
                              <span>Inspect Run</span>
                              <span>→</span>
                            </button>
                          </div>

                          <p className="text-slate-200 text-xs leading-relaxed">{run.summary}</p>

                          {/* Action Badges */}
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {run.actions?.map((act, aIdx) => (
                              <span
                                key={aIdx}
                                className={`px-2 py-0.5 rounded text-[9px] font-mono border ${
                                  act.type === "merge"
                                    ? "bg-cyan-950/60 text-cyan-300 border-cyan-500/30"
                                    : act.type === "split"
                                    ? "bg-amber-950/60 text-amber-300 border-amber-500/30"
                                    : act.type === "delete"
                                    ? "bg-rose-950/60 text-rose-300 border-rose-500/30"
                                    : "bg-emerald-950/60 text-emerald-300 border-emerald-500/30"
                                }`}
                              >
                                {act.type.toUpperCase()}: {act.source_topics.join(", ")}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Floating Ambient Companion Quick-Bar & Expandable Sheet for Mobile */}
      <MobileCompanionSheet
        isOpen={isMobileCompanionOpen}
        onOpen={() => setIsMobileCompanionOpen(true)}
        onClose={() => setIsMobileCompanionOpen(false)}
        companionTab={companionTab}
        setCompanionTab={setCompanionTab}
        session={session}
        signIn={signIn}
        messages={messages}
        chatInput={inputPrompt}
        setChatInput={setInputPrompt}
        isSendingChat={isSendingChat}
        chatError={chatError}
        handleSendMessage={handleSendMessage}
        handleInspectChatTurn={handleInspectChatTurn}
        chatScrollContainerRef={chatScrollContainerRef}
        attachedStory={attachedStory}
        setAttachedStory={setAttachedStory}
        unifiedTopicNode={unifiedTopicNode}
        userGraph={userGraph}
        extractedTopics={extractedTopics}
        totalInterestsCount={totalInterestsCount}
        handleInspectTopic={handleInspectTopic}
        setSelectedTopicFilter={(topic: string) => {
          setSelectedTopicFilter(topic);
          setSelectedCategoryFilter("all");
          setAiFeedFilter(null);
        }}
        handleHarmonizeInterests={handleHarmonizeInterests}
        isHarmonizing={isHarmonizing}
        handleResetProfileAndSession={handleResetProfileAndSession}
        isResettingProfile={isResettingProfile}
        setSelectedContext={setSelectedContext}
        setIsDevToolsOpen={setIsDevToolsOpen}
      />

      {/* Mobile Fixed Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-slate-950/95 backdrop-blur-xl border-t border-white/10 px-4 py-2 flex items-center justify-around pb-safe shadow-2xl">
        <button
          onClick={() => {
            setIsMobileCompanionOpen(false);
            setMobileTab("feed");
          }}
          className={`flex flex-col items-center gap-0.5 transition px-3 py-1 rounded-xl ${
            !isMobileCompanionOpen && mobileTab === "feed" ? "text-cyan-400 font-bold" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <div className="relative">
            <Newspaper className="w-5 h-5" />
            {feedCards.length > 0 && (
              <span className="absolute -top-1.5 -right-3 px-1.5 py-0.2 bg-cyan-500 text-slate-950 text-[9px] font-mono font-bold rounded-full">
                {feedCards.length}
              </span>
            )}
          </div>
          <span className="text-[10px] font-mono">Feed</span>
        </button>

        <button
          onClick={() => {
            setCompanionTab("chat");
            setIsMobileCompanionOpen(true);
          }}
          className={`flex flex-col items-center gap-0.5 transition px-3 py-1 rounded-xl ${
            isMobileCompanionOpen && companionTab === "chat" ? "text-cyan-400 font-bold" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <div className="relative">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-cyan-500 to-violet-500 flex items-center justify-center font-bold text-white text-xs shadow-sm">
              α
            </div>
            {attachedStory && (
              <span className="absolute -top-1 -right-1.5 w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping" />
            )}
          </div>
          <span className="text-[10px] font-mono">Dialogue</span>
        </button>

        <button
          onClick={() => {
            setCompanionTab("interests");
            setIsMobileCompanionOpen(true);
          }}
          className={`flex flex-col items-center gap-0.5 transition px-3 py-1 rounded-xl ${
            isMobileCompanionOpen && companionTab === "interests" ? "text-cyan-400 font-bold" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <div className="relative">
            <Brain className="w-5 h-5" />
            {totalInterestsCount > 0 && (
              <span className="absolute -top-1.5 -right-3 px-1.5 py-0.2 bg-violet-500 text-white text-[9px] font-mono font-bold rounded-full">
                {totalInterestsCount}
              </span>
            )}
          </div>
          <span className="text-[10px] font-mono">Interests</span>
        </button>

        <button
          onClick={() => setIsDevToolsOpen(true)}
          className="flex flex-col items-center gap-0.5 transition px-3 py-1 rounded-xl text-slate-400 hover:text-cyan-300"
        >
          <Sliders className="w-5 h-5" />
          <span className="text-[10px] font-mono">DevTools</span>
        </button>
      </nav>

      {/* Interactive Original Source Article Reader Modal with Highlighted Passages */}
      {selectedReadingSource && (
        <SourceReaderModal
          source={selectedReadingSource.source}
          card={selectedReadingSource.card}
          onClose={() => setSelectedReadingSource(null)}
          onDiscuss={(c) => {
            setSelectedReadingSource(null);
            handleDiscussStory(c);
          }}
        />
      )}

      {/* Global Contextually Aware DevTools Drawer */}
      <DevToolsPanel
        isOpen={isDevToolsOpen}
        onToggle={() => setIsDevToolsOpen(!isDevToolsOpen)}
        userGraph={userGraph}
        unifiedTopicNode={unifiedTopicNode}
        refreshTrigger={refreshTrigger}
        selectedContext={selectedContext}
        onSelectContext={setSelectedContext}
        isCollectingNews={isCollectingNews}
      />
    </div>
  );
}
