import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getToken } from "next-auth/jwt";

export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { device_id, nickname, site_name, location, address } = await req.json();
  if (!device_id) return NextResponse.json({ error: "device_id required" }, { status: 400 });

  await sql`
    UPDATE devices SET
      nickname   = ${nickname || null},
      site_name  = ${site_name || null},
      location   = ${location || null},
      address    = ${address || null},
      updated_at = NOW()
    WHERE device_id = ${device_id}
      AND tenant_id = ${token.tenantId as string}
  `;

  return NextResponse.json({ ok: true });
}
