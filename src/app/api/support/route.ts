import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/core/auth/auth-options";
import { postgresStore } from "@/core/storage/postgres-store";
import { SupportService } from "@/lib/support-service";
import { SupportCategory, SupportTicketPayload } from "@/core/types/contracts";
import { verifyAdminAuth } from "@/core/auth/admin-guard";

const VALID_CATEGORIES: SupportCategory[] = [
  "bug_report",
  "feature_request",
  "ai_feed_synthesis",
  "account_billing",
  "general_inquiry",
];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as SupportTicketPayload;

    const name = (body.name || "").trim();
    const email = (body.email || "").trim().toLowerCase();
    const category = body.category && VALID_CATEGORIES.includes(body.category)
      ? body.category
      : "general_inquiry";
    const subject = (body.subject || "").trim();
    const message = (body.message || "").trim();

    // Field validation
    if (!email || !EMAIL_REGEX.test(email)) {
      return NextResponse.json(
        { success: false, error: "A valid email address is required so we can reply to you." },
        { status: 400 }
      );
    }

    if (!subject || subject.length < 3) {
      return NextResponse.json(
        { success: false, error: "Please provide a subject line (minimum 3 characters)." },
        { status: 400 }
      );
    }

    if (!message || message.length < 10) {
      return NextResponse.json(
        { success: false, error: "Please describe your issue or feedback in more detail (minimum 10 characters)." },
        { status: 400 }
      );
    }

    // Extract authenticated session if present
    let session = null;
    try {
      session = await getServerSession(authOptions);
    } catch {
      session = null;
    }

    const sessionUserId = session?.user?.email
      ? `usr_${session.user.email.replace(/[^a-zA-Z0-9]/g, "_")}`
      : null;

    // Merge diagnostic metadata
    const userAgent = req.headers.get("user-agent") || undefined;
    const clientIp = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || undefined;

    const metadata = {
      ...(body.metadata || {}),
      userId: sessionUserId || body.metadata?.userId || undefined,
      userEmail: session?.user?.email || body.metadata?.userEmail || email,
      userAgent: userAgent || body.metadata?.userAgent,
      clientIp: process.env.NODE_ENV === "development" ? "127.0.0.1" : clientIp,
      submittedAt: new Date().toISOString(),
    };

    // 1. Persist ticket in storage
    const ticket = await postgresStore.saveSupportTicket({
      user_id: sessionUserId,
      name: name || (session?.user?.name as string) || email.split("@")[0],
      email,
      category,
      subject,
      message,
      metadata,
      status: "open",
    });

    // 2. Dispatch email notification via Amazon SES (and SNS if configured)
    let deliveryStatus = { success: true, messageId: undefined as string | undefined };
    try {
      const sendResult = await SupportService.sendSupportTicket(ticket);
      deliveryStatus = {
        success: sendResult.success,
        messageId: sendResult.messageId,
      };
    } catch (err: any) {
      console.error("API /api/support: Error delivering ticket email via SES:", err);
      // We do not fail the request if the ticket was saved to DB, but report status
    }

    return NextResponse.json(
      {
        success: true,
        ticketId: ticket.id,
        category: ticket.category,
        message: "Your support request has been received. We'll be in touch shortly!",
        delivery: deliveryStatus,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("API /api/support error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "An unexpected error occurred while submitting your ticket. Please try again.",
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  // Admin-only inspection endpoint
  const adminCheck = await verifyAdminAuth(req);
  if (!adminCheck.isAuthorized) {
    return NextResponse.json(
      { success: false, error: "Unauthorized: Admin privileges required to view support tickets." },
      { status: 403 }
    );
  }

  const limitParam = req.nextUrl.searchParams.get("limit");
  const limit = limitParam ? parseInt(limitParam, 10) : 50;

  try {
    const tickets = await postgresStore.getSupportTickets(isNaN(limit) ? 50 : limit);
    return NextResponse.json({ success: true, tickets });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
