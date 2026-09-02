/**
 * Google Analytics (GA4) Utility & Funnel Tracking
 */

export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "";

declare global {
  interface Window {
    dataLayer?: any[];
    gtag?: (...args: any[]) => void;
  }
}

/**
 * Log pageviews to Google Analytics
 */
export function pageview(url: string): void {
  if (typeof window === "undefined") return;

  if (process.env.NODE_ENV === "development") {
    // eslint-disable-next-line no-console
    console.debug("[GA Pageview]", url);
  }

  if (typeof window.gtag === "function" && GA_MEASUREMENT_ID) {
    window.gtag("config", GA_MEASUREMENT_ID, {
      page_path: url,
    });
  }
}

/**
 * Dispatch generic custom event to Google Analytics
 */
export function trackEvent(
  eventName: string,
  eventParams?: Record<string, any>
): void {
  if (typeof window === "undefined") return;

  if (process.env.NODE_ENV === "development") {
    // eslint-disable-next-line no-console
    console.debug("[GA Event]", eventName, eventParams || {});
  }

  if (typeof window.gtag === "function") {
    window.gtag("event", eventName, eventParams);
  }
}

/**
 * Funnel Stage 1: Landing Page & Top-of-Funnel CTAs
 */
export function trackLandingCta(buttonName: string, section: string): void {
  trackEvent("landing_cta_click", {
    button_name: buttonName,
    section,
    funnel_stage: "top_of_funnel",
  });
}

export function trackFaqToggle(question: string, action: "open" | "close"): void {
  trackEvent("faq_toggle", {
    faq_question: question,
    action,
    funnel_stage: "top_of_funnel",
  });
}

export function trackComparisonTab(tab: "before" | "after"): void {
  trackEvent("comparison_tab_toggle", {
    selected_tab: tab,
    funnel_stage: "top_of_funnel",
  });
}

/**
 * Funnel Stage 2: Authentication & Acquisition Flow
 */
export function trackAuthAction(
  action: "sign_in_initiated" | "guest_explore_start" | "guest_preview_exit" | "sign_out",
  sourceLocation: string = "unknown"
): void {
  trackEvent(action, {
    source_location: sourceLocation,
    funnel_stage: "acquisition",
  });
}

/**
 * Funnel Stage 3: Core Product Activation & Feed Consumption
 */
export function trackFeedInteraction(
  action: "category_change" | "refresh" | "article_click" | "feed_view",
  details?: {
    category?: string;
    itemCount?: number;
    articleId?: string;
    topic?: string;
    headline?: string;
  }
): void {
  trackEvent(`feed_${action}`, {
    ...details,
    funnel_stage: "activation",
  });
}

export function trackSourceReader(
  action: "open" | "external_link_click",
  details?: {
    articleId?: string;
    title?: string;
    sourceUrl?: string;
    publisher?: string;
  }
): void {
  trackEvent(`source_reader_${action}`, {
    ...details,
    funnel_stage: "activation",
  });
}

/**
 * Funnel Stage 4: Companion & Epistemic Retention
 */
export function trackCompanionChat(
  action: "message_send" | "suggestion_click" | "context_attach",
  details?: {
    messageLength?: number;
    hasAttachedContext?: boolean;
    suggestionText?: string;
    storyTitle?: string;
    topic?: string;
  }
): void {
  trackEvent(`companion_${action}`, {
    ...details,
    funnel_stage: "deep_engagement",
  });
}

export function trackTopicInteraction(
  action: "select" | "evolve",
  details?: {
    topicName?: string;
    weight?: number;
  }
): void {
  trackEvent(`topic_${action}`, {
    ...details,
    funnel_stage: "deep_engagement",
  });
}

/**
 * Funnel Stage 5: Monetization & Conversion Progression
 */
export function trackSubscriptionFunnel(
  action: "modal_open" | "checkout_start" | "checkout_success" | "checkout_cancel" | "quota_warning",
  details?: {
    source?: string;
    tier?: string;
    testMode?: boolean;
    skipDiscount?: boolean;
    warningType?: "near_limit" | "limit_reached";
    sessionId?: string;
  }
): void {
  trackEvent(`subscription_${action}`, {
    ...details,
    funnel_stage: "monetization",
  });
}
