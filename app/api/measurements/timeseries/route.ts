ø
import { sql } from "@vercel/postgres";

export const runtime = "nodejs";

function bad(msg: string, details?: any) {
  return Response.json({ ok: false, error: msg, details }, { status: 400 });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const device_id = searchParams.get("device_id") || "";
  const since_minutes_str = searchParams.get("since_minutes") || "60";

  // allow repeated urls=... OR urls comma-separated
  const urls_multi = searchParams.getAll("urls");
  const urls_csv = (searchParams.get("urls") || "").split(",").map(s => s.trim()).filter(Boolean);
  const urls = Array.from(new Set([...urls_multi, ...urls_csv])).filter(Boolean);

  const since_minutes = Number(since_minutes_str);

  if (!device_id) return bad("device_id is required");
  if (!Number.isFinite(since_minutes) || since_minutes <= 0 || since_minutes > 10080) {
    return bad("since_minutes must be a number between 1 and 10080");
  }
  if (urls.length === 0) return bad("Provide at least one urls parameter (repeat urls=...)");
  if (urls.length > 5) return bad("Max 5 urls (MVP limit)");

  try {
    // Pull raw points for the selected urls in time window
    const rows = await sql`
      SELECT device_id, ts_utc, url, dns_ms, http_ms, http_err
      FROM measurements
      WHERE device_id = ${device_id}
        AND url = ANY(${urls})
        AND ts_utc >= NOW() - (${since_minutes}::int * INTERVAL '1 minute')
      ORDER BY ts_utc ASC;
    `;

    // Group by url for the frontend
    const series: Record<string, any[]> = {};
    for (const u of urls) series[u] = [];

    for (const r of rows.rows) {
      series[r.url] = series[r.url] || [];
      series[r.url].push({
        ts_utc: r.ts_utc,
        dns_ms: r.dns_ms,
        http_ms: r.http_ms,
        http_err: r.http_err,
      });
    }

    return Response.json({
      ok: true,
      device_id,
      since_minutes,
      urls,
      points: rows.rowCount ?? rows.rows.length,
      series,
    });
  } catch (e: any) {
    return Response.json(
      { ok: false, error: "DB query failed", details: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}
