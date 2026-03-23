import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const deviceKey = req.headers.get("x-device-key");
  const deviceId  = req.headers.get("x-device-id");

  if (!deviceKey || !deviceId) {
    return NextResponse.json({ error: "Missing device credentials" }, { status: 401 });
  }

  const sql = neon(process.env.DATABASE_URL!);

  const devices = await sql`
    SELECT device_id, tenant_id
    FROM   devices
    WHERE  device_id       = ${deviceId}
      AND  device_key_hash = encode(sha256(${deviceKey}::bytea), 'hex')
    LIMIT  1
  `;

  if (!devices[0]) {
    return NextResponse.json({ error: "Invalid device credentials" }, { status: 403 });
  }

  const { device_id, tenant_id } = devices[0];

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { scans, ts_utc } = body;

  if (!Array.isArray(scans) || scans.length === 0) {
    return NextResponse.json({ ok: true, inserted: 0 });
  }

  const ts = ts_utc ?? new Date().toISOString();
  let inserted = 0;

  for (const scan of scans) {
    try {
      await sql`
        INSERT INTO bt_scans
          (device_id, tenant_id, ts_utc, mac, name, rssi, manufacturer, service_uuids, adv_data, tx_power)
        VALUES
          (${device_id}, ${tenant_id}, ${ts}::timestamptz,
           ${scan.mac}, ${scan.name ?? null}, ${scan.rssi ?? null},
           ${scan.manufacturer ?? null},
           ${scan.service_uuids?.length ? scan.service_uuids : null},
           ${scan.adv_data ? JSON.stringify(scan.adv_data) : null},
           ${scan.tx_power ?? null})
      `;
      inserted++;
    } catch (err) {
      console.error(`bt_scans insert error for mac ${scan.mac}:`, err);
    }
  }

  try {
    await sql`
      INSERT INTO bt_scans_hourly
        (device_id, tenant_id, hour_utc, unique_devices, avg_rssi, new_devices, returning_devices)
      SELECT
        ${device_id},
        ${tenant_id}::uuid,
        date_trunc('hour', ${ts}::timestamptz),
        COUNT(DISTINCT mac),
        AVG(rssi),
        COUNT(DISTINCT mac) FILTER (
          WHERE mac NOT IN (
            SELECT DISTINCT mac FROM bt_scans
            WHERE device_id = ${device_id}
              AND ts_utc < date_trunc('hour', ${ts}::timestamptz)
          )
        ),
        COUNT(DISTINCT mac) FILTER (
          WHERE mac IN (
            SELECT DISTINCT mac FROM bt_scans
            WHERE device_id = ${device_id}
              AND ts_utc < date_trunc('hour', ${ts}::timestamptz)
          )
        )
      FROM bt_scans
      WHERE device_id = ${device_id}
        AND ts_utc >= date_trunc('hour', ${ts}::timestamptz)
        AND ts_utc <  date_trunc('hour', ${ts}::timestamptz) + INTERVAL '1 hour'
      ON CONFLICT (device_id, hour_utc)
      DO UPDATE SET
        unique_devices    = EXCLUDED.unique_devices,
        avg_rssi          = EXCLUDED.avg_rssi,
        new_devices       = EXCLUDED.new_devices,
        returning_devices = EXCLUDED.returning_devices
    `;
  } catch (err) {
    console.error("bt_scans_hourly upsert error:", err);
  }

  return NextResponse.json({ ok: true, inserted });
}
