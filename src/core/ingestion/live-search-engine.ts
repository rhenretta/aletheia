import { RawArticle } from "../types/contracts";
import { FreeNewsFetcher } from "./rss-search";

export interface LiveSearchOptions {
  timeWindow?: "week" | "month" | "year" | "all";
  maxResults?: number;
  maxAgeDays?: number;
}

export class LiveSearchEngine {
  private static searchCache: Map<string, { timestamp: number; articles: RawArticle[] }> = new Map();
  private static readonly CACHE_TTL_MS = 7 * 60 * 1000; // 7 minutes
  private static ddgCircuitBreakerUntil: number = 0;
  private static readonly USER_AGENT =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

  /**
   * Cleans and decodes HTML text and entities
   */
  public static cleanText(input: string): string {
    if (!input) return "";
    return FreeNewsFetcher.cleanHtml(input);
  }

  /**
   * Extracts publication date and relative age from snippet text (e.g. "Aug 17, 2024 - ...", "3 days ago ...")
   */
  public static extractDateFromSnippet(snippet: string): { cleanSnippet: string; publishedAt?: string; ageDays?: number } {
    if (!snippet) return { cleanSnippet: "" };

    const clean = snippet.trim();

    // Check relative patterns: "X days/weeks/months/years ago"
    const relMatch = clean.match(/^(\d+)\s+(day|week|month|year|hour|minute)s?\s+ago\s*[-–—:]?\s*/i);
    if (relMatch) {
      const count = parseInt(relMatch[1], 10);
      const unit = relMatch[2].toLowerCase();
      let ageDays = 0;
      if (unit.startsWith("day")) ageDays = count;
      else if (unit.startsWith("week")) ageDays = count * 7;
      else if (unit.startsWith("month")) ageDays = count * 30;
      else if (unit.startsWith("year")) ageDays = count * 365;

      const pubDate = new Date(Date.now() - ageDays * 24 * 60 * 60 * 1000).toISOString();
      const rest = clean.slice(relMatch[0].length).trim();
      return { cleanSnippet: rest || clean, publishedAt: pubDate, ageDays };
    }

    // Check absolute date pattern: "Month DD, YYYY" or "DD Month YYYY"
    const absMatch = clean.match(/^([A-Za-z]{3,9}\.?\s+\d{1,2}(?:,\s*|\s+)\d{4}|\d{1,2}\s+[A-Za-z]{3,9}\.?\s+\d{4}|\d{4}-\d{2}-\d{2})\s*[-–—:]?\s*/i);
    if (absMatch) {
      const parsed = Date.parse(absMatch[1]);
      if (!isNaN(parsed)) {
        const ageDays = Math.max(0, Math.round((Date.now() - parsed) / (1000 * 60 * 60 * 24)));
        const rest = clean.slice(absMatch[0].length).trim();
        return { cleanSnippet: rest || clean, publishedAt: new Date(parsed).toISOString(), ageDays };
      }
    }

    // Check for inline years indicating past historical content (e.g. 2018-2024 when in current year 2026)
    const yearMatch = clean.match(/\b(201[0-9]|202[0-4])\b/);
    if (yearMatch) {
      const year = parseInt(yearMatch[1], 10);
      const currentYear = new Date().getFullYear();
      if (currentYear - year >= 2) {
        const approximateAgeDays = (currentYear - year) * 365;
        return { cleanSnippet: clean, ageDays: approximateAgeDays };
      }
    }

    return { cleanSnippet: clean };
  }

  /**
   * Executes live search for a given query, returning structured results with rich snippets.
   * Uses an in-memory TTL cache, multi-provider mesh (Bing RSS + DDG), query relaxation,
   * and optional recency window filtering.
   */
  public static async search(
    query: string,
    maxResultsOrOptions: number | LiveSearchOptions = 6
  ): Promise<RawArticle[]> {
    if (!query || query.trim().length === 0) {
      return [];
    }

    const options: LiveSearchOptions =
      typeof maxResultsOrOptions === "number"
        ? { maxResults: maxResultsOrOptions }
        : maxResultsOrOptions;

    const maxResults = options.maxResults ?? 6;
    const maxAgeDays = options.maxAgeDays;
    const timeWindow = options.timeWindow;

    const cleanQuery = query.trim();
    const cacheKey = `${cleanQuery.toLowerCase().replace(/\s+/g, " ")}__tw_${timeWindow || "all"}__age_${maxAgeDays || 0}`;

    // 1. Check in-memory TTL cache
    const cached = this.searchCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      return cached.articles.slice(0, maxResults);
    }

