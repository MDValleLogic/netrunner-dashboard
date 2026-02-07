import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

function stripBasePath(pathname: string) {
  return pathname.startsWith("/netrunner")
    ? pathname.slice("/netrunner".length) || "/"
    : pathname;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Normalize so this works whether Next gives us /login or /netrunner/login
  const p = stripBasePath(pathname);

  // Public routes (normalized)
  if (
    p === "/" ||                // /netrunner
    p === "/login" ||           // /netrunner/login
    p.startsWith("/api/auth") ||// /netrunner/api/auth
    p.startsWith("/_next")      // assets
  ) {
    return NextResponse.next();
  }

  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });

  // Protect everything else under the app
  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = "/netrunner/login";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Run middleware for the whole app mount, not just dashboard
  matcher: ["/netrunner/:path*"],
};

