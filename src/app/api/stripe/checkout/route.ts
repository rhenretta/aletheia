import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/core/auth/auth-options";
import { postgresStore } from "@/core/storage/postgres-store";
import { stripeService } from "@/core/stripe/stripe-service";
import { isReadOnlyRequest, readOnlyForbiddenResponse } from "@/core/auth/read-only-guard";

export async function POST(req: NextRequest) {
  try {
    if (isReadOnlyRequest(req)) {
      return readOnlyForbiddenResponse("Subscription checkout");
    }

    const session = await getServerSession(authOptions);
    const body = await req.json().catch(() => ({}));
    const { userId, testMode, skipDiscount } = body as { userId?: string; testMode?: boolean; skipDiscount?: boolean };

    // Must have an authenticated session to subscribe
    if (!session?.user?.email) {
      return NextResponse.json(
        {
          success: false,
          error: "Authentication required. Please sign in with Google to subscribe.",
        },
        { status: 401 }
      );
    }

    const userEmail = session.user.email.toLowerCase();
    const existing = await postgresStore.getUserByEmail(userEmail);
    const effectiveUserId =
      existing?.id ||
      (session.user as any)?.id ||
      `usr_${userEmail.replace(/[^a-zA-Z0-9]/g, "_")}`;

    // Get or create the user record — never hard-fail if the row isn't in the DB yet
    const user = await postgresStore.getOrCreateUser({
      id: effectiveUserId,
      email: userEmail,
      name: session.user.name || userEmail.split("@")[0],
      image: session.user.image || undefined,
    });

    const origin = req.headers.get("origin") || process.env.NEXTAUTH_URL || "http://localhost:3000";
    const result = await stripeService.createCheckoutSession({
      user,
      originUrl: origin,
      testMode: Boolean(testMode),
      skipDiscount: Boolean(skipDiscount),
    });

    return NextResponse.json({
      success: true,
      checkoutUrl: result.checkoutUrl,
      sessionId: result.sessionId,
      isMock: result.isMock,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create checkout session";
    console.error("Stripe Checkout Error:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