    // 2. Execute search across multi-provider mesh with recency parameters
    let articles = await this.executeSearch(cleanQuery, maxResults, options);

    // 3. Automatic Query Relaxation: if results < 2 and query contains over-constraining month/date tokens
    if (articles.length < 2) {
      const relaxedQuery = this.relaxQuery(cleanQuery);
      if (relaxedQuery !== cleanQuery) {
        const relaxedArticles = await this.executeSearch(relaxedQuery, maxResults, options);
        if (relaxedArticles.length > articles.length) {
          articles = relaxedArticles;
        }
      }
    }

    // 4. Filter by maxAgeDays if specified
    if (maxAgeDays && maxAgeDays > 0) {
      const cutoffTime = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
      articles = articles.filter((a) => {
        const pub = new Date(a.published_at || 0).getTime();
        return isNaN(pub) || pub >= cutoffTime;
      });
    }

    // 5. Save to cache
    if (articles.length > 0) {
      this.searchCache.set(cacheKey, {
        timestamp: Date.now(),
        articles,
      });

      // Maintain max cache size (LRU prune after 300 entries)
      if (this.searchCache.size > 300) {
        const oldestKey = this.searchCache.keys().next().value;
        if (oldestKey) this.searchCache.delete(oldestKey);
      }
    }

