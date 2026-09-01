import { Annotation, StateGraph } from "@langchain/langgraph";
import {
  NewsStateContext,
  RawArticle,
  PureFactObject,
  UserKnowledgeGraph,
  UnifiedTopicNode,
  RoutingDecision,
  PresentationPayload,
  AgentTraceLog,
  SynthesizedEventCard,
} from "../types/contracts";
import { runEpistemologyNode } from "../agents/epistemology";
import { runTelemetryNode, TelemetryGraphEngine } from "../agents/telemetry";
import { runSerendipityNode } from "../agents/serendipity";
import { runSynthesisNode } from "../agents/synthesis";
import { docWorker } from "../observability/doc-worker";
import { dataStore } from "../storage/persistence";
import { postgresStore } from "../storage/postgres-store";

/**
 * State Graph Annotation for LangGraph
 */
export const NewsStateAnnotation = Annotation.Root({
  session_id: Annotation<string>({
    reducer: (curr, update) => update ?? curr,
    default: () => `sess_${Date.now()}`,
  }),
  user_id: Annotation<string>({
    reducer: (curr, update) => update ?? curr,
    default: () => "usr_default",
  }),
  raw_articles: Annotation<RawArticle[]>({
    reducer: (curr, update) => update ?? curr,
    default: () => [],
  }),
  current_facts: Annotation<PureFactObject[]>({
    reducer: (curr, update) => (update ? [...(curr || []), ...update] : curr || []),
    default: () => [],
  }),
  user_graph: Annotation<UserKnowledgeGraph>({
    reducer: (curr, update) => update ?? curr,
    default: () => TelemetryGraphEngine.createDefaultGraph("usr_default"),
  }),
  unified_topic_node: Annotation<UnifiedTopicNode | undefined>({
    reducer: (curr, update) => update ?? curr,
    default: () => undefined,
  }),
  feed_cards: Annotation<SynthesizedEventCard[] | undefined>({
    reducer: (curr, update) => update ?? curr,
    default: () => undefined,
  }),
  routing_decision: Annotation<RoutingDecision | undefined>({
    reducer: (curr, update) => update ?? curr,
    default: () => undefined,
  }),
  presentation_payload: Annotation<PresentationPayload | undefined>({
    reducer: (curr, update) => update ?? curr,
    default: () => undefined,
  }),
  traces: Annotation<AgentTraceLog[]>({
    reducer: (curr, update) => (update ? [...(curr || []), ...update] : curr || []),
    default: () => [],
  }),
  errors: Annotation<string[]>({
    reducer: (curr, update) => (update ? [...(curr || []), ...update] : curr || []),
    default: () => [],
  }),
});

/**
 * Constructs and compiles the LangGraph State Graph
 */
export function buildAletheiaGraph() {
  const workflow = new StateGraph(NewsStateAnnotation)
    // Add micro-agent nodes
    .addNode("epistemology_agent", async (state) => {
      return await runEpistemologyNode(state as NewsStateContext);
    })
    .addNode("telemetry_agent", async (state) => {
      return await runTelemetryNode(state as NewsStateContext);
    })
    .addNode("serendipity_agent", async (state) => {
      return await runSerendipityNode(state as NewsStateContext);
    })
    .addNode("synthesis_agent", async (state) => {
      return await runSynthesisNode(state as NewsStateContext);
    })
    // Define deterministic node transition edges
    .addEdge("__start__", "epistemology_agent")
    .addEdge("epistemology_agent", "telemetry_agent")
    .addEdge("telemetry_agent", "serendipity_agent")
    .addEdge("serendipity_agent", "synthesis_agent")
    .addEdge("synthesis_agent", "__end__");

  return workflow.compile();
}

/**
 * High-level orchestration pipeline executor
 */
export async function executeAletheiaPipeline(initialState: {
  sessionId?: string;
  userId?: string;
  articles: RawArticle[];
  userGraph?: UserKnowledgeGraph;
  unifiedTopicNode?: UnifiedTopicNode;
}): Promise<NewsStateContext> {
  const graph = buildAletheiaGraph();
  const sessionId = initialState.sessionId || `sess_${Date.now()}`;
  const userId = initialState.userId || "usr_default";

  // Load existing persistent unified topic node & user graph
  const unifiedNode =
    initialState.unifiedTopicNode || (await postgresStore.getUnifiedTopicNode(userId));

  const initialUserGraph =
    initialState.userGraph ||
    (await postgresStore.getUserGraph(userId)) ||
    TelemetryGraphEngine.createDefaultGraph(userId);

  const result = await graph.invoke({
    session_id: sessionId,
    user_id: userId,
    raw_articles: initialState.articles,
    user_graph: initialUserGraph,
    unified_topic_node: unifiedNode,
    current_facts: [],
    traces: [],
    errors: [],
  });

  const finalContext = result as unknown as NewsStateContext;

  // Persist updated Unified Topic Node, User Knowledge Graph & Pure Facts
  if (finalContext.unified_topic_node) {
    await postgresStore.saveUnifiedTopicNode(finalContext.unified_topic_node);
  }
  if (finalContext.user_graph) {
    await postgresStore.saveUserGraph(finalContext.user_graph);
  }
  if (finalContext.current_facts) {
    for (const fact of finalContext.current_facts) {
      dataStore.saveFact(fact);
      await postgresStore.saveFact(fact);
    }
  }

  // Trigger Living Documentation auto-sync loop on pipeline completion
  try {
    docWorker.syncDocs();
  } catch (err) {
    console.warn("DocWorker sync failed during pipeline execution:", err);
  }

  return finalContext;
}
