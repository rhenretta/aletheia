import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/core/auth/auth-options";
import { postgresStore } from "@/core/storage/postgres-store";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const { searchParams } = new URL(req.url);
    const queryUserId = searchParams.get("userId");

    const effectiveUserId =
      session?.user?.email
        ? `usr_${session.user.email.replace(/[^a-zA-Z0-9]/g, "_")}`
        : queryUserId && queryUserId.startsWith("usr_") && queryUserId !== "usr_guest"
        ? queryUserId
        : "usr_guest";

    if (effectiveUserId === "usr_guest") {
      return NextResponse.json({
        success: true,
        tier: "free",
        limitStatus: {
          allowed: true,
          tier: "free",
          currentCost: 0,
          limit: 0.5,
          percentUsed: 0,
          isNearLimit: false,
        },
        usage: {
          user_id: "usr_guest",
          total_chat_messages: 0,
          total_pipeline_runs: 0,
          total_tokens_used: 0,
          total_dwell_time_ms: 0,
          current_period_start: new Date().toISOString(),
          period_tokens_used: 0,
          period_cost_usd: 0,
          lifetime_cost_usd: 0,
          last_active_at: new Date().toISOString(),
          recent_events: [],
        },
      });
    }

    const user = await postgresStore.getUser(effectiveUserId);
    const usage = await postgresStore.getUserUsage(effectiveUserId);
    const limitStatus = await postgresStore.checkUsageLimit(effectiveUserId);

    return NextResponse.json({
      success: true,
      user,
      tier: user?.tier || "free",
      usage,
      limitStatus,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch usage";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
