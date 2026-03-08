import { sql } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { device_id, api_key } = body;

    // Validate device
    const devices = await sql`
      SELECT d.device_id, d.tenant_id FROM devices d
      WHERE d.device_id = ${device_id} AND d.api_key = ${api_key} AND d.claimed = true
    ` as any[];
    if (!devices.length) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const tenant_id = devices[0].tenant_id;

    // Aggregate last hour of rf_scans into rf_scans_hourly
    await sql`
      INSERT INTO rf_scans_hourly
        (device_id, tenant_id, hour_utc, ap_count, ssid_count, best_signal, avg_signal, band_24_count, band_5_count, open_count, scan_count)
      SELECT
        device_id,
        ${tenant_id}::uuid,
        date_trunc('hour', ts_utc) AS hour_utc,
        AVG(ap_count)::int         AS ap_count,
        AVG(ssid_count)::int       AS ssid_count,
        MAX(best_signal)           AS best_signal,
        AVG(avg_signal)::int       AS avg_signal,
        AVG(band_24)::int          AS band_24_count,
        AVG(band_5)::int           AS band_5_count,
        AVG(open_ct)::int          AS open_count,
        COUNT(*)::int              AS scan_count
      FROM (
        SELECT
          device_id,
          ts_utc,
          COUNT(*)                                                        AS ap_count,
          COUNT(DISTINCT ssid)                                            AS ssid_count,
          MAX(signal_dbm)                                                 AS best_signal,
          AVG(signal_dbm)::int                                            AS avg_signal,
          SUM(CASE WHEN frequency_mhz < 3000 OR channel <= 14 THEN 1 ELSE 0 END) AS band_24,
          SUM(CASE WHEN frequency_mhz >= 3000 OR channel > 14  THEN 1 ELSE 0 END) AS band_5,
          SUM(CASE WHEN LOWER(security) = 'open'               THEN 1 ELSE 0 END) AS open_ct
        FROM rf_scans
        WHERE device_id = ${device_id}
          AND ts_utc >= date_trunc('hour', now()) - interval '1 hour'
          AND ts_utc <  date_trunc('hour', now())
        GROUP BY device_id, ts_utc
      ) sub
      GROUP BY device_id, date_trunc('hour', ts_utc)
      ON CONFLICT (device_id, hour_utc) DO UPDATE SET
        ap_count      = EXCLUDED.ap_count,
        ssid_count    = EXCLUDED.ssid_count,
        best_signal   = EXCLUDED.best_signal,
        avg_signal    = EXCLUDED.avg_signal,
        band_24_count = EXCLUDED.band_24_count,
        band_5_count  = EXCLUDED.band_5_count,
        open_count    = EXCLUDED.open_count,
        scan_count    = EXCLUDED.scan_count
    `;

    // Delete rf_scans older than 48 hours
    const deleted = await sql`
      DELETE FROM rf_scans
      WHERE device_id = ${device_id}
        AND ts_utc < now() - interval '48 hours'
    ` as any;

    return NextResponse.json({ ok: true, deleted: deleted.count ?? 0 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
