import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { sql } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const tenantId = (session.user as any).tenantId;
  const { id } = await params;

  const rows = await sql`
    SELECT s.*,
      COUNT(d.device_id)::int AS device_count,
      COUNT(CASE WHEN d.last_seen > NOW() - INTERVAL '3 minutes' THEN 1 END)::int AS devices_online
    FROM sites s
    LEFT JOIN devices d ON d.site_name = s.name AND d.tenant_id = ${tenantId}::uuid
    WHERE s.id = ${id}::uuid AND s.tenant_id = ${tenantId}::uuid
    GROUP BY s.id
  ` as any[];

  if (rows.length === 0) return NextResponse.json({ error: "Site not found" }, { status: 404 });
  return NextResponse.json({ ok: true, site: rows[0] });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const tenantId = (session.user as any).tenantId;
  const { id } = await params;

  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { name, address, district, city, state, lat, lng } = body;
  const rows = await sql`
    UPDATE sites SET
      name       = COALESCE(${name ?? null},      name),
      address    = COALESCE(${address ?? null},    address),
      district   = COALESCE(${district ?? null},   district),
      city       = COALESCE(${city ?? null},        city),
      state      = COALESCE(${state ?? null},       state),
      lat        = COALESCE(${lat ?? null},         lat),
      lng        = COALESCE(${lng ?? null},         lng),
      updated_at = NOW()
    WHERE id = ${id}::uuid AND tenant_id = ${tenantId}::uuid
    RETURNING *
  ` as any[];

  if (rows.length === 0) return NextResponse.json({ error: "Site not found" }, { status: 404 });
  return NextResponse.json({ ok: true, site: rows[0] });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const tenantId = (session.user as any).tenantId;
  const { id } = await params;

  await sql`DELETE FROM sites WHERE id = ${id}::uuid AND tenant_id = ${tenantId}::uuid`;
  return NextResponse.json({ ok: true });
}
