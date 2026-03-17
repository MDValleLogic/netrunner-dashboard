import { sql } from "@/lib/db";

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export const MCP_TOOLS: MCPTool[] = [
  {
    name: "list_devices",
    description: "List all NetRunner devices registered to this tenant. Returns device ID, nickname, IP address, online/offline status, last seen timestamp, and agent version.",
    inputSchema: {
      type: "object",
      properties: {
        status_filter: { type: "string", enum: ["all", "online", "offline"], description: "Filter by device status. Defaults to 'all'." },
      },
    },
  },
  {
    name: "get_device_status",
    description: "Get the current status of a specific NetRunner device: online/offline, last seen time, agent version, IP address, nickname, and uptime.",
    inputSchema: {
      type: "object",
      properties: {
        device_id: { type: "string", description: "The device ID (e.g. nr-5cc812f0)." },
      },
      required: ["device_id"],
    },
  },
  {
    name: "get_rf_history",
    description: "Get WiFi RF scan history for a device. Returns AP counts, signal strength trends, and band distribution (2.4GHz vs 5GHz) over time.",
    inputSchema: {
      type: "object",
      properties: {
        device_id: { type: "string", description: "The device ID." },
        hours: { type: "number", description: "How many hours of history to return. Defaults to 24. Max 168 (7 days)." },
      },
      required: ["device_id"],
    },
  },
  {
    name: "get_speed_results",
    description: "Get internet speed test results for a device. Returns download/upload speeds (Mbps) and ping (ms) over time.",
    inputSchema: {
      type: "object",
      properties: {
        device_id: { type: "string", description: "The device ID." },
        hours: { type: "number", description: "Hours of history. Defaults to 24. Max 168." },
        include_summary: { type: "boolean", description: "Include min/max/avg summary statistics. Defaults to true." },
      },
      required: ["device_id"],
    },
  },
  {
    name: "get_route_trace",
    description: "Get traceroute results showing the network path from the device to the internet. Includes each hop's IP, hostname, RTT, and ISP.",
    inputSchema: {
      type: "object",
      properties: {
        device_id: { type: "string", description: "The device ID." },
        limit: { type: "number", description: "Number of most recent traces to return. Defaults to 5." },
      },
      required: ["device_id"],
    },
  },
  {
    name: "get_webrunner_data",
    description: "Get web performance monitoring data for a device. Returns HTTP response times, DNS lookup latency, and error rates per monitored URL.",
    inputSchema: {
      type: "object",
      properties: {
        device_id: { type: "string", description: "The device ID." },
        hours: { type: "number", description: "Hours of history. Defaults to 24. Max 168." },
        url_filter: { type: "string", description: "Optional: filter results to a specific monitored URL." },
      },
      required: ["device_id"],
    },
  },
  {
    name: "get_measurements_timeseries",
    description: "Get time-bucketed network performance measurements for a device. Aggregates speed, latency, and RF data into consistent time buckets for trend analysis.",
    inputSchema: {
      type: "object",
      properties: {
        device_id: { type: "string", description: "The device ID." },
        hours: { type: "number", description: "Hours of history. Defaults to 24. Max 168." },
        bucket_minutes: { type: "number", description: "Bucket size in minutes. Defaults to 60." },
      },
      required: ["device_id"],
    },
  },
];

// ---------------------------------------------------------------------------
// Tool Dispatcher
// ---------------------------------------------------------------------------

