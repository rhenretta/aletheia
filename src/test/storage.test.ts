import { describe, it, expect } from "vitest";
import { PostgresStore } from "../core/storage/postgres-store";
import { UserKnowledgeGraph, PureFactObject } from "../core/types/contracts";

describe("Unified Persistence & PostgreSQL Store", () => {
  const store = PostgresStore.getInstance();

  it("handles user knowledge graph persistence and retrieval seamlessly", async () => {
    const testGraph: UserKnowledgeGraph = {
      user_id: "usr_test_999",
      topic_weights: {
        "Artificial Intelligence": 0.95,
        "Macroeconomics": 0.60,
      },
      cognitive_load_state: "balanced",
      historical_anchors: ["Artificial Intelligence"],
      dwell_history: [{ topic: "Artificial Intelligence", dwell_ms: 45000, date: new Date().toISOString() }],
      last_updated: new Date().toISOString(),
    };

    await store.saveUserGraph(testGraph);
    const retrieved = await store.getUserGraph("usr_test_999");

    expect(retrieved).toBeDefined();
    expect(retrieved?.user_id).toBe("usr_test_999");
    expect(retrieved?.topic_weights["Artificial Intelligence"]).toBe(0.95);
    expect(retrieved?.historical_anchors).toContain("Artificial Intelligence");
  });

  it("handles PureFactObject caching and retrieval seamlessly", async () => {
    const testFact: PureFactObject = {
      event_id: "evt_test_555",
      topic: "Quantum Supercomputing Frontier",
      verified_entities: ["Quantum Research Consortium"],
      timeline: [
        {
          timestamp_iso: new Date().toISOString(),
          verified_event: "Benchmark completed with 128 error-mitigated qubits.",
          sources: ["Consortium Dispatch"],
        },
      ],
      agreed_facts: ["128 error-mitigated qubits operated at benchmark stability."],
      disputed_claims: [],
      adjective_density_score: 0.01,
      sanitized_timestamp: new Date().toISOString(),
    };

    await store.saveFact(testFact);
    const retrieved = await store.getFact("evt_test_555");

    expect(retrieved).toBeDefined();
    expect(retrieved?.topic).toBe("Quantum Supercomputing Frontier");
    expect(retrieved?.agreed_facts[0]).toContain("128 error-mitigated qubits");
  });
});
