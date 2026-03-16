import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { sendVerificationEmail } from "@/lib/email";

function generateSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 32);
}

export async function POST(req: NextRequest) {
  try {
    const { email, password, name, orgName } = await req.json();

    if (!email || !password || !name || !orgName) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 });
    }

    const emailLower = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLower)) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    const existing = await sql`
      SELECT id FROM app_users WHERE email = ${emailLower} LIMIT 1
    `;
    if ((existing as any[]).length > 0) {
      return NextResponse.json({ ok: true });
    }

    let slug = generateSlug(orgName);
    const slugExists = await sql`
      SELECT id FROM tenants WHERE slug = ${slug} LIMIT 1
    `;
    if ((slugExists as any[]).length > 0) {
      slug = slug + crypto.randomBytes(3).toString("hex");
    }

    const tenantRows = await sql`
      INSERT INTO tenants (name, slug)
      VALUES (${orgName.trim()}, ${slug})
      RETURNING id
    ` as any[];
    const tenantId = tenantRows[0].id;

    const passwordHash = await bcrypt.hash(password, 12);
    const userRows = await sql`
      INSERT INTO app_users (email, name, password_hash, tenant_id, email_verified)
      VALUES (${emailLower}, ${name.trim()}, ${passwordHash}, ${tenantId}, false)
      RETURNING id
    ` as any[];
    const userId = userRows[0].id;

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await sql`
      INSERT INTO email_verifications (user_id, token, expires_at)
      VALUES (${userId}, ${token}, ${expiresAt})
    `;

    await sendVerificationEmail(emailLower, token);

    return NextResponse.json({ ok: true });

  } catch (e: any) {
    console.error("[register]", e);
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
