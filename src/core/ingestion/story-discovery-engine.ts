import { RawArticle } from "../types/contracts";
import { FreeNewsFetcher } from "./rss-search";
import { DirectContentCrawler } from "./direct-crawler";

export type WebResourceKind = "story" | "source_hub";

export class StoryDiscoveryEngine {
  private static readonly USER_AGENT =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
  private static readonly FETCH_TIMEOUT_MS = 6000;

  // Cache discovered stories per source URL to prevent redundant network scraping
  private static sourceCrawlCache = new Map<string, { timestamp: number; articles: RawArticle[] }>();
  private static readonly CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

  /**
   * Identifies whether a web resource is a social media / microblogging platform
   * (e.g. X, Twitter, Reddit, Bluesky, Threads) rather than a formal news publication.
   */
  public static isSocialMediaResource(url: string): boolean {
    if (!url) return false;
    try {
      const host = new URL(url).hostname.toLowerCase();
      return (
        host.includes("x.com") ||
        host.includes("twitter.com") ||
        host.includes("reddit.com") ||
        host.includes("threads.net") ||
        host.includes("bsky.app") ||
        host.includes("instagram.com") ||
        host.includes("facebook.com")
      );
    } catch {
      return false;
    }
  }

  /**
   * Domain-agnostic classifier to determine whether a web resource is a generic
   * source/portal/index hub vs. a concrete reporting article (story).
   */
  public static classifyWebResource(
    url: string,
    title?: string,
    snippet?: string
  ): WebResourceKind {
    if (!url) return "source_hub";

    try {
      const parsed = new URL(url);
      const pathname = parsed.pathname.replace(/\/+$/, "");

      // 1. Root domain is always a source hub
      if (!pathname || pathname === "" || pathname === "/") {
        return "source_hub";
      }

      const lowerPath = pathname.toLowerCase();
      const pathSegments = lowerPath.split("/").filter(Boolean);

      // 2. Common portal / directory / category index patterns
      const hubPatterns = [
        "/category/",
        "/categories/",
        "/topic/",
        "/topics/",
        "/tag/",
        "/tags/",
        "/section/",
        "/sections/",
        "/browse/",
        "/archive/",
        "/feed",
        "/rss",
        "/index.html",
        "/index.php",
      ];
      if (hubPatterns.some((pattern) => lowerPath.includes(pattern))) {
        // If the path ends immediately after the category/tag name, it is a hub
        const isTerminalHub =
          lowerPath.endsWith("/category") ||
          lowerPath.includes("/category/") ||
          lowerPath.includes("/topic/") ||
          lowerPath.includes("/tag/");
        if (isTerminalHub && pathSegments.length <= 3 && !lowerPath.match(/\d{4}/)) {
          return "source_hub";
        }
      }

      // 3. Short single-segment marketing/product or landing page paths
      // e.g. /fsd, /fsd-beta, /autopilot, /pricing, /about, /features, /models
      if (pathSegments.length === 1) {
        const seg = pathSegments[0];
        // If single path segment has fewer than 3 hyphen-separated words and no digits, it's a hub/landing page
        if (seg.split("-").length < 3 && !/\d/.test(seg)) {
          return "source_hub";
        }
      }

      // 4. Inspect title heuristics for directory/portal slogans vs. reporting headlines
      if (title) {
        const cleanT = title.trim();
        // Title ending in generic portal descriptions or lists of nouns
        if (
          /\b(News, Software Updates, Release Notes and Statistics|News, Reviews, Videos|Reviews, Videos|Official Site|Home Page|All Articles|Browse by Topic)\b/i.test(
            cleanT
          )
        ) {
          return "source_hub";
        }
      }

      // 5. Check positive indicators of an actual reporting article:
      // - Date in URL path: e.g. /2026/08/31/ or /2024/...
      // - Multi-word hyphenated slug: e.g. /tesla-fsd-v14-3-8-and-v14-1-lite-rolling-out/
      // - Article ID with slug: e.g. /news/4631/elon-musk-says-...
      // - File extension: .html, .php with slug
      const hasDatePath = /\/\d{4}\/\d{1,2}\//.test(lowerPath) || /\/\d{4}-\d{2}\//.test(lowerPath);
      const hasHyphenatedSlug = pathSegments.some(
        (seg) => seg.split("-").length >= 3 || (seg.split("-").length >= 2 && /\d/.test(seg))
      );
      const hasArticleKeyword =
        lowerPath.includes("/news/") ||
        lowerPath.includes("/article/") ||
        lowerPath.includes("/story/") ||
        lowerPath.includes("/post/") ||
        lowerPath.includes("/release-notes");

      if (hasDatePath || (hasHyphenatedSlug && hasArticleKeyword) || (hasHyphenatedSlug && pathSegments.length >= 2)) {
        return "story";
      }

      // If snippet is very generic directory description
      if (snippet && /\b(the latest news, information, and videos on|welcome to the official)\b/i.test(snippet)) {
        return "source_hub";
      }

      return "story";
    } catch {
      return "source_hub";
    }
  }

