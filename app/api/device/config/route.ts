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

  const rows = await sql<{
    interval_seconds: number;
    urls: string[];
    updated_at: Date;
  }>`
    select interval_seconds, urls, updated_at
    from device_config
    where device_id = ${deviceId}
    limit 1
  `;

  if (!rows || rows.length === 0) {
    return Response.json({ configured: false });
  }

  return Response.json({
    configured: true,
    interval_seconds: rows[0].interval_seconds,
    urls: rows[0].urls,
    updated_at: rows[0].updated_at,
  });
}
