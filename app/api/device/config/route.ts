import { verifyDevice } from "@/lib/authDevice";
import { sql } from "@/lib/db";

export async function GET(req: Request) {
  const auth = await verifyDevice(req);
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const deviceId = auth.deviceId;

  const res = await sql`
    select interval_seconds, urls, updated_at
    from device_config
    where device_id = ${deviceId}
    limit 1
  `;

  const rows = Array.isArray(res) ? res : (res?.rows ?? []);

  if (!rows || rows.length === 0) {
    return Response.json({ configured: false });
  }

  const row = rows[0] as {
    interval_seconds: number;
    urls: string[];
    updated_at: Date;
  };

  return Response.json({
    configured: true,
    interval_seconds: row.interval_seconds,
    urls: row.urls,
    updated_at: row.updated_at,
  });
}
