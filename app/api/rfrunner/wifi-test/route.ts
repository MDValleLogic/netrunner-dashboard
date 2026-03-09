import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
export const dynamic = "force-dynamic";

// Look up vendor from BSSID/MAC using macvendors.com (free, no key needed)
async function ouiLookup(mac: string | null | undefined): Promise<string | null> {
  if (!mac) return null;
  try {
    const parts = mac.split(/[:-]/); const oui = parts.slice(0, 3).join(':').toUpperCase();
    const res = await fetch(`https://api.macvendors.com/${oui}`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const vendor = await res.text();
    return vendor?.trim() || null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { device_id, ts_utc, ssid, association, dhcp, ping, rf_details, security_scan } = body;

    if (!device_id)
      return NextResponse.json({ ok: false, error: "device_id required" }, { status: 400 });

    const ts = ts_utc || new Date().toISOString();

    // OUI lookup for the connected AP BSSID
    const bssid_vendor = await ouiLookup(rf_details?.bssid);

    await sql`
      INSERT INTO wifi_tests (
        device_id, ts_utc, ssid,
        assoc_success, assoc_time_ms, assoc_failure,
        dhcp_success, dhcp_time_ms, ip_assigned, gateway, dns_servers,
        ping_success, ping_latency_ms, ping_loss_pct,
        bssid, rssi_dbm, channel, band, frequency_mhz,
        bssid_vendor,
        host_count, open_ports, risk_score, findings
      ) VALUES (
        ${device_id},
        ${ts},
        ${ssid || null},
        ${association?.success ?? null},
        ${association?.auth_time_ms ?? null},
        ${association?.failure_reason ?? null},
        ${dhcp?.success ?? null},
        ${dhcp?.dhcp_time_ms ?? null},
        ${dhcp?.ip_assigned ?? null},
        ${dhcp?.gateway ?? null},
        ${dhcp?.dns_servers ?? null},
        ${ping?.success ?? null},
        ${ping?.latency_ms ?? null},
        ${ping?.packet_loss_pct ?? null},
        ${rf_details?.bssid ?? null},
        ${rf_details?.rssi_dbm ?? null},
        ${rf_details?.channel ?? null},
        ${rf_details?.band ?? null},
        ${rf_details?.frequency_mhz ?? null},
        ${bssid_vendor},
        ${security_scan?.host_count ?? null},
        ${JSON.stringify(security_scan?.open_ports_found ?? [])},
        ${security_scan?.risk_score ?? null},
        ${security_scan?.findings ?? null}
      )
    `;

    return NextResponse.json({ ok: true, device_id, ts, bssid_vendor });
  } catch (e: any) {
    console.error("[rfrunner/wifi-test]", e.message);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const device_id = searchParams.get("device_id");
    const limit = parseInt(searchParams.get("limit") || "20");

    if (!device_id)
      return NextResponse.json({ ok: false, error: "device_id required" }, { status: 400 });

    const rows = await sql`
      SELECT * FROM wifi_tests
      WHERE device_id = ${device_id}
      ORDER BY ts_utc DESC
      LIMIT ${limit}
    `;

    return NextResponse.json({ ok: true, device_id, tests: rows });
  } catch (e: any) {
    console.error("[rfrunner/wifi-test GET]", e.message);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
