import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  pageview,
  trackEvent,
  trackLandingCta,
  trackFaqToggle,
  trackComparisonTab,
  trackAuthAction,
  trackFeedInteraction,
  trackSourceReader,
  trackCompanionChat,
  trackTopicInteraction,
  trackSubscriptionFunnel,
} from "@/lib/analytics";

describe("Google Analytics (GA4) & Funnel Progression Tracking", () => {
  let mockGtag: any;

  beforeEach(() => {
    mockGtag = vi.fn();
    (global as any).window = {
      gtag: mockGtag,
      location: { pathname: "/test" },
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Core GA4 Dispatcher", () => {
    it("dispatches trackEvent through window.gtag", () => {
      trackEvent("custom_action", { foo: "bar" });
      expect(mockGtag).toHaveBeenCalledWith("event", "custom_action", { foo: "bar" });
    });

    it("handles missing window.gtag gracefully without throwing", () => {
      (global as any).window.gtag = undefined;
      expect(() => trackEvent("test_event", { key: "val" })).not.toThrow();
    });

    it("handles pageview without throwing", () => {
      expect(() => pageview("/overview")).not.toThrow();
    });
  });

  describe("Funnel Stage 1: Landing Page & Top of Funnel", () => {
    it("tracks landing CTA clicks with section attribution", () => {
      trackLandingCta("Get Started with Google", "hero");
      expect(mockGtag).toHaveBeenCalledWith("event", "landing_cta_click", {
        button_name: "Get Started with Google",
        section: "hero",
        funnel_stage: "top_of_funnel",
      });
    });

    it("tracks FAQ toggle open and close actions", () => {
      trackFaqToggle("How does pricing work?", "open");
      expect(mockGtag).toHaveBeenCalledWith("event", "faq_toggle", {
        faq_question: "How does pricing work?",
        action: "open",
        funnel_stage: "top_of_funnel",
      });
    });

    it("tracks comparison tab toggle", () => {
      trackComparisonTab("before");
      expect(mockGtag).toHaveBeenCalledWith("event", "comparison_tab_toggle", {
        selected_tab: "before",
        funnel_stage: "top_of_funnel",
      });
    });
  });

  describe("Funnel Stage 2: Acquisition & Authentication", () => {
    it("tracks sign in initiation from header nav", () => {
      trackAuthAction("sign_in_initiated", "header_nav");
      expect(mockGtag).toHaveBeenCalledWith("event", "sign_in_initiated", {
        source_location: "header_nav",
        funnel_stage: "acquisition",
      });
    });

    it("tracks guest preview start and exit", () => {
      trackAuthAction("guest_explore_start", "hero");
      expect(mockGtag).toHaveBeenCalledWith("event", "guest_explore_start", {
        source_location: "hero",
        funnel_stage: "acquisition",
      });

      trackAuthAction("guest_preview_exit", "preview_banner");
      expect(mockGtag).toHaveBeenCalledWith("event", "guest_preview_exit", {
        source_location: "preview_banner",
        funnel_stage: "acquisition",
      });
    });

    it("tracks sign out", () => {
      trackAuthAction("sign_out", "user_menu");
      expect(mockGtag).toHaveBeenCalledWith("event", "sign_out", {
        source_location: "user_menu",
        funnel_stage: "acquisition",
      });
    });
  });

  describe("Funnel Stage 3: Activation & Feed Engagement", () => {
    it("tracks feed refresh and category changes", () => {
      trackFeedInteraction("refresh");
      expect(mockGtag).toHaveBeenCalledWith("event", "feed_refresh", {
        funnel_stage: "activation",
      });

      trackFeedInteraction("category_change", { category: "Technology" });
      expect(mockGtag).toHaveBeenCalledWith("event", "feed_category_change", {
        category: "Technology",
        funnel_stage: "activation",
      });
    });

    it("tracks source reader opens and outbound publisher clicks", () => {
      trackSourceReader("open", {
        articleId: "art_123",
        title: "Clean Facts on AI",
        publisher: "Reuters",
      });
      expect(mockGtag).toHaveBeenCalledWith("event", "source_reader_open", {
        articleId: "art_123",
        title: "Clean Facts on AI",
        publisher: "Reuters",
        funnel_stage: "activation",
      });

      trackSourceReader("external_link_click", {
        articleId: "art_123",
        sourceUrl: "https://reuters.com/example",
      });
      expect(mockGtag).toHaveBeenCalledWith("event", "source_reader_external_link_click", {
        articleId: "art_123",
        sourceUrl: "https://reuters.com/example",
        funnel_stage: "activation",
      });
    });
  });

  describe("Funnel Stage 4: Deep Engagement with Companion", () => {
    it("tracks companion chat message send with context flag", () => {
      trackCompanionChat("message_send", {
        messageLength: 42,
        hasAttachedContext: true,
        storyTitle: "Autonomous Driving",
      });
      expect(mockGtag).toHaveBeenCalledWith("event", "companion_message_send", {
        messageLength: 42,
        hasAttachedContext: true,
        storyTitle: "Autonomous Driving",
        funnel_stage: "deep_engagement",
      });
    });

    it("tracks story context attachment to dialogue", () => {
      trackCompanionChat("context_attach", {
        storyTitle: "Quantum Breakthrough",
        topic: "Physics",
      });
      expect(mockGtag).toHaveBeenCalledWith("event", "companion_context_attach", {
        storyTitle: "Quantum Breakthrough",
        topic: "Physics",
        funnel_stage: "deep_engagement",
      });
    });

    it("tracks topic knowledge graph selection", () => {
      trackTopicInteraction("select", { topicName: "Clean Energy", weight: 85 });
      expect(mockGtag).toHaveBeenCalledWith("event", "topic_select", {
        topicName: "Clean Energy",
        weight: 85,
        funnel_stage: "deep_engagement",
      });
    });
  });

  describe("Funnel Stage 5: Monetization & Conversion Progression", () => {
    it("tracks subscription modal open", () => {
      trackSubscriptionFunnel("modal_open", { source: "user_menu", tier: "free" });
      expect(mockGtag).toHaveBeenCalledWith("event", "subscription_modal_open", {
        source: "user_menu",
        tier: "free",
        funnel_stage: "monetization",
      });
    });

    it("tracks checkout start with promotional tier data", () => {
      trackSubscriptionFunnel("checkout_start", {
        tier: "subscriber",
        testMode: false,
        skipDiscount: false,
      });
      expect(mockGtag).toHaveBeenCalledWith("event", "subscription_checkout_start", {
        tier: "subscriber",
        testMode: false,
        skipDiscount: false,
        funnel_stage: "monetization",
      });
    });

    it("tracks checkout completion and cancellation returns", () => {
      trackSubscriptionFunnel("checkout_success", {
        sessionId: "cs_test_abc123",
        tier: "subscriber",
      });
      expect(mockGtag).toHaveBeenCalledWith("event", "subscription_checkout_success", {
        sessionId: "cs_test_abc123",
        tier: "subscriber",
        funnel_stage: "monetization",
      });

      trackSubscriptionFunnel("checkout_cancel", { tier: "subscriber" });
      expect(mockGtag).toHaveBeenCalledWith("event", "subscription_checkout_cancel", {
        tier: "subscriber",
        funnel_stage: "monetization",
      });
    });

    it("tracks quota warning display for approaching limit", () => {
      trackSubscriptionFunnel("quota_warning", {
        warningType: "near_limit",
        tier: "free",
      });
      expect(mockGtag).toHaveBeenCalledWith("event", "subscription_quota_warning", {
        warningType: "near_limit",
        tier: "free",
        funnel_stage: "monetization",
      });
    });
  });
});
