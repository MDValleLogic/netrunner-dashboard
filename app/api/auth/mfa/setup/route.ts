import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import speakeasy from "speakeasy";
import QRCode from "qrcode";
import { getToken } from "next-auth/jwt";

export async function GET(req: NextRequest) {
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const secret = speakeasy.generateSecret({ name: `ValleLogic (${token.email})`, length: 20 });

    const qrDataUrl = await QRCode.toDataURL(secret.otpauth_url!, {
      width: 240,
      margin: 1,
      color: { dark: "#e2e8f0", light: "#0d1421" },
    });

    await sql`
      UPDATE app_users SET mfa_secret = ${secret.base32} WHERE id = ${token.sub as string}
    `;

    return NextResponse.json({ secret: secret.base32, otpauthUrl: secret.otpauth_url, qrDataUrl });

  } catch (e: any) {
    console.error("[mfa/setup]", e);
    return NextResponse.json({ error: "MFA setup failed" }, { status: 500 });
  }
}
