import { db } from "@/lib/db";

// ---------------------------------------------------------------------------
// MCP Tool Registry
// ---------------------------------------------------------------------------

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
        device_id: {
          type: "string",
          description: "The device ID.",
        },
        hours: {
          type: "number",
          description:
            "How many hours of history to return. Defaults to 24. Max 168 (7 days).",
        },
      },
      required: ["device_id"],
    },
  },
  {
    name: "get_speed_results",
    description:
      "Get internet speed test results for a device. Returns download/upload speeds (Mbps) and ping (ms) over time, with optional filtering by time range.",
    inputSchema: {
      type: "object",
      properties: {
        device_id: {
          type: "string",
          description: "The device ID.",
        },
        hours: {
          type: "number",
          description: "Hours of history to return. Defaults to 24. Max 168.",
        },
        include_summary: {
          type: "boolean",
          description:
            "Include min/max/avg summary statistics. Defaults to true.",
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
        device_id: {
          type: "string",
          description: "The device ID.",
        },
        limit: {
          type: "number",
          description: "Number of most recent traces to return. Defaults to 5.",
        },
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
        device_id: {
          type: "string",
          description: "The device ID.",
        },
        hours: {
          type: "number",
          description: "Hours of history to return. Defaults to 24. Max 168.",
        },
        url_filter: {
          type: "string",
          description: "Optional: filter results to a specific monitored URL.",
        },
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
        device_id: {
          type: "string",
          description: "The device ID.",
        },
        hours: {
          type: "number",
          description:
            "Hours of history. Defaults to 24. Max 168 (1 week). Use 168 for weekly trend analysis.",
        },
        bucket_minutes: {
          type: "number",
          description:
            "Bucket size in minutes for aggregation. Defaults to 60. Use 15 for high-resolution.",
        },
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
      return getRFHistory(
        args.device_id as string,
        tenantId,
        (args.hours as number) ?? 24
      );

    case "get_speed_results":
      return getSpeedResults(
        args.device_id as string,
        tenantId,
        (args.hours as number) ?? 24,
        (args.include_summary as boolean) ?? true
      );

    case "get_route_trace":
      return getRouteTrace(
        args.device_id as string,
        tenantId,
        (args.limit as number) ?? 5
      );

    case "get_webrunner_data":
      return getWebrunnerData(
        args.device_id as string,
        tenantId,
        (args.hours as number) ?? 24,
        args.url_filter as string | undefined
      );

    case "get_measurements_timeseries":
      return getMeasurementsTimeseries(
        args.device_id as string,
        tenantId,
        (args.hours as number) ?? 24,
        (args.bucket_minutes as number) ?? 60
      );

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

// ---------------------------------------------------------------------------
// Tool Implementations
// ---------------------------------------------------------------------------

async function listDevices(tenantId: string, statusFilter?: string) {
  let whereClause = "WHERE d.tenant_id = $1";
  const params: unknown[] = [tenantId];

  if (statusFilter === "online") {
    whereClause += " AND d.last_seen > NOW() - INTERVAL '3 minutes'";
  } else if (statusFilter === "offline") {
    whereClause += " AND (d.last_seen IS NULL OR d.last_seen <= NOW() - INTERVAL '3 minutes')";
  }

  const result = await db.query(
    `SELECT
       d.device_id,
       d.hostname,
       d.ip_address,
       d.agent_version,
       d.last_seen,
       d.claimed_at,
       CASE
         WHEN d.last_seen > NOW() - INTERVAL '3 minutes' THEN 'online'
         ELSE 'offline'
       END AS status
     FROM devices d
     ${whereClause}
     ORDER BY d.last_seen DESC NULLS LAST`,
    params
  );

  return {
    device_count: result.rows.length,
    devices: result.rows.map((r) => ({
      device_id: r.device_id,
      hostname: r.hostname,
      ip_address: r.ip_address,
      status: r.status,
      last_seen: r.last_seen,
      agent_version: r.agent_version,
      claimed_at: r.claimed_at,
    })),
  };
}

async function getDeviceStatus(deviceId: string, tenantId: string) {
  const result = await db.query(
    `SELECT
       d.device_id,
       d.hostname,
       d.ip_address,
       d.agent_version,
       d.last_seen,
       d.uptime_seconds,
       d.status,
       d.claimed_at,
       d.registered_at,
       CASE
         WHEN d.last_seen > NOW() - INTERVAL '3 minutes' THEN 'online'
         ELSE 'offline'
       END AS current_status,
       EXTRACT(EPOCH FROM (NOW() - d.last_seen))::int AS seconds_since_seen
     FROM devices d
     WHERE d.device_id = $1 AND d.tenant_id = $2`,
    [deviceId, tenantId]
  );

  if (result.rows.length === 0) {
    return { error: `Device ${deviceId} not found or does not belong to this tenant.` };
  }

  return result.rows[0];
}

async function getRFHistory(
  deviceId: string,
  tenantId: string,
  hours: number
) {
  const clampedHours = Math.min(hours, 168);

  // Verify device belongs to tenant
  const deviceCheck = await verifyDeviceTenant(deviceId, tenantId);
  if (!deviceCheck) return { error: `Device ${deviceId} not found.` };

  const result = await db.query(
    `SELECT
       DATE_TRUNC('hour', scanned_at) AS hour,
       COUNT(*)::int AS scan_count,
       AVG(ap_count)::int AS avg_ap_count,
       MAX(ap_count)::int AS max_ap_count,
       AVG(avg_signal)::numeric(5,1) AS avg_signal_dbm,
       SUM(band_2ghz_count)::int AS band_2ghz_aps,
       SUM(band_5ghz_count)::int AS band_5ghz_aps,
       SUM(band_6ghz_count)::int AS band_6ghz_aps
     FROM rf_scans_hourly
     WHERE device_id = $1
       AND scanned_at > NOW() - ($2 || ' hours')::interval
     GROUP BY DATE_TRUNC('hour', scanned_at)
     ORDER BY hour DESC`,
    [deviceId, clampedHours]
  );

  // Also grab most recent raw scan for current snapshot
  const latest = await db.query(
    `SELECT ap_count, avg_signal, band_2ghz_count, band_5ghz_count,
            band_6ghz_count, scanned_at
     FROM rf_scans
     WHERE device_id = $1
     ORDER BY scanned_at DESC
     LIMIT 1`,
    [deviceId]
  );

  return {
    device_id: deviceId,
    hours_requested: clampedHours,
    current_snapshot: latest.rows[0] ?? null,
    hourly_history: result.rows,
  };
}

async function getSpeedResults(
  deviceId: string,
  tenantId: string,
  hours: number,
  includeSummary: boolean
) {
  const clampedHours = Math.min(hours, 168);

  const deviceCheck = await verifyDeviceTenant(deviceId, tenantId);
  if (!deviceCheck) return { error: `Device ${deviceId} not found.` };

  const result = await db.query(
    `SELECT
       tested_at,
       download_mbps,
       upload_mbps,
       ping_ms,
       jitter_ms,
       server_name,
       server_location
     FROM speed_results
     WHERE device_id = $1
       AND tested_at > NOW() - ($2 || ' hours')::interval
     ORDER BY tested_at DESC`,
    [deviceId, clampedHours]
  );

  const response: Record<string, unknown> = {
    device_id: deviceId,
    hours_requested: clampedHours,
    test_count: result.rows.length,
    results: result.rows,
  };

  if (includeSummary && result.rows.length > 0) {
    const downloads = result.rows.map((r) => r.download_mbps).filter(Boolean);
    const uploads = result.rows.map((r) => r.upload_mbps).filter(Boolean);
    const pings = result.rows.map((r) => r.ping_ms).filter(Boolean);

    response.summary = {
      download_mbps: {
        min: Math.min(...downloads).toFixed(1),
        max: Math.max(...downloads).toFixed(1),
        avg: (downloads.reduce((a, b) => a + b, 0) / downloads.length).toFixed(1),
      },
      upload_mbps: {
        min: Math.min(...uploads).toFixed(1),
        max: Math.max(...uploads).toFixed(1),
        avg: (uploads.reduce((a, b) => a + b, 0) / uploads.length).toFixed(1),
      },
      ping_ms: {
        min: Math.min(...pings).toFixed(1),
        max: Math.max(...pings).toFixed(1),
        avg: (pings.reduce((a, b) => a + b, 0) / pings.length).toFixed(1),
      },
    };
  }

  return response;
}

async function getRouteTrace(
  deviceId: string,
  tenantId: string,
  limit: number
) {
  const deviceCheck = await verifyDeviceTenant(deviceId, tenantId);
  if (!deviceCheck) return { error: `Device ${deviceId} not found.` };

  const traces = await db.query(
    `SELECT id, traced_at, target_host, hop_count, total_rtt_ms
     FROM route_results
     WHERE device_id = $1
     ORDER BY traced_at DESC
     LIMIT $2`,
    [deviceId, Math.min(limit, 20)]
  );

  if (traces.rows.length === 0) {
    return { device_id: deviceId, traces: [] };
  }

  // Fetch hops for each trace
  const traceIds = traces.rows.map((r) => r.id);
  const hops = await db.query(
    `SELECT trace_id, hop_number, ip_address, hostname, rtt_ms, isp_name, is_private
     FROM route_hops
     WHERE trace_id = ANY($1)
     ORDER BY trace_id, hop_number`,
    [traceIds]
  );

  // Group hops by trace
  const hopsByTrace: Record<string, unknown[]> = {};
  for (const hop of hops.rows) {
    if (!hopsByTrace[hop.trace_id]) hopsByTrace[hop.trace_id] = [];
    hopsByTrace[hop.trace_id].push({
      hop: hop.hop_number,
      ip: hop.ip_address,
      hostname: hop.hostname,
      rtt_ms: hop.rtt_ms,
      isp: hop.isp_name,
      is_private: hop.is_private,
    });
  }

  return {
    device_id: deviceId,
    trace_count: traces.rows.length,
    traces: traces.rows.map((t) => ({
      traced_at: t.traced_at,
      target: t.target_host,
      hop_count: t.hop_count,
      total_rtt_ms: t.total_rtt_ms,
      hops: hopsByTrace[t.id] ?? [],
    })),
  };
}

async function getWebrunnerData(
  deviceId: string,
  tenantId: string,
  hours: number,
  urlFilter?: string
) {
  const clampedHours = Math.min(hours, 168);

  const deviceCheck = await verifyDeviceTenant(deviceId, tenantId);
  if (!deviceCheck) return { error: `Device ${deviceId} not found.` };

  const params: unknown[] = [deviceId, clampedHours];
  let urlClause = "";
  if (urlFilter) {
    params.push(urlFilter);
    urlClause = `AND target_url = $${params.length}`;
  }

  const result = await db.query(
    `SELECT
       target_url,
       DATE_TRUNC('hour', checked_at) AS hour,
       COUNT(*)::int AS check_count,
       AVG(response_time_ms)::int AS avg_response_ms,
       MIN(response_time_ms)::int AS min_response_ms,
       MAX(response_time_ms)::int AS max_response_ms,
       AVG(dns_time_ms)::int AS avg_dns_ms,
       SUM(CASE WHEN status_code >= 400 OR status_code IS NULL THEN 1 ELSE 0 END)::int AS error_count,
       ROUND(
         100.0 * SUM(CASE WHEN status_code >= 200 AND status_code < 400 THEN 1 ELSE 0 END) / COUNT(*),
         1
       ) AS uptime_pct
     FROM webrunner_live
     WHERE device_id = $1
       AND checked_at > NOW() - ($2 || ' hours')::interval
       ${urlClause}
     GROUP BY target_url, DATE_TRUNC('hour', checked_at)
     ORDER BY target_url, hour DESC`,
    params
  );

  // Group by URL
  const byUrl: Record<string, unknown[]> = {};
  for (const row of result.rows) {
    if (!byUrl[row.target_url]) byUrl[row.target_url] = [];
    byUrl[row.target_url].push({
      hour: row.hour,
      checks: row.check_count,
      avg_response_ms: row.avg_response_ms,
      min_response_ms: row.min_response_ms,
      max_response_ms: row.max_response_ms,
      avg_dns_ms: row.avg_dns_ms,
      errors: row.error_count,
      uptime_pct: row.uptime_pct,
    });
  }

  return {
    device_id: deviceId,
    hours_requested: clampedHours,
    monitored_urls: Object.keys(byUrl).length,
    data: byUrl,
  };
}

async function getMeasurementsTimeseries(
  deviceId: string,
  tenantId: string,
  hours: number,
  bucketMinutes: number
) {
  const clampedHours = Math.min(hours, 168);
  const clampedBucket = Math.max(5, Math.min(bucketMinutes, 1440));

  const deviceCheck = await verifyDeviceTenant(deviceId, tenantId);
  if (!deviceCheck) return { error: `Device ${deviceId} not found.` };

  const result = await db.query(
    `SELECT
       DATE_TRUNC('minute', measured_at) -
         (EXTRACT(MINUTE FROM measured_at)::int % $3 * INTERVAL '1 minute') AS bucket,
       AVG(download_mbps)::numeric(8,2) AS avg_download_mbps,
       AVG(upload_mbps)::numeric(8,2) AS avg_upload_mbps,
       AVG(ping_ms)::numeric(6,1) AS avg_ping_ms,
       AVG(ap_count)::numeric(5,1) AS avg_ap_count,
       AVG(avg_signal)::numeric(5,1) AS avg_signal_dbm,
       COUNT(*)::int AS sample_count
     FROM measurements_recent
     WHERE device_id = $1
       AND measured_at > NOW() - ($2 || ' hours')::interval
     GROUP BY bucket
     ORDER BY bucket DESC`,
    [deviceId, clampedHours, clampedBucket]
  );

  return {
    device_id: deviceId,
    hours_requested: clampedHours,
    bucket_minutes: clampedBucket,
    data_points: result.rows.length,
    timeseries: result.rows,
  };
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

async function verifyDeviceTenant(
  deviceId: string,
  tenantId: string
): Promise<boolean> {
  const result = await db.query(
    `SELECT 1 FROM devices WHERE device_id = $1 AND tenant_id = $2 LIMIT 1`,
    [deviceId, tenantId]
  );
  return result.rows.length > 0;
}
