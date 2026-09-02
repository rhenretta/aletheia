import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/core/auth/auth-options";
import { postgresStore } from "@/core/storage/postgres-store";
import { stripeService } from "@/core/stripe/stripe-service";
import { isReadOnlyRequest, readOnlyForbiddenResponse } from "@/core/auth/read-only-guard";

export async function POST(req: NextRequest) {
  try {
    if (isReadOnlyRequest(req)) {
      return readOnlyForbiddenResponse("Billing portal access");
    }

    const session = await getServerSession(authOptions);
    const body = await req.json().catch(() => ({}));
    const { userId, isTestMode } = body as { userId?: string; isTestMode?: boolean };

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
          error: "Authentication required to access billing portal.",
        },
        { status: 401 }
      );
    }

    const user = await postgresStore.getUser(effectiveUserId);
    if (!user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    const origin = req.headers.get("origin") || process.env.NEXTAUTH_URL || "http://localhost:3000";
    const result = await stripeService.createPortalSession({
      user,
      returnUrl: origin,
      isTestMode: Boolean(isTestMode),
    });

    return NextResponse.json({
      success: true,
      portalUrl: result.portalUrl,
      isMock: result.isMock,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create portal session";
    console.error("Stripe Portal Error:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
