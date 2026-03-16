import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();

    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }

    // Find valid unused token
    const rows = await sql`
      SELECT user_id FROM email_verifications
      WHERE token      = ${token}
        AND expires_at > NOW()
        AND used       = false
      LIMIT 1
    ` as any[];

    if (!rows.length) {
      return NextResponse.json({ error: "Link is invalid or has expired" }, { status: 400 });
    }

    const userId = rows[0].user_id;

    // Mark token used + verify user in one go
    await sql`
      UPDATE email_verifications SET used = true WHERE token = ${token}
    `;
    await sql`
      UPDATE app_users SET email_verified = true WHERE id = ${userId}
    `;

    return NextResponse.json({ ok: true });

  } catch (e: any) {
    console.error("[verify-email]", e);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}
