# Architectural & Agentic Integrity Rules

## 1. Absolute Ban on Test-Case Poisoning & Overfitting
- **Never "teach to the test"**: When the user provides a real-world example, conversational query, screenshot, or bug report (e.g., SpaceX Starship, specific flight numbers, specific products, etc.), you MUST NOT insert those specific entities, names, flight numbers, or terms into prompts, ontologies, regexes, or routing code.
- **Pure Generalizability**: All agent code, routing logic, prompt templates, and ingestion pipelines must remain 100% domain-agnostic and work universally across any topic or domain.

## 2. Absolute Ban on Keyword / Regex Heuristics for Epistemic Decisions
- **No Regex Intent Routing**: Never use regex lists of words (e.g., `/\b(when|latest|status|upcoming|schedule|is it true|verify)\b/i`) or string replacement stop-lists to decide whether to search, filter, or route cognitive logic.
- **LLM-Driven Agentic Tool Calling**: All decisions regarding information sufficiency, tool execution, and query formulation MUST be delegated to the LLM via structured JSON tool-calling protocols.
- **Fail Fast on Hardcoded Heuristics**: Rely on model-driven evaluation, vector semantics, or explicit schema contracts—never hand-rolled word-matching heuristics.
