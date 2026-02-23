import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AnyRow = Record<string, any>;

function toArray<T = AnyRow>(q: unknown): T[] {
  if (!q) return [];
  if (Array.isArray(q)) return q as T[];
  if (typeof q === "object" && q !== null && "rows" in q) {
    const rows = (q as { rows?: unknown }).rows;
    if (Array.isArray(rows)) return rows as T[];
  }
  return [];
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const device_id = (searchParams.get("device_id") || "").trim();

    if (!device_id) {
      return NextResponse.json(
        { ok: false, error: "device_id_required" },
        { status: 400 }
      );
    }

    // Expected schema:
    // device_id (pk)
    // urls (json/jsonb)
    // interval_seconds (int)
    // updated_at (timestamp)
    const q = await sql`
      select
        device_id,
        urls,
        interval_seconds,
        updated_at
      from device_config
      where device_id = ${device_id}
      limit 1
    `;

    const rows = toArray<{
      device_id: string;
      urls: any;
      interval_seconds: number | null;
      updated_at: string | null;
    }>(q);

    // Safe defaults
    const defaults = {
      urls: ["https://www.google.com/generate_204"],
      interval_seconds: 300,
    };

    if (!rows.length) {
      return NextResponse.json({
        ok: true,
        device_id,
        config: defaults,
        source: "default",
        fetched_at_utc: new Date().toISOString(),
      });
    }

    const r = rows[0];

    // Normalize URLs
    let urls: string[] = defaults.urls;

    try {
      const raw = r.urls;
      const parsed =
        typeof raw === "string" ? JSON.parse(raw) : raw;

      if (Array.isArray(parsed)) {
        urls = parsed.map(String).filter(Boolean);
      }
    } catch {
      // fall back to defaults
    }

    const config = {
      urls,
      interval_seconds: Number.isFinite(Number(r.interval_seconds))
        ? Number(r.interval_seconds)
        : defaults.interval_seconds,
    };

    return NextResponse.json({
      ok: true,
      device_id,
      config,
      updated_at: r.updated_at,
      source: "device_config",
      fetched_at_utc: new Date().toISOString(),
    });
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        error: "server_error",
        message: String(e?.message || e),
      },
      { status: 500 }
    );
  }
}
