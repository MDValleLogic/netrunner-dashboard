import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireTenantSession, AuthError } from "@/lib/requireTenantSession";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { tenantId } = await requireTenantSession();

    // All devices for this tenant
    const devices = await sql`
      SELECT device_id, nr_serial, nickname, site_name, location, address,
             lat, lng, agent_version, last_seen, last_ip, status
      FROM devices
      WHERE tenant_id = ${tenantId}
      ORDER BY site_name, nickname
    ` as any[];

    // 1hr avg DNS + HTTP per device
    const webStats = await sql`
      SELECT device_id,
             ROUND(AVG(dns_ms))  AS avg_dns_ms,
             ROUND(AVG(http_ms)) AS avg_http_ms,
             COUNT(*)            AS measurement_count
      FROM measurements
      WHERE tenant_id = ${tenantId}
        AND ts_utc > NOW() - INTERVAL '1 hour'
        AND http_err IS NULL
      GROUP BY device_id
    ` as any[];

    // Latest speed result per device
    const speedStats = await sql`
      SELECT DISTINCT ON (sr.device_id)
             sr.device_id,
             sr.download_mbps,
             sr.upload_mbps,
             sr.ping_ms,
             sr.ts_utc AS speed_ts
      FROM speed_results sr
      JOIN devices d ON d.device_id = sr.device_id
      WHERE d.tenant_id = ${tenantId}
        AND sr.error IS NULL
        AND sr.ts_utc > NOW() - INTERVAL '1 hour'
      ORDER BY sr.device_id, sr.ts_utc DESC
    ` as any[];

    // Index lookups
    const webByDevice = new Map(webStats.map((r: any) => [r.device_id, r]));
    const speedByDevice = new Map(speedStats.map((r: any) => [r.device_id, r]));

    // Build per-device summary
    const deviceSummaries = devices.map((d: any) => {
      const web = webByDevice.get(d.device_id);
      const speed = speedByDevice.get(d.device_id);
      const mins = d.last_seen
        ? (Date.now() - new Date(d.last_seen).getTime()) / 60000
        : Infinity;
      const online_status =
        d.status === "provisioned" || d.status === "unclaimed" ? "unclaimed"
        : mins < 5 ? "online"
        : mins < 30 ? "idle"
        : "offline";

      return {
        device_id:        d.device_id,
        nr_serial:        d.nr_serial,
        nickname:         d.nickname,
        location:         d.location,
        last_seen:        d.last_seen,
        last_ip:          d.last_ip,
        agent_version:    d.agent_version,
        status:           d.status,
        online_status,
        avg_dns_ms:       web ? Number(web.avg_dns_ms)  : null,
        avg_http_ms:      web ? Number(web.avg_http_ms) : null,
        measurement_count: web ? Number(web.measurement_count) : 0,
        download_mbps:    speed ? Number(speed.download_mbps) : null,
        upload_mbps:      speed ? Number(speed.upload_mbps)   : null,
        ping_ms:          speed ? Number(speed.ping_ms)        : null,
        sla_alerts:       0, // future SLA feature
      };
    });

    // Group by site
    const siteMap = new Map<string, any>();
    for (const d of deviceSummaries) {
      const key = devices.find((r: any) => r.device_id === d.device_id)?.site_name || "Unassigned";
      if (!siteMap.has(key)) {
        const dev = devices.find((r: any) => r.device_id === d.device_id);
        siteMap.set(key, {
          site_name: key,
          address:   dev?.address || null,
          lat:       dev?.lat     || null,
          lng:       dev?.lng     || null,
          devices:   [],
        });
      }
      siteMap.get(key).devices.push(d);
    }

    // Compute site-level rollups
    const sites = Array.from(siteMap.values()).map((site: any) => {
      const devs = site.devices;
      const online  = devs.filter((d: any) => d.online_status === "online").length;
      const idle    = devs.filter((d: any) => d.online_status === "idle").length;
      const offline = devs.filter((d: any) => d.online_status === "offline").length;

      const dnsVals   = devs.map((d: any) => d.avg_dns_ms).filter((v: any) => v !== null);
      const httpVals  = devs.map((d: any) => d.avg_http_ms).filter((v: any) => v !== null);
      const dlVals    = devs.map((d: any) => d.download_mbps).filter((v: any) => v !== null);
      const ulVals    = devs.map((d: any) => d.upload_mbps).filter((v: any) => v !== null);

      const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;
      const avgDl = (arr: number[]) => arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : null;

      const worst_status =
        offline > 0 ? "offline"
        : idle > 0   ? "idle"
        : online > 0 ? "online"
        : "unclaimed";

      return {
        site_name:         site.site_name,
        address:           site.address,
        lat:               site.lat,
        lng:               site.lng,
        devices_total:     devs.length,
        devices_online:    online,
        devices_idle:      idle,
        devices_offline:   offline,
        worst_status,
        avg_dns_ms:        avg(dnsVals),
        avg_http_ms:       avg(httpVals),
        avg_download_mbps: avgDl(dlVals),
        avg_upload_mbps:   avgDl(ulVals),
        sla_alerts:        0,
        devices:           devs,
      };
    });

    // Sort: offline first (needs attention), then idle, then online, then unclaimed
    const order: Record<string, number> = { offline: 0, idle: 1, online: 2, unclaimed: 3 };
    sites.sort((a: any, b: any) => order[a.worst_status] - order[b.worst_status]);

    return NextResponse.json({
      ok: true,
      tenant_id:    tenantId,
      generated_at: new Date().toISOString(),
      sites,
    });

  } catch (e: any) {
    if (e instanceof AuthError) {
      return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
    }
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