    return articles.slice(0, maxResults);
  }

  /**
   * Relaxes over-constrained temporal tokens (e.g. month names, conversational fillers)
   */
  public static relaxQuery(query: string): string {
    return query
      .replace(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/gi, "")
      .replace(/\b(202[4-9]|203[0-9])\b/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  /**
   * Internal search orchestrator: tries DDG first, then Bing RSS, then Google News RSS
   */
  private static async executeSearch(
    query: string,
    maxResults: number,
    options?: LiveSearchOptions
  ): Promise<RawArticle[]> {
    const combined: RawArticle[] = [];
    const seenUrls = new Set<string>();

    // 1. DuckDuckGo HTML search (organic web index with trackers, blogs, wikis)
    if (Date.now() > this.ddgCircuitBreakerUntil) {
      try {
        const ddgResults = await this.queryDuckDuckGoHtml(query, maxResults, options);
        for (const a of ddgResults) {
          if (!seenUrls.has(a.source_url)) {
            seenUrls.add(a.source_url);
            combined.push(a);
          }
        }
      } catch (err) {
        console.warn(`LiveSearchEngine: DDG search error for "${query}":`, err);
      }
    }

    if (combined.length >= maxResults) {
      return combined.slice(0, maxResults);
    }

    // 2. Bing RSS Web Search (structured RSS XML fallback with relevance checking)
    try {
      const bingArticles = await this.queryBingRss(query, maxResults, options);
      for (const a of bingArticles) {
        if (!seenUrls.has(a.source_url)) {
          seenUrls.add(a.source_url);
          combined.push(a);
        }
      }
    } catch (err) {
      console.warn(`LiveSearchEngine: Bing RSS search error for "${query}":`, err);
    }

    if (combined.length >= 2) {
      return combined.slice(0, maxResults);
    }

    // 3. Google News RSS fallback (for breaking news and technical journalism)
    try {
      const rssArticles = await FreeNewsFetcher.fetchRssForQuery(query);
      for (const a of rssArticles) {
        if (!seenUrls.has(a.source_url)) {
          seenUrls.add(a.source_url);
          combined.push(a);
        }
      }
    } catch (err) {
      console.warn(`LiveSearchEngine: Google News RSS fallback error for "${query}":`, err);
    }

    return combined.slice(0, maxResults);
  }

  /**
   * Queries Bing Web Search RSS feed for general web documentation, release trackers, and forums
   */
  public static async queryBingRss(
    query: string,
    maxResults: number,
    options?: LiveSearchOptions
  ): Promise<RawArticle[]> {
    const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}&format=rss`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    try {
      const response = await fetch(searchUrl, {
        method: "GET",
        headers: {
          "User-Agent": this.USER_AGENT,
          Accept: "application/rss+xml, text/xml, */*",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      if (!response.ok) return [];

      const xml = await response.text();
      const articles: RawArticle[] = [];

      const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
      let match: RegExpExecArray | null;

      while ((match = itemRegex.exec(xml)) !== null && articles.length < maxResults) {
        const item = match[1];
        const titleMatch = /<title>([\s\S]*?)<\/title>/i.exec(item);
        const linkMatch = /<link>([\s\S]*?)<\/link>/i.exec(item);
        const descMatch = /<description>([\s\S]*?)<\/description>/i.exec(item);
        const pubDateMatch = /<pubDate>([\s\S]*?)<\/pubDate>/i.exec(item);

        const rawTitle = titleMatch ? this.cleanText(titleMatch[1]) : "";
        const url = linkMatch ? linkMatch[1].trim() : "";
        const snippet = descMatch ? this.cleanText(descMatch[1]) : "";

        if (url.startsWith("http") && rawTitle.length > 5) {
          try {
            const parsedUrl = new URL(url);
            const host = parsedUrl.hostname.toLowerCase();
            // Filter out e-commerce storefronts and checkout pages
            if (
              host.startsWith("shop.") ||
              host.startsWith("store.") ||
              host.startsWith("cart.") ||
              host.startsWith("checkout.")
            ) {
              continue;
            }
            // Filter out generic root homepages if they lack version/update context
            if (
              parsedUrl.pathname === "/" &&
              !rawTitle.toLowerCase().includes("version") &&
              !rawTitle.toLowerCase().includes("update") &&
              !rawTitle.toLowerCase().includes("release")
            ) {
              continue;
            }

            // Relevance verification: Result must match specific non-trivial query terms
            const nonTrivialTerms = query
              .toLowerCase()
              .split(/\s+/)
              .filter((t) => t.length > 2 && !["the", "and", "for", "with", "from", "that", "been", "how", "has"].includes(t));
            if (nonTrivialTerms.length > 1) {
              const fullSnippet = `${rawTitle} ${snippet}`.toLowerCase();
              const matchedCount = nonTrivialTerms.filter((term) => fullSnippet.includes(term)).length;
              if (matchedCount < Math.min(2, nonTrivialTerms.length)) {
                continue;
              }
            }
          } catch {}

          let sourceName = "Web Source";
          try {
            sourceName = new URL(url).hostname.replace(/^www\./, "");
          } catch {}

          let publishedAt = new Date().toISOString();
          let ageDays: number | undefined;
          if (pubDateMatch) {
            const d = new Date(pubDateMatch[1].trim());
            if (!isNaN(d.getTime())) {
              publishedAt = d.toISOString();
              ageDays = Math.max(0, Math.round((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24)));
            }
          }

          if (options?.maxAgeDays && ageDays !== undefined && ageDays > options.maxAgeDays) {
            continue;
          }

          const { cleanSnippet, ageDays: snippetAgeDays } = this.extractDateFromSnippet(snippet);
          if (options?.maxAgeDays && snippetAgeDays !== undefined && snippetAgeDays > options.maxAgeDays) {
            continue;
          }

          articles.push({
            source_url: url,
            source_name: sourceName,
            title: rawTitle,
            raw_text: cleanSnippet ? `${rawTitle}. ${cleanSnippet}` : rawTitle,
            author_bias_rating: "center",
            published_at: publishedAt,
            topic_category: LiveSearchEngine.cleanTopicCategory(query),
          });
        }
      }

      return articles;
    } catch {
      clearTimeout(timeoutId);
      return [];
    }
  }

  /**
   * Scrapes DuckDuckGo HTML search results for rich empirical snippets
   */
  private static async queryDuckDuckGoHtml(
    query: string,
    maxResults: number,
    options?: LiveSearchOptions
  ): Promise<RawArticle[]> {
    let searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    if (options?.timeWindow === "week") {
      searchUrl += "&df=w";
    } else if (options?.timeWindow === "month") {
      searchUrl += "&df=m";
    } else if (options?.timeWindow === "year") {
      searchUrl += "&df=y";
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    try {
      const response = await fetch(searchUrl, {
        method: "GET",
        headers: {
          "User-Agent": "Mozilla/5.0",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Status 202 is an anti-bot challenge: trip circuit breaker for 30 seconds
      if (response.status === 202 || !response.ok) {
        this.ddgCircuitBreakerUntil = Date.now() + 30 * 1000;
        return [];
      }

      const html = await response.text();
      // If the body is a challenge page without search results, trip circuit breaker
      if (html.includes("anomaly-modal") || !html.includes("result__a")) {
        this.ddgCircuitBreakerUntil = Date.now() + 30 * 1000;
        return [];
      }

      return this.parseDdgHtml(html, query, maxResults, options);
    } catch {
      clearTimeout(timeoutId);
      return [];
    }
  }

  /**
   * Parses DuckDuckGo HTML results extracting real publisher URLs, titles, and substantive snippets
   */
  private static parseDdgHtml(
    html: string,
    query: string,
    maxResults: number,
    options?: LiveSearchOptions
  ): RawArticle[] {
    const articles: RawArticle[] = [];

    const resultBlockRegex = /<div[^>]*class="[^"]*result\s+results_links[^"]*"[\s\S]*?(?=<div[^>]*class="[^"]*result\s+results_links|$)/gi;
    const blocks = html.match(resultBlockRegex) || [];

    for (const block of blocks) {
      if (articles.length >= maxResults) break;

      const titleMatch =
        /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i.exec(block) ||
        /<a[^>]*class="[^"]*result__url[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i.exec(block);

      const snippetMatch =
        /<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/i.exec(block) ||
        /<div[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/div>/i.exec(block);

      if (titleMatch) {
        let rawUrl = titleMatch[1];
        if (rawUrl.startsWith("//")) rawUrl = "https:" + rawUrl;

        if (rawUrl.includes("uddg=")) {
          const match = /uddg=([^&]+)/.exec(rawUrl);
          if (match) {
            try {
              rawUrl = decodeURIComponent(match[1]);
            } catch {}
          }
        }

        const title = this.cleanText(titleMatch[2]);
        const snippet = snippetMatch ? this.cleanText(snippetMatch[1]) : "";

        if (rawUrl.startsWith("http") && title.length > 5) {
          let sourceName = "Live Web Source";
          try {
            sourceName = new URL(rawUrl).hostname.replace(/^www\./, "");
          } catch {}

          const { cleanSnippet, publishedAt, ageDays } = this.extractDateFromSnippet(snippet);
          if (options?.maxAgeDays && ageDays !== undefined && ageDays > options.maxAgeDays) {
            continue; // Skip stale article older than maxAgeDays
          }

          articles.push({
            source_url: rawUrl,
            source_name: sourceName,
            title,
            raw_text: cleanSnippet ? `${title}. ${cleanSnippet}` : title,
            author_bias_rating: "center",
            published_at: publishedAt || new Date().toISOString(),
            topic_category: LiveSearchEngine.cleanTopicCategory(query),
          });
        }
      }
    }

    return articles;
  }

  /**
   * Strips search operators (site:, when:, inurl:) to extract clean human-readable topic name
   */
  public static cleanTopicCategory(query: string): string {
    const cleaned = query
      .replace(/\bsite:[^\s]+/gi, "")
      .replace(/\bwhen:[^\s]+/gi, "")
      .replace(/\binurl:[^\s]+/gi, "")
      .replace(/\bsource:[^\s]+/gi, "")
      .replace(/\bfiletype:[^\s]+/gi, "")
      .replace(/\s+/g, " ")
      .trim();
    return cleaned.length > 0 ? cleaned : query;
  }
}
