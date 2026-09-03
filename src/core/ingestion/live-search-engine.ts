import { RawArticle } from "../types/contracts";
import { FreeNewsFetcher } from "./rss-search";

export interface LiveSearchResult {
  title: string;
  snippet: string;
  source_name: string;
  source_url: string;
  published_at?: string;
}

/**
 * Live Search Engine: Direct multi-source live web search.
 * Pulls rich, empirical descriptive snippets and authentic publisher URLs without API keys.
 * Contains zero hardcoded word-stripping heuristics or domain-specific fallbacks.
 */
export class LiveSearchEngine {
  /**
   * Cleans and decodes HTML text and entities
   */
  public static cleanText(input: string): string {
    if (!input) return "";
    return FreeNewsFetcher.cleanHtml(input);
  }

  /**
   * Executes live search for a given query, returning structured results with rich snippets
   */
  public static async search(query: string, maxResults: number = 6): Promise<RawArticle[]> {
    if (!query || query.trim().length === 0) {
      return [];
    }

    const cleanQuery = query.trim();

    try {
      const ddgResults = await this.queryDuckDuckGoHtml(cleanQuery, maxResults);
      if (ddgResults.length > 0) {
        return ddgResults;
      }
    } catch (err) {
      console.warn(`LiveSearchEngine: DDG search error for "${cleanQuery}":`, err);
    }

    return [];
  }

  /**
   * Scrapes DuckDuckGo HTML search results for rich empirical snippets
   */
  private static async queryDuckDuckGoHtml(query: string, maxResults: number): Promise<RawArticle[]> {
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    try {
      const response = await fetch(searchUrl, {
        method: "GET",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return [];
      }

      const html = await response.text();
      return this.parseDdgHtml(html, query, maxResults);
    } catch (err) {
      clearTimeout(timeoutId);
      return [];
    }
  }

  /**
   * Parses DuckDuckGo HTML results extracting real publisher URLs, titles, and substantive snippets
   */
  private static parseDdgHtml(html: string, query: string, maxResults: number): RawArticle[] {
    const articles: RawArticle[] = [];

    // Match each result block
    const resultBlockRegex = /<div[^>]*class="[^"]*result\s+results_links[^"]*"[\s\S]*?(?=<div[^>]*class="[^"]*result\s+results_links|$)/gi;
    const blocks = html.match(resultBlockRegex) || [];

    for (const block of blocks) {
      if (articles.length >= maxResults) break;

      // Extract headline and URL from h2.result__title a.result__a
      const titleMatch =
        /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i.exec(block) ||
        /<a[^>]*class="[^"]*result__url[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i.exec(block);

      // Extract snippet
      const snippetMatch =
        /<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/i.exec(block) ||
        /<div[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/div>/i.exec(block);

      if (titleMatch) {
        let rawUrl = titleMatch[1];
        if (rawUrl.startsWith("//")) {
          rawUrl = "https:" + rawUrl;
        }

        // Decode DDG redirect URL parameter: uddg=...
        if (rawUrl.includes("uddg=")) {
          const match = /uddg=([^&]+)/.exec(rawUrl);
          if (match) {
            try {
              rawUrl = decodeURIComponent(match[1]);
            } catch (e) {}
          }
        }

        const title = this.cleanText(titleMatch[2]);
        const snippet = snippetMatch ? this.cleanText(snippetMatch[1]) : "";

        // Determine publisher name from URL domain
        let sourceName = "Live Web Source";
        try {
          const parsed = new URL(rawUrl);
          sourceName = parsed.hostname.replace(/^www\./, "");
        } catch (e) {}

        if (title.length > 5 && (snippet.length > 15 || title.length > 20)) {
          articles.push({
            source_url: rawUrl,
            source_name: sourceName,
            title,
            raw_text: snippet ? `${title}. ${snippet}` : title,
            author_bias_rating: "center",
            published_at: new Date().toISOString(),
            topic_category: query,
          });
        }
      }
    }

    // Fallback: If resultBlockRegex did not match (due to HTML layout variations), try global snippet regex
    if (articles.length === 0) {
      const linkRegex = /<a[^>]*class="result__snippet"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
      const urlRegex = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;

      const links: Array<{ url: string; title: string }> = [];
      let lMatch;
      while ((lMatch = urlRegex.exec(html)) !== null && links.length < maxResults) {
        let u = lMatch[1];
        if (u.includes("uddg=")) {
          const m = /uddg=([^&]+)/.exec(u);
          if (m) {
            try { u = decodeURIComponent(m[1]); } catch (e) {}
          }
        }
        links.push({ url: u, title: this.cleanText(lMatch[2]) });
      }

      const snippets: string[] = [];
      let sMatch;
      while ((sMatch = linkRegex.exec(html)) !== null && snippets.length < maxResults) {
        snippets.push(this.cleanText(sMatch[2]));
      }

      for (let i = 0; i < links.length; i++) {
        const link = links[i];
        const snip = snippets[i] || "";
        let sourceName = "Live Web Source";
        try {
          sourceName = new URL(link.url).hostname.replace(/^www\./, "");
        } catch (e) {}

        articles.push({
          source_url: link.url,
          source_name: sourceName,
          title: link.title,
          raw_text: snip ? `${link.title}. ${snip}` : link.title,
          author_bias_rating: "center",
          published_at: new Date().toISOString(),
          topic_category: query,
        });
      }
    }

    return articles;
  }
}
