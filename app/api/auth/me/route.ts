import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { sql } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const rows = await sql`
      SELECT mfa_enabled FROM app_users WHERE id = ${token.sub as string} LIMIT 1
    ` as any[];

    if (!rows.length) return NextResponse.json({ error: "User not found" }, { status: 404 });

    return NextResponse.json({ mfa_enabled: rows[0].mfa_enabled });

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
