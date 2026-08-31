import { NewsStateContext, RoutingDecision, RoutingDecisionSchema } from "../../types/contracts";
import { traceLogger } from "../../observability/trace-logger";

export class SerendipityBanditEngine {
  private static readonly EPSILON = 0.20; // 20% exploration, 80% exploitation

  /**
   * Evaluates candidate topics against user graph using Epsilon-Greedy Bandit routing
   */
  public static selectRouting(
    candidateTopics: string[],
    topicWeights: Record<string, number>,
    historicalAnchors: string[],
    forceStrategy?: "exploitation" | "exploration"
  ): RoutingDecision {
    if (!candidateTopics || candidateTopics.length === 0) {
      throw new Error("Serendipity Agent Error: Cannot route with empty candidate topics.");
    }

    const roll = Math.random();
    const isExploration = forceStrategy
      ? forceStrategy === "exploration"
      : roll < this.EPSILON;

    if (isExploration) {
      // Exploration: find low-weight or novel topics
      const sortedByNovelty = [...candidateTopics].sort((a, b) => {
        const weightA = topicWeights[a] ?? 0.1;
        const weightB = topicWeights[b] ?? 0.1;
        return weightA - weightB; // Ascending -> lowest weight first
      });

      const selected = sortedByNovelty[0];
      const anchor = historicalAnchors.length > 0
        ? historicalAnchors[Math.floor(Math.random() * historicalAnchors.length)]
        : "Artificial Intelligence";

      return RoutingDecisionSchema.parse({
        strategy: "exploration",
        selected_topic: selected,
        bandit_epsilon: this.EPSILON,
        anchor_concept: anchor,
        reasoning: `Node C triggered Epsilon-greedy exploration (epsilon=${this.EPSILON}, roll=${roll.toFixed(3)}). Selected novel/adjacent topic "${selected}" and paired with high-affinity anchor "${anchor}" for conceptual bridging.`,
      });
    } else {
      // Exploitation: find highest-weight topic matching revealed preferences
      const sortedByAffinity = [...candidateTopics].sort((a, b) => {
        const weightA = topicWeights[a] ?? 0.5;
        const weightB = topicWeights[b] ?? 0.5;
        return weightB - weightA; // Descending -> highest weight first
      });

      const selected = sortedByAffinity[0];
      const weight = topicWeights[selected] ?? 0.5;

      return RoutingDecisionSchema.parse({
        strategy: "exploitation",
        selected_topic: selected,
        bandit_epsilon: this.EPSILON,
        reasoning: `Node C executed exploitation (roll=${roll.toFixed(3)} >= epsilon ${this.EPSILON}). Routed high-affinity topic "${selected}" (user graph weight: ${weight}).`,
      });
    }
  }
}

/**
 * Node C: Serendipity Agent (Routing & Curation)
 */
export async function runSerendipityNode(state: NewsStateContext): Promise<Partial<NewsStateContext>> {
  const startTime = Date.now();

  const facts = state.current_facts || [];
  const candidateTopics = facts.map(f => f.topic);

  // If facts have specific topics or fallback topics
  const topicsToEvaluate = candidateTopics.length > 0
    ? candidateTopics
    : ["Geopolitics", "Macroeconomics", "Artificial Intelligence", "Biotech & Longevity", "Energy & Climate"];

  const weights = state.user_graph?.topic_weights || {};
  const anchors = state.user_graph?.historical_anchors || ["Artificial Intelligence"];

  const decision = SerendipityBanditEngine.selectRouting(topicsToEvaluate, weights, anchors);
  const latency = Date.now() - startTime;

  const trace = traceLogger.logTrace({
    session_id: state.session_id,
    node_name: "node_c_serendipity",
    input_summary: {
      candidate_topics: topicsToEvaluate,
      user_weights: weights,
      bandit_epsilon: decision.bandit_epsilon,
    },
    output_summary: {
      strategy: decision.strategy,
      selected_topic: decision.selected_topic,
      anchor_concept: decision.anchor_concept || null,
    },
    reasoning_rationale: decision.reasoning,
    latency_ms: latency,
  });

  return {
    routing_decision: decision,
    traces: [...(state.traces || []), trace],
  };
}
