import { sql } from "@vercel/postgres";
import { NextResponse } from "next/server";

export const runtime = "nodejs20.x";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const device_id = searchParams.get("device_id") || "";

  if (!device_id) {
    return NextResponse.json(
      { ok: false, error: "device_id is required" },
      { status: 400 }
    );
  }

  const result = await sql`
    SELECT device_id, urls, interval_seconds, updated_at
    FROM device_config
    WHERE device_id = ${device_id}
    LIMIT 1;
  `;

  if (result.rows.length === 0) {
    return NextResponse.json({
      ok: true,
      version: "dc-v6",
      config: {
        device_id,
        urls: [],
        interval_seconds: 300,
        updated_at: null,
      },
    });
  }

  const row = result.rows[0];

  return NextResponse.json({
    ok: true,
    version: "dc-v6",
    config: {
      device_id: row.device_id,
      urls: row.urls ?? [],
      interval_seconds: row.interval_seconds ?? 300,
      updated_at: row.updated_at,
    },
  });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json(
      { ok: false, error: "invalid JSON body" },
      { status: 400 }
    );
  }

  const device_id = (body.device_id || "").trim();
  if (!device_id) {
    return NextResponse.json(
      { ok: false, error: "device_id is required" },
      { status: 400 }
    );
  }

  const urls = Array.isArray(body.urls)
    ? body.urls.map((u: any) => String(u).trim()).filter(Boolean)
    : [];

  const interval_seconds =
    Number.isFinite(body.interval_seconds) && body.interval_seconds > 0
      ? Math.floor(body.interval_seconds)
      : 300;

  await sql`
    INSERT INTO device_config (device_id, urls, interval_seconds, updated_at)
    VALUES (${device_id}, ${urls}::text[], ${interval_seconds}, NOW())
    ON CONFLICT (device_id)
    DO UPDATE SET
      urls = EXCLUDED.urls,
      interval_seconds = EXCLUDED.interval_seconds,
      updated_at = NOW();
  `;

  return NextResponse.json({ ok: true, version: "dc-v6" });
}
