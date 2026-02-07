import NextAuth from "next-auth";
import { authOptions } from "@/lib/authOptions";

export const runtime = "nodejs";

// Force NextAuth endpoints to live at /netrunner/api/auth/* when basePath is /netrunner
const handler = NextAuth({
  ...authOptions,
  basePath: "/netrunner/api/auth",
});

export { handler as GET, handler as POST };

