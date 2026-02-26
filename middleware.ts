import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow Next.js internals & public pages
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth")
  ) {
    return NextResponse.next();
  }

  // ✅ DEVICE PLANE — MUST BE PUBLIC (probe calls these)
  if (
    pathname.startsWith("/v1/") ||
    pathname === "/api/heartbeat" ||
    pathname === "/api/device-config" ||
    pathname === "/api/measurements/ingest" ||
    pathname.startsWith("/api/routerunner")
  ) {
    return NextResponse.next();
  }

  // UI requires auth
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next).*)"],
};
