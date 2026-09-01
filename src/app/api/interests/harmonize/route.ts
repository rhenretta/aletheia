import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/core/auth/auth-options";
import { postgresStore } from "@/core/storage/postgres-store";
import { InterestHarmonizer } from "@/core/agents/observer/interest-harmonizer";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const body = await req.json().catch(() => ({}));
    const { userId } = body as { userId?: string };

    const effectiveUserId =
      session?.user?.email
        ? `usr_${session.user.email.replace(/[^a-zA-Z0-9]/g, "_")}`
        : userId && userId.startsWith("usr_") && userId !== "usr_guest"
        ? userId
        : null;

    if (!effectiveUserId) {
      return NextResponse.json(
        { success: false, error: "Authentication required to harmonize interests." },
        { status: 401 }
      );
    }

    const unifiedNode = await postgresStore.getUnifiedTopicNode(effectiveUserId);
    const result = await InterestHarmonizer.harmonize(unifiedNode, "manual_user");

    // Always persist updated node to preserve the HarmonizationRun audit log
    await postgresStore.saveUnifiedTopicNode(result.harmonized_node);

    const userGraph = await postgresStore.getUserGraph(effectiveUserId);

    return NextResponse.json({
      success: true,
      changed: result.changed,
      actions_taken: result.actions_taken,
      harmonization_run: result.harmonization_run,
      unified_topic_node: result.harmonized_node,
      user_graph: userGraph,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Harmonization failed";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
