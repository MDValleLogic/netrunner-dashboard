import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/api/auth")
  ) {
    return NextResponse.next();
  }

  if (
    pathname.startsWith("/v1/") ||
    pathname === "/api/heartbeat" ||
    pathname.startsWith("/api/devices/heartbeat") ||
    pathname === "/api/device-config" ||
    pathname === "/api/measurements/ingest" ||
    pathname.startsWith("/api/routerunner") ||
    pathname.startsWith("/api/speedrunner") ||
    pathname.startsWith("/api/devices") ||
    pathname.startsWith("/api/rfrunner") ||
    pathname.startsWith("/api/webrunner") ||
    pathname.startsWith("/api/blerunner") ||
    pathname.startsWith("/api/commandrunner") ||
    pathname.startsWith("/api/mcp")
  ) {
    return NextResponse.next();
  }

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
