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
    description:
      "List all NetRunner devices registered to this tenant. Returns device ID, hostname, IP address, online/offline status, last seen timestamp, and agent version.",
    inputSchema: {
      type: "object",
      properties: {
        status_filter: {
          type: "string",
          enum: ["all", "online", "offline"],
          description: "Filter by device status. Defaults to 'all'.",
        },
      },
    },
  },
  {
    name: "get_device_status",
    description:
      "Get the current status of a specific NetRunner device: online/offline, last seen time, agent version, IP address, hostname, and uptime.",
    inputSchema: {
      type: "object",
      properties: {
        device_id: {
          type: "string",
          description: "The device ID (e.g. nr-2ae6-5c7f).",
        },
      },
      required: ["device_id"],
    },
  },
  {
    name: "get_rf_history",
    description:
      "Get WiFi RF scan history for a device. Returns AP counts, signal strength trends, band distribution (2.4GHz vs 5GHz vs 6GHz), and channel congestion over time.",
    inputSchema: {
      type: "object",
      properties: {
        device_id: { type: "string", description: "The device ID." },
        hours: {
          type: "number",
          description: "How many hours of history to return. Defaults to 24. Max 168 (7 days).",
        },
      },
      required: ["device_id"],
    },
  },
  {
    name: "get_speed_results",
    description:
      "Get internet speed test results for a device. Returns download/upload speeds (Mbps) and ping (ms) over time.",
    inputSchema: {
      type: "object",
      properties: {
        device_id: { type: "string", description: "The device ID." },
        hours: { type: "number", description: "Hours of history. Defaults to 24. Max 168." },
        include_summary: {
          type: "boolean",
          description: "Include min/max/avg summary statistics. Defaults to true.",
        },
      },
      required: ["device_id"],
    },
  },
  {
    name: "get_route_trace",
    description:
      "Get traceroute results showing the network path from the device to the internet. Includes each hop's IP, hostname, RTT, and ISP identification.",
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
    description:
      "Get web performance monitoring data for a device. Returns HTTP response times, DNS lookup latency, and error rates per monitored URL.",
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
    description:
      "Get time-bucketed network performance measurements for a device. Aggregates speed, latency, and RF data into consistent time buckets for trend analysis.",
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
      SELECT device_id, hostname, ip_address, agent_version, last_seen, claimed_at,
        'online' AS status
      FROM devices
      WHERE tenant_id = ${tenantId}
        AND last_seen > NOW() - INTERVAL '3 minutes'
      ORDER BY last_seen DESC NULLS LAST
    ` as any[];
  } else if (statusFilter === "offline") {
    rows = await sql`
      SELECT device_id, hostname, ip_address, agent_version, last_seen, claimed_at,
        'offline' AS status
      FROM devices
      WHERE tenant_id = ${tenantId}
        AND (last_seen IS NULL OR last_seen <= NOW() - INTERVAL '3 minutes')
      ORDER BY last_seen DESC NULLS LAST
    ` as any[];
  } else {
    rows = await sql`
      SELECT device_id, hostname, ip_address, agent_version, last_seen, claimed_at,
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
    SELECT device_id, hostname, ip_address, agent_version, last_seen, uptime_seconds,
      status, claimed_at, registered_at,
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
      DATE_TRUNC('hour', scanned_at) AS hour,
      COUNT(*)::int AS scan_count,
      AVG(ap_count)::int AS avg_ap_count,
      MAX(ap_count)::int AS max_ap_count,
      AVG(avg_signal)::numeric(5,1) AS avg_signal_dbm,
      SUM(band_2ghz_count)::int AS band_2ghz_aps,
      SUM(band_5ghz_count)::int AS band_5ghz_aps,
      SUM(band_6ghz_count)::int AS band_6ghz_aps
    FROM rf_scans_hourly
    WHERE device_id = ${deviceId}
      AND scanned_at > NOW() - (${clampedHours} || ' hours')::interval
    GROUP BY DATE_TRUNC('hour', scanned_at)
    ORDER BY hour DESC
  ` as any[];

  const latest = await sql`
    SELECT ap_count, avg_signal, band_2ghz_count, band_5ghz_count, band_6ghz_count, scanned_at
    FROM rf_scans
    WHERE device_id = ${deviceId}
    ORDER BY scanned_at DESC
    LIMIT 1
  ` as any[];

  return { device_id: deviceId, hours_requested: clampedHours, current_snapshot: latest[0] ?? null, hourly_history: history };
}

async function getSpeedResults(deviceId: string, tenantId: string, hours: number, includeSummary: boolean) {
  const clampedHours = Math.min(hours, 168);
  if (!(await verifyDeviceTenant(deviceId, tenantId))) return { error: `Device ${deviceId} not found.` };

  const rows = await sql`
    SELECT tested_at, download_mbps, upload_mbps, ping_ms, jitter_ms, server_name, server_location
    FROM speed_results
    WHERE device_id = ${deviceId}
      AND tested_at > NOW() - (${clampedHours} || ' hours')::interval
    ORDER BY tested_at DESC
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
    response.summary = {
      download_mbps: { min: Math.min(...downloads).toFixed(1), max: Math.max(...downloads).toFixed(1), avg: (downloads.reduce((a: number, b: number) => a + b, 0) / downloads.length).toFixed(1) },
      upload_mbps: { min: Math.min(...uploads).toFixed(1), max: Math.max(...uploads).toFixed(1), avg: (uploads.reduce((a: number, b: number) => a + b, 0) / uploads.length).toFixed(1) },
      ping_ms: { min: Math.min(...pings).toFixed(1), max: Math.max(...pings).toFixed(1), avg: (pings.reduce((a: number, b: number) => a + b, 0) / pings.length).toFixed(1) },
    };
  }

  return response;
}

