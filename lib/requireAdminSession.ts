import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";

type AdminResult = { session: any; email: string } | NextResponse;

export async function requireAdminSession(): Promise<AdminResult> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sql = neon(process.env.DATABASE_URL!);

  const rows = await sql`
    SELECT is_admin
    FROM   app_users
    WHERE  email = ${session.user.email}
    LIMIT  1
  `;

  if (!rows[0]?.is_admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return { session, email: session.user.email };
}
