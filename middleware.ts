import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req: NextRequest) {
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });

  const { pathname } = req.nextUrl;

  // Allow public routes
  if (
    pathname === "/netrunner" ||
    pathname.startsWith("/netrunner/login") ||
    pathname.startsWith("/netrunner/api/auth") ||
    pathname.startsWith("/_next")
  ) {
    return NextResponse.next();
  }

  // Protect dashboard
  if (!token) {
    return NextResponse.redirect(new URL("/netrunner/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/netrunner/dashboard/:path*"],
};

