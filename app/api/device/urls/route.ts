import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Returns the distinct URLs a device has actually measured in the last 24h
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const device_id = searchParams.get("device_id") || "";

  if (!device_id) {
    return NextResponse.json({ ok: false, error: "device_id is required" }, { status: 400 });
  }

  try {
    const rows = await sql`
      SELECT DISTINCT url
      FROM measurements
      WHERE device_id = ${device_id}
        AND ts_utc >= NOW() - INTERVAL '24 hours'
      ORDER BY url ASC
    `;

    const urls = (rows as any[]).map((r) => r.url).filter(Boolean);

    return NextResponse.json({ ok: true, device_id, urls });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "DB query failed", details: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}
