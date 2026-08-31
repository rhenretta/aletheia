import { describe, it, expect } from "vitest";
import { BiasStripper } from "../core/agents/epistemology/bias-stripper";
import { RawArticle, PureFactObjectSchema } from "../core/types/contracts";

describe("Node A: Epistemology Agent (BiasStripper)", () => {
  it("successfully removes emotional language, sensationalism, and hyperbole from raw text", () => {
    const biasedInput =
      "In a shockingly disastrous and scandalous press conference, the unhinged leadership delivered a catastrophic announcement that sparked furious outrage across the nation.";

    const sanitized = BiasStripper.sanitizeText(biasedInput);

    // Assert that emotive adjectives and adverbs are removed
    expect(sanitized).not.toContain("shockingly");
    expect(sanitized).not.toContain("disastrous");
    expect(sanitized).not.toContain("scandalous");
    expect(sanitized).not.toContain("unhinged");
    expect(sanitized).not.toContain("catastrophic");
    expect(sanitized).not.toContain("furious");

    // Assert that the grammatical core remains coherent
    expect(sanitized).toContain("press conference");
    expect(sanitized).toContain("leadership delivered a announcement that sparked outrage across the nation");
  });

  it("calculates lower adjective density score on sanitized factual statements", () => {
    const sensationalText = "A horrific, devastating, shockingly monstrous and atrocious event!";
    const factualText = "The committee convened at 09:00 UTC and ratified the agreement with 42 votes.";

    const highDensity = BiasStripper.calculateAdjectiveDensity(sensationalText);
    const lowDensity = BiasStripper.calculateAdjectiveDensity(factualText);

    expect(highDensity).toBeGreaterThan(0.2);
    expect(lowDensity).toBeLessThan(0.05);
  });

  it("cross-references polarized multi-source articles and produces a valid PureFactObject", () => {
    const rawArticles: RawArticle[] = [
      {
        source_url: "https://left-news.example.com/clean-energy-bill",
        source_name: "The Progressive Post",
        title: "Senate Passes Clean Energy Bill",
        author_bias_rating: "lean_left",
        raw_text:
          "In a heroic victory, the Senate passed the Clean Energy Act with 52 affirmative votes, allocating $120 billion to solar infrastructure. Radical opponents attempted catastrophic obstruction.",
      },
      {
        source_url: "https://right-news.example.com/senate-spending-spree",
        source_name: "The Daily Conservative",
        title: "Disastrous $120B Spending Package Pushed Through",
        author_bias_rating: "lean_right",
        raw_text:
          "In a brazen and disastrous move, the Senate approved the $120 billion energy package with 52 affirmative votes. Critics argue the reckless spending will trigger apocalyptic inflation.",
      },
      {
        source_url: "https://wire.example.com/senate-energy-vote",
        source_name: "Neutral Wire",
        title: "Senate Approves $120B Clean Energy Measure",
        author_bias_rating: "center",
        raw_text:
          "The Senate passed the energy legislation on Tuesday with 52 affirmative votes. The bill authorizes $120 billion in funding over five years.",
      },
    ];

    const result = BiasStripper.processArticles("Senate Passes $120B Clean Energy Legislation", rawArticles);

    // Validate that result adheres strictly to the PureFactObject schema
    const parseResult = PureFactObjectSchema.safeParse(result);
    expect(parseResult.success).toBe(true);

    // Verify verified entities extraction
    expect(result.verified_entities).toContain("Senate");

    // Verify agreed facts extraction (52 affirmative votes / $120 billion)
    const agreedText = result.agreed_facts.join(" ");
    expect(agreedText).toMatch(/52/);
    expect(agreedText).toMatch(/120/);

    // Verify disputed claims isolation
    expect(result.disputed_claims.length).toBeGreaterThan(0);
    expect(result.disputed_claims[0].asserted_by).toContain("The Progressive Post");
    expect(result.disputed_claims[0].contested_by).toContain("The Daily Conservative");

    // Verify adjective density is constrained
    expect(result.adjective_density_score).toBeLessThanOrEqual(0.15);
  });
});
