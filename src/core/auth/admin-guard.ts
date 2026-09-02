import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "./auth-options";

import { postgresStore } from "../storage/postgres-store";

const ADMIN_EMAILS = new Set([
  "rhenretta@gmail.com",
  ...(process.env.ADMIN_EMAIL ? [process.env.ADMIN_EMAIL.toLowerCase()] : []),
  ...(process.env.ADMIN_EMAILS ? process.env.ADMIN_EMAILS.toLowerCase().split(",").map((e) => e.trim()) : []),
]);

export interface AdminAuthResult {
  isAuthorized: boolean;
  userId?: string;
  error?: string;
}

/**
 * Verify administrative access for sensitive production telemetry, user management & devtools endpoints
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
  let session = null;
  try {
    session = await getServerSession(authOptions);
  } catch {
    session = null;
  }
  if (session?.user?.email) {
    const email = session.user.email.toLowerCase();
    const effectiveUserId = (session.user as any).id || `usr_${email.replace(/[^a-zA-Z0-9]/g, "_")}`;
    const userRole = (session.user as any).role?.toLowerCase();

    if (userRole === "admin" || ADMIN_EMAILS.has(email)) {
      return { isAuthorized: true, userId: effectiveUserId };
    }

    // Check database directly in case session has not reloaded
    const canonicalId = `usr_${email.replace(/[^a-zA-Z0-9]/g, "_")}`;
    const dbUser =
      (await postgresStore.getUser(effectiveUserId)) ||
      (await postgresStore.getUser(canonicalId)) ||
      (await postgresStore.getUserByEmail(email));

    if (dbUser?.role === "admin") {
      return { isAuthorized: true, userId: effectiveUserId };
    }
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
