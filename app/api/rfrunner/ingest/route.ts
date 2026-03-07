import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { device_id, api_key, networks } = body;

    if (!device_id || !Array.isArray(networks) || networks.length === 0)
      return NextResponse.json({ ok: false, error: "device_id and networks required" }, { status: 400 });

    const ts = new Date().toISOString();

    for (const n of networks) {
      const { bssid, ssid, signal_dbm, channel, frequency_mhz, band, security } = n;
      if (!bssid) continue;
      await sql`
        INSERT INTO rf_scans (device_id, ts_utc, bssid, ssid, signal_dbm, channel, frequency_mhz, band, security)
        VALUES (${device_id}, ${ts}, ${bssid}, ${ssid||null}, ${signal_dbm||null}, ${channel||null}, ${frequency_mhz||null}, ${band||null}, ${security||null})
      `;
    }

    return NextResponse.json({ ok: true, device_id, count: networks.length });
  } catch (e: any) {
    console.error("[rfrunner/ingest]", e.message);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
