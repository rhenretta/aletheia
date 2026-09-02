import { describe, it, expect } from "vitest";
import { postgresStore } from "../core/storage/postgres-store";
import { stripeService } from "../core/stripe/stripe-service";
import { AppUser } from "../core/types/contracts";

describe("Monetization, Stripe Integration & Tiered Usage Limits", () => {
  const timestamp = Date.now();
  const freeUserId = `usr_test_free_${timestamp}`;
  const subscriberUserId = `usr_test_sub_${timestamp}`;
  const adminUserId = `usr_test_admin_${timestamp}`;

  describe("1. User Tiers & Subscription Defaults", () => {
    it("creates a new user with default 'free' tier and subscription_status 'none'", async () => {
      const user = await postgresStore.getOrCreateUser({
        id: freeUserId,
        email: `free_${timestamp}@example.com`,
        name: "Free Test User",
        role: "user",
      });

      expect(user).toBeDefined();
      expect(user.id).toBe(freeUserId);
      expect(user.tier).toBe("free");
      expect(user.subscription_status).toBe("none");
      expect(user.stripe_customer_id).toBeFalsy();
      expect(user.stripe_subscription_id).toBeFalsy();
    });

    it("allows updating user tier directly", async () => {
      const updated = await postgresStore.updateUserTier(freeUserId, "subscriber");
      expect(updated.tier).toBe("subscriber");

      // Revert back to free
      const reverted = await postgresStore.updateUserTier(freeUserId, "free");
      expect(reverted.tier).toBe("free");
    });

    it("persists Stripe subscription metadata via updateUserSubscription", async () => {
      const customerId = `cus_test_${timestamp}`;
      const subId = `sub_test_${timestamp}`;
      const periodEnd = new Date(Date.now() + 30 * 86400000).toISOString();

      const user = await postgresStore.updateUserSubscription(freeUserId, {
        tier: "subscriber",
        stripeCustomerId: customerId,
        stripeSubscriptionId: subId,
        subscriptionStatus: "active",
        subscriptionPeriodEnd: periodEnd,
      });

      expect(user.tier).toBe("subscriber");
      expect(user.stripe_customer_id).toBe(customerId);
      expect(user.stripe_subscription_id).toBe(subId);
      expect(user.subscription_status).toBe("active");
      expect(user.subscription_period_end).toBe(periodEnd);

      // Re-fetch to confirm persistence
      const fetched = await postgresStore.getUser(freeUserId);
      expect(fetched?.tier).toBe("subscriber");
      expect(fetched?.stripe_customer_id).toBe(customerId);

      // Reset back to free for limit testing
      await postgresStore.updateUserSubscription(freeUserId, {
        tier: "free",
        subscriptionStatus: "none",
      });
    });
  });

  describe("2. Compute Usage & Cost Accumulation", () => {
    it("initializes usage metrics with period tracking fields", async () => {
      const usage = await postgresStore.getUserUsage(freeUserId);
      expect(usage).toBeDefined();
      expect(usage.period_cost_usd).toBe(0);
      expect(usage.period_tokens_used).toBe(0);
      expect(usage.lifetime_cost_usd).toBe(0);
      expect(usage.current_period_start).toBeDefined();
    });

    it("accurately increments cost delta based on tokens ($0.0000015/token) and pipeline runs ($0.002/run)", async () => {
      // 10,000 tokens = $0.015
      // 2 pipeline runs = $0.004
      // Total expected delta = $0.019
      await postgresStore.recordUsage(freeUserId, {
        tokensUsed: 10000,
        pipelineRuns: 2,
        chatMessages: 3,
        eventName: "chat",
        detail: "Test run",
      });

      const usage = await postgresStore.getUserUsage(freeUserId);
      expect(usage.period_tokens_used).toBe(10000);
      expect(usage.total_chat_messages).toBe(3);
      expect(usage.total_pipeline_runs).toBe(2);
      expect(usage.period_cost_usd).toBeCloseTo(0.019, 3);
      expect(usage.lifetime_cost_usd).toBeCloseTo(0.019, 3);
    });

    it("resets period_cost_usd when 30-day period expires while preserving lifetime_cost_usd", async () => {
      const usage = await postgresStore.getUserUsage(freeUserId);
      // Simulate that period started 31 days ago
      usage.current_period_start = new Date(Date.now() - 31 * 86400000).toISOString();

      // Trigger usage record
      await postgresStore.recordUsage(freeUserId, {
        tokensUsed: 1000, // $0.0015
        eventName: "telemetry",
      });

      const refreshedUsage = await postgresStore.getUserUsage(freeUserId);
      // Period cost should have been reset and only include the new 1000 tokens ($0.0015)
      expect(refreshedUsage.period_cost_usd).toBeCloseTo(0.0015, 3);
      // Lifetime cost should include both previous ($0.019) and new ($0.0015) = ~$0.0205
      expect(refreshedUsage.lifetime_cost_usd).toBeGreaterThan(0.019);
    });
  });

  describe("3. Tiered Usage Limits Enforcement ($0.50 Free vs $3.00 Subscriber)", () => {
    it("allows Free user when usage is under $0.50 limit", async () => {
      const limitStatus = await postgresStore.checkUsageLimit(freeUserId);
      expect(limitStatus.allowed).toBe(true);
      expect(limitStatus.tier).toBe("free");
      expect(limitStatus.limit).toBe(0.5);
      expect(limitStatus.currentCost).toBeLessThan(0.5);
    });

    it("detects when Free user approaches limit (>70% or >$0.35)", async () => {
      // Add usage to reach ~$0.40 (approx 250,000 tokens = $0.375)
      await postgresStore.recordUsage(freeUserId, {
        tokensUsed: 250000,
        eventName: "chat",
      });

      const limitStatus = await postgresStore.checkUsageLimit(freeUserId);
      expect(limitStatus.allowed).toBe(true);
      expect(limitStatus.currentCost).toBeGreaterThan(0.35);
      expect(limitStatus.isNearLimit).toBe(true);
      expect(limitStatus.percentUsed).toBeGreaterThanOrEqual(70);
    });

    it("blocks Free user when cost exceeds $0.50 and instructs to upgrade", async () => {
      // Add usage to exceed $0.50 (another 100,000 tokens = $0.15, total > $0.50)
      await postgresStore.recordUsage(freeUserId, {
        tokensUsed: 100000,
        eventName: "chat",
      });

      const limitStatus = await postgresStore.checkUsageLimit(freeUserId);
      expect(limitStatus.allowed).toBe(false);
      expect(limitStatus.tier).toBe("free");
      expect(limitStatus.currentCost).toBeGreaterThanOrEqual(0.5);
      expect(limitStatus.reason).toContain("Monthly free compute limit reached");
      expect(limitStatus.reason).toContain("Upgrade to Subscriber");
    });

    it("allows Subscriber user when cost exceeds $0.50 because Subscriber limit is $3.00", async () => {
      // Create or upgrade subscriber
      await postgresStore.getOrCreateUser({
        id: subscriberUserId,
        email: `sub_${timestamp}@example.com`,
        name: "Subscriber Test User",
        role: "user",
      });
      await postgresStore.updateUserTier(subscriberUserId, "subscriber");

      // Incur $1.00 of compute cost (approx 666,666 tokens)
      await postgresStore.recordUsage(subscriberUserId, {
        tokensUsed: 666666, // $0.999999
        eventName: "pipeline",
      });

      const limitStatus = await postgresStore.checkUsageLimit(subscriberUserId);
      expect(limitStatus.allowed).toBe(true);
      expect(limitStatus.tier).toBe("subscriber");
      expect(limitStatus.limit).toBe(3.0);
      expect(limitStatus.currentCost).toBeGreaterThan(0.9);
      expect(limitStatus.currentCost).toBeLessThan(3.0);
    });

    it("blocks Subscriber user when cost exceeds $3.00 cap", async () => {
      // Add enough tokens to exceed $3.00 cap (e.g. 1.5M more tokens = $2.25, total > $3.20)
      await postgresStore.recordUsage(subscriberUserId, {
        tokensUsed: 1500000,
        eventName: "chat",
      });

      const limitStatus = await postgresStore.checkUsageLimit(subscriberUserId);
      expect(limitStatus.allowed).toBe(false);
      expect(limitStatus.tier).toBe("subscriber");
      expect(limitStatus.currentCost).toBeGreaterThanOrEqual(3.0);
      expect(limitStatus.reason).toContain("Monthly subscriber compute allowance reached");
    });

    it("exempts Admin users from compute limits completely", async () => {
      await postgresStore.getOrCreateUser({
        id: adminUserId,
        email: `admin_${timestamp}@example.com`,
        name: "Admin Test User",
        role: "admin",
      });

      // Give admin huge usage (> $10.00)
      await postgresStore.recordUsage(adminUserId, {
        tokensUsed: 10000000, // $15.00
        eventName: "pipeline",
      });

      const limitStatus = await postgresStore.checkUsageLimit(adminUserId);
      expect(limitStatus.allowed).toBe(true);
      expect(limitStatus.limit).toBe(Infinity);
      expect(limitStatus.percentUsed).toBe(0);
    });
  });

  describe("4. Stripe Service Pricing, Coupons & Sessions", () => {
    it("resolves $15 recurring subscription price and $10-off coupon", async () => {
      const { priceId, couponId } = await stripeService.getOrCreatePriceAndCoupon();
      expect(priceId).toBeDefined();
      expect(couponId).toBeDefined();
      expect(typeof priceId).toBe("string");
      expect(typeof couponId).toBe("string");
    });

    it("creates a checkout session pointing to returnUrl with $10 first month discount", async () => {
      const user: AppUser = {
        id: freeUserId,
        email: `free_${timestamp}@example.com`,
        name: "Free User",
        role: "user",
        tier: "free",
        status: "active",
        created_at: new Date().toISOString(),
        last_active_at: new Date().toISOString(),
      };

      const result = await stripeService.createCheckoutSession({
        user,
        originUrl: "http://localhost:3000",
      });

      expect(result).toBeDefined();
      expect(result.checkoutUrl).toBeDefined();
      expect(result.sessionId).toBeDefined();
      expect(result.checkoutUrl).toContain("session_id=");
    });

    it("synchronizes subscription from checkout session ID and upgrades user to subscriber", async () => {
      const mockSessionId = `mock_cs_${Date.now()}`;
      const updatedUser = await stripeService.syncSubscriptionFromSession(freeUserId, mockSessionId);

      expect(updatedUser).toBeDefined();
      expect(updatedUser?.tier).toBe("subscriber");
      expect(updatedUser?.subscription_status).toBe("active");
      expect(updatedUser?.subscription_period_end).toBeDefined();
    });
  });

  describe("5. Admin Stripe Test Mode & Test Credit Card Simulator", () => {
    const testAdminTargetUserId = `usr_test_target_${timestamp}`;

    it("processes a test card payment with standard 4242 card and activates subscription", async () => {
      await postgresStore.getOrCreateUser({
        id: testAdminTargetUserId,
        email: `target_${timestamp}@example.com`,
        name: "Target Test User",
        role: "user",
      });

      const result = await stripeService.processTestPayment({
        userId: testAdminTargetUserId,
        cardNumber: "4242 4242 4242 4242",
        expDate: "12/28",
        cvc: "123",
      });

      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user?.tier).toBe("subscriber");
      expect(result.user?.subscription_status).toBe("active");
      expect(result.customerId).toContain("cus_test_admin_");
      expect(result.subscriptionId).toContain("sub_test_");

      // Verify that user now has subscriber compute limit of $3.00
      const limitStatus = await postgresStore.checkUsageLimit(testAdminTargetUserId);
      expect(limitStatus.tier).toBe("subscriber");
      expect(limitStatus.limit).toBe(3.0);
      expect(limitStatus.allowed).toBe(true);
    });

    it("simulates card decline on Stripe test card ending in 0002", async () => {
      const result = await stripeService.processTestPayment({
        userId: testAdminTargetUserId,
        cardNumber: "4000 0000 0000 0002",
        expDate: "12/28",
        cvc: "123",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("card was declined");
    });

    it("simulates expired card error on Stripe test card ending in 0115", async () => {
      const result = await stripeService.processTestPayment({
        userId: testAdminTargetUserId,
        cardNumber: "4000 0000 0000 0115",
        expDate: "01/20",
        cvc: "123",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("expired");
    });

    it("supports testMode flag in createCheckoutSession", async () => {
      const user: AppUser = {
        id: testAdminTargetUserId,
        email: `target_${timestamp}@example.com`,
        name: "Target User",
        role: "user",
        tier: "free",
        status: "active",
        created_at: new Date().toISOString(),
        last_active_at: new Date().toISOString(),
      };

      const result = await stripeService.createCheckoutSession({
        user,
        originUrl: "http://localhost:3000",
        testMode: true,
      });

      expect(result).toBeDefined();
      expect(result.checkoutUrl).toContain("test_mode=true");
    });

    it("automatically reconciles and demotes lapsed subscriptions back to free tier", async () => {
      const lapsedUserId = `usr_lapsed_${timestamp}`;
      await postgresStore.getOrCreateUser({
        id: lapsedUserId,
        email: `lapsed_${timestamp}@example.com`,
        name: "Lapsed User",
        role: "user",
      });

      // Set user as subscriber whose period ended yesterday
      const yesterday = new Date(Date.now() - 86400000).toISOString();
      await postgresStore.updateUserSubscription(lapsedUserId, {
        tier: "subscriber",
        subscriptionStatus: "active",
        subscriptionPeriodEnd: yesterday,
      });

      // Calling getUser should automatically reconcile the lapse
      const user = await postgresStore.getUser(lapsedUserId);
      expect(user?.tier).toBe("free");
      expect(user?.subscription_status).toBe("past_due");

      // checkUsageLimit should enforce the $0.50 free cap
      const limitStatus = await postgresStore.checkUsageLimit(lapsedUserId);
      expect(limitStatus.tier).toBe("free");
      expect(limitStatus.limit).toBe(0.5);
    });
  });
});
