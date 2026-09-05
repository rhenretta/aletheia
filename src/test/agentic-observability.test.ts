import { describe, it, expect, beforeEach } from "vitest";
import { traceLogger } from "../core/observability/trace-logger";
import { AgentTraceLogSchema } from "../core/types/contracts";
import { DeepSeekProvider } from "../core/llm/deepseek-provider";
import { DialogueAgent } from "../core/agents/intake/dialogue-agent";
import { UnifiedTopicNode } from "../core/types/contracts";

describe("End-to-End Agentic Observability & Tracing Architecture", () => {
  beforeEach(() => {
    traceLogger.clearTraces();
  });

  it("1. Validates schema flexibility: permits arbitrary agent names and new call types without Zod error", () => {
    const tracePayload = {
      trace_id: "tr_test_custom_agent_1",
      session_id: "sess_custom_1",
      timestamp: new Date().toISOString(),
      node_name: "agent_dialogue",
      call_type: "flow_root" as const,
      run_id: "run_chat_123",
      input_summary: { message: "Hello world" },
      output_summary: { response: "Hi there" },
      reasoning_rationale: "Answered user greeting directly.",
      latency_ms: 120,
      llm_tokens_used: 45,
      prompt_details: {
        system_prompt: "You are Aletheia.",
        user_prompt: "Hello world",
      },
      reasoning_details: {
        primary_rationale: "Direct peer greeting",
        emotional_state: "Open, curious",
      },
      response_details: {
        raw_completion: '{"message": "Hi there"}',
      },
      model_details: {
        provider: "DeepSeek",
        model: "deepseek-chat",
      },
    };

    const parsed = AgentTraceLogSchema.safeParse(tracePayload);
    expect(parsed.success).toBe(true);

    const logged = traceLogger.logTrace(tracePayload as any);
    expect(logged.trace_id).toBe("tr_test_custom_agent_1");
    expect(logged.run_id).toBe("run_chat_123");
    expect(logged.call_type).toBe("flow_root");
  });

  it("2. Aggregates multi-step traces sharing a run_id into an AgentRunFlow", () => {
    const runId = "run_flow_test_999";
    const sessionId = "sess_user_alpha";

    // Step 1: Context resolution
    traceLogger.logTrace({
      run_id: runId,
      session_id: sessionId,
      node_name: "node_context",
      call_type: "agent_step",
      reasoning_rationale: "Resolved user interest in Renewable Energy",
      latency_ms: 10,
      llm_tokens_used: 0,
    });

    // Step 2: Tool execution
    traceLogger.logTrace({
      run_id: runId,
      session_id: sessionId,
      node_name: "tool_search",
      call_type: "tool",
      reasoning_rationale: "Live search on wire feeds",
      latency_ms: 250,
      llm_tokens_used: 0,
      input_summary: { query: "Next-gen solar cells" },
    });

    // Step 3: LLM generation
    traceLogger.logTrace({
      run_id: runId,
      session_id: sessionId,
      node_name: "agent_dialogue",
      call_type: "llm",
      reasoning_rationale: "DeepSeek chat completion",
      latency_ms: 800,
      llm_tokens_used: 420,
      prompt_details: { user_prompt: "What is the efficiency of perovskite cells?" },
      response_details: { raw_completion: "Perovskite-silicon tandems achieve >33%." },
    });

    // Step 4: Root flow completion
    traceLogger.logTrace({
      run_id: runId,
      session_id: sessionId,
      node_name: "agent_dialogue",
      call_type: "flow_root",
      reasoning_rationale: "Companion dialogue turn completed",
      latency_ms: 1060,
      llm_tokens_used: 420,
      prompt_details: { user_prompt: "What is the efficiency of perovskite cells?" },
    });

    const flows = traceLogger.getRecentFlows(10);
    expect(flows.length).toBe(1);

    const flow = flows[0];
    expect(flow.run_id).toBe(runId);
    expect(flow.session_id).toBe(sessionId);
    expect(flow.steps.length).toBe(4);
    expect(flow.total_tokens).toBe(840);
    expect(flow.total_latency_ms).toBe(2120);
    expect(flow.status).toBe("success");
    expect(flow.flow_name).toContain("Chat:");
  });

  it("3. Correctly filters and searches traces by text, agent, and call type", () => {
    traceLogger.logTrace({
      run_id: "run_search_1",
      node_name: "tool_search",
      call_type: "tool",
      reasoning_rationale: "Querying quantum algorithms in chemistry",
      latency_ms: 180,
      input_summary: { query: "VQE molecular simulation" },
    });

    traceLogger.logTrace({
      run_id: "run_search_2",
      node_name: "node_observer",
      call_type: "agent_step",
      reasoning_rationale: "Updated topic weight for Quantum Computing",
      latency_ms: 15,
      response_details: { raw_completion: "Emitted 1 topic diff" },
    });

    // Search by text query
    const resultsQ = traceLogger.searchTraces({ q: "quantum" });
    expect(resultsQ.length).toBe(2);

    // Search by agent
    const resultsAgent = traceLogger.searchTraces({ agent: "tool_search" });
    expect(resultsAgent.length).toBe(1);
    expect(resultsAgent[0].node_name).toBe("tool_search");

    // Search by call type
    const resultsType = traceLogger.searchTraces({ callType: "tool" });
    expect(resultsType.length).toBe(1);
  });

  it("4. DeepSeekProvider streaming emits rich trace telemetry even in local fallback mode", async () => {
    const provider = new DeepSeekProvider();
    // In test environment where DEEPSEEK_API_KEY is not set or local, generator emits fallback trace
    const gen = provider.generateStream("Test prompt query", {
      systemPrompt: "System instruction test",
      traceOptions: {
        runId: "run_provider_test",
        agentName: "agent_dialogue",
      },
    });

    let fullOutput = "";
    for await (const chunk of gen) {
      fullOutput += chunk;
    }

    expect(fullOutput.length).toBeGreaterThan(0);

    const traces = traceLogger.searchTraces({ runId: "run_provider_test" });
    expect(traces.length).toBeGreaterThanOrEqual(1);
    const trace = traces[0];
    expect(trace.call_type).toBe("llm");
    expect(trace.node_name).toBe("agent_dialogue");
    expect(trace.prompt_details?.user_prompt).toBe("Test prompt query");
    expect(trace.prompt_details?.system_prompt).toBe("System instruction test");
    expect(trace.response_details?.raw_completion).toBeDefined();
  });

  it("5. DialogueAgent.chatStream emits coordinated run_id traces across context, tools, and response", async () => {
    const mockUnifiedNode: UnifiedTopicNode = {
      user_id: "usr_test_observer",
      topics: {
        "Space Exploration": {
          weight: 0.9,
          why_they_care: "Deep passion for propulsion architectures.",
          technical_depth: "expert",
          curiosity_vectors: ["Starship", "Raptor engines"],
          last_discussed_at: new Date().toISOString(),
        },
      },
      psychological_profile: {
        emotional_trajectory: "Analytical & Rigorous",
        sensitivities: [],
        boundaries: [],
        communication_style: "Direct peer",
      },
      discovery_parameters: {
        signal_threshold: 0.8,
        anti_preferences: [],
        exploration_rate: 0.2,
        depth_requirement: "practitioner",
      },
      historical_anchors: [],
      interest_intersections: [],
      adjacent_curiosity_frontiers: [],
      dwell_history: [],
      last_updated: new Date().toISOString(),
      recent_topic_diffs: [],
    };

    const stream = DialogueAgent.chatStream(
      [{ id: "1", role: "user", content: "What is the status of the Starship orbital launch test?", timestamp: new Date().toISOString() }],
      mockUnifiedNode
    );

    let finalResponse: any = null;
    for await (const chunk of stream) {
      if (chunk.type === "meta") {
        finalResponse = chunk.data;
      }
    }

    expect(finalResponse).toBeDefined();
    expect(finalResponse.run_id).toBeDefined();
    expect(finalResponse.run_id).toMatch(/^run_chat_/);

    const flows = traceLogger.getRecentFlows(10);
    const matchingFlow = flows.find((f) => f.run_id === finalResponse.run_id);
    expect(matchingFlow).toBeDefined();
    expect(matchingFlow!.steps.length).toBeGreaterThanOrEqual(2);

    // Verify context resolution step exists
    const contextStep = matchingFlow!.steps.find((s) => s.node_name === "node_context");
    expect(contextStep).toBeDefined();
    expect(contextStep!.call_type).toBe("agent_step");

    // Verify root dialogue step exists
    const dialogueStep = matchingFlow!.steps.find((s) => s.call_type === "flow_root");
    expect(dialogueStep).toBeDefined();
    expect(dialogueStep!.node_name).toBe("agent_dialogue");
    expect(dialogueStep!.prompt_details?.user_prompt).toBeDefined();
    expect(dialogueStep!.response_details?.raw_completion).toBeDefined();
  });
});
