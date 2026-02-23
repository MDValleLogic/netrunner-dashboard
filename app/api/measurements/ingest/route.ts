import { sql } from "@/lib/db";

export const runtime = "nodejs";

function bad(msg: string, details?: any) {
  return Response.json({ ok: false, error: msg, details }, { status: 400 });
}

export async function POST(req: Request) {
  const deviceIdFromHeader = req.headers.get("x-device-id") || "";

  let body: any;
  try {
    body = await req.json();
  } catch {
    return bad("Invalid JSON body");
  }

  const device_id = (body?.device_id || deviceIdFromHeader || "").trim();
  const { ts_utc, url, dns_ms, http_ms, http_err } = body || {};

  if (!device_id) return bad("device_id is required (body or x-device-id header)");
  if (!ts_utc || typeof ts_utc !== "string") return bad("ts_utc is required");
  if (!url || typeof url !== "string") return bad("url is required");
  if (typeof dns_ms !== "number") return bad("dns_ms must be a number");
  if (typeof http_ms !== "number" && http_ms !== null) return bad("http_ms must be a number or null");

  const ts = new Date(ts_utc);
  if (Number.isNaN(ts.getTime())) return bad("ts_utc must be a valid ISO timestamp");

  const err = typeof http_err === "string" ? http_err : "";
  const http_ms_val = typeof http_ms === "number" ? http_ms : 0;

  try {
    const inserted = await sql`
      INSERT INTO measurements (device_id, ts_utc, url, dns_ms, http_ms, http_err)
      VALUES (${device_id}, ${ts.toISOString()}, ${url}, ${dns_ms}, ${http_ms_val}, ${err})
      RETURNING id, device_id, ts_utc, url, dns_ms, http_ms, http_err;
    `;

    return Response.json({
      ok: true,
      inserted_id: (inserted as any)[0]?.id ?? null,
      inserted: (inserted as any)[0] ?? null,
    });
  } catch (e: any) {
    return Response.json(
      { ok: false, error: "DB insert failed", details: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}
