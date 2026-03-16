import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import speakeasy from "speakeasy";
import { getToken } from "next-auth/jwt";
import { sendWelcomeEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { code } = await req.json();
    if (!code || !/^\d{6}$/.test(code.trim())) {
      return NextResponse.json({ error: "Enter the 6-digit code from your authenticator app" }, { status: 400 });
    }

    const rows = await sql`
      SELECT mfa_secret, name, tenant_id FROM app_users
      WHERE id = ${token.sub as string} LIMIT 1
    ` as any[];

    if (!rows.length) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const { mfa_secret, tenant_id } = rows[0];
    if (!mfa_secret) return NextResponse.json({ error: "MFA setup not started" }, { status: 400 });

    const isValid = speakeasy.totp.verify({
      secret: mfa_secret,
      encoding: "base32",
      token: code.trim(),
      window: 1,
    });

    if (!isValid) return NextResponse.json({ error: "Incorrect code — try again" }, { status: 400 });

    await sql`UPDATE app_users SET mfa_enabled = true WHERE id = ${token.sub as string}`;

    const tenantRows = await sql`SELECT name FROM tenants WHERE id = ${tenant_id} LIMIT 1` as any[];
    const tenantName = tenantRows[0]?.name ?? "your organization";

    sendWelcomeEmail(token.email as string, tenantName).catch((e) =>
      console.error("[mfa/verify] welcome email failed:", e)
    );

    return NextResponse.json({ ok: true });

  } catch (e: any) {
    console.error("[mfa/verify]", e);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}
