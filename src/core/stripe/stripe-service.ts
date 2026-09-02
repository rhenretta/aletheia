import Stripe from "stripe";
import { postgresStore } from "../storage/postgres-store";
import { AppUser, UserTier, SubscriptionStatus } from "../types/contracts";

export interface CheckoutSessionResult {
  checkoutUrl: string;
  sessionId: string;
  isMock?: boolean;
}

export interface PortalSessionResult {
  portalUrl: string;
  isMock?: boolean;
}

export class StripeService {
  private static instance: StripeService;
  private liveStripe: Stripe | null = null;
  private testStripe: Stripe | null = null;
  private isTestMode: boolean = true;
  private cachedPriceId: string | null = null;
  private cachedCouponId: string | null = null;

  constructor() {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    const testSecretKey = process.env.STRIPE_TEST_SECRET_KEY;

    if (secretKey && secretKey.trim().length > 0) {
      const client = new Stripe(secretKey, {
        apiVersion: "2025-01-27.acacia" as any,
      });
      if (secretKey.startsWith("sk_test_")) {
        this.testStripe = client;
        this.liveStripe = client;
        this.isTestMode = true;
      } else {
        this.liveStripe = client;
        this.isTestMode = false;
      }
    }

    if (testSecretKey && testSecretKey.trim().length > 0) {
      this.testStripe = new Stripe(testSecretKey, {
        apiVersion: "2025-01-27.acacia" as any,
      });
    }
  }

  public static getInstance(): StripeService {
    if (!StripeService.instance) {
      StripeService.instance = new StripeService();
    }
    return StripeService.instance;
  }

  public get stripe(): Stripe | null {
    return this.getClient();
  }

  public getClient(forceTestMode?: boolean): Stripe | null {
    if (forceTestMode) {
      return this.testStripe || (this.liveStripe && this.isTestMode ? this.liveStripe : null);
    }
    return this.liveStripe || this.testStripe;
  }

  public isConfigured(forceTestMode?: boolean): boolean {
    return Boolean(this.getClient(forceTestMode));
  }

  public hasTestKey(): boolean {
    return Boolean(this.testStripe);
  }

  public hasLiveKey(): boolean {
    return Boolean(this.liveStripe && !this.isTestMode);
  }

  /**
   * Retrieves or creates the recurring $15/month subscription price and $10-off first-month coupon.
   */
  public async getOrCreatePriceAndCoupon(forceTestMode?: boolean): Promise<{ priceId: string; couponId: string }> {
    const client = this.getClient(forceTestMode);
    if (!client) {
      return { priceId: "price_mock_15usd_month", couponId: "coupon_mock_10usd_off" };
    }

    // 1. Resolve Price
    let priceId = process.env.STRIPE_PRICE_ID || this.cachedPriceId;
    if (!priceId) {
      try {
        const prices = await client.prices.list({
          active: true,
          limit: 10,
          type: "recurring",
        });

        const existing15 = prices.data.find(
          (p) => p.unit_amount === 1500 && p.currency === "usd" && p.recurring?.interval === "month"
        );

        if (existing15) {
          priceId = existing15.id;
        } else {
          const products = await client.products.list({ active: true, limit: 10 });
          let product = products.data.find((p) => p.name.toLowerCase().includes("aletheia"));

          if (!product) {
            product = await client.products.create({
              name: "Project Aletheia News Subscription",
              description: "Full epistemically-verified news companion, unconstrained cognitive analysis, and 6x compute quota.",
            });
          }

          const newPrice = await client.prices.create({
            product: product.id,
            unit_amount: 1500, // $15.00
            currency: "usd",
            recurring: {
              interval: "month",
            },
          });
          priceId = newPrice.id;
        }
        this.cachedPriceId = priceId;
      } catch (err) {
        console.warn("StripeService: Could not auto-resolve Stripe price, using fallback:", err);
        priceId = "price_aletheia_sub_15";
      }
    }

    // 2. Resolve $10 Off First Month Coupon
    let couponId = process.env.STRIPE_COUPON_ID || this.cachedCouponId;
    if (!couponId) {
      try {
        const couponName = "aletheia_first_month_10_off";
        try {
          const existingCoupon = await client.coupons.retrieve(couponName);
          couponId = existingCoupon.id;
        } catch {
          const createdCoupon = await client.coupons.create({
            id: couponName,
            name: "First Month $10 Off Special",
            amount_off: 1000,
            currency: "usd",
            duration: "once",
          });
          couponId = createdCoupon.id;
        }
        this.cachedCouponId = couponId;
      } catch (err) {
        console.warn("StripeService: Could not auto-resolve Stripe coupon:", err);
        couponId = "aletheia_first_month_10_off";
      }
    }

    return { priceId: priceId || "price_aletheia_sub_15", couponId: couponId || "aletheia_first_month_10_off" };
  }

