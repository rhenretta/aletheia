import { z } from "zod";

/**
 * Generates an immutable, deterministic or UUID-based topic GUID
 * Format: "top_[alphanumeric_slug]"
 */
export function generateTopicId(name?: string): string {
  if (!name || name.trim().length === 0) {
    return `top_${Math.random().toString(36).substring(2, 11)}`;
  }
  const cleanSlug = name
    .replace(/\([^)]*\)/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);

  return cleanSlug ? `top_${cleanSlug}` : `top_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Raw article ingested from web sources / MCP
 */
export interface RawArticle {
  source_url: string;
  source_name: string;
  title: string;
  raw_text: string;
  author_bias_rating: "far_left" | "lean_left" | "center" | "lean_right" | "far_right" | "unknown";
  published_at?: string;
  author?: string;
  topic_id?: string;
  topic_category?: string;
  image_url?: string;
  content_format?: "news_article" | "social_post" | "discussion_thread";
  platform?: "reddit" | "bluesky" | "substack" | "youtube" | "fediverse" | "open_web";
}

export const RawArticleSchema = z.object({
  source_url: z.string().url(),
  source_name: z.string(),
  title: z.string(),
  raw_text: z.string().min(1),
  author_bias_rating: z.enum(["far_left", "lean_left", "center", "lean_right", "far_right", "unknown"]),
  published_at: z.string().optional(),
  author: z.string().optional(),
  topic_id: z.string().optional(),
  topic_category: z.string().optional(),
  image_url: z.string().optional(),
  content_format: z.enum(["news_article", "social_post", "discussion_thread"]).optional(),
  platform: z.enum(["reddit", "bluesky", "substack", "youtube", "fediverse", "open_web"]).optional(),
});

/**
 * Disputed claim item identified during cross-referencing
 */
export interface DisputedClaim {
  claim: string;
  asserted_by: string[];
  contested_by: string[];
  divergence_reason: string;
}

export const DisputedClaimSchema = z.object({
  claim: z.string(),
  asserted_by: z.array(z.string()),
  contested_by: z.array(z.string()),
  divergence_reason: z.string(),
});

/**
 * Chronological timeline item
 */
export interface TimelineItem {
  timestamp_iso: string;
  verified_event: string;
  sources: string[];
}

export const TimelineItemSchema = z.object({
  timestamp_iso: z.string(),
  verified_event: z.string(),
  sources: z.array(z.string()),
});

/**
 * Sanitized, unbiased pure factual output from Node A (The Epistemology Agent)
 */
export interface PureFactObject {
  event_id: string;
  topic_id?: string;
  topic: string;
  verified_entities: string[];
  timeline: TimelineItem[];
  agreed_facts: string[];
  disputed_claims: DisputedClaim[];
  adjective_density_score: number; // Low score indicates stripped emotional framing
  sanitized_timestamp: string;
  source_articles?: RawArticle[];
}

export const PureFactObjectSchema = z.object({
  event_id: z.string(),
  topic_id: z.string().optional(),
  topic: z.string(),
  verified_entities: z.array(z.string()),
  timeline: z.array(TimelineItemSchema),
  agreed_facts: z.array(z.string()),
  disputed_claims: z.array(DisputedClaimSchema),
  adjective_density_score: z.number().min(0).max(1),
  sanitized_timestamp: z.string(),
  source_articles: z.array(RawArticleSchema).optional(),
});

/**
 * Cognitive load preference state for Node D synthesis
 */
export type CognitiveLoadState = "low" | "balanced" | "deep_dive";

/**
 * Passive telemetry event recorded from client interactions
 */
export interface BehavioralTelemetry {
  session_id: string;
  article_id: string;
  topic: string;
  dwell_time_ms: number;
  scroll_depth_pct: number; // 0 to 100
  session_abandoned: boolean;
  timestamp: string;
}

export const BehavioralTelemetrySchema = z.object({
  session_id: z.string(),
  article_id: z.string(),
  topic: z.string(),
  dwell_time_ms: z.number().nonnegative(),
  scroll_depth_pct: z.number().min(0).max(100),
  session_abandoned: z.boolean(),
  timestamp: z.string(),
});

/**
 * Intersectional synthesis connecting multiple distinct user interests
 */
export interface InterestIntersection {
  interest_a: string;
  interest_b: string;
  intersection_theme: string;
  hypothesis: string;
}

export const InterestIntersectionSchema = z.object({
  interest_a: z.string(),
  interest_b: z.string(),
  intersection_theme: z.string(),
  hypothesis: z.string(),
});

/**
 * Adjacent frontier topic identified at the boundary of user knowledge
 */
export interface AdjacentCuriosityFrontier {
  topic: string;
  connected_to: string[];
  rationale: string;
}

export const AdjacentCuriosityFrontierSchema = z.object({
  topic: z.string(),
  connected_to: z.array(z.string()),
  rationale: z.string(),
});

/**
/**
 * Technical Depth Level for Intellectual Calibration
 */
export type TechnicalDepth = "introductory" | "practitioner" | "expert" | "deep_technical";

export interface TopicEvolutionEntry {
  timestamp: string;
  insight: string;
  trigger_source?: string;
  evidence?: string;
}

export const TopicEvolutionEntrySchema = z.object({
  timestamp: z.string(),
  insight: z.string(),
  trigger_source: z.string().optional(),
  evidence: z.string().optional(),
});

/**
 * Topic Metadata in Unified Topic Node (A Living Topic Dossier)
 */
export interface TopicMetadata {
  topic_id?: string; // Immutable topic GUID (e.g. "top_1f8a9e2d")
  weight: number; // 0.0 - 1.0
  what_they_care_about?: string; // Core focus, sub-domains, and technical dimensions (What the user is interested in)
  why_they_care: string; // Underlying intellectual motivation, stakes, and worldview (Why they care)
  presentation_strategy?: string; // Editorial directive on how to curate, filter, and present stories (How best to present)
  technical_depth: TechnicalDepth;
  living_narrative?: string; // Rich evolving synthesis of user's perspective on this topic
  likes_and_angles?: string[]; // Preferred angles, dimensions, and features
  dislikes_and_critiques?: string[]; // Anti-preferences, hype to filter out, critiques
  curiosity_vectors?: string[];
  aliases?: string[]; // Known acronyms and alternative names
  evolution_timeline?: TopicEvolutionEntry[]; // Chronological timeline of how the perspective evolved
  last_discussed_at?: string;
}

export const TopicMetadataSchema = z.object({
  topic_id: z.string().optional(),
  weight: z.number().min(0).max(1),
  what_they_care_about: z.string().optional(),
  why_they_care: z.string(),
  presentation_strategy: z.string().optional(),
  technical_depth: z.enum(["introductory", "practitioner", "expert", "deep_technical"]),
  living_narrative: z.string().optional(),
  likes_and_angles: z.array(z.string()).optional(),
  dislikes_and_critiques: z.array(z.string()).optional(),
  curiosity_vectors: z.array(z.string()).optional(),
  aliases: z.array(z.string()).optional(),
  evolution_timeline: z.array(TopicEvolutionEntrySchema).optional(),
  last_discussed_at: z.string().optional(),
});

/**
 * Psychological Profile & Emotional Trajectory for Context Agent (The Empath)
 */
export interface PsychologicalProfile {
  emotional_trajectory: string; // e.g. "curious and analytical", "fatigued by hype cycles", "seeking agency and sanctuary"
  sensitivities: string[]; // Topics or framings requiring careful, respectful nuance
  boundaries: string[]; // Strict conversational or topical limits
  communication_style: string; // e.g. "direct, intellectually rigorous, zero condescension, grounded peer"
}

export const PsychologicalProfileSchema = z.object({
  emotional_trajectory: z.string(),
  sensitivities: z.array(z.string()),
  boundaries: z.array(z.string()),
  communication_style: z.string(),
});

/**
 * News Discovery Parameters for Discovery Agent (The Curator)
 */
export interface DiscoveryParameters {
  signal_threshold: number; // 0.0 - 1.0 (minimum information density and empirical rigor)
  anti_preferences: string[]; // Unhelpful, low-effort, or sensationalist topics/keywords to reject
  exploration_rate: number; // Epsilon parameter for serendipity (e.g. 0.20)
  depth_requirement: TechnicalDepth;
}

export const DiscoveryParametersSchema = z.object({
  signal_threshold: z.number().min(0).max(1),
  anti_preferences: z.array(z.string()),
  exploration_rate: z.number().min(0).max(1),
  depth_requirement: z.enum(["introductory", "practitioner", "expert", "deep_technical"]),
});

/**
 * Structured Delta Diff for Topic State Transitions
 */
export interface TopicUpdateDiff {
  topic_name: string;
  timestamp: string;
  trigger_source: "observer_agent" | "dialogue_agent" | "telemetry_agent" | "interest_harmonizer";
  reasoning: string;
  evidence?: string;
  previous_state: {
    weight: number;
    technical_depth: TechnicalDepth;
    why_they_care: string;
    curiosity_vectors: string[];
  };
  current_state: {
    weight: number;
    technical_depth: TechnicalDepth;
    why_they_care: string;
    curiosity_vectors: string[];
  };
  weight_delta: number;
  depth_changed: boolean;
  why_changed: boolean;
  vectors_added?: string[];
  vectors_removed?: string[];
}

export const TopicUpdateDiffSchema = z.object({
  topic_name: z.string(),
  timestamp: z.string(),
  trigger_source: z.enum(["observer_agent", "dialogue_agent", "telemetry_agent", "interest_harmonizer"]),
  reasoning: z.string(),
  evidence: z.string().optional(),
  previous_state: z.object({
    weight: z.number(),
    technical_depth: z.enum(["introductory", "practitioner", "expert", "deep_technical"]),
    why_they_care: z.string(),
    curiosity_vectors: z.array(z.string()),
  }),
  current_state: z.object({
    weight: z.number(),
    technical_depth: z.enum(["introductory", "practitioner", "expert", "deep_technical"]),
    why_they_care: z.string(),
    curiosity_vectors: z.array(z.string()),
  }),
  weight_delta: z.number(),
  depth_changed: z.boolean(),
  why_changed: z.boolean(),
  vectors_added: z.array(z.string()).optional(),
  vectors_removed: z.array(z.string()).optional(),
});

/**
 * Action taken during knowledge graph harmonization
 */
export interface HarmonizationAction {
  type: "merge" | "split" | "normalize" | "delete" | "edit";
  source_topics: string[];
  resulting_topics: string[];
  rationale: string;
  before_state?: Record<string, Partial<TopicMetadata>>;
  after_state?: Record<string, Partial<TopicMetadata>>;
}

export const HarmonizationActionSchema = z.object({
  type: z.enum(["merge", "split", "normalize", "delete", "edit"]),
  source_topics: z.array(z.string()),
  resulting_topics: z.array(z.string()),
  rationale: z.string(),
  before_state: z.record(z.string(), z.any()).optional(),
  after_state: z.record(z.string(), z.any()).optional(),
});

/**
 * Historical record of a Knowledge Graph Harmonization run
 */
export interface HarmonizationRun {
  run_id: string;
  timestamp: string;
  trigger_source: "background_observer" | "manual_user";
  summary: string;
  actions: HarmonizationAction[];
  trace_id: string;
  topics_before_count: number;
  topics_after_count: number;
}

export const HarmonizationRunSchema = z.object({
  run_id: z.string(),
  timestamp: z.string(),
  trigger_source: z.enum(["background_observer", "manual_user"]),
  summary: z.string(),
  actions: z.array(HarmonizationActionSchema),
  trace_id: z.string(),
  topics_before_count: z.number(),
  topics_after_count: z.number(),
});

/**
 * Unified Topic Node: The Single Source of Truth in Mind-State Memory Architecture
 * Fuses conversational memory and news discovery parameters.
 */
export interface UnifiedTopicNode {
  user_id: string;
  topics: Record<string, TopicMetadata>;
  psychological_profile: PsychologicalProfile;
  discovery_parameters: DiscoveryParameters;
  historical_anchors: string[]; // Known concepts used for pedagogical bridging
  interest_intersections?: InterestIntersection[]; // Cross-referenced synergies between topics
  adjacent_curiosity_frontiers?: AdjacentCuriosityFrontier[]; // Novel related domains at the boundary
  recent_topic_diffs?: TopicUpdateDiff[]; // Historical state delta transitions
  harmonization_runs?: HarmonizationRun[]; // Audit trail of all harmonization runs
  dwell_history?: Array<{ topic: string; dwell_ms: number; date: string }>;
  last_updated: string;
}

export const UnifiedTopicNodeSchema = z.object({
  user_id: z.string(),
  topics: z.record(z.string(), TopicMetadataSchema),
  psychological_profile: PsychologicalProfileSchema,
  discovery_parameters: DiscoveryParametersSchema,
  historical_anchors: z.array(z.string()),
  interest_intersections: z.array(InterestIntersectionSchema).optional(),
  adjacent_curiosity_frontiers: z.array(AdjacentCuriosityFrontierSchema).optional(),
  recent_topic_diffs: z.array(TopicUpdateDiffSchema).optional(),
  harmonization_runs: z.array(HarmonizationRunSchema).optional(),
  dwell_history: z
    .array(
      z.object({
        topic: z.string(),
        dwell_ms: z.number(),
        date: z.string(),
      })
    )
    .optional(),
  last_updated: z.string(),
});

/**
 * User Behavioral Knowledge Graph maintained by Node B (Backwards compatible interface)
 */
export interface UserKnowledgeGraph {
  user_id: string;
  topic_weights: Record<string, number>; // Normalized weights 0.0 - 1.0 (revealed preferences)
  cognitive_load_state: CognitiveLoadState;
  historical_anchors: string[]; // Known concepts used for pedagogical bridging
  interest_intersections?: InterestIntersection[]; // Cross-referenced synergies between topics
  adjacent_curiosity_frontiers?: AdjacentCuriosityFrontier[]; // Novel related domains at the boundary
  dwell_history: Array<{ topic: string; dwell_ms: number; date: string }>;
  last_updated: string;
}

export const UserKnowledgeGraphSchema = z.object({
  user_id: z.string(),
  topic_weights: z.record(z.string(), z.number()),
  cognitive_load_state: z.enum(["low", "balanced", "deep_dive"]),
  historical_anchors: z.array(z.string()),
  interest_intersections: z.array(InterestIntersectionSchema).optional(),
  adjacent_curiosity_frontiers: z.array(AdjacentCuriosityFrontierSchema).optional(),
  dwell_history: z.array(
    z.object({
      topic: z.string(),
      dwell_ms: z.number(),
      date: z.string(),
    })
  ),
  last_updated: z.string(),
});

/**
 * Routing decision from Node C (The Serendipity Agent) using Multi-Armed Bandit
 */
export interface RoutingDecision {
  strategy: "exploitation" | "exploration";
  selected_topic: string;
  bandit_epsilon: number;
  anchor_concept?: string; // Concept to bridge exploration topic if strategy is exploration
  reasoning: string;
}

export const RoutingDecisionSchema = z.object({
  strategy: z.enum(["exploitation", "exploration"]),
  selected_topic: z.string(),
  bandit_epsilon: z.number(),
  anchor_concept: z.string().optional(),
  reasoning: z.string(),
});

/**
 * Generative UI / Presentation payload from Node D (The Synthesis Agent)
 */
export interface PresentationPayload {
  format: "bulleted_distillation" | "generative_widget" | "structured_narrative";
  headline: string;
  summary: string;
  fact_bullets: string[];
  widget_data?: {
    chart_type?: "timeline" | "delta_bar" | "entity_network" | "source_distribution";
    data_points: Array<{ label: string; value: number | string; category?: string }>;
  };
  cognitive_load_target: CognitiveLoadState;
  anchor_explanation?: string;
  rendered_at: string;
}

export const PresentationPayloadSchema = z.object({
  format: z.enum(["bulleted_distillation", "generative_widget", "structured_narrative"]),
  headline: z.string(),
  summary: z.string(),
  fact_bullets: z.array(z.string()),
  widget_data: z
    .object({
      chart_type: z.enum(["timeline", "delta_bar", "entity_network", "source_distribution"]).optional(),
      data_points: z.array(
        z.object({
          label: z.string(),
          value: z.union([z.number(), z.string()]),
          category: z.string().optional(),
        })
      ),
    })
    .optional(),
  cognitive_load_target: z.enum(["low", "balanced", "deep_dive"]),
  anchor_explanation: z.string().optional(),
  rendered_at: z.string(),
});

/**
 * Structured Agent Trace record for Observability-Driven Development
 */
export type AgentNodeName =
  | "node_context"
  | "node_discovery"
  | "node_scout"
  | "node_observer"
  | "node_a_epistemology"
  | "node_b_telemetry"
  | "node_c_serendipity"
  | "node_d_synthesis"
  | "agent_dialogue"
  | "agent_observer"
  | "agent_discovery"
  | "agent_epistemology"
  | "agent_telemetry"
  | "agent_serendipity"
  | "agent_synthesis"
  | "agent_brief_synthesizer"
  | "agent_card_evolution"
  | "tool_execution"
  | "tool_search"
  | "tool_rss"
  | "llm_completion"
  | (string & {});

export type AgentCallType = "flow_root" | "agent_step" | "llm" | "tool" | "tool_call";

export interface AgentTraceLog {
  trace_id: string;
  session_id: string;
  timestamp: string;
  node_name: AgentNodeName;
  input_summary?: Record<string, unknown>;
  output_summary?: Record<string, unknown>;
  reasoning_rationale: string;
  latency_ms: number;
  llm_tokens_used?: number;
  run_id?: string;
  parent_trace_id?: string;
  call_type?: AgentCallType;
  prompt_details?: {
    system_prompt?: string;
    user_prompt?: string;
    messages?: Array<{ role: string; content: string }>;
  };
  context_details?: Record<string, unknown>;
  reasoning_details?: {
    primary_rationale?: string;
    internal_thought?: string;
    emotional_state?: string;
    curiosity_focus?: string;
    pedagogical_strategy?: string;
    why_this_response?: string;
    adaptations?: unknown[];
    topic_diffs?: unknown[];
  };
  response_details?: {
    raw_completion?: string;
    parsed_output?: unknown;
    emitted_state?: unknown;
    sources?: unknown[];
  };
  model_details?: {
    provider?: string;
    model?: string;
    temperature?: number;
    max_tokens?: number;
  };
  status?: "success" | "error" | "running";
  error_message?: string;
  metadata?: Record<string, unknown>;
}

export const AgentTraceLogSchema = z.object({
  trace_id: z.string(),
  session_id: z.string(),
  timestamp: z.string(),
  node_name: z.string(),
  input_summary: z.record(z.string(), z.unknown()).default({}),
  output_summary: z.record(z.string(), z.unknown()).default({}),
  reasoning_rationale: z.string(),
  latency_ms: z.number(),
  llm_tokens_used: z.number().optional(),
  run_id: z.string().optional(),
  parent_trace_id: z.string().optional(),
  call_type: z.enum(["flow_root", "agent_step", "llm", "tool", "tool_call"]).optional(),
  prompt_details: z
    .object({
      system_prompt: z.string().optional(),
      user_prompt: z.string().optional(),
      messages: z.array(z.object({ role: z.string(), content: z.string() })).optional(),
    })
    .optional(),
  context_details: z.record(z.string(), z.unknown()).optional(),
  reasoning_details: z
    .object({
      primary_rationale: z.string().optional(),
      internal_thought: z.string().optional(),
      emotional_state: z.string().optional(),
      curiosity_focus: z.string().optional(),
      pedagogical_strategy: z.string().optional(),
      why_this_response: z.string().optional(),
      adaptations: z.array(z.unknown()).optional(),
      topic_diffs: z.array(z.unknown()).optional(),
    })
    .optional(),
  response_details: z
    .object({
      raw_completion: z.string().optional(),
      parsed_output: z.unknown().optional(),
      emitted_state: z.unknown().optional(),
      sources: z.array(z.unknown()).optional(),
    })
    .optional(),
  model_details: z
    .object({
      provider: z.string().optional(),
      model: z.string().optional(),
      temperature: z.number().optional(),
      max_tokens: z.number().optional(),
    })
    .optional(),
  status: z.enum(["success", "error", "running"]).optional(),
  error_message: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export interface AgentRunFlow {
  run_id: string;
  session_id: string;
  flow_name: string;
  start_time: string;
  end_time: string;
  total_latency_ms: number;
  total_tokens: number;
  status: "success" | "error" | "running";
  steps: AgentTraceLog[];
  root_trace?: AgentTraceLog;
}

/**
 * Contributing Source Article with raw text and highlighted passages
 */
export interface EventSourceArticle {
  name: string;
  url: string;
  bias: string;
  title?: string;
  raw_text?: string;
  published_at?: string;
  highlighted_passages?: string[];
}

export const EventSourceArticleSchema = z.object({
  name: z.string(),
  url: z.string(),
  bias: z.string(),
  title: z.string().optional(),
  raw_text: z.string().optional(),
  published_at: z.string().optional(),
  highlighted_passages: z.array(z.string()).optional(),
});

/**
 * Multi-Topic Personalized Event Briefing Card
 */
export interface SynthesizedEventCard {
  event_id: string;
  topic_id?: string; // Immutable topic GUID
  topic: string;
  headline: string;
  personalized_framing: string;
  summary: string;
  expansion_text?: string;
  fact_bullets: string[];
  disputed_claims: DisputedClaim[];
  verified_entities: string[];
  sources: EventSourceArticle[];
  format: "bulleted_distillation" | "generative_widget" | "structured_narrative";
  discovery_category?: "revealed_preference" | "thematic_intersection" | "curiosity_frontier";
  published_at?: string;
  recency_label?: string;
  is_exploration?: boolean;
  anchor_concept?: string;
  image_url?: string;
  is_fresh?: boolean;
  freshness_score?: number;
  widget_data?: {
    chart_type: "delta_bar" | "timeline" | "source_distribution" | "entity_network";
    data_points: Array<{ label: string; value: number; category: string }>;
  };
}

export const SynthesizedEventCardSchema = z.object({
  event_id: z.string(),
  topic_id: z.string().optional(),
  topic: z.string(),
  headline: z.string(),
  personalized_framing: z.string(),
  summary: z.string(),
  expansion_text: z.string().optional(),
  fact_bullets: z.array(z.string()),
  disputed_claims: z.array(DisputedClaimSchema),
  verified_entities: z.array(z.string()),
  sources: z.array(EventSourceArticleSchema),
  format: z.enum(["bulleted_distillation", "generative_widget", "structured_narrative"]),
  discovery_category: z.enum(["revealed_preference", "thematic_intersection", "curiosity_frontier"]).optional(),
  published_at: z.string().optional(),
  recency_label: z.string().optional(),
  is_exploration: z.boolean().optional(),
  anchor_concept: z.string().optional(),
  image_url: z.string().optional(),
  is_fresh: z.boolean().optional(),
  freshness_score: z.number().optional(),
  widget_data: z
    .object({
      chart_type: z.enum(["delta_bar", "timeline", "source_distribution", "entity_network"]),
      data_points: z.array(
        z.object({
          label: z.string(),
          value: z.number(),
          category: z.string(),
        })
      ),
    })
    .optional(),
});

/**
 * Attached Story Context for focused story discussion with Aletheia
 */
export interface AttachedStoryContext {
  event_id: string;
  topic: string;
  headline: string;
  summary: string;
  published_at?: string;
  fact_bullets?: string[];
  disputed_claims?: DisputedClaim[];
  sources?: Array<{ name: string; url: string; bias: string }>;
}

export const AttachedStoryContextSchema = z.object({
  event_id: z.string(),
  topic: z.string(),
  headline: z.string(),
  summary: z.string(),
  published_at: z.string().optional(),
  fact_bullets: z.array(z.string()).optional(),
  disputed_claims: z.array(DisputedClaimSchema).optional(),
  sources: z
    .array(
      z.object({
        name: z.string(),
        url: z.string(),
        bias: z.string(),
      })
    )
    .optional(),
});

/**
 * Event Topic Lifecycle Phase for event-driven living topic state machines
 */
export type EventTopicLifecyclePhase = "spawning" | "escalating" | "maturing" | "cooling";

export const EventTopicLifecyclePhaseSchema = z.enum(["spawning", "escalating", "maturing", "cooling"]);

export interface EventTopicSentimentQuote {
  quote: string;
  speaker_or_community: string;
  platform?: string;
  url?: string;
}

export const EventTopicSentimentQuoteSchema = z.object({
  quote: z.string(),
  speaker_or_community: z.string(),
  platform: z.string().optional(),
  url: z.string().optional(),
});

export interface EventTopicSentiment {
  tone: "positive" | "critical" | "mixed" | "cautious" | "neutral";
  summary: string;
  representative_quotes: EventTopicSentimentQuote[];
}

export const EventTopicSentimentSchema = z.object({
  tone: z.enum(["positive", "critical", "mixed", "cautious", "neutral"]),
  summary: z.string(),
  representative_quotes: z.array(EventTopicSentimentQuoteSchema),
});

export interface EventTopicHistoricalMilestone {
  time_label: string;
  milestone: string;
  source_name?: string;
  source_url?: string;
}

export const EventTopicHistoricalMilestoneSchema = z.object({
  time_label: z.string(),
  milestone: z.string(),
  source_name: z.string().optional(),
  source_url: z.string().optional(),
});

/**
 * Attached Topic Brief Context for deep companion dialogue priming
 */
export interface AttachedTopicBriefContext {
  brief_id: string;
  topic_title: string;
  parent_interest: string;
  lifecycle_phase: EventTopicLifecyclePhase;
  lifecycle_label: string;
  gravity_score: number;
  current_focus: string;
  executive_summary: string;
  public_sentiment?: EventTopicSentiment;
  historical_arc?: EventTopicHistoricalMilestone[];
  key_facts?: string[];
  sources?: Array<{ name: string; url: string; bias?: string }>;
}

export const AttachedTopicBriefContextSchema = z.object({
  brief_id: z.string(),
  topic_title: z.string(),
  parent_interest: z.string(),
  lifecycle_phase: EventTopicLifecyclePhaseSchema,
  lifecycle_label: z.string(),
  gravity_score: z.number(),
  current_focus: z.string(),
  executive_summary: z.string(),
  public_sentiment: EventTopicSentimentSchema.optional(),
  historical_arc: z.array(EventTopicHistoricalMilestoneSchema).optional(),
  key_facts: z.array(z.string()).optional(),
  sources: z
    .array(
      z.object({
        name: z.string(),
        url: z.string(),
        bias: z.string().optional(),
      })
    )
    .optional(),
  dynamic_sections: z.array(z.any()).optional(),
});

/**
 * Dynamic Presentation Block Types for LLM-Designed Briefings
 */
export type DynamicBriefSectionType =
  | "executive_summary"
  | "key_developments"
  | "critical_tensions"
  | "telemetry_metrics"
  | "real_world_chronology"
  | "community_pulse"
  | "catalysts_outlook"
  | "deep_dive_inquiries";

export interface DynamicSectionContent {
  summary?: string;
  bullets?: Array<{ title?: string; text: string; source?: string; source_url?: string }>;
  metrics?: Array<{ label: string; value: string; context?: string; trend?: "up" | "down" | "neutral" }>;
  milestones?: Array<{ time_label: string; milestone: string; source_name?: string; source_url?: string }>;
  quotes?: Array<{
    quote: string;
    speaker_or_community: string;
    platform?: string;
    sentiment?: "positive" | "critical" | "mixed" | "neutral";
    url?: string;
  }>;
  tensions?: Array<{ topic_tension: string; thesis: string; antithesis: string; verified_evidence?: string; source?: string; source_url?: string }>;
  catalysts?: Array<{ timeframe: string; event: string; significance: string; source?: string; source_url?: string }>;
  inquiries?: Array<{ question: string; angle: string }>;
}

export interface DynamicBriefSection {
  id: string;
  topic_id?: string;
  section_type: DynamicBriefSectionType;
  title: string;
  subtitle?: string;
  badge?: string;
  layout_style?: "callout" | "grid" | "timeline" | "metrics" | "quote_cards" | "bullets" | "key_value";
  content: DynamicSectionContent;
}

export interface LLMTopicBriefDesign {
  topic_id?: string;
  presentation_archetype:
    | "regulatory_controversy"
    | "technical_deep_dive"
    | "breaking_chronology"
    | "field_synthesis"
    | "empirical_investigation";
  design_rationale: string;
  executive_take: string;
  sections: DynamicBriefSection[];
}

export interface CardEvolutionDecision {
  decision: "update_in_place" | "redesign";
  rationale: string;
  significant_developments?: string[];
}

export interface LayoutInformationGap {
  gap_type: "timeline" | "community_quotes" | "metrics" | "opposing_claims" | "general_context";
  query: string;
  rationale: string;
  target_section?: DynamicBriefSectionType;
}

export interface LayoutArchitectPlan {
  archetype: LLMTopicBriefDesign["presentation_archetype"];
  design_rationale: string;
  planned_section_types: DynamicBriefSectionType[];
  information_gaps: LayoutInformationGap[];
}

export interface EvolvedTopicCardResult {
  topic: string;
  topic_id?: string;
  decision: "update_in_place" | "redesign";
  decision_rationale: string;
  design: LLMTopicBriefDesign;
  new_cards: SynthesizedEventCard[];
  all_sources: EventSourceArticle[];
  targeted_queries_executed?: string[];
}


/**
 * Step in the Agentic Flow for Generating Context
 */
export interface AgenticContextFlowStep {
  step_number: number;
  stage_name: string;
  agent_name: string;
  description: string;
  input_data: Record<string, unknown>;
  output_data: Record<string, unknown>;
  status: "completed" | "active" | "skipped";
}

export interface RetrievedStoryContext {
  event_id: string;
  headline: string;
  topic: string;
  summary: string;
  fact_bullets?: string[];
  relevance_score: number;
  relevance_rationale?: string;
}

/**
 * Full Generated Context Envelope for Chat Messages
 */
export interface GeneratedMessageContext {
  empath_instructions?: string;
  calibrated_depth?: string;
  emotional_trajectory?: string;
  active_sensitivities?: string[];
  active_boundaries?: string[];
  why_they_care_context?: string[];
  pedagogical_strategy?: string;
  retrieved_stories?: RetrievedStoryContext[];
  tools_executed?: Array<{
    tool_name: string;
    query: string;
    results_summary: string;
    items_retrieved: number;
  }>;
  raw_prompt_sent_to_llm?: string;
  raw_system_prompt?: string;
  agent_internal_rationale?: Record<string, unknown>;
  agentic_flow?: AgenticContextFlowStep[];
}

/**
 * Dynamic Context Selection for Contextually Reactive DevTools
 */
export type ContextualSelection =
  | {
      type: "chat_turn";
      trace_id: string;
      message_id: string;
      user_prompt?: string;
      assistant_response?: string;
      context_generated?: GeneratedMessageContext;
      agentic_flow?: AgenticContextFlowStep[];
      agent_internal_rationale?: Record<string, unknown>;
      topic_diffs?: TopicUpdateDiff[];
      tools_executed?: Array<{
        tool_name: string;
        query: string;
        results_summary: string;
        items_retrieved: number;
      }>;
    }
  | { type: "story_card"; event_id: string; topic: string; card?: SynthesizedEventCard }
  | {
      type: "topic";
      topic_name: string;
      weight: number;
      reasoning?: string;
      technical_depth?: TechnicalDepth;
      why_they_care?: string;
      curiosity_vectors?: string[];
      recent_diff?: TopicUpdateDiff;
    }
  | { type: "topic_diff"; diff: TopicUpdateDiff }
  | { type: "harmonization_run"; run: HarmonizationRun }
  | { type: "intersection"; theme: string; hypothesis?: string }
  | { type: "node_trace"; trace_id: string; node_name: string };


/**
 * Top-level Graph State Context for LangGraph orchestrator
 */
export interface NewsStateContext {
  session_id: string;
  user_id?: string;
  user_graph?: UserKnowledgeGraph;
  unified_topic_node?: UnifiedTopicNode;
  raw_articles: RawArticle[];
  current_facts: PureFactObject[];
  feed_cards?: SynthesizedEventCard[];
  routing_decision?: RoutingDecision;
  presentation_payload?: PresentationPayload;
  traces?: AgentTraceLog[];
  errors?: string[];
}

/**
 * User levels and role system
 */
export type UserRole = "user" | "admin";
export type UserAccountStatus = "active" | "suspended";
export type UserTier = "free" | "subscriber";
export type SubscriptionStatus = "none" | "active" | "past_due" | "canceled";

export interface AppUser {
  id: string;
  email: string;
  name: string;
  image?: string;
  role: UserRole;
  status: UserAccountStatus;
  tier?: UserTier;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  subscription_status?: SubscriptionStatus;
  subscription_period_end?: string;
  created_at: string;
  last_active_at: string;
}

export interface UsageEvent {
  type: "chat" | "pipeline" | "telemetry" | "login";
  timestamp: string;
  detail?: string;
  metadata?: Record<string, any>;
}

export interface UserUsageMetrics {
  user_id: string;
  total_chat_messages: number;
  total_pipeline_runs: number;
  total_tokens_used: number;
  total_dwell_time_ms: number;
  current_period_start: string;
  period_tokens_used: number;
  period_cost_usd: number;
  lifetime_cost_usd: number;
  last_active_at: string;
  recent_events: UsageEvent[];
}

export interface UsageLimitStatus {
  allowed: boolean;
  tier: UserTier;
  currentCost: number;
  limit: number;
  percentUsed: number;
  isNearLimit: boolean;
  reason?: string;
}

export type SupportCategory =
  | "bug_report"
  | "feature_request"
  | "ai_feed_synthesis"
  | "account_billing"
  | "general_inquiry";

export interface SupportTicketMetadata {
  userId?: string;
  userEmail?: string;
  tier?: string;
  url?: string;
  userAgent?: string;
  screenWidth?: number;
  screenHeight?: number;
  includeDiagnostics?: boolean;
  [key: string]: any;
}

export interface SupportTicket {
  id: string;
  user_id?: string | null;
  name: string;
  email: string;
  category: SupportCategory;
  subject: string;
  message: string;
  metadata: SupportTicketMetadata;
  status: "open" | "in_progress" | "resolved" | "closed";
  created_at: string;
}

export interface SupportTicketPayload {
  name: string;
  email: string;
  category: SupportCategory;
  subject: string;
  message: string;
  metadata?: SupportTicketMetadata;
}

/**
 * Direct Source Discovery & Ingestion Contracts
 */
export type DirectSourceType =
  | "rss_feed"
  | "www_page"
  | "reddit_community"
  | "bluesky_profile"
  | "social_feed";

export type DirectSourceStatus = "active" | "failing" | "pending_validation" | "inactive";

export interface SocialSourceMetadata {
  platform: "reddit" | "bluesky" | "substack" | "youtube" | "fediverse" | "open_web";
  handle_or_identifier: string;
  profile_name?: string;
  curated_topics?: string[];
  role_description?: string; // e.g. "Community Subreddit", "Industry Analyst", "Research Lead"
}

export interface DirectSource {
  id: string;
  topic: string;
  source_type: DirectSourceType;
  url: string;
  title: string;
  publisher_name: string;
  status: DirectSourceStatus;
  reliability_score: number; // 0.0 - 1.0
  last_crawled_at?: string;
  last_successful_content_at?: string;
  etag?: string;
  last_modified?: string;
  consecutive_failures: number;
  created_at: string;
  platform?: "reddit" | "bluesky" | "substack" | "youtube" | "fediverse" | "open_web";
  metadata?: SocialSourceMetadata;
}

export const SocialSourceMetadataSchema = z.object({
  platform: z.enum(["reddit", "bluesky", "substack", "youtube", "fediverse", "open_web"]),
  handle_or_identifier: z.string(),
  profile_name: z.string().optional(),
  curated_topics: z.array(z.string()).optional(),
  role_description: z.string().optional(),
});

export const DirectSourceSchema = z.object({
  id: z.string(),
  topic: z.string(),
  source_type: z.enum(["rss_feed", "www_page", "reddit_community", "bluesky_profile", "social_feed"]),
  url: z.string().url(),
  title: z.string(),
  publisher_name: z.string(),
  status: z.enum(["active", "failing", "pending_validation", "inactive"]),
  reliability_score: z.number().min(0).max(1),
  last_crawled_at: z.string().optional(),
  last_successful_content_at: z.string().optional(),
  etag: z.string().optional(),
  last_modified: z.string().optional(),
  consecutive_failures: z.number().int().nonnegative(),
  created_at: z.string(),
  platform: z.enum(["reddit", "bluesky", "substack", "youtube", "fediverse", "open_web"]).optional(),
  metadata: SocialSourceMetadataSchema.optional(),
});



