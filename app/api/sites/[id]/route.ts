import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { sql } from "@/lib/db";

// ── GET — Get a single site ──────────────────────────────────────────────────
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenantId = (session.user as any).tenantId;
  const { id } = params;

  const rows = await sql`
    SELECT
      s.*,
      COUNT(d.device_id)::int AS device_count,
      COUNT(CASE WHEN d.last_seen > NOW() - INTERVAL '3 minutes' THEN 1 END)::int AS devices_online,
      json_agg(json_build_object(
        'device_id',  d.device_id,
        'nickname',   d.nickname,
        'last_ip',    d.last_ip,
        'building',   d.building,
        'floor',      d.floor,
        'tags',       d.tags,
        'online',     d.last_seen > NOW() - INTERVAL '3 minutes',
        'last_seen',  d.last_seen
      )) FILTER (WHERE d.device_id IS NOT NULL) AS devices
    FROM sites s
    LEFT JOIN devices d ON d.site_name = s.name AND d.tenant_id = ${tenantId}::uuid
    WHERE s.id = ${id}::uuid AND s.tenant_id = ${tenantId}::uuid
    GROUP BY s.id
  ` as any[];

  if (rows.length === 0) return NextResponse.json({ error: "Site not found" }, { status: 404 });

  return NextResponse.json({ ok: true, site: rows[0] });
}

// ── PATCH — Update a site ────────────────────────────────────────────────────
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenantId = (session.user as any).tenantId;
  const { id } = params;

  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { name, address, district, city, state, lat, lng } = body;

  const rows = await sql`
    UPDATE sites SET
      name       = COALESCE(${name ?? null},     name),
      address    = COALESCE(${address ?? null},   address),
      district   = COALESCE(${district ?? null},  district),
      city       = COALESCE(${city ?? null},       city),
      state      = COALESCE(${state ?? null},      state),
      lat        = COALESCE(${lat ?? null},        lat),
      lng        = COALESCE(${lng ?? null},        lng),
      updated_at = NOW()
    WHERE id = ${id}::uuid AND tenant_id = ${tenantId}::uuid
    RETURNING *
  ` as any[];

  if (rows.length === 0) return NextResponse.json({ error: "Site not found" }, { status: 404 });

  return NextResponse.json({ ok: true, site: rows[0] });
}

// ── DELETE — Delete a site ───────────────────────────────────────────────────
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenantId = (session.user as any).tenantId;
  const { id } = params;

  await sql`
    DELETE FROM sites
    WHERE id = ${id}::uuid AND tenant_id = ${tenantId}::uuid
  `;

  return NextResponse.json({ ok: true });
}
