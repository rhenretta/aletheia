#!/usr/bin/env node
/**
 * Production Inspector & Telemetry Log Viewer
 * Provides live, secure inspection of AWS Production State & Agent Traces
 */

interface ProdDevToolsResponse {
  success: boolean;
  postgres_connected: boolean;
  total_traces: number;
  ai_calls: Array<{
    trace_id: string;
    timestamp: string;
    node: string;
    model: string;
    tokens_used: number;
    latency_ms: number;
    reasoning?: string;
    input?: any;
    output?: any;
  }>;
  traces: any[];
  target_user_id: string;
  all_users: Array<{
    user_id: string;
    topics_count: number;
    topics: Record<string, any>;
    last_updated: string;
  }>;
  database_state: {
    unified_topic_node: any;
    user_graph: any;
    facts_cached: number;
  };
}

async function runInspector() {
  const args = process.argv.slice(2);
  const rawMode = args.includes("--raw");
  const showTraces = args.includes("--traces");
  const showDb = args.includes("--db") || args.length === 0;
  const userArg = args.find((a) => a.startsWith("--userId="))?.split("=")[1] || "usr_rhenretta_gmail_com";
  const endpointArg = args.find((a) => a.startsWith("--endpoint="))?.split("=")[1] || "https://news.ciclops.io/api/devtools";

  const targetUrl = `${endpointArg}?userId=${encodeURIComponent(userArg)}`;

  console.log(`\n🔍 Fetching live production telemetry from: \x1b[36m${targetUrl}\x1b[0m\n`);

  try {
    const res = await fetch(targetUrl);
    if (!res.ok) {
      throw new Error(`Server returned HTTP ${res.status}: ${res.statusText}`);
    }

    const data: ProdDevToolsResponse = await res.json();

    if (rawMode) {
      console.log(JSON.stringify(data, null, 2));
      return;
    }

    // Status Banner
    console.log("===============================================================================");
    console.log(`🌐 PRODUCTION STATUS: news.ciclops.io`);
    console.log(`🗄️  PostgreSQL RDS Connected: ${data.postgres_connected ? "\x1b[32mYES (Secure SSL)\x1b[0m" : "\x1b[31mNO\x1b[0m"}`);
    console.log(`👤 Target User ID: \x1b[33m${data.target_user_id}\x1b[0m`);
    console.log(`📊 All Users in Database: ${data.all_users.length}`);
    console.log(`🧠 Facts Cached in PostgreSQL: ${data.database_state.facts_cached}`);
    console.log(`📜 Total Traces Recorded: ${data.total_traces}`);
    console.log("===============================================================================\n");

    // All Users
    if (data.all_users.length > 0) {
      console.log(`👥 REGISTERED USERS (${data.all_users.length}):`);
      data.all_users.forEach((u) => {
        const topics = Object.keys(u.topics || {}).join(", ") || "(no active topics)";
        console.log(`   • User: \x1b[36m${u.user_id}\x1b[0m | Topics (${u.topics_count}): ${topics} | Last Updated: ${u.last_updated}`);
      });
      console.log("");
    }

    // Active Topics for Target User
    const targetNode = data.database_state.unified_topic_node;
    if (showDb && targetNode) {
      const topicEntries = Object.entries(targetNode.topics || {});
      console.log(`🎯 ACTIVE TOPICS FOR ${data.target_user_id} (${topicEntries.length}):`);
      if (topicEntries.length === 0) {
        console.log("   (No active topics registered in RDS PostgreSQL)");
      } else {
        topicEntries.forEach(([topic, meta]: [string, any]) => {
          const weightPct = Math.round((meta.weight || 0) * 100);
          console.log(`   ▶ \x1b[32m${topic}\x1b[0m [\x1b[33m${weightPct}%\x1b[0m] (Depth: ${meta.technical_depth || "practitioner"})`);
          if (meta.why_they_care) {
            console.log(`     Rationale: \x1b[90m${meta.why_they_care}\x1b[0m`);
          }
          if (meta.curiosity_vectors && meta.curiosity_vectors.length > 0) {
            console.log(`     Vectors: \x1b[36m${meta.curiosity_vectors.join(" | ")}\x1b[0m`);
          }
        });
      }
      console.log("");

      // Intersections & Bridges
      const bridges = targetNode.interest_intersections || [];
      if (bridges.length > 0) {
        console.log(`🌉 THEMATIC BRIDGES (${bridges.length}):`);
        bridges.forEach((b: any) => {
          console.log(`   • ${b.interest_a} ⟷ ${b.interest_b}: \x1b[35m${b.intersection_theme}\x1b[0m`);
        });
        console.log("");
      }

      // Harmonization Runs
      const runs = targetNode.harmonization_runs || [];
      if (runs.length > 0) {
        console.log(`🔄 RECENT HARMONIZATION RUNS (${runs.length}):`);
        runs.slice(0, 5).forEach((r: any) => {
          console.log(`   • [${r.timestamp}] (${r.trigger_source}) ${r.summary}`);
        });
        console.log("");
      }
    }

    // Recent AI Traces & LLM Calls
    if (showTraces || data.ai_calls.length > 0) {
      console.log(`⚡ RECENT AGENT TRACES & LLM CALLS (${data.ai_calls.length}):`);
      if (data.ai_calls.length === 0) {
        console.log("   (No traces logged yet for this worker instance)");
      } else {
        data.ai_calls.slice(0, 10).forEach((call) => {
          console.log(`   • [\x1b[36m${call.node}\x1b[0m] ${call.model} | Latency: ${call.latency_ms}ms | Tokens: ${call.tokens_used}`);
          if (call.reasoning) {
            console.log(`     Reasoning: \x1b[90m${call.reasoning}\x1b[0m`);
          }
        });
      }
      console.log("");
    }
  } catch (err: any) {
    console.error(`\x1b[31m❌ Error inspecting production:\x1b[0m`, err.message);
    process.exit(1);
  }
}

runInspector();
