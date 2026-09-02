import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAuth } from "@/core/auth/admin-guard";
import { postgresStore } from "@/core/storage/postgres-store";
import { UserRole, UserTier, UserAccountStatus } from "@/core/types/contracts";

export async function GET(req: NextRequest) {
  const auth = await verifyAdminAuth(req);
  if (!auth.isAuthorized) {
    return NextResponse.json(
      { success: false, error: auth.error || "Administrator privileges required." },
      { status: 401 }
    );
  }

  try {
    const users = await postgresStore.getAllUsers();
    const allUsage = await postgresStore.getAllUserUsage();

    const enrichedUsers = users.map((u) => {
      const usage = allUsage[u.id] || {
        user_id: u.id,
        total_chat_messages: 0,
        total_pipeline_runs: 0,
        total_tokens_used: 0,
        total_dwell_time_ms: 0,
        last_active_at: u.last_active_at,
        recent_events: [],
      };
      return {
        ...u,
        usage,
      };
    });

    return NextResponse.json({
      success: true,
      users: enrichedUsers,
      total_count: enrichedUsers.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch users";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await verifyAdminAuth(req);
  if (!auth.isAuthorized) {
    return NextResponse.json(
      { success: false, error: auth.error || "Administrator privileges required." },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const { userId, role, tier } = body as {
      userId?: string;
      role?: UserRole;
      tier?: UserTier;
    };

    if (!userId) {
      return NextResponse.json({ success: false, error: "userId is required" }, { status: 400 });
    }

    if (role && role !== "user" && role !== "admin") {
      return NextResponse.json({ success: false, error: "Invalid role specified" }, { status: 400 });
    }

    if (tier && tier !== "free" && tier !== "subscriber") {
      return NextResponse.json({ success: false, error: "Invalid tier specified" }, { status: 400 });
    }

    let updatedUser = await postgresStore.getUser(userId);
    if (!updatedUser) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    if (role) {
      updatedUser = await postgresStore.updateUserRole(userId, role);
    }

    if (tier) {
      updatedUser = await postgresStore.updateUserTier(userId, tier);
    }

    const usage = await postgresStore.getUserUsage(userId);

    return NextResponse.json({
      success: true,
      user: {
        ...updatedUser,
        usage,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update user";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
