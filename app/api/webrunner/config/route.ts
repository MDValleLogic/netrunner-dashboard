import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeUrls(urls: string[]) {
  const out: string[] = [];
  for (const raw of urls) {
    const s = (raw || "").trim();
    if (!s) continue;
    try {
      const u = new URL(s);
      out.push(u.toString());
    } catch {
      // ignore invalid urls
    }
  }
  return Array.from(new Set(out));
}

export async function GET(req: Request) {
  // Human admin: require authenticated session
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const device_id = searchParams.get("device_id") || "pi-001";

  const rows = await sql`
    SELECT device_id, urls, interval_seconds, updated_at
    FROM device_config
    WHERE device_id = ${device_id}
    LIMIT 1
  `;

  const row = rows?.[0] ?? null;

  return NextResponse.json({
    ok: true,
    device_id,
    config: row
      ? {
          device_id: row.device_id,
          urls: row.urls ?? [],
          interval_seconds: row.interval_seconds ?? 300,
          updated_at: row.updated_at,
        }
      : { device_id, urls: [], interval_seconds: 300, updated_at: null },
  });
}

export async function POST(req: Request) {
  // Human admin: require authenticated session
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const device_id = (body.device_id || "pi-001").toString();
  const urls = normalizeUrls(Array.isArray(body.urls) ? body.urls : []);
  const interval_seconds = Math.max(5, parseInt(body.interval_seconds || "300", 10) || 300);

  if (urls.length === 0) {
    return NextResponse.json({ ok: false, error: "no_valid_urls" }, { status: 400 });
  }

  // Upsert: update if exists, else insert
  await sql`
    INSERT INTO device_config (device_id, urls, interval_seconds, updated_at)
    VALUES (${device_id}, ${urls}::text[], ${interval_seconds}, NOW())
    ON CONFLICT (device_id)
    DO UPDATE SET
      urls = EXCLUDED.urls,
      interval_seconds = EXCLUDED.interval_seconds,
      updated_at = NOW()
  `;

  const rows = await sql`
    SELECT device_id, urls, interval_seconds, updated_at
    FROM device_config
    WHERE device_id = ${device_id}
    LIMIT 1
  `;

  const row = rows?.[0] ?? null;

  return NextResponse.json({
    ok: true,
    device_id,
    config: row
      ? {
          device_id: row.device_id,
          urls: row.urls ?? [],
          interval_seconds: row.interval_seconds ?? interval_seconds,
          updated_at: row.updated_at,
        }
      : { device_id, urls, interval_seconds, updated_at: null },
  });
}

