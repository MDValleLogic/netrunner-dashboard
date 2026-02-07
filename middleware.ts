import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Public routes
  if (
    pathname === "/" ||
    pathname === "/login" ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next")
  ) {
    return NextResponse.next();
  }

  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });

  // Protect dashboard + apps
  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next|favicon.ico).*)"],
};

