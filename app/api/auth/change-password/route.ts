import { NextRequest, NextResponse } from "next/server";
export const runtime = "nodejs";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { sql } from "@/lib/db";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { currentPassword, newPassword } = await req.json();

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: "Both fields required" }, { status: 400 });
  }
  if (newPassword.length < 10) {
    return NextResponse.json({ error: "New password must be 10+ characters" }, { status: 400 });
  }

  const email    = session.user.email!;
  const tenantId = (session.user as any).tenantId;

  const rows = await sql`
    SELECT id, password_hash FROM app_users
    WHERE email = ${email} AND tenant_id = ${tenantId}
    LIMIT 1
  ` as any[];

  if (rows.length === 0) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const ok = await bcrypt.compare(currentPassword, rows[0].password_hash);
  if (!ok) return NextResponse.json({ error: "Current password is incorrect" }, { status: 403 });

  const hash = await bcrypt.hash(newPassword, 12);
  await sql`
    UPDATE app_users SET password_hash = ${hash}
    WHERE id = ${rows[0].id}
  `;

  return NextResponse.json({ ok: true });
}