async function getRouteTrace(deviceId: string, tenantId: string, limit: number) {
  if (!(await verifyDeviceTenant(deviceId, tenantId))) return { error: `Device ${deviceId} not found.` };

  const traces = await sql`
    SELECT id, traced_at, target_host, hop_count, total_rtt_ms
    FROM route_results
    WHERE device_id = ${deviceId}
    ORDER BY traced_at DESC
    LIMIT ${Math.min(limit, 20)}
  ` as any[];

  if (traces.length === 0) return { device_id: deviceId, traces: [] };

  const traceIds = traces.map((r: any) => r.id);
  const hops = await sql`
    SELECT trace_id, hop_number, ip_address, hostname, rtt_ms, isp_name, is_private
    FROM route_hops
    WHERE trace_id = ANY(${traceIds})
    ORDER BY trace_id, hop_number
  ` as any[];

  const hopsByTrace: Record<string, unknown[]> = {};
  for (const hop of hops) {
    if (!hopsByTrace[hop.trace_id]) hopsByTrace[hop.trace_id] = [];
    hopsByTrace[hop.trace_id].push({ hop: hop.hop_number, ip: hop.ip_address, hostname: hop.hostname, rtt_ms: hop.rtt_ms, isp: hop.isp_name, is_private: hop.is_private });
  }

  return {
    device_id: deviceId,
    trace_count: traces.length,
    traces: traces.map((t: any) => ({ traced_at: t.traced_at, target: t.target_host, hop_count: t.hop_count, total_rtt_ms: t.total_rtt_ms, hops: hopsByTrace[t.id] ?? [] })),
  };
}

