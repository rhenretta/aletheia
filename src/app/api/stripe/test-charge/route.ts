import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
 import { authOptions } from "@/core/auth/auth-options";
 import { postgresStore } from "@/core/storage/postgres-store";
 import { stripeService } from "@/core/stripe/stripe-service";
 import { isReadOnlyRequest, readOnlyForbiddenResponse } from "@/core/auth/read-only-guard";

export async function POST(req: NextRequest) {
  try {
    if (isReadOnlyRequest(req)) {
      return readOnlyForbiddenResponse("Stripe test payment");
    }

    const session = await getServerSession(authOptions);
    const body = await req.json().catch(() => ({}));
    const { cardNumber, expDate, cvc, userId } = body as {
      cardNumber?: string;
      expDate?: string;
      cvc?: string;
      userId?: string;
    };

    const effectiveUserId =
      session?.user?.email
        ? `usr_${session.user.email.replace(/[^a-zA-Z0-9]/g, "_")}`
        : userId && userId.startsWith("usr_") && userId !== "usr_guest"
        ? userId
        : null;

    if (!effectiveUserId) {
      return NextResponse.json(
        { success: false, error: "Authentication required to run test card payment." },
        { status: 401 }
      );
    }

    const user = await postgresStore.getUser(effectiveUserId);
    if (!user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    // Verify admin role or dev environment
    const isAdmin =
      user.role === "admin" ||
      (session?.user as any)?.role === "admin" ||
      process.env.NODE_ENV !== "production";

    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: "Test Credit Card Mode requires Administrator privileges." },
        { status: 403 }
      );
    }

    if (!cardNumber) {
      return NextResponse.json(
        { success: false, error: "Card number is required for test payment." },
        { status: 400 }
      );
    }

    const result = await stripeService.processTestPayment({
      userId: effectiveUserId,
      cardNumber,
      expDate,
      cvc,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || "Test payment failed" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      user: result.user,
      message: "Test payment successful! Subscription activated at $3.00/mo compute cap.",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to process test charge";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