  /**
   * Retrieves or creates a Stripe Customer linked to the user account
   */
  public async getOrCreateCustomer(user: AppUser, forceTestMode?: boolean): Promise<string | null> {
    const client = this.getClient(forceTestMode);
    if (!client) return null;

    if (user.stripe_customer_id && !user.stripe_customer_id.startsWith("mock_")) {
      return user.stripe_customer_id;
    }

    try {
      const existing = await client.customers.list({
        email: user.email,
        limit: 1,
      });

      if (existing.data.length > 0) {
        const customerId = existing.data[0].id;
        await postgresStore.updateUserSubscription(user.id, { stripeCustomerId: customerId });
        return customerId;
      }

      const newCustomer = await client.customers.create({
        email: user.email,
        name: user.name || user.email.split("@")[0],
        metadata: {
          userId: user.id,
          platform: "Project Aletheia",
          isTestMode: String(Boolean(forceTestMode || this.isTestMode)),
        },
      });

      await postgresStore.updateUserSubscription(user.id, { stripeCustomerId: newCustomer.id });
      return newCustomer.id;
    } catch (err) {
      console.warn("StripeService: Error retrieving or creating customer:", err);
      return null;
    }
  }

  /**
   * Creates a Stripe Checkout Session for $15/month subscription with $10 first-month discount.
   * Pass skipDiscount: true for reactivating lapsed subscribers (coupon already used).
   */
  public async createCheckoutSession(params: {
    user: AppUser;
    originUrl: string;
    testMode?: boolean;
    skipDiscount?: boolean;
  }): Promise<CheckoutSessionResult> {
    const { user, originUrl, testMode, skipDiscount } = params;
    const client = this.getClient(testMode);

    if (!client) {
      // Only allow mock checkout during automated unit test runs
      if (process.env.NODE_ENV === "test") {
        const mockSessionId = `mock_cs_${Date.now()}`;
        return {
          checkoutUrl: `${originUrl}?subscription=success&session_id=${mockSessionId}&mock=true${testMode ? "&test_mode=true" : ""}`,
          sessionId: mockSessionId,
          isMock: true,
        };
      }
      throw new Error(
        testMode
          ? "Stripe test mode is not configured. Please configure STRIPE_TEST_SECRET_KEY on the server."
          : "Stripe payments are not configured on this server. Please configure STRIPE_SECRET_KEY."
      );
    }

    const customerId = await this.getOrCreateCustomer(user, testMode);
    const { priceId, couponId } = await this.getOrCreatePriceAndCoupon(testMode);

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      // Only attach the discount coupon for brand-new subscribers, not reactivating lapsed ones
      discounts: (!skipDiscount && couponId) ? [{ coupon: couponId }] : undefined,
      client_reference_id: user.id,
      metadata: {
        userId: user.id,
        userEmail: user.email,
        testMode: String(Boolean(testMode)),
      },
      subscription_data: {
        metadata: {
          userId: user.id,
        },
      },
      success_url: `${originUrl}?subscription=success&session_id={CHECKOUT_SESSION_ID}${testMode ? "&test_mode=true" : ""}`,
      cancel_url: `${originUrl}?subscription=canceled`,
    };

    if (customerId) {
      sessionParams.customer = customerId;
    } else {
      sessionParams.customer_email = user.email;
    }

    const session = await client.checkout.sessions.create(sessionParams);

