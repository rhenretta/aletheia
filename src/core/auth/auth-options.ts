import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

import { postgresStore } from "../storage/postgres-store";

function getAdminEmails(): string[] {
  const envEmails = (process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || "").toLowerCase();
  const list = envEmails
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (!list.includes("rhenretta@gmail.com")) {
    list.push("rhenretta@gmail.com");
  }
  return list;
}

function getCookieDomain(): string | undefined {
  const customDomain = process.env.COOKIE_DOMAIN;
  if (customDomain) {
    return customDomain.startsWith(".") ? customDomain : `.${customDomain}`;
  }
  const nextAuthUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "";
  try {
    if (nextAuthUrl && !nextAuthUrl.includes("localhost") && !nextAuthUrl.includes("127.0.0.1")) {
      const parsed = new URL(nextAuthUrl);
      const hostname = parsed.hostname;
      const parts = hostname.split(".");
      if (parts.length >= 2) {
        // e.g. news.ciclops.io or ciclops.io -> .ciclops.io
        const rootDomain = parts.slice(-2).join(".");
        return `.${rootDomain}`;
      }
      return `.${hostname}`;
    }
  } catch {
    // fallback
  }
  return undefined;
}

const cookieDomain = process.env.NODE_ENV === "production" ? getCookieDomain() : undefined;

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || process.env.AUTH_GOOGLE_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || process.env.AUTH_GOOGLE_SECRET || "",
      authorization: {
        params: {
          prompt: "select_account",
          access_type: "offline",
          response_type: "code",
        },
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  /**
   * Share __Secure- cookies across apex and subdomains (.ciclops.io)
   * so authentication works seamlessly between ciclops.io and news.ciclops.io
   */
  cookies:
    process.env.NODE_ENV === "production"
      ? {
          sessionToken: {
            name: "__Secure-next-auth.session-token",
            options: { httpOnly: true, sameSite: "lax", path: "/", secure: true, domain: cookieDomain },
          },
          callbackUrl: {
            name: "__Secure-next-auth.callback-url",
            options: { httpOnly: true, sameSite: "lax", path: "/", secure: true, domain: cookieDomain },
          },
          csrfToken: {
            name: "__Host-next-auth.csrf-token",
            options: { httpOnly: true, sameSite: "lax", path: "/", secure: true },
          },
          pkceCodeVerifier: {
            name: "__Secure-next-auth.pkce.code_verifier",
            options: { httpOnly: true, sameSite: "lax", path: "/", secure: true, maxAge: 60 * 15, domain: cookieDomain },
          },
          state: {
            name: "__Secure-next-auth.state",
            options: { httpOnly: true, sameSite: "lax", path: "/", secure: true, maxAge: 60 * 15, domain: cookieDomain },
          },
          nonce: {
            name: "__Secure-next-auth.nonce",
            options: { httpOnly: true, sameSite: "lax", path: "/", secure: true, domain: cookieDomain },
          },
        }
      : undefined,
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id || `usr_${user.email?.replace(/[^a-zA-Z0-9]/g, "_") || "anon"}`;
        token.name = user.name;
        token.email = user.email;
        token.picture = user.image;
      }

      const userEmail = (token.email || user?.email || "").toLowerCase();
      if (userEmail) {
        try {
          const adminEmails = getAdminEmails();
          const isAdminByEnv = adminEmails.includes(userEmail);
          const initialRole = isAdminByEnv ? "admin" : "user";

          const appUser = await postgresStore.getOrCreateUser({
            id: (token.id as string) || `usr_${userEmail.replace(/[^a-zA-Z0-9]/g, "_")}`,
            email: userEmail,
            name: (token.name as string) || user?.name || undefined,
            image: (token.picture as string) || user?.image || undefined,
            role: initialRole,
          });

          // If env explicitly marks as admin, uphold admin role
          if (isAdminByEnv && appUser.role !== "admin") {
            await postgresStore.updateUserRole(appUser.id, "admin");
            appUser.role = "admin";
          }

          token.role = appUser.role;

          if (user) {
            await postgresStore.recordUsage(appUser.id, {
              eventName: "login",
              detail: "User session authenticated",
            });
          }
        } catch (err) {
          console.warn("authOptions: Error syncing user with store:", err);
          const adminEmails = getAdminEmails();
          token.role = adminEmails.includes(userEmail) ? "admin" : "user";
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        const customUser = session.user as {
          name?: string | null;
          email?: string | null;
          image?: string | null;
          id?: string;
          role?: string;
        };
        if (token.id) {
          customUser.id = token.id as string;
        }
        customUser.role = (token.role as string) || "user";
      }
      return session;
    },
  },
  pages: {
    signIn: "/",
  },
  secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || "aletheia-dev-secret-key-32chars-minimum-safe",
};
