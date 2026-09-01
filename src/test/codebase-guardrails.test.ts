import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Architectural Guardrails: Zero Heuristics & Zero Overfitting", () => {
  const agentsDir = path.resolve(__dirname, "../core/agents");

  const getAgentFiles = (dir: string): string[] => {
    let results: string[] = [];
    const list = fs.readdirSync(dir);
    for (const file of list) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat && stat.isDirectory()) {
        results = results.concat(getAgentFiles(fullPath));
      } else if (file.endsWith(".ts")) {
        results.push(fullPath);
      }
    }
    return results;
  };

  it("ensures no agent files contain brittle keyword-matching regexes for intent routing", () => {
    const files = getAgentFiles(agentsDir);
    const forbiddenPatterns = [
      /\/\b\(when\|latest\|status\|next\|upcoming/i,
      /\/\b\(is that true\|is this true\|claim\|verify/i,
      /\.replace\(\/\\b\(when\|can\|we\|expect/i,
    ];

    for (const file of files) {
      const content = fs.readFileSync(file, "utf-8");
      for (const pattern of forbiddenPatterns) {
        const hasMatch = pattern.test(content);
        expect(
          hasMatch,
          `Guardrail Violation in ${path.basename(file)}: Found banned heuristic regex matching pattern ${pattern}`
        ).toBe(false);
      }
    }
  });

  it("ensures no agent files contain hardcoded test-case flight numbers or specific entity lists", () => {
    const files = getAgentFiles(agentsDir);
    const bannedSpecificKeywords = [
      /\bflight 7\b/i,
      /\bflight 6\b/i,
      /\bflight 13\b/i,
    ];

    for (const file of files) {
      const content = fs.readFileSync(file, "utf-8");
      for (const pattern of bannedSpecificKeywords) {
        const hasMatch = pattern.test(content);
        expect(
          hasMatch,
          `Guardrail Violation in ${path.basename(file)}: Found hardcoded test-case entity / flight number ${pattern}`
        ).toBe(false);
      }
    }
  });
});
