import { sql } from "@/lib/db";

export const runtime = "nodejs";

type IngestBody = {
  device_id: string;
  ts_utc: string; // ISO string
  url: string;
  dns_ms: number;
  http_ms: number;
  http_err?: string;
};

function bad(msg: string, details?: any) {
  return Response.json({ ok: false, error: msg, details }, { status: 400 });
}

// Your db helper may return either { rows: [...] } OR an array directly.
// Normalize it so route logic is stable.
function getRows<T = any>(result: any): T[] {
  if (!result) return [];
  if (Array.isArray(result)) return result as T[];
  if (Array.isArray(result.rows)) return result.rows as T[];
  return [];
}

export async function POST(req: Request) {
  let body: IngestBody;

  // 1) Parse JSON
  try {
    body = (await req.json()) as IngestBody;
  } catch (e) {
    return bad("Invalid JSON body");
  }

  // 2) Basic validation
  const { device_id, ts_utc, url, dns_ms, http_ms, http_err } = body || ({} as any);

  if (!device_id || typeof device_id !== "string") return bad("device_id is required");
  if (!ts_utc || typeof ts_utc !== "string") return bad("ts_utc is required");
  if (!url || typeof url !== "string") return bad("url is required");
  if (typeof dns_ms !== "number") return bad("dns_ms must be a number");
  if (typeof http_ms !== "number") return bad("http_ms must be a number");

  // Validate ts_utc parses as a date
  const ts = new Date(ts_utc);
  if (Number.isNaN(ts.getTime())) return bad("ts_utc must be a valid ISO timestamp");

  // Normalize error field
  const err = typeof http_err === "string" ? http_err : "";

  try {
    // 3) Ensure table exists (idempotent)
    await sql`
      CREATE TABLE IF NOT EXISTS measurements (
        id BIGSERIAL PRIMARY KEY,
        device_id TEXT NOT NULL,
        ts_utc TIMESTAMPTZ NOT NULL,
        url TEXT NOT NULL,
        dns_ms DOUBLE PRECISION NOT NULL,
        http_ms DOUBLE PRECISION NOT NULL,
        http_err TEXT NOT NULL DEFAULT ''
      );
    `;

    // 4) Helpful index for /recent query
    await sql`
      CREATE INDEX IF NOT EXISTS measurements_device_ts_idx
      ON measurements (device_id, ts_utc DESC);
    `;

    // 5) Insert measurement
    const inserted = await sql`
      INSERT INTO measurements (device_id, ts_utc, url, dns_ms, http_ms, http_err)
      VALUES (${device_id}, ${ts.toISOString()}, ${url}, ${dns_ms}, ${http_ms}, ${err})
      RETURNING id, device_id, ts_utc, url, dns_ms, http_ms, http_err;
    `;

    const row = getRows(inserted)[0] ?? null;

    return Response.json({
      ok: true,
      inserted: row,
    });
  } catch (e: any) {
    // If Vercel Postgres env vars aren’t wired, this will fail here.
    return Response.json(
      { ok: false, error: "DB insert failed", details: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}