    return {
      checkoutUrl: session.url || `${originUrl}?subscription=success`,
      sessionId: session.id,
      isMock: false,
    };
  }

  /**
   * Processes an admin test payment using test credit card numbers.
   * Simulates full Stripe charge lifecycle and updates user quota to $3.00/mo subscriber.
   */
  public async processTestPayment(params: {
    userId: string;
    cardNumber: string;
    expDate?: string;
    cvc?: string;
  }): Promise<{
    success: boolean;
    user?: AppUser | null;
    error?: string;
    message?: string;
    customerId?: string;
    subscriptionId?: string;
  }> {
    const { userId, cardNumber, expDate, cvc } = params;
    const cleanCard = cardNumber.replace(/\s+/g, "");

    // Built-in Stripe test card responses simulation
    if (cleanCard.endsWith("0002")) {
      return {
        success: false,
        error: "Your test card was declined. (Stripe Simulator: card_declined test case)",
      };
    }
    if (cleanCard.endsWith("0115")) {
      return {
        success: false,
        error: "Your test card has expired. (Stripe Simulator: expired_card test case)",
      };
    }
    if (cleanCard.endsWith("0127")) {
      return {
        success: false,
        error: "Your test card's security code (CVC) is incorrect. (Stripe Simulator: incorrect_cvc test case)",
      };
    }

    if (cleanCard.length < 12) {
      return {
        success: false,
        error: "Invalid card format. Enter a 16-digit test card number (e.g. 4242 4242 4242 4242).",
      };
    }

    const testCustomerId = `cus_test_admin_${userId.replace(/[^a-zA-Z0-9]/g, "_")}`;
    const testSubId = `sub_test_${Date.now()}`;
    const periodEnd = new Date(Date.now() + 30 * 86400000).toISOString();

    const updatedUser = await postgresStore.updateUserSubscription(userId, {
      tier: "subscriber",
      stripeCustomerId: testCustomerId,
      stripeSubscriptionId: testSubId,
      subscriptionStatus: "active",
      subscriptionPeriodEnd: periodEnd,
    });

    // Refresh monthly period usage for the test subscriber
    const usage = await postgresStore.getUserUsage(userId);
    usage.current_period_start = new Date().toISOString();
    usage.period_cost_usd = 0;
    usage.period_tokens_used = 0;

    await postgresStore.recordUsage(userId, {
      eventName: "telemetry",
      detail: `Stripe Test Payment processed with card ending in ${cleanCard.slice(-4)}. Subscription activated at $3.00/mo quota.`,
    });

    return {
      success: true,
      user: updatedUser,
      customerId: testCustomerId,
      subscriptionId: testSubId,
    };
  }

  /**
   * Creates a Stripe Billing Portal session for active subscribers to manage billing.
   */
  public async createPortalSession(params: {
    user: AppUser;
    returnUrl: string;
  }): Promise<PortalSessionResult> {
    const { user, returnUrl } = params;
    const client = this.getClient();

    if (!client) {
      if (process.env.NODE_ENV === "test") {
        return {
          portalUrl: `${returnUrl}?portal=mock`,
          isMock: true,
        };
      }
      throw new Error("Stripe billing portal is not configured. Please set STRIPE_SECRET_KEY in server environment.");
    }

    if (!user.stripe_customer_id) {
      throw new Error("No active Stripe subscription or customer record found for this account.");
    }

    const portal = await client.billingPortal.sessions.create({
      customer: user.stripe_customer_id,
      return_url: returnUrl,
    });

    return {
      portalUrl: portal.url,
      isMock: false,
    };
  }

  /**
   * Directly synchronizes subscription status from Stripe by Checkout Session ID.
   * Useful when returning to success URL without waiting for webhooks.
   */
  public async syncSubscriptionFromSession(
    userId: string,
    sessionId: string
  ): Promise<AppUser | null> {
    if (sessionId.startsWith("mock_")) {
      if (process.env.NODE_ENV === "test") {
        // Unit test mock activation only
        return await postgresStore.updateUserSubscription(userId, {
          tier: "subscriber",
          subscriptionStatus: "active",
          subscriptionPeriodEnd: new Date(Date.now() + 30 * 86400000).toISOString(),
        });
      }
      throw new Error("Mock checkout sessions are disabled in this environment.");
    }

    const client = this.getClient();
    if (!client && !this.testStripe) {
      throw new Error("Stripe client is not configured.");
    }

    try {
      let session: Stripe.Checkout.Session | null = null;
      if (client) {
        try {
          session = await client.checkout.sessions.retrieve(sessionId, {
            expand: ["subscription"],
          });
        } catch {
          // If primary client failed to find session, fallback to testStripe if available
        }
      }

      if (!session && this.testStripe) {
        session = await this.testStripe.checkout.sessions.retrieve(sessionId, {
          expand: ["subscription"],
        });
      }

      if (!session) {
        throw new Error(`Unable to locate Stripe checkout session ${sessionId}`);
      }

      // Verify payment was actually completed or paid by customer
      if (session.status !== "complete" && session.payment_status !== "paid") {
        console.warn(`Stripe session ${sessionId} payment not verified (status: ${session.status}, payment_status: ${session.payment_status})`);
        return null;
      }

      const customerId =
        typeof session.customer === "string" ? session.customer : session.customer?.id;
      const sub = session.subscription as Stripe.Subscription | undefined;
      const subscriptionId = typeof sub === "string" ? sub : sub?.id;
      const subAny = sub as any;
      const periodEnd = subAny?.current_period_end
        ? new Date(subAny.current_period_end * 1000).toISOString()
        : new Date(Date.now() + 30 * 86400000).toISOString();

      return await postgresStore.updateUserSubscription(userId, {
        tier: "subscriber",
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
        subscriptionStatus: "active",
        subscriptionPeriodEnd: periodEnd,
      });
    } catch (err) {
      console.warn("StripeService: Error syncing session:", err);
      return null;
    }
  }

  /**
   * Handles incoming Stripe Webhook events.
   */
  public async handleWebhook(
    payload: string | Buffer,
    sig: string,
    webhookSecret?: string
  ): Promise<{ handled: boolean; eventType: string }> {
    if (!this.stripe) {
      return { handled: false, eventType: "stripe_not_configured" };
    }

    const secret = webhookSecret || process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) {
      throw new Error("StripeService: STRIPE_WEBHOOK_SECRET is not configured.");
    }

    const event = this.stripe.webhooks.constructEvent(payload, sig, secret);

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id || session.metadata?.userId;
        const customerId =
          typeof session.customer === "string" ? session.customer : session.customer?.id;
        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id;

        if (userId) {
          await postgresStore.updateUserSubscription(userId, {
            tier: "subscriber",
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
            subscriptionStatus: "active",
            subscriptionPeriodEnd: new Date(Date.now() + 30 * 86400000).toISOString(),
          });
        }
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
        const status = sub.status;
        const subAny = sub as any;
        const periodEnd = subAny?.current_period_end
          ? new Date(subAny.current_period_end * 1000).toISOString()
          : new Date(Date.now() + 30 * 86400000).toISOString();

        if (customerId) {
          const allUsers = await postgresStore.getAllUsers();
          const matchedUser = allUsers.find((u) => u.stripe_customer_id === customerId);
          if (matchedUser) {
            const isSubActive = status === "active" || status === "trialing";
            const appStatus: SubscriptionStatus =
              status === "active" ? "active" : status === "past_due" ? "past_due" : "canceled";

            await postgresStore.updateUserSubscription(matchedUser.id, {
              tier: isSubActive ? "subscriber" : "free",
              stripeSubscriptionId: sub.id,
              subscriptionStatus: appStatus,
              subscriptionPeriodEnd: periodEnd,
            });
          }
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;

        if (customerId) {
          const allUsers = await postgresStore.getAllUsers();
          const matchedUser = allUsers.find((u) => u.stripe_customer_id === customerId);
          if (matchedUser) {
            await postgresStore.updateUserSubscription(matchedUser.id, {
              tier: "free",
              subscriptionStatus: "canceled",
            });
          }
        }
        break;
      }

      case "invoice.payment_succeeded": {
        // Renewal payment succeeded - reset the monthly compute usage period
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
        if (customerId) {
          const allUsers = await postgresStore.getAllUsers();
          const matchedUser = allUsers.find((u) => u.stripe_customer_id === customerId);
          if (matchedUser) {
            const usage = await postgresStore.getUserUsage(matchedUser.id);
            usage.current_period_start = new Date().toISOString();
            usage.period_cost_usd = 0;
            usage.period_tokens_used = 0;
            await postgresStore.recordUsage(matchedUser.id, {
              eventName: "telemetry",
              detail: "Monthly subscription renewal processed. Compute allowance refreshed.",
            });
          }
        }
        break;
      }

      default:
        break;
    }

    return { handled: true, eventType: event.type };
  }
}

export const stripeService = StripeService.getInstance();
