import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAuth } from "@/core/auth/admin-guard";
import { postgresStore } from "@/core/storage/postgres-store";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await verifyAdminAuth(req);
  if (!auth.isAuthorized) {
    return NextResponse.json(
      { success: false, error: auth.error || "Administrator privileges required." },
      { status: 401 }
    );
  }

  try {
    const userId = params.id;
    const user = await postgresStore.getUser(userId);
    if (!user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    const usage = await postgresStore.getUserUsage(userId);
    const unifiedTopicNode = await postgresStore.getUnifiedTopicNode(userId);
    const chatSession = await postgresStore.getChatSession(userId);

    return NextResponse.json({
      success: true,
      user,
      usage,
      unified_topic_node: unifiedTopicNode,
      total_messages: chatSession?.messages?.length || 0,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch user details";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await verifyAdminAuth(req);
  if (!auth.isAuthorized) {
    return NextResponse.json(
      { success: false, error: auth.error || "Administrator privileges required." },
      { status: 401 }
    );
  }

  try {
    const userId = params.id;
    const user = await postgresStore.getUser(userId);
    if (!user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    // Safety guard: prevent admin from accidentally deleting their own active account
    if (auth.userId && (user.id === auth.userId || (user.email && auth.userId.toLowerCase().includes(user.email.toLowerCase())))) {
      return NextResponse.json(
        { success: false, error: "Cannot delete your own active administrator account." },
        { status: 400 }
      );
    }

    const deleted = await postgresStore.deleteUser(user.id);
    if (!deleted) {
      return NextResponse.json({ success: false, error: "User could not be deleted" }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: `User ${user.email} (${user.id}) successfully deleted.`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to delete user";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

