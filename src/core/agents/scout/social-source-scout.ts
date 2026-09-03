import { DirectSource, DirectSourceType, SocialSourceMetadata } from "../../types/contracts";
import { postgresStore } from "../../storage/postgres-store";
import { deepseekProvider } from "../../llm/deepseek-provider";
import { SocialContentCrawler } from "../../ingestion/social-crawler";
import { traceLogger } from "../../observability/trace-logger";

export interface SocialScoutResult {
  topic: string;
  candidate_sources_found: number;
  sources_validated_and_saved: DirectSource[];
  trace_id: string;
}

export class SocialSourceScoutAgent {
  /**
   * Autonomously discovers, validates, and registers public social media sources,
   * topic subreddits, and domain influencer feeds for any given topic.
   */
  public static async scoutForTopic(topic: string): Promise<SocialScoutResult> {
    const startTime = Date.now();
    const traceId = `trace_social_scout_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    if (!topic || topic.trim().length === 0) {
      return { topic, candidate_sources_found: 0, sources_validated_and_saved: [], trace_id: traceId };
    }

    // 1. Check if we already have active social sources registered for this topic
    const existing = await postgresStore.getDirectSourcesForTopic(topic);
    const existingSocial = existing.filter(
      (s) =>
        s.status === "active" &&
        (s.source_type === "reddit_community" ||
          s.source_type === "bluesky_profile" ||
          s.source_type === "social_feed" ||
          s.platform === "reddit" ||
          s.platform === "bluesky")
    );

    if (existingSocial.length >= 2) {
      return {
        topic,
        candidate_sources_found: existingSocial.length,
        sources_validated_and_saved: existingSocial,
        trace_id: traceId,
      };
    }

    // 2. LLM-Driven Domain-Agnostic Social Hub Discovery
    const candidateConfigs: Array<{
      source_type: DirectSourceType;
      url: string;
      title: string;
      publisher_name: string;
      platform: "reddit" | "bluesky" | "substack" | "open_web";
      metadata: SocialSourceMetadata;
    }> = [];

    if (deepseekProvider.isConfigured()) {
      try {
        const prompt = `You are the Social Media & Influencer Scout Agent for Project Aletheia.
Your task is to identify authoritative, high-signal public social hubs, practitioner communities, and domain influencers for the topic: "${topic}".

Identify:
1. One or two primary public Reddit communities (e.g. r/{subreddit}) dedicated to serious discussion, technical updates, or practitioner news on this topic.
2. One or two prominent open Bluesky handles or domain search keywords where leading researchers, engineers, or analysts publish primary updates on this topic.
3. Relevant technical Substack or independent newsletters if applicable.

Output strict JSON:
{
  "social_sources": [
    {
      "platform": "reddit",
      "source_type": "reddit_community",
      "url": "https://www.reddit.com/r/{subreddit}/",
      "title": "r/{subreddit} Discussion Hub",
      "publisher_name": "Reddit r/{subreddit}",
      "handle": "{subreddit}",
      "role_description": "Public practitioner and community hub"
    },
    {
      "platform": "bluesky",
      "source_type": "bluesky_profile",
      "url": "https://bsky.app/profile/{handle}",
      "title": "{Display Name or Organization} on Bluesky",
      "publisher_name": "Bluesky @{handle}",
      "handle": "{handle}",
      "role_description": "Domain researcher / core developer feed"
    }
  ]
}`;

        const res = await deepseekProvider.generateCompletion(prompt, {
          temperature: 0.1,
          maxTokens: 500,
        });

        const jsonMatch = res.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          const sources = Array.isArray(parsed.social_sources) ? parsed.social_sources : [];
          for (const s of sources) {
            if (s.url && s.source_type && s.platform) {
              candidateConfigs.push({
                source_type: s.source_type as DirectSourceType,
                url: s.url,
                title: s.title || `${s.platform} source`,
                publisher_name: s.publisher_name || s.platform,
                platform: s.platform,
                metadata: {
                  platform: s.platform,
                  handle_or_identifier: s.handle || s.url,
                  profile_name: s.title,
                  curated_topics: [topic],
                  role_description: s.role_description,
                },
              });
            }
          }
        }
      } catch (err) {
        console.warn(`SocialSourceScoutAgent: LLM social hub discovery error for "${topic}":`, err);
      }
    }

    // 3. Probe and Validate Candidate Social Feeds
    const validatedSources: DirectSource[] = [];

    for (const candidate of candidateConfigs) {
      try {
        const directSource: DirectSource = {
          id: `social_${candidate.platform}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          topic,
          source_type: candidate.source_type,
          url: candidate.url,
          title: candidate.title,
          publisher_name: candidate.publisher_name,
          status: "pending_validation",
          reliability_score: 0.85,
          platform: candidate.platform,
          metadata: candidate.metadata,
          consecutive_failures: 0,
          created_at: new Date().toISOString(),
        };

        // Probe endpoint with maxPosts = 2
        const crawlRes = await SocialContentCrawler.crawl(directSource, 2);

        if (crawlRes.articles && crawlRes.articles.length > 0) {
          directSource.status = "active";
          directSource.last_crawled_at = new Date().toISOString();
          directSource.last_successful_content_at = new Date().toISOString();
          directSource.etag = crawlRes.etag;
          directSource.last_modified = crawlRes.lastModified;

          await postgresStore.saveDirectSource(directSource);
          validatedSources.push(directSource);
        }
      } catch (probeErr) {
        console.warn(`SocialSourceScoutAgent: Probe validation failed for ${candidate.url}:`, probeErr);
      }
    }

    // 4. Trace logging
    try {
      traceLogger.logTrace({
        node_name: "node_scout",
        input_summary: { topic, candidates_proposed: candidateConfigs.length },
        output_summary: {
          sources_validated: validatedSources.length,
          active_source_urls: validatedSources.map((s) => s.url),
        },
        reasoning_rationale: `Social Scout probed ${candidateConfigs.length} candidate hubs for topic "${topic}". Successfully validated ${validatedSources.length} social feeds.`,
        latency_ms: Date.now() - startTime,
      });
    } catch {}

    return {
      topic,
      candidate_sources_found: candidateConfigs.length,
      sources_validated_and_saved: validatedSources,
      trace_id: traceId,
    };
  }
}
