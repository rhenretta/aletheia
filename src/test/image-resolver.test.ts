import { describe, it, expect } from "vitest";
import { ArticleImageResolver } from "../core/ingestion/article-image-resolver";

describe("ArticleImageResolver & Zero-Duplication Engine", () => {
  it("rejects generic placeholder URLs and flag images", () => {
    expect(ArticleImageResolver.isValidEditorialImage("https://example.com/logo.png")).toBe(false);
    expect(ArticleImageResolver.isValidEditorialImage("https://upload.wikimedia.org/wikipedia/en/a/a4/Flag_of_the_United_States.svg")).toBe(false);
    expect(ArticleImageResolver.isValidEditorialImage("https://example.com/favicon.ico")).toBe(false);
    expect(ArticleImageResolver.isValidEditorialImage("https://example.com/default_image.jpg")).toBe(false);
    expect(ArticleImageResolver.isValidEditorialImage("https://example.com/1x1.gif")).toBe(false);
  });

  it("accepts authentic high-resolution editorial photography", () => {
    expect(
      ArticleImageResolver.isValidEditorialImage(
        "https://images.unsplash.com/photo-1593508512255-86ab42a8e620?auto=format&fit=crop&w=1200&q=80"
      )
    ).toBe(true);
    expect(
      ArticleImageResolver.isValidEditorialImage(
        "https://media.defense.gov/2026/May/12/2003456789/1200/800/0/260512-N-NO123-1001.JPG"
      )
    ).toBe(true);
  });

  it("guarantees unique non-duplicated images across multiple feed cards", () => {
    const usedImages = new Set<string>();

    const img1 = ArticleImageResolver.resolveUniqueFallbackImage(
      "US involvement in world conflicts",
      "How will the Iran war change the US role in the world?",
      usedImages
    );
    const img2 = ArticleImageResolver.resolveUniqueFallbackImage(
      "Iran conflict",
      "U.S. Strikes Iranian Rocket Launchers in Strait of Hormuz",
      usedImages
    );
    const img3 = ArticleImageResolver.resolveUniqueFallbackImage(
      "AI and software engineering",
      "Autonomous Agentic Architectures in Production",
      usedImages
    );

    expect(img1).toBeDefined();
    expect(img2).toBeDefined();
    expect(img3).toBeDefined();

    // Verify all 3 images are distinct
    expect(img1).not.toEqual(img2);
    expect(img2).not.toEqual(img3);
    expect(img1).not.toEqual(img3);
  });
});
