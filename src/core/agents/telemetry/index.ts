import { NewsStateContext, UserKnowledgeGraph, BehavioralTelemetry } from "../../types/contracts";
import { traceLogger } from "../../observability/trace-logger";

export class TelemetryGraphEngine {
  /**
   * Applies behavioral telemetry to update revealed preference topic weights
   */
  public static updateGraphWithTelemetry(
    graph: UserKnowledgeGraph,
    telemetryEvents: BehavioralTelemetry[]
  ): UserKnowledgeGraph {
    const updatedWeights: Record<string, number> = { ...graph.topic_weights };
    const updatedAnchors = new Set<string>(graph.historical_anchors || []);
    const dwellHistory = [...(graph.dwell_history || [])];

    for (const event of telemetryEvents) {
      const topic = event.topic || "General";
      const currentWeight = updatedWeights[topic] ?? 0.5;

      // Behavioral heuristic:
      // - Dwell time > 30s (+0.10)
      // - Dwell time > 60s (+0.20)
      // - High scroll depth > 75% (+0.05)
      // - Quick bounce (< 8s) / session abandoned (-0.15)
      let delta = 0;
      if (event.session_abandoned || event.dwell_time_ms < 8000) {
        delta = -0.15;
      } else {
        if (event.dwell_time_ms >= 60000) {
          delta += 0.20;
        } else if (event.dwell_time_ms >= 30000) {
          delta += 0.10;
        } else if (event.dwell_time_ms >= 15000) {
          delta += 0.05;
        }

        if (event.scroll_depth_pct >= 75) {
          delta += 0.05;
        }
      }

      // Clamp weight between 0.05 and 1.0
      const newWeight = Math.min(1.0, Math.max(0.05, Number((currentWeight + delta).toFixed(3))));
      updatedWeights[topic] = newWeight;

      // High affinity topics become historical concept anchors
      if (newWeight >= 0.75) {
        updatedAnchors.add(topic);
      }

      dwellHistory.push({
        topic,
        dwell_ms: event.dwell_time_ms,
        date: event.timestamp || new Date().toISOString(),
      });
    }

    return {
      ...graph,
      topic_weights: updatedWeights,
      historical_anchors: Array.from(updatedAnchors),
      dwell_history: dwellHistory.slice(-50),
      last_updated: new Date().toISOString(),
    };
  }

  /**
   * Initializes a default user knowledge graph if none exists
   */
  public static createDefaultGraph(userId: string): UserKnowledgeGraph {
    return {
      user_id: userId,
      topic_weights: {},
      cognitive_load_state: "balanced",
      historical_anchors: [],
      dwell_history: [],
      last_updated: new Date().toISOString(),
    };
  }
}

/**
 * Node B: Telemetry & Graph Agent (User State)
 */
export async function runTelemetryNode(
  state: NewsStateContext,
  telemetryEvents: BehavioralTelemetry[] = []
): Promise<Partial<NewsStateContext>> {
  const startTime = Date.now();
  const currentGraph = state.user_graph || TelemetryGraphEngine.createDefaultGraph(state.user_id || "usr_default");

  const updatedGraph = TelemetryGraphEngine.updateGraphWithTelemetry(currentGraph, telemetryEvents);
  const latency = Date.now() - startTime;

  const trace = traceLogger.logTrace({
    session_id: state.session_id,
    node_name: "node_b_telemetry",
    input_summary: {
      user_id: updatedGraph.user_id,
      telemetry_event_count: telemetryEvents.length,
      initial_weights: currentGraph.topic_weights,
    },
    output_summary: {
      updated_weights: updatedGraph.topic_weights,
      anchors_count: updatedGraph.historical_anchors.length,
      cognitive_load_state: updatedGraph.cognitive_load_state,
    },
    reasoning_rationale: `Updated Behavioral Knowledge Graph via ${telemetryEvents.length} passive interaction events. Adjusted topic weights based on revealed dwell times and scroll depth metrics.`,
    latency_ms: latency,
  });

  return {
    user_graph: updatedGraph,
    traces: [...(state.traces || []), trace],
  };
}
