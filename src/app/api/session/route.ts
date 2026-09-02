import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/core/auth/auth-options";
import { postgresStore } from "@/core/storage/postgres-store";
import { DataPersistenceStore } from "@/core/storage/persistence";
import { verifyAdminAuth } from "@/core/auth/admin-guard";

import { isReadOnlyRequest, readOnlyForbiddenResponse } from "@/core/auth/read-only-guard";

export async function GET(req: NextRequest) {
  let session = null;
  try {
    session = await getServerSession(authOptions);
  } catch {
    session = null;
  }
  const queryUserId = req.nextUrl.searchParams.get("userId");
  const viewAsUserId = req.nextUrl.searchParams.get("viewAs") || req.headers.get("x-view-as-user");

  let effectiveUserId: string | null = null;
  let isViewingAsOther = false;

  // Handle "View site as another user" (Impersonation in read-only mode)
  if (viewAsUserId) {
    const adminCheck = await verifyAdminAuth(req);
    if (!adminCheck.isAuthorized) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized: Administrator privileges required to view site as another user.",
        },
        { status: 403 }
      );
    }

    // Resolve target user by ID, email, or canonical prefix
    const targetUser =
      (await postgresStore.getUser(viewAsUserId)) ||
      (await postgresStore.getUserByEmail(viewAsUserId)) ||
      (viewAsUserId.startsWith("usr_")
        ? undefined
        : await postgresStore.getUser(`usr_${viewAsUserId.replace(/[^a-zA-Z0-9]/g, "_")}`));

    effectiveUserId =
      targetUser?.id ||
      (viewAsUserId.startsWith("usr_")
        ? viewAsUserId
        : `usr_${viewAsUserId.replace(/[^a-zA-Z0-9]/g, "_")}`);
    isViewingAsOther = true;
  }

  if (!effectiveUserId) {
    if (session?.user?.email) {
      effectiveUserId = `usr_${session.user.email.replace(/[^a-zA-Z0-9]/g, "_")}`;
    } else if (queryUserId && queryUserId.startsWith("usr_") && queryUserId !== "usr_guest") {
      effectiveUserId = queryUserId;
    }
  }

  if (!effectiveUserId) {
    // Unauthenticated Guest: Return clean baseline topic node and empty conversation
    const guestNode = DataPersistenceStore.createDefaultUnifiedTopicNode("usr_guest");
    const facts = await postgresStore.getAllFacts();

    return NextResponse.json({
      success: true,
      user_id: "usr_guest",
      is_authenticated: false,
      is_viewing_as: false,
      user: null,
      unified_topic_node: guestNode,
      user_graph: {
        user_id: "usr_guest",
        topic_weights: {},
        cognitive_load_state: "balanced",
        historical_anchors: [],
        dwell_history: [],
        last_updated: new Date().toISOString(),
      },
      messages: [],
      extracted_topics: [],
      facts_cached: facts,
    });
  }

  const unifiedTopicNode = await postgresStore.getUnifiedTopicNode(effectiveUserId);
  const chatSession = await postgresStore.getChatSession(effectiveUserId);
  const userGraph = await postgresStore.getUserGraph(effectiveUserId);
  const facts = await postgresStore.getAllFacts();
  const dbUser =
    (await postgresStore.getUser(effectiveUserId)) ||
    (effectiveUserId.includes("@") ? await postgresStore.getUserByEmail(effectiveUserId) : undefined);
  const usage = await postgresStore.getUserUsage(effectiveUserId);

  return NextResponse.json({
    success: true,
    user_id: effectiveUserId,
    is_authenticated: true,
    is_viewing_as: isViewingAsOther,
    user: dbUser
      ? {
          name: dbUser.name,
          email: dbUser.email,
          image: dbUser.image,
          role: dbUser.role,
          id: dbUser.id,
        }
      : isViewingAsOther
      ? {
          name: effectiveUserId.replace(/^usr_/, "").replace(/_/g, " "),
          email: effectiveUserId.includes("@") ? effectiveUserId : undefined,
          role: "user",
          id: effectiveUserId,
        }
      : session?.user || null,
    usage: usage || null,
    unified_topic_node: unifiedTopicNode || null,
    user_graph: userGraph || null,
    messages: chatSession?.messages || [],
    extracted_topics: chatSession?.extracted_topics || [],
    facts_cached: facts,
  });
}

export async function DELETE(req: NextRequest) {
  if (isReadOnlyRequest(req)) {
    return readOnlyForbiddenResponse("Clearing profile and mind-state memory");
  }

  const session = await getServerSession(authOptions);
  const queryUserId = req.nextUrl.searchParams.get("userId");

  const isAuthenticated = !!session?.user?.email;
  const effectiveUserId = isAuthenticated
    ? `usr_${session!.user!.email!.replace(/[^a-zA-Z0-9]/g, "_")}`
    : queryUserId && queryUserId.startsWith("usr_")
    ? queryUserId
    : "usr_guest";

  // Wipe user's persistent mind-state memory, chat session, and graph
  await postgresStore.clearSession(effectiveUserId);

  const cleanNode = DataPersistenceStore.createDefaultUnifiedTopicNode(effectiveUserId);
  const cleanGraph = {
    user_id: effectiveUserId,
    topic_weights: {},
    cognitive_load_state: "balanced" as const,
    historical_anchors: [],
    dwell_history: [],
    last_updated: new Date().toISOString(),
  };

  return NextResponse.json({
    success: true,
    message: "Profile and mind-state memory cleared successfully.",
    user_id: effectiveUserId,
    unified_topic_node: cleanNode,
    user_graph: cleanGraph,
    messages: [],
    extracted_topics: [],
  });
}
