import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
export const dynamic = "force-dynamic";

async function ouiLookup(mac: string | null | undefined): Promise<string | null> {
  if (!mac) return null;
  try {
    const params = new URLSearchParams({
      key: process.env.FINGERBANK_API_KEY || "",
      mac,
    });
    const res = await fetch(
      `https://api.fingerbank.org/api/v2/combinations/interrogate?${params}`,
      { signal: AbortSignal.timeout(4000) }
    );
    if (!res.ok) return null;
    const json = await res.json();
    return json?.device?.name || null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { device_id, networks } = body;

    if (!device_id || !Array.isArray(networks) || networks.length === 0)
      return NextResponse.json({ ok: false, error: "device_id and networks required" }, { status: 400 });

    const ts = new Date().toISOString();

    // Deduplicate OUI lookups — many BSSIDs share the same vendor prefix
    const uniqueOuis = new Set(
      networks
        .filter(n => n.bssid)
        .map(n => (n.bssid as string).split(/[:-]/).slice(0, 3).join(':').toUpperCase())
    );

    const vendorMap = new Map<string, string | null>();
    await Promise.all(
      Array.from(uniqueOuis).map(async oui => {
        const vendor = await ouiLookup(oui);
        vendorMap.set(oui, vendor);
      })
    );

    for (const n of networks) {
      const { bssid, ssid, signal_dbm, channel, frequency_mhz, band, security } = n;
      if (!bssid) continue;
      const parts2 = bssid.split(/[:-]/); const oui = parts2.slice(0, 3).join(':').toUpperCase();
      const bssid_vendor = vendorMap.get(oui) ?? null;
      await sql`
        INSERT INTO rf_scans (device_id, ts_utc, bssid, ssid, signal_dbm, channel, frequency_mhz, band, security, bssid_vendor)
        VALUES (${device_id}, ${ts}, ${bssid}, ${ssid||null}, ${signal_dbm||null}, ${channel||null}, ${frequency_mhz||null}, ${band||null}, ${security||null}, ${bssid_vendor})
      `;
    }

    return NextResponse.json({ ok: true, device_id, count: networks.length });
  } catch (e: any) {
    console.error("[rfrunner/ingest]", e.message);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
