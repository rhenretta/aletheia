import { NextRequest, NextResponse } from "next/server";
import { encode } from "next-auth/jwt";

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Dev session only available in development" }, { status: 403 });
  }

  const secret = process.env.NEXTAUTH_SECRET || "aletheia-super-secret-jwt-key-32-chars-min";
  const userEmail = req.nextUrl.searchParams.get("email") || "rhenretta@gmail.com";
  const userName = req.nextUrl.searchParams.get("name") || "RT H";

  const token = {
    name: userName,
    email: userEmail,
    picture: "https://lh3.googleusercontent.com/a/ACg8ocKij18jm2tdfHXMw5EK1ttv1UoHo_XStf-EBmZwiTnvZbLVly6YaQ=s96-c",
    sub: `usr_${userEmail.replace(/[^a-zA-Z0-9]/g, "_")}`,
    id: `usr_${userEmail.replace(/[^a-zA-Z0-9]/g, "_")}`,
    role: "admin",
  };

  const jwt = await encode({ token, secret });

  const targetUrl = new URL("/", req.nextUrl.origin);
  const response = NextResponse.redirect(targetUrl);

  response.cookies.set("next-auth.session-token", jwt, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    maxAge: 30 * 24 * 60 * 60,
  });

  return response;
}
