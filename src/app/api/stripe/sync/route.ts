import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/core/auth/auth-options";
import { postgresStore } from "@/core/storage/postgres-store";
import { stripeService } from "@/core/stripe/stripe-service";
import { isReadOnlyRequest, readOnlyForbiddenResponse } from "@/core/auth/read-only-guard";

export async function POST(req: NextRequest) {
  try {
    if (isReadOnlyRequest(req)) {
      return readOnlyForbiddenResponse("Subscription sync");
    }

    const session = await getServerSession(authOptions);
    const body = await req.json().catch(() => ({}));
    const { sessionId, userId } = body as { sessionId?: string; userId?: string };

    const userEmail = session?.user?.email?.toLowerCase();
    let effectiveUserId: string | null = null;
    if (userEmail) {
      const existing = await postgresStore.getUserByEmail(userEmail);
      effectiveUserId =
        existing?.id ||
        (session?.user as any)?.id ||
        `usr_${userEmail.replace(/[^a-zA-Z0-9]/g, "_")}`;
    } else if (userId && userId.startsWith("usr_") && userId !== "usr_guest") {
      effectiveUserId = userId;
    }

    if (!effectiveUserId) {
      return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
    }

    if (!sessionId) {
      return NextResponse.json({ success: false, error: "sessionId is required." }, { status: 400 });
    }

    const updatedUser = await stripeService.syncSubscriptionFromSession(effectiveUserId, sessionId);

    return NextResponse.json({
      success: true,
      user: updatedUser,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Sync failed";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
