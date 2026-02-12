import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { verifyDevice } from "@/lib/authDevice";

function toArray<T = any>(rows: any): T[] {
  // neon/serverless sql return types can be unions; normalize to plain array
  if (!rows) return [];
  if (Array.isArray(rows)) return rows as T[];
  // Some clients return { rows: [...] }
  if (typeof rows === "object" && Array.isArray((rows as any).rows)) return (rows as any).rows as T[];
  return [];
}

export async function GET(req: Request) {
  const auth = await verifyDevice(req);
  if (!auth.ok) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const device_id = auth.deviceId;

  // Device row
  const devRows = toArray<any>(
    await sql`
      select
        device_id,
        last_seen,
        hostname,
        ip,
        mode,
        tenant_id,
        claimed,
        claim_code_sha256
      from devices
      where device_id = ${device_id}
      limit 1
    `
  );

  // Latest measurements (last N)
  const measRows = toArray<any>(
    await sql`
      select
        ts_utc,
        url,
        dns_ms,
        http_ms,
        http_err
      from measurements
      where device_id = ${device_id}
      order by ts_utc desc
      limit 50
    `
  );

  return NextResponse.json({
    ok: true,
    device_id,
    device: devRows.length ? devRows[0] : null,
    measurements: measRows,
    fetched_at_utc: new Date().toISOString(),
  });
}

