import { sql } from "@/lib/db";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
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

    if ((result as any[]).length === 0) {
      return NextResponse.json({
        ok: true,
        version: "dc-v7",
        config: { device_id, urls: [], interval_seconds: 300, updated_at: null },
      });
    }

    const row: any = (result as any[])[0];

    return NextResponse.json({
      ok: true,
      version: "dc-v7",
      config: {
        device_id: row.device_id,
        urls: row.urls ?? [],
        interval_seconds: row.interval_seconds ?? 300,
        updated_at: row.updated_at ?? null,
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || String(e) },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);

    if (!body) {
      return NextResponse.json(
        { ok: false, error: "invalid JSON body" },
        { status: 400 }
      );
    }

    const device_id = String(body.device_id || "").trim();
    if (!device_id) {
      return NextResponse.json(
        { ok: false, error: "device_id is required" },
        { status: 400 }
      );
    }

    // FK safety: device_id must exist in devices table
    const dev = await sql`
      SELECT device_id
      FROM devices
      WHERE device_id = ${device_id}
      LIMIT 1;
    `;

    if ((dev as any[]).length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error:
            `Unknown device_id '${device_id}'. ` +
            `It must exist in the devices table before device_config can be saved.`,
        },
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

    return NextResponse.json({ ok: true, version: "dc-v7" });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || String(e) },
      { status: 500 }
    );
  }
}

