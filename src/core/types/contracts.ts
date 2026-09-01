import { z } from "zod";

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
  topic_category?: string;
  image_url?: string;
}

export const RawArticleSchema = z.object({
  source_url: z.string().url(),
  source_name: z.string(),
  title: z.string(),
  raw_text: z.string().min(1),
  author_bias_rating: z.enum(["far_left", "lean_left", "center", "lean_right", "far_right", "unknown"]),
  published_at: z.string().optional(),
  author: z.string().optional(),
  topic_category: z.string().optional(),
  image_url: z.string().optional(),
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
  weight: number; // 0.0 - 1.0
  what_they_care_about?: string; // Core focus, sub-domains, and technical dimensions (What the user is interested in)
  why_they_care: string; // Underlying intellectual motivation, stakes, and worldview (Why they care)
  presentation_strategy?: string; // Editorial directive on how to curate, filter, and present stories (How best to present)
  technical_depth: TechnicalDepth;
  living_narrative?: string; // Rich evolving synthesis of user's perspective on this topic
  likes_and_angles?: string[]; // Preferred angles, dimensions, and features
  dislikes_and_critiques?: string[]; // Anti-preferences, hype to filter out, critiques
  curiosity_vectors?: string[];
  evolution_timeline?: TopicEvolutionEntry[]; // Chronological timeline of how the perspective evolved
  last_discussed_at?: string;
}

export const TopicMetadataSchema = z.object({
  weight: z.number().min(0).max(1),
  what_they_care_about: z.string().optional(),
  why_they_care: z.string(),
  presentation_strategy: z.string().optional(),
  technical_depth: z.enum(["introductory", "practitioner", "expert", "deep_technical"]),
  living_narrative: z.string().optional(),
  likes_and_angles: z.array(z.string()).optional(),
  dislikes_and_critiques: z.array(z.string()).optional(),
  curiosity_vectors: z.array(z.string()).optional(),
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
export interface AgentTraceLog {
  trace_id: string;
  session_id: string;
  timestamp: string;
  node_name:
    | "node_context"
    | "node_discovery"
    | "node_observer"
    | "node_a_epistemology"
    | "node_b_telemetry"
    | "node_c_serendipity"
    | "node_d_synthesis";
  input_summary: Record<string, unknown>;
  output_summary: Record<string, unknown>;
  reasoning_rationale: string;
  latency_ms: number;
  llm_tokens_used?: number;
  metadata?: Record<string, unknown>;
}

export const AgentTraceLogSchema = z.object({
  trace_id: z.string(),
  session_id: z.string(),
  timestamp: z.string(),
  node_name: z.enum([
    "node_context",
    "node_discovery",
    "node_observer",
    "node_a_epistemology",
    "node_b_telemetry",
    "node_c_serendipity",
    "node_d_synthesis",
  ]),
  input_summary: z.record(z.string(), z.unknown()),
  output_summary: z.record(z.string(), z.unknown()),
  reasoning_rationale: z.string(),
  latency_ms: z.number(),
  llm_tokens_used: z.number().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

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