export async function dispatchTool(
  toolName: string,
  args: Record<string, unknown>,
  tenantId: string
): Promise<unknown> {
  switch (toolName) {
    case "list_devices":
      return listDevices(tenantId, args.status_filter as string | undefined);
    case "get_device_status":
      return getDeviceStatus(args.device_id as string, tenantId);
    case "get_rf_history":
      return getRFHistory(args.device_id as string, tenantId, (args.hours as number) ?? 24);
    case "get_speed_results":
      return getSpeedResults(args.device_id as string, tenantId, (args.hours as number) ?? 24, (args.include_summary as boolean) ?? true);
    case "get_route_trace":
      return getRouteTrace(args.device_id as string, tenantId, (args.limit as number) ?? 5);
    case "get_webrunner_data":
      return getWebrunnerData(args.device_id as string, tenantId, (args.hours as number) ?? 24, args.url_filter as string | undefined);
    case "get_measurements_timeseries":
      return getMeasurementsTimeseries(args.device_id as string, tenantId, (args.hours as number) ?? 24, (args.bucket_minutes as number) ?? 60);
    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

// ---------------------------------------------------------------------------
// Tool Implementations
// ---------------------------------------------------------------------------

async function listDevices(tenantId: string, statusFilter?: string) {
  let rows: any[];
  if (statusFilter === "online") {
    rows = await sql`
      SELECT device_id, nickname, last_ip, agent_version, last_seen, claimed_at, 'online' AS status
      FROM devices
      WHERE tenant_id = ${tenantId} AND last_seen > NOW() - INTERVAL '3 minutes'
      ORDER BY last_seen DESC NULLS LAST
    ` as any[];
  } else if (statusFilter === "offline") {
    rows = await sql`
      SELECT device_id, nickname, last_ip, agent_version, last_seen, claimed_at, 'offline' AS status
      FROM devices
      WHERE tenant_id = ${tenantId} AND (last_seen IS NULL OR last_seen <= NOW() - INTERVAL '3 minutes')
      ORDER BY last_seen DESC NULLS LAST
    ` as any[];
  } else {
    rows = await sql`
      SELECT device_id, nickname, last_ip, agent_version, last_seen, claimed_at,
        CASE WHEN last_seen > NOW() - INTERVAL '3 minutes' THEN 'online' ELSE 'offline' END AS status
      FROM devices
      WHERE tenant_id = ${tenantId}
      ORDER BY last_seen DESC NULLS LAST
    ` as any[];
  }
  return { device_count: rows.length, devices: rows };
}

async function getDeviceStatus(deviceId: string, tenantId: string) {
  const rows = await sql`
    SELECT device_id, nickname, last_ip, agent_version, last_seen, status,
      claimed_at, provisioned_at, image_version,
      CASE WHEN last_seen > NOW() - INTERVAL '3 minutes' THEN 'online' ELSE 'offline' END AS current_status,
      EXTRACT(EPOCH FROM (NOW() - last_seen))::int AS seconds_since_seen
    FROM devices
    WHERE device_id = ${deviceId} AND tenant_id = ${tenantId}
  ` as any[];
  if (rows.length === 0) return { error: `Device ${deviceId} not found or does not belong to this tenant.` };
  return rows[0];
}

async function getRFHistory(deviceId: string, tenantId: string, hours: number) {
  const clampedHours = Math.min(hours, 168);
  if (!(await verifyDeviceTenant(deviceId, tenantId))) return { error: `Device ${deviceId} not found.` };

  const history = await sql`
    SELECT
      hour_utc AS hour,
      ap_count,
      ssid_count,
      best_signal,
      avg_signal,
      band_24_count,
      band_5_count,
      scan_count
    FROM rf_scans_hourly
    WHERE device_id = ${deviceId}
      AND hour_utc > NOW() - (${clampedHours} || ' hours')::interval
    ORDER BY hour_utc DESC
  ` as any[];

  const latest = await sql`
    SELECT bssid, ssid, signal_dbm, channel, band, frequency_mhz, ts_utc
    FROM rf_scans
    WHERE device_id = ${deviceId}
    ORDER BY ts_utc DESC
    LIMIT 10
  ` as any[];

  return {
    device_id: deviceId,
    hours_requested: clampedHours,
    recent_aps: latest,
    hourly_history: history,
  };
}

async function getSpeedResults(deviceId: string, tenantId: string, hours: number, includeSummary: boolean) {
  const clampedHours = Math.min(hours, 168);
  if (!(await verifyDeviceTenant(deviceId, tenantId))) return { error: `Device ${deviceId} not found.` };

  const rows = await sql`
    SELECT ts_utc, download_mbps, upload_mbps, ping_ms, jitter_ms,
           server_name, server_city, server_country, isp, engine
    FROM speed_results
    WHERE device_id = ${deviceId}
      AND ts_utc > NOW() - (${clampedHours} || ' hours')::interval
      AND error IS NULL
    ORDER BY ts_utc DESC
  ` as any[];

  const response: Record<string, unknown> = {
    device_id: deviceId,
    hours_requested: clampedHours,
    test_count: rows.length,
    results: rows,
  };

  if (includeSummary && rows.length > 0) {
    const downloads = rows.map((r: any) => r.download_mbps).filter(Boolean);
    const uploads = rows.map((r: any) => r.upload_mbps).filter(Boolean);
    const pings = rows.map((r: any) => r.ping_ms).filter(Boolean);
    if (downloads.length > 0) {
      response.summary = {
        download_mbps: { min: Math.min(...downloads).toFixed(1), max: Math.max(...downloads).toFixed(1), avg: (downloads.reduce((a: number, b: number) => a + b, 0) / downloads.length).toFixed(1) },
        upload_mbps: { min: Math.min(...uploads).toFixed(1), max: Math.max(...uploads).toFixed(1), avg: (uploads.reduce((a: number, b: number) => a + b, 0) / uploads.length).toFixed(1) },
        ping_ms: { min: Math.min(...pings).toFixed(1), max: Math.max(...pings).toFixed(1), avg: (pings.reduce((a: number, b: number) => a + b, 0) / pings.length).toFixed(1) },
      };
    }
  }
  return response;
}

async function getRouteTrace(deviceId: string, tenantId: string, limit: number) {
  if (!(await verifyDeviceTenant(deviceId, tenantId))) return { error: `Device ${deviceId} not found.` };

  const traces = await sql`
    SELECT id, ts_utc, target, dest_ip, hop_count, total_hops
    FROM route_traces
    WHERE device_id = ${deviceId}
    ORDER BY ts_utc DESC
    LIMIT ${Math.min(limit, 20)}
  ` as any[];

  if (traces.length === 0) return { device_id: deviceId, traces: [] };

  const traceIds = traces.map((r: any) => r.id);
  const hops = await sql`
    SELECT trace_id, hop_num, ip, hostname, rtt_ms, isp, org, city, country, timeout
    FROM route_hops
    WHERE trace_id = ANY(${traceIds})
    ORDER BY trace_id, hop_num
  ` as any[];

  const hopsByTrace: Record<string, unknown[]> = {};
  for (const hop of hops) {
    if (!hopsByTrace[hop.trace_id]) hopsByTrace[hop.trace_id] = [];
    hopsByTrace[hop.trace_id].push({
      hop: hop.hop_num, ip: hop.ip, hostname: hop.hostname,
      rtt_ms: hop.rtt_ms, isp: hop.isp, org: hop.org,
      city: hop.city, country: hop.country, timeout: hop.timeout,
    });
  }

  return {
    device_id: deviceId,
    trace_count: traces.length,
    traces: traces.map((t: any) => ({
      traced_at: t.ts_utc, target: t.target, dest_ip: t.dest_ip,
      hop_count: t.hop_count, total_hops: t.total_hops,
      hops: hopsByTrace[t.id] ?? [],
    })),
  };
}

async function getWebrunnerData(deviceId: string, tenantId: string, hours: number, urlFilter?: string) {
  const clampedHours = Math.min(hours, 168);
  if (!(await verifyDeviceTenant(deviceId, tenantId))) return { error: `Device ${deviceId} not found.` };

  const rows = urlFilter
    ? await sql`
        SELECT url, DATE_TRUNC('hour', ts_utc) AS hour,
          COUNT(*)::int AS check_count,
          AVG(http_ms)::int AS avg_http_ms,
          MIN(http_ms)::int AS min_http_ms,
          MAX(http_ms)::int AS max_http_ms,
          AVG(dns_ms)::int AS avg_dns_ms,
          SUM(CASE WHEN http_err IS NOT NULL THEN 1 ELSE 0 END)::int AS error_count,
          ROUND(100.0 * SUM(CASE WHEN http_err IS NULL THEN 1 ELSE 0 END) / COUNT(*), 1) AS uptime_pct
        FROM measurements
        WHERE device_id = ${deviceId}
          AND ts_utc > NOW() - (${clampedHours} || ' hours')::interval
          AND url = ${urlFilter}
        GROUP BY url, DATE_TRUNC('hour', ts_utc)
        ORDER BY url, hour DESC
      ` as any[]
    : await sql`
        SELECT url, DATE_TRUNC('hour', ts_utc) AS hour,
          COUNT(*)::int AS check_count,
          AVG(http_ms)::int AS avg_http_ms,
          MIN(http_ms)::int AS min_http_ms,
          MAX(http_ms)::int AS max_http_ms,
          AVG(dns_ms)::int AS avg_dns_ms,
          SUM(CASE WHEN http_err IS NOT NULL THEN 1 ELSE 0 END)::int AS error_count,
          ROUND(100.0 * SUM(CASE WHEN http_err IS NULL THEN 1 ELSE 0 END) / COUNT(*), 1) AS uptime_pct
        FROM measurements
        WHERE device_id = ${deviceId}
          AND ts_utc > NOW() - (${clampedHours} || ' hours')::interval
        GROUP BY url, DATE_TRUNC('hour', ts_utc)
        ORDER BY url, hour DESC
      ` as any[];

  const byUrl: Record<string, unknown[]> = {};
  for (const row of rows) {
    if (!byUrl[row.url]) byUrl[row.url] = [];
    byUrl[row.url].push({ hour: row.hour, checks: row.check_count, avg_http_ms: row.avg_http_ms, min_http_ms: row.min_http_ms, max_http_ms: row.max_http_ms, avg_dns_ms: row.avg_dns_ms, errors: row.error_count, uptime_pct: row.uptime_pct });
  }
  return { device_id: deviceId, hours_requested: clampedHours, monitored_urls: Object.keys(byUrl).length, data: byUrl };
}

async function getMeasurementsTimeseries(deviceId: string, tenantId: string, hours: number, bucketMinutes: number) {
  const clampedHours = Math.min(hours, 168);
  const clampedBucket = Math.max(5, Math.min(bucketMinutes, 1440));
  if (!(await verifyDeviceTenant(deviceId, tenantId))) return { error: `Device ${deviceId} not found.` };

  const rows = await sql`
    SELECT
      DATE_TRUNC('minute', ts_utc) -
        (EXTRACT(MINUTE FROM ts_utc)::int % ${clampedBucket} * INTERVAL '1 minute') AS bucket,
      AVG(http_ms)::numeric(8,2) AS avg_http_ms,
      AVG(dns_ms)::numeric(8,2) AS avg_dns_ms,
      COUNT(*)::int AS sample_count,
      SUM(CASE WHEN http_err IS NOT NULL THEN 1 ELSE 0 END)::int AS error_count
    FROM measurements
    WHERE device_id = ${deviceId}
      AND ts_utc > NOW() - (${clampedHours} || ' hours')::interval
    GROUP BY bucket
    ORDER BY bucket DESC
  ` as any[];

  return { device_id: deviceId, hours_requested: clampedHours, bucket_minutes: clampedBucket, data_points: rows.length, timeseries: rows };
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

async function verifyDeviceTenant(deviceId: string, tenantId: string): Promise<boolean> {
  const rows = await sql`
    SELECT 1 FROM devices WHERE device_id = ${deviceId} AND tenant_id = ${tenantId} LIMIT 1
  ` as any[];
  return rows.length > 0;
}
