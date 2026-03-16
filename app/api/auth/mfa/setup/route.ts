import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { authenticator } from "otplib/preset/default";
import QRCode from "qrcode";
import { getToken } from "next-auth/jwt";

authenticator.options = { window: 1 };

export async function GET(req: NextRequest) {
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const secret = authenticator.generateSecret(20);
    const otpauthUrl = authenticator.keyuri(token.email as string, "ValleLogic", secret);
    const qrDataUrl = await QRCode.toDataURL(otpauthUrl, {
      width: 240,
      margin: 1,
      color: { dark: "#e2e8f0", light: "#0d1421" },
    });

    await sql`
      UPDATE app_users SET mfa_secret = ${secret} WHERE id = ${token.sub as string}
    `;

    return NextResponse.json({ secret, otpauthUrl, qrDataUrl });

  } catch (e: any) {
    console.error("[mfa/setup]", e);
    return NextResponse.json({ error: "MFA setup failed" }, { status: 500 });
  }
}