  /**
   * Explores a source hub page (e.g. topic portal, index, publication hub) to discover
   * actual concrete reporting stories related to the topic.
   */
  public static async discoverStoriesFromSource(
    sourceUrl: string,
    topic: string,
    maxStories: number = 4
  ): Promise<RawArticle[]> {
    if (!sourceUrl || !sourceUrl.startsWith("http")) return [];

    const cached = this.sourceCrawlCache.get(sourceUrl);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      return cached.articles.slice(0, maxStories);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(sourceUrl, {
        headers: {
          "User-Agent": this.USER_AGENT,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) return [];

      const html = await response.text();
      const origin = new URL(sourceUrl).origin;
      const hostname = new URL(sourceUrl).hostname.replace(/^www\./, "");

      // Extract all anchor links with their text and attributes
      const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
      let match: RegExpExecArray | null;
      const candidateLinks: Array<{ href: string; title: string }> = [];
      const seenHrefs = new Set<string>();

      while ((match = linkRegex.exec(html)) !== null) {
        let href = match[1].trim();
        const rawText = match[2];
        const text = FreeNewsFetcher.cleanHtml(rawText);

        if (!href || href.startsWith("#") || href.startsWith("javascript:") || href.startsWith("mailto:")) {
          continue;
        }

        // Normalize relative URLs
        if (href.startsWith("//")) {
          href = "https:" + href;
        } else if (href.startsWith("/")) {
          href = origin + href;
        } else if (!href.startsWith("http")) {
          href = `${origin}/${href}`;
        }

        // Must remain within the same domain or subdomain
        try {
          const parsedLink = new URL(href);
          if (!parsedLink.hostname.includes(hostname.replace(/^www\./, ""))) {
            continue;
          }
        } catch {
          continue;
        }

        if (seenHrefs.has(href) || href === sourceUrl) continue;
        seenHrefs.add(href);

        // Classify the discovered link: must be an actual story, NOT another hub
        if (text.length >= 15 && this.classifyWebResource(href, text) === "story") {
          // Skip utility links
          const lowerText = text.toLowerCase();
          if (
            lowerText.includes("privacy policy") ||
            lowerText.includes("terms of service") ||
            lowerText.includes("contact us") ||
            lowerText.includes("cookie policy") ||
            lowerText.includes("about us") ||
            lowerText.includes("sign in") ||
            lowerText.includes("subscribe")
          ) {
            continue;
          }

          candidateLinks.push({ href, title: text });
        }
      }

      if (candidateLinks.length === 0) {
        return [];
      }

      // Score candidates by relevance to the topic
      const topicTokens = topic
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((t) => t.length > 2 && !["the", "and", "for", "with", "news"].includes(t));

      const scoredLinks = candidateLinks.map((link) => {
        const combined = `${link.title} ${link.href}`.toLowerCase();
        const matchCount = topicTokens.filter((token) => combined.includes(token)).length;
        return { ...link, score: matchCount };
      });

      // Sort by relevance score descending
      scoredLinks.sort((a, b) => b.score - a.score);
      const topSelected = scoredLinks.slice(0, maxStories);

      // Deeply extract each selected story
      const discoveredArticles: RawArticle[] = [];
      for (const item of topSelected) {
        const deepStory = await this.extractDeepStory(item.href, hostname, topic, item.title);
        if (deepStory) {
          discoveredArticles.push(deepStory);
        } else {
          discoveredArticles.push({
            source_url: item.href,
            source_name: hostname,
            title: item.title,
            raw_text: `${item.title}. Reporting from ${hostname} on ${topic}.`,
            author_bias_rating: "center",
            published_at: new Date().toISOString(),
            topic_category: topic,
          });
        }
      }

      this.sourceCrawlCache.set(sourceUrl, {
        timestamp: Date.now(),
        articles: discoveredArticles,
      });

      return discoveredArticles;
    } catch {
      clearTimeout(timeoutId);
      return [];
    }
  }

  /**
   * Fetches the actual story content from an article page so summaries and facts
   * are drawn from genuine narrative reporting.
   */
  public static async extractDeepStory(
    url: string,
    publisherName: string,
    topic: string,
    fallbackTitle?: string
  ): Promise<RawArticle | null> {
    if (!url || !url.startsWith("http")) return null;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": this.USER_AGENT,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) return null;

      const html = await response.text();
      const parsedArticles = DirectContentCrawler.parseHtmlPage(html, {
        id: `src_${encodeURIComponent(url).slice(0, 32)}`,
        url,
        publisher_name: publisherName,
        source_type: "www_page",
        status: "active",
        consecutive_failures: 0,
        reliability_score: 1.0,
        topic,
        title: fallbackTitle || publisherName,
        created_at: new Date().toISOString(),
      });

      if (parsedArticles.length > 0) {
        const article = parsedArticles[0];
        // Clean headline if it repeats publisher name at the end
        if (article.title.includes(" - ")) {
          const parts = article.title.split(" - ");
          if (parts[parts.length - 1].toLowerCase().includes(publisherName.toLowerCase())) {
            parts.pop();
            article.title = parts.join(" - ").trim();
          }
        }
        return article;
      }

      return null;
    } catch {
      clearTimeout(timeoutId);
      return null;
    }
  }
}