async function getWebrunnerData(deviceId: string, tenantId: string, hours: number, urlFilter?: string) {
  const clampedHours = Math.min(hours, 168);
  if (!(await verifyDeviceTenant(deviceId, tenantId))) return { error: `Device ${deviceId} not found.` };

  const rows = urlFilter
    ? await sql`
        SELECT target_url, DATE_TRUNC('hour', checked_at) AS hour,
          COUNT(*)::int AS check_count,
          AVG(response_time_ms)::int AS avg_response_ms,
          MIN(response_time_ms)::int AS min_response_ms,
          MAX(response_time_ms)::int AS max_response_ms,
          AVG(dns_time_ms)::int AS avg_dns_ms,
          SUM(CASE WHEN status_code >= 400 OR status_code IS NULL THEN 1 ELSE 0 END)::int AS error_count,
          ROUND(100.0 * SUM(CASE WHEN status_code >= 200 AND status_code < 400 THEN 1 ELSE 0 END) / COUNT(*), 1) AS uptime_pct
        FROM webrunner_live
        WHERE device_id = ${deviceId}
          AND checked_at > NOW() - (${clampedHours} || ' hours')::interval
          AND target_url = ${urlFilter}
        GROUP BY target_url, DATE_TRUNC('hour', checked_at)
        ORDER BY target_url, hour DESC
      ` as any[]
    : await sql`
        SELECT target_url, DATE_TRUNC('hour', checked_at) AS hour,
          COUNT(*)::int AS check_count,
          AVG(response_time_ms)::int AS avg_response_ms,
          MIN(response_time_ms)::int AS min_response_ms,
          MAX(response_time_ms)::int AS max_response_ms,
          AVG(dns_time_ms)::int AS avg_dns_ms,
          SUM(CASE WHEN status_code >= 400 OR status_code IS NULL THEN 1 ELSE 0 END)::int AS error_count,
          ROUND(100.0 * SUM(CASE WHEN status_code >= 200 AND status_code < 400 THEN 1 ELSE 0 END) / COUNT(*), 1) AS uptime_pct
        FROM webrunner_live
        WHERE device_id = ${deviceId}
          AND checked_at > NOW() - (${clampedHours} || ' hours')::interval
        GROUP BY target_url, DATE_TRUNC('hour', checked_at)
        ORDER BY target_url, hour DESC
      ` as any[];

  const byUrl: Record<string, unknown[]> = {};
  for (const row of rows) {
    if (!byUrl[row.target_url]) byUrl[row.target_url] = [];
    byUrl[row.target_url].push({ hour: row.hour, checks: row.check_count, avg_response_ms: row.avg_response_ms, min_response_ms: row.min_response_ms, max_response_ms: row.max_response_ms, avg_dns_ms: row.avg_dns_ms, errors: row.error_count, uptime_pct: row.uptime_pct });
  }

  return { device_id: deviceId, hours_requested: clampedHours, monitored_urls: Object.keys(byUrl).length, data: byUrl };
}

async function getMeasurementsTimeseries(deviceId: string, tenantId: string, hours: number, bucketMinutes: number) {
  const clampedHours = Math.min(hours, 168);
  const clampedBucket = Math.max(5, Math.min(bucketMinutes, 1440));
  if (!(await verifyDeviceTenant(deviceId, tenantId))) return { error: `Device ${deviceId} not found.` };

  const rows = await sql`
    SELECT
      DATE_TRUNC('minute', measured_at) -
        (EXTRACT(MINUTE FROM measured_at)::int % ${clampedBucket} * INTERVAL '1 minute') AS bucket,
      AVG(download_mbps)::numeric(8,2) AS avg_download_mbps,
      AVG(upload_mbps)::numeric(8,2) AS avg_upload_mbps,
      AVG(ping_ms)::numeric(6,1) AS avg_ping_ms,
      AVG(ap_count)::numeric(5,1) AS avg_ap_count,
      AVG(avg_signal)::numeric(5,1) AS avg_signal_dbm,
      COUNT(*)::int AS sample_count
    FROM measurements_recent
    WHERE device_id = ${deviceId}
      AND measured_at > NOW() - (${clampedHours} || ' hours')::interval
    GROUP BY bucket
    ORDER BY bucket DESC
  ` as any[];

  return { device_id: deviceId, hours_requested: clampedHours, bucket_minutes: clampedBucket, data_points: rows.length, timeseries: rows };
}

async function verifyDeviceTenant(deviceId: string, tenantId: string): Promise<boolean> {
  const rows = await sql`
    SELECT 1 FROM devices WHERE device_id = ${deviceId} AND tenant_id = ${tenantId} LIMIT 1
  ` as any[];
  return rows.length > 0;
}
