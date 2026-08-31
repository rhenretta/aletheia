import { docWorker } from "../core/observability/doc-worker";

console.log("🚀 Running Project Aletheia Living Documentation Sync...");
const report = docWorker.syncDocs();
console.log("✅ Documentation Synchronized Successfully!");
console.log(JSON.stringify(report, null, 2));
