import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "./auth-options";

const ADMIN_EMAILS = new Set([
  "rhenretta@gmail.com",
  ...(process.env.ADMIN_EMAIL ? [process.env.ADMIN_EMAIL.toLowerCase()] : []),
]);

export interface AdminAuthResult {
  isAuthorized: boolean;
  userId?: string;
  error?: string;
}

/**
 * Verify administrative access for sensitive production telemetry & devtools endpoints
 */
export async function verifyAdminAuth(req: NextRequest): Promise<AdminAuthResult> {
  // 1. Check Admin API Secret Key in request headers
  const adminKey =
    req.headers.get("x-admin-key") ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  const expectedKey = process.env.ADMIN_SECRET_KEY || process.env.NEXTAUTH_SECRET;

  if (expectedKey && adminKey && adminKey.trim() === expectedKey.trim()) {
    return { isAuthorized: true, userId: "admin_api_key" };
  }

  // 2. Check Authenticated NextAuth Session
  const session = await getServerSession(authOptions);
  if (session?.user?.email && ADMIN_EMAILS.has(session.user.email.toLowerCase())) {
    const effectiveUserId = `usr_${session.user.email.replace(/[^a-zA-Z0-9]/g, "_")}`;
    return { isAuthorized: true, userId: effectiveUserId };
  }

  // 3. Allow unauthenticated inspection in non-production local environments
  if (process.env.NODE_ENV !== "production") {
    return { isAuthorized: true, userId: "dev_local" };
  }

  return {
    isAuthorized: false,
    error: "Unauthorized: Administrator privileges or valid admin key required.",
  };
}
