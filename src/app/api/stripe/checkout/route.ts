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

    const effectiveUserId =
      session?.user?.email
        ? `usr_${session.user.email.replace(/[^a-zA-Z0-9]/g, "_")}`
        : userId && userId.startsWith("usr_") && userId !== "usr_guest"
        ? userId
        : null;

    if (!effectiveUserId) {
      return NextResponse.json(
        {
          success: false,
          error: "Authentication required. Please sign in with Google to subscribe.",
        },
        { status: 401 }
      );
    }

    const user = await postgresStore.getUser(effectiveUserId);
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: "User record not found. Please sign in again.",
        },
        { status: 404 }
      );
    }

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
