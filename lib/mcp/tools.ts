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
    description: "List all VGER 1 units registered to this tenant. Returns device ID, nickname, IP address, online/offline status, last seen timestamp, and agent version.",
    inputSchema: {
      type: "object",
      properties: {
        status_filter: { type: "string", enum: ["all", "online", "offline"], description: "Filter by device status. Defaults to 'all'." },
      },
    },
  },
  {
    name: "get_device_status",
    description: "Get the current status of a specific VGER 1 unit: online/offline, last seen time, agent version, IP address, nickname, and uptime.",
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
  {
    name: "queue_command",
    description: "Queue a command to be executed on a NetRunner device on its next heartbeat. Supports run_script, update_file, restart_service, reboot, run_cli_command, run_snmp_get, run_network_discovery.",
    inputSchema: {
      type: "object",
      properties: {
        device_id: { type: "string", description: "The NetRunner device ID." },
        command_type: { type: "string", enum: ["run_script", "update_file", "restart_service", "reboot", "run_cli_command", "run_snmp_get", "run_network_discovery"], description: "Type of command to execute." },
        payload: { type: "object", description: "Command payload. run_script: {script}, update_file: {path, content}, restart_service: {service_name}, reboot: {}" },
      },
      required: ["device_id", "command_type"],
    },
  },
  {
    name: "get_pending_commands",
    description: "Get pending, executing, complete, and failed commands for a NetRunner device.",
    inputSchema: {
      type: "object",
      properties: {
        device_id: { type: "string", description: "The NetRunner device ID." },
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

// ── BLERunner ──────────────────────────────────────────────────────────────
const BLE_TOOLS: MCPTool[] = [
  {
    name: "get_ble_devices",
    description: "Get all BLE devices detected by a NetRunner device. Returns MAC addresses, names, signal strength, manufacturer, and detection timestamps. Note: many BLE MACs are randomized by iOS/Android.",
    inputSchema: { type: "object", properties: {
      device_id: { type: "string", description: "The NetRunner device ID." },
      hours: { type: "number", description: "Hours of history. Defaults to 24. Max 168." },
      min_rssi: { type: "number", description: "Filter out devices below this RSSI (e.g. -80)." },
      manufacturer: { type: "string", description: "Filter by manufacturer name." },
    }, required: ["device_id"] },
  },
  {
    name: "get_ble_history",
    description: "Get hourly BLE scan summaries. Returns device counts, new vs returning devices, and average RSSI per hour.",
    inputSchema: { type: "object", properties: {
      device_id: { type: "string", description: "The NetRunner device ID." },
      hours: { type: "number", description: "Hours of history. Defaults to 24. Max 168." },
      include_summary: { type: "boolean", description: "Include summary stats. Defaults to true." },
    }, required: ["device_id"] },
  },
  {
    name: "get_ble_live_feed",
    description: "Get BLE devices detected in the last 5 minutes — current presence snapshot sorted by signal strength.",
    inputSchema: { type: "object", properties: {
      device_id: { type: "string", description: "The NetRunner device ID." },
    }, required: ["device_id"] },
  },
  {
    name: "get_ble_device_detail",
    description: "Get full history for a specific BLE MAC address — all sightings, signal trend, and time on/off premises.",
    inputSchema: { type: "object", properties: {
      device_id: { type: "string", description: "The NetRunner device ID." },
      mac: { type: "string", description: "The BLE MAC address to look up." },
      hours: { type: "number", description: "Hours of history. Defaults to 24. Max 168." },
    }, required: ["device_id", "mac"] },
  },
];

// ── RFRunner extras ─────────────────────────────────────────────────────────
const RF_EXTRA_TOOLS: MCPTool[] = [
  {
    name: "get_rf_config",
    description: "Get the current RFRunner WiFi scan configuration for a device.",
    inputSchema: { type: "object", properties: {
      device_id: { type: "string", description: "The NetRunner device ID." },
    }, required: ["device_id"] },
  },
  {
    name: "set_rf_config",
    description: "Update the RFRunner WiFi scan configuration for a device.",
    inputSchema: { type: "object", properties: {
      device_id: { type: "string", description: "The NetRunner device ID." },
      scan_interval_seconds: { type: "number", description: "How often to scan (min 30)." },
    }, required: ["device_id"] },
  },
  {
    name: "get_rf_active_scan",
    description: "Get the most recent active RF scan — full AP list with SSID, BSSID, channel, signal, and security.",
    inputSchema: { type: "object", properties: {
      device_id: { type: "string", description: "The NetRunner device ID." },
    }, required: ["device_id"] },
  },
  {
    name: "set_rf_active_mode",
    description: "Enable or disable active RF scanning mode on a device.",
    inputSchema: { type: "object", properties: {
      device_id: { type: "string", description: "The NetRunner device ID." },
      enabled: { type: "boolean", description: "True to enable active mode, false to disable." },
    }, required: ["device_id", "enabled"] },
  },
];

// ── NOC ─────────────────────────────────────────────────────────────────────
const NOC_TOOLS: MCPTool[] = [
  {
    name: "get_noc_summary",
    description: "Get a platform-wide NOC summary: total devices, online/offline counts, and fleet health.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_noc_alerts",
    description: "Get active NOC alerts: devices offline >1hr, heartbeat gaps, and runner failures.",
    inputSchema: { type: "object", properties: {
      hours: { type: "number", description: "How far back to look for alerts. Defaults to 24." },
    } },
  },
  {
    name: "get_noc_event_log",
    description: "Get recent device events: heartbeats, status changes, and runner activity across the fleet.",
    inputSchema: { type: "object", properties: {
      device_id: { type: "string", description: "Optional: filter to a specific device." },
      limit: { type: "number", description: "Number of events to return. Defaults to 50." },
    } },
  },
];

// ── RouterRunner extras ──────────────────────────────────────────────────────
const ROUTER_EXTRA_TOOLS: MCPTool[] = [
  {
    name: "get_routerunner_config",
    description: "Get the current RouterRunner traceroute configuration for a device.",
    inputSchema: { type: "object", properties: {
      device_id: { type: "string", description: "The NetRunner device ID." },
    }, required: ["device_id"] },
  },
  {
    name: "set_routerunner_config",
    description: "Update the RouterRunner traceroute configuration for a device.",
    inputSchema: { type: "object", properties: {
      device_id: { type: "string", description: "The NetRunner device ID." },
      trace_interval_seconds: { type: "number", description: "How often to run traceroutes." },
      targets: { type: "array", description: "List of IPs/hostnames to trace to.", items: { type: "string" } },
    }, required: ["device_id"] },
  },
  {
    name: "get_routerunner_live",
    description: "Get the most recent traceroute result for a device.",
    inputSchema: { type: "object", properties: {
      device_id: { type: "string", description: "The NetRunner device ID." },
    }, required: ["device_id"] },
  },
];

// ── SpeedRunner extras ───────────────────────────────────────────────────────
const SPEED_EXTRA_TOOLS: MCPTool[] = [
  {
    name: "get_speedrunner_config",
    description: "Get the current SpeedRunner configuration for a device.",
    inputSchema: { type: "object", properties: {
      device_id: { type: "string", description: "The NetRunner device ID." },
    }, required: ["device_id"] },
  },
  {
    name: "set_speedrunner_config",
    description: "Update the SpeedRunner configuration. Use this to fix the speed test server (currently routing to Tokyo — set server_url to a US endpoint).",
    inputSchema: { type: "object", properties: {
      device_id: { type: "string", description: "The NetRunner device ID." },
      test_interval_seconds: { type: "number", description: "How often to run speed tests (min 300)." },
      server_url: { type: "string", description: "Override the speed test server URL." },
    }, required: ["device_id"] },
  },
  {
    name: "get_speedrunner_live",
    description: "Get the single most recent speed test result for a device.",
    inputSchema: { type: "object", properties: {
      device_id: { type: "string", description: "The NetRunner device ID." },
    }, required: ["device_id"] },
  },
];

// ── WebRunner extras ─────────────────────────────────────────────────────────
const WEBRUNNER_EXTRA_TOOLS: MCPTool[] = [
  {
    name: "get_webrunner_config",
    description: "Get the current WebRunner HTTP monitoring configuration for a device.",
    inputSchema: { type: "object", properties: {
      device_id: { type: "string", description: "The NetRunner device ID." },
    }, required: ["device_id"] },
  },
  {
    name: "set_webrunner_config",
    description: "Update the WebRunner HTTP monitoring configuration for a device.",
    inputSchema: { type: "object", properties: {
      device_id: { type: "string", description: "The NetRunner device ID." },
      check_interval_seconds: { type: "number", description: "Check interval in seconds (min 30)." },
      targets: { type: "array", description: "Replace monitored URLs.", items: { type: "string" } },
      alert_latency_threshold_ms: { type: "number", description: "Alert if latency exceeds this value." },
    }, required: ["device_id"] },
  },
  {
    name: "get_webrunner_live",
    description: "Get the most recent HTTP check results for all monitored targets on a device.",
    inputSchema: { type: "object", properties: {
      device_id: { type: "string", description: "The NetRunner device ID." },
    }, required: ["device_id"] },
  },
];

// Merge all into MCP_TOOLS
MCP_TOOLS.push(...BLE_TOOLS, ...RF_EXTRA_TOOLS, ...NOC_TOOLS, ...ROUTER_EXTRA_TOOLS, ...SPEED_EXTRA_TOOLS, ...WEBRUNNER_EXTRA_TOOLS);

// ── Extended dispatchTool — replaces the default throw ──────────────────────
// Patch: re-export a wrapped dispatcher that handles new tools
const _originalDispatch = dispatchTool;

// ── Pending Commands ─────────────────────────────────────────────────────────

async function queueCommand(deviceId: string, tenantId: string, args: Record<string, unknown>) {
  if (!(await verifyDeviceTenant(deviceId, tenantId))) return { error: `Device ${deviceId} not found.` };
  const { command_type, payload = {} } = args;
  const valid = ["run_script", "update_file", "restart_service", "reboot", "run_cli_command", "run_snmp_get", "run_network_discovery"];
  if (!valid.includes(command_type as string)) return { error: "invalid command_type" };
  const rows = await sql`
    INSERT INTO pending_commands (device_id, tenant_id, command_type, payload)
    VALUES (${deviceId}, ${tenantId}, ${command_type as string}, ${JSON.stringify(payload)})
    RETURNING id, status, created_at
  ` as any[];
  return { ok: true, command: rows[0] };
}

async function getPendingCommands(deviceId: string, tenantId: string) {
  if (!(await verifyDeviceTenant(deviceId, tenantId))) return { error: `Device ${deviceId} not found.` };
  const rows = await sql`
    SELECT id, command_type, payload, status, created_at, executed_at, completed_at, output, error
    FROM pending_commands
    WHERE device_id = ${deviceId}
    ORDER BY created_at DESC
    LIMIT 20
  ` as any[];
  return { ok: true, device_id: deviceId, commands: rows };
}

export async function dispatchToolExtended(
  toolName: string,
  args: Record<string, unknown>,
  tenantId: string
): Promise<unknown> {
  switch (toolName) {
    // BLERunner
    case "get_ble_devices":      return getBleDevices(args.device_id as string, tenantId, (args.hours as number) ?? 24, args.min_rssi as number | undefined, args.manufacturer as string | undefined);
    case "get_ble_history":      return getBleHistory(args.device_id as string, tenantId, (args.hours as number) ?? 24, (args.include_summary as boolean) ?? true);
    case "get_ble_live_feed":    return getBleliveFeed(args.device_id as string, tenantId);
    case "get_ble_device_detail":return getBleDeviceDetail(args.device_id as string, tenantId, args.mac as string, (args.hours as number) ?? 24);
    // RFRunner extras
    case "get_rf_config":        return getRfConfig(args.device_id as string, tenantId);
    case "set_rf_config":        return setRfConfig(args.device_id as string, tenantId, args);
    case "get_rf_active_scan":   return getRfActiveScan(args.device_id as string, tenantId);
    case "set_rf_active_mode":   return setRfActiveMode(args.device_id as string, tenantId, args.enabled as boolean);
    // NOC
    case "get_noc_summary":      return getNocSummary(tenantId);
    case "get_noc_alerts":       return getNocAlerts(tenantId, (args.hours as number) ?? 24);
    case "get_noc_event_log":    return getNocEventLog(tenantId, args.device_id as string | undefined, (args.limit as number) ?? 50);
    // RouterRunner extras
    case "get_routerunner_config":  return getRouterunnerConfig(args.device_id as string, tenantId);
    case "set_routerunner_config":  return setRouterunnerConfig(args.device_id as string, tenantId, args);
    case "get_routerunner_live":    return getRouterunnerLive(args.device_id as string, tenantId);
    // SpeedRunner extras
    case "get_speedrunner_config":  return getSpeedrunnerConfig(args.device_id as string, tenantId);
    case "set_speedrunner_config":  return setSpeedrunnerConfig(args.device_id as string, tenantId, args);
    case "get_speedrunner_live":    return getSpeedrunnerLive(args.device_id as string, tenantId);
    // WebRunner extras
    case "get_webrunner_config":    return getWebrunnerConfig(args.device_id as string, tenantId);
    case "set_webrunner_config":    return setWebrunnerConfig(args.device_id as string, tenantId, args);
    case "get_webrunner_live":      return getWebrunnerLive(args.device_id as string, tenantId);
    // Fall through to original
    case "queue_command": return queueCommand(args.device_id as string, tenantId, args);
    case "get_pending_commands": return getPendingCommands(args.device_id as string, tenantId);
    case "list_sites":   return listSites(tenantId);
    case "get_site":     return getSite(args.site_id as string, tenantId);
    case "create_site":  return createSite(tenantId, args);
    case "update_site":  return updateSite(args.site_id as string, tenantId, args);
    default: return _originalDispatch(toolName, args, tenantId);
  }
}

// ── BLERunner Handlers ──────────────────────────────────────────────────────

async function getBleDevices(deviceId: string, tenantId: string, hours: number, minRssi?: number, manufacturer?: string) {
  const clampedHours = Math.min(hours, 168);
  if (!(await verifyDeviceTenant(deviceId, tenantId))) return { error: `Device ${deviceId} not found.` };
  const rows = await sql`
    SELECT DISTINCT ON (mac) mac, name, rssi, manufacturer, tx_power, ts_utc AS last_seen,
      MIN(ts_utc) OVER (PARTITION BY mac) AS first_seen
    FROM bt_scans
    WHERE device_id = ${deviceId}
      AND ts_utc > NOW() - (${clampedHours} || ' hours')::interval
      ${minRssi !== undefined ? sql`AND rssi >= ${minRssi}` : sql``}
      ${manufacturer ? sql`AND manufacturer ILIKE ${'%' + manufacturer + '%'}` : sql``}
    ORDER BY mac, ts_utc DESC
  ` as any[];
  return { device_id: deviceId, hours_requested: clampedHours, ble_device_count: rows.length, devices: rows };
}

async function getBleHistory(deviceId: string, tenantId: string, hours: number, includeSummary: boolean) {
  const clampedHours = Math.min(hours, 168);
  if (!(await verifyDeviceTenant(deviceId, tenantId))) return { error: `Device ${deviceId} not found.` };
  const hourly = await sql`
    SELECT hour_utc, unique_devices, avg_rssi, new_devices, returning_devices
    FROM bt_scans_hourly
    WHERE device_id = ${deviceId}
      AND hour_utc > NOW() - (${clampedHours} || ' hours')::interval
    ORDER BY hour_utc DESC
  ` as any[];
  const response: Record<string, unknown> = { device_id: deviceId, hours_requested: clampedHours, hourly };
  if (includeSummary && hourly.length > 0) {
    const counts = hourly.map((h: any) => h.unique_devices);
    response.summary = {
      total_unique_devices: await sql`SELECT COUNT(DISTINCT mac) AS c FROM bt_scans WHERE device_id = ${deviceId} AND ts_utc > NOW() - (${clampedHours} || ' hours')::interval`.then((r: any) => r[0]?.c ?? 0),
      avg_devices_per_hour: Math.round(counts.reduce((a: number, b: number) => a + b, 0) / counts.length),
      peak_devices: Math.max(...counts),
    };
  }
  return response;
}

async function getBleliveFeed(deviceId: string, tenantId: string) {
  if (!(await verifyDeviceTenant(deviceId, tenantId))) return { error: `Device ${deviceId} not found.` };
  const scans = await sql`
    SELECT DISTINCT ON (mac) mac, name, rssi, manufacturer, service_uuids, tx_power, ts_utc
    FROM bt_scans
    WHERE device_id = ${deviceId} AND ts_utc > NOW() - INTERVAL '5 minutes'
    ORDER BY mac, rssi DESC NULLS LAST
  ` as any[];
  return { device_id: deviceId, as_of: new Date().toISOString(), device_count: scans.length, devices: scans.sort((a: any, b: any) => (b.rssi ?? -120) - (a.rssi ?? -120)) };
}

async function getBleDeviceDetail(deviceId: string, tenantId: string, mac: string, hours: number) {
  const clampedHours = Math.min(hours, 168);
  if (!(await verifyDeviceTenant(deviceId, tenantId))) return { error: `Device ${deviceId} not found.` };
  const sightings = await sql`
    SELECT ts_utc, rssi, name, service_uuids, tx_power
    FROM bt_scans
    WHERE device_id = ${deviceId} AND mac = ${mac.toUpperCase()}
      AND ts_utc > NOW() - (${clampedHours} || ' hours')::interval
    ORDER BY ts_utc DESC
  ` as any[];
  if (sightings.length === 0) return { device_id: deviceId, mac, sightings: 0, message: "MAC not seen in this period." };
  const rssiVals = sightings.map((s: any) => s.rssi).filter(Boolean);
  return {
    device_id: deviceId, mac, hours_requested: clampedHours,
    sightings: sightings.length,
    first_seen: sightings[sightings.length - 1].ts_utc,
    last_seen: sightings[0].ts_utc,
    rssi: { min: Math.min(...rssiVals), max: Math.max(...rssiVals), avg: Math.round(rssiVals.reduce((a: number, b: number) => a + b, 0) / rssiVals.length) },
    history: sightings,
  };
}

// ── RFRunner Extras ─────────────────────────────────────────────────────────

async function getRfConfig(deviceId: string, tenantId: string) {
  if (!(await verifyDeviceTenant(deviceId, tenantId))) return { error: `Device ${deviceId} not found.` };
  const rows = await sql`SELECT * FROM device_config WHERE device_id = ${deviceId} LIMIT 1` as any[];
  return rows[0] ?? { device_id: deviceId, message: "No config found — using defaults." };
}

async function setRfConfig(deviceId: string, tenantId: string, args: Record<string, unknown>) {
  if (!(await verifyDeviceTenant(deviceId, tenantId))) return { error: `Device ${deviceId} not found.` };
  await sql`
    INSERT INTO device_config (device_id, rf_scan_interval_seconds, updated_at)
    VALUES (${deviceId}, ${args.scan_interval_seconds as number ?? 60}, NOW())
    ON CONFLICT (device_id) DO UPDATE SET
      rf_scan_interval_seconds = EXCLUDED.rf_scan_interval_seconds,
      updated_at = NOW()
  `;
  return { success: true, updated_fields: Object.keys(args).filter(k => k !== "device_id") };
}

async function getRfActiveScan(deviceId: string, tenantId: string) {
  if (!(await verifyDeviceTenant(deviceId, tenantId))) return { error: `Device ${deviceId} not found.` };
  const scans = await sql`
    SELECT bssid, ssid, signal_dbm, channel, band, frequency_mhz, security, ts_utc
    FROM rf_scans
    WHERE device_id = ${deviceId}
      AND ts_utc = (SELECT MAX(ts_utc) FROM rf_scans WHERE device_id = ${deviceId})
    ORDER BY signal_dbm DESC
  ` as any[];
  return { device_id: deviceId, ap_count: scans.length, scanned_at: scans[0]?.ts_utc ?? null, aps: scans };
}

async function setRfActiveMode(deviceId: string, tenantId: string, enabled: boolean) {
  if (!(await verifyDeviceTenant(deviceId, tenantId))) return { error: `Device ${deviceId} not found.` };
  await sql`
    INSERT INTO device_config (device_id, rf_active_mode, updated_at)
    VALUES (${deviceId}, ${enabled}, NOW())
    ON CONFLICT (device_id) DO UPDATE SET rf_active_mode = ${enabled}, updated_at = NOW()
  `;
  return { success: true, device_id: deviceId, rf_active_mode: enabled };
}

// ── NOC Handlers ─────────────────────────────────────────────────────────────

async function getNocSummary(tenantId: string) {
  const devices = await sql`
    SELECT device_id, nr_serial, nickname, site_name, location, address,
           agent_version, last_seen, last_ip, status
    FROM devices WHERE tenant_id = ${tenantId}::uuid ORDER BY site_name, nickname
  ` as any[];

  const webStats = await sql`
    SELECT device_id,
           ROUND(AVG(dns_ms))  AS avg_dns_ms,
           ROUND(AVG(http_ms)) AS avg_http_ms,
           COUNT(*)            AS measurement_count
    FROM measurements
    WHERE tenant_id = ${tenantId}::uuid
      AND ts_utc > NOW() - INTERVAL '1 hour'
      AND http_err IS NULL
    GROUP BY device_id
  ` as any[];

  const speedStats = await sql`
    SELECT DISTINCT ON (sr.device_id) sr.device_id,
           sr.download_mbps, sr.upload_mbps, sr.ping_ms
    FROM speed_results sr
    JOIN devices d ON d.device_id = sr.device_id
    WHERE d.tenant_id = ${tenantId}::uuid
      AND sr.error IS NULL
      AND sr.ts_utc > NOW() - INTERVAL '1 hour'
    ORDER BY sr.device_id, sr.ts_utc DESC
  ` as any[];

  const webByDevice = new Map(webStats.map((r: any) => [r.device_id, r]));
  const speedByDevice = new Map(speedStats.map((r: any) => [r.device_id, r]));

  const siteMap = new Map<string, any>();
  for (const d of devices) {
    const key = d.site_name || 'Unassigned';
    const mins = d.last_seen ? (Date.now() - new Date(d.last_seen).getTime()) / 60000 : Infinity;
    const online_status = d.status === 'provisioned' || d.status === 'unclaimed' ? 'unclaimed'
      : mins < 5 ? 'online' : mins < 30 ? 'idle' : 'offline';
    const web = webByDevice.get(d.device_id);
    const speed = speedByDevice.get(d.device_id);
    if (!siteMap.has(key)) siteMap.set(key, { site_name: key, address: d.address, devices: [], online: 0, idle: 0, offline: 0 });
    const site = siteMap.get(key);
    if (online_status === 'online') site.online++;
    else if (online_status === 'idle') site.idle++;
    else if (online_status === 'offline') site.offline++;
    site.devices.push({
      device_id: d.device_id, nr_serial: d.nr_serial, nickname: d.nickname,
      location: d.location, online_status, last_seen: d.last_seen, last_ip: d.last_ip,
      avg_dns_ms: web ? Number(web.avg_dns_ms) : null,
      avg_http_ms: web ? Number(web.avg_http_ms) : null,
      download_mbps: speed ? Number(speed.download_mbps) : null,
      upload_mbps: speed ? Number(speed.upload_mbps) : null,
      sla_alerts: 0,
    });
  }

  const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((a: number, b: number) => a + b, 0) / arr.length) : null;
  const sites = Array.from(siteMap.values()).map((site: any) => {
    const devs = site.devices;
    const dnsVals  = devs.map((d: any) => d.avg_dns_ms).filter((v: any) => v !== null);
    const httpVals = devs.map((d: any) => d.avg_http_ms).filter((v: any) => v !== null);
    const dlVals   = devs.map((d: any) => d.download_mbps).filter((v: any) => v !== null);
    const ulVals   = devs.map((d: any) => d.upload_mbps).filter((v: any) => v !== null);
    const worst = site.offline > 0 ? 'offline' : site.idle > 0 ? 'idle' : site.online > 0 ? 'online' : 'unclaimed';
    return {
      site_name: site.site_name, address: site.address,
      devices_total: devs.length, devices_online: site.online,
      devices_idle: site.idle, devices_offline: site.offline,
      worst_status: worst, sla_alerts: 0,
      avg_dns_ms: avg(dnsVals), avg_http_ms: avg(httpVals),
      avg_download_mbps: avg(dlVals), avg_upload_mbps: avg(ulVals),
      devices: devs,
    };
  });

  const order: Record<string, number> = { offline: 0, idle: 1, online: 2, unclaimed: 3 };
  sites.sort((a: any, b: any) => order[a.worst_status] - order[b.worst_status]);

  const totalOnline  = sites.reduce((a: number, s: any) => a + s.devices_online, 0);
  const totalOffline = sites.reduce((a: number, s: any) => a + s.devices_offline, 0);
  const totalIdle    = sites.reduce((a: number, s: any) => a + s.devices_idle, 0);
  const health = totalOffline === 0 ? 'healthy' : totalOnline === 0 ? 'critical' : 'degraded';

  return {
    generated_at: new Date().toISOString(),
    total_sites: sites.length, total_devices: devices.length,
    total_online: totalOnline, total_idle: totalIdle, total_offline: totalOffline,
    health, sites,
  };
}

async function getNocAlerts(tenantId: string, hours: number) {
  const offline = await sql`
    SELECT device_id, nickname, last_seen, last_ip,
      EXTRACT(EPOCH FROM (NOW() - last_seen))/3600 AS hours_offline
    FROM devices
    WHERE tenant_id = ${tenantId}::uuid
      AND last_seen < NOW() - INTERVAL '1 hour'
      AND status != 'provisioned'
    ORDER BY last_seen ASC
  ` as any[];
  const gaps = await sql`
    SELECT device_id, last_seen,
      EXTRACT(EPOCH FROM (NOW() - last_seen))/60 AS minutes_since_heartbeat
    FROM devices
    WHERE tenant_id = ${tenantId}::uuid
      AND last_seen BETWEEN NOW() - (${hours} || ' hours')::interval AND NOW() - INTERVAL '10 minutes'
    ORDER BY last_seen ASC
  ` as any[];
  const alerts = [
    ...offline.map((d: any) => ({ level: "error", type: "device_offline", device_id: d.device_id, nickname: d.nickname, message: `Offline for ${parseFloat(d.hours_offline).toFixed(1)} hours`, last_seen: d.last_seen })),
    ...gaps.map((d: any) => ({ level: "warning", type: "heartbeat_gap", device_id: d.device_id, message: `No heartbeat for ${parseFloat(d.minutes_since_heartbeat).toFixed(0)} minutes`, last_seen: d.last_seen })),
  ];
  return { alert_count: alerts.length, alerts };
}

async function getNocEventLog(tenantId: string, deviceId?: string, limit: number = 50) {
  const rows = deviceId
    ? await sql`SELECT device_id, last_seen AS ts, status, last_ip FROM devices WHERE tenant_id = ${tenantId}::uuid AND device_id = ${deviceId} LIMIT ${limit}` as any[]
    : await sql`SELECT device_id, last_seen AS ts, status, last_ip FROM devices WHERE tenant_id = ${tenantId}::uuid ORDER BY last_seen DESC LIMIT ${limit}` as any[];
  return { event_count: rows.length, events: rows };
}

// ── RouterRunner Extras ──────────────────────────────────────────────────────

async function getRouterunnerConfig(deviceId: string, tenantId: string) {
  if (!(await verifyDeviceTenant(deviceId, tenantId))) return { error: `Device ${deviceId} not found.` };
  const rows = await sql`SELECT * FROM device_config WHERE device_id = ${deviceId} LIMIT 1` as any[];
  return rows[0] ?? { device_id: deviceId, message: "No config found — using defaults." };
}

async function setRouterunnerConfig(deviceId: string, tenantId: string, args: Record<string, unknown>) {
  if (!(await verifyDeviceTenant(deviceId, tenantId))) return { error: `Device ${deviceId} not found.` };
  await sql`
    INSERT INTO device_config (device_id, route_trace_interval_seconds, updated_at)
    VALUES (${deviceId}, ${args.trace_interval_seconds as number ?? 300}, NOW())
    ON CONFLICT (device_id) DO UPDATE SET
      route_trace_interval_seconds = EXCLUDED.route_trace_interval_seconds,
      updated_at = NOW()
  `;
  return { success: true, updated_fields: Object.keys(args).filter(k => k !== "device_id") };
}

async function getRouterunnerLive(deviceId: string, tenantId: string) {
  if (!(await verifyDeviceTenant(deviceId, tenantId))) return { error: `Device ${deviceId} not found.` };
  const trace = await sql`
    SELECT id, ts_utc, target, dest_ip, hop_count
    FROM route_traces WHERE device_id = ${deviceId}
    ORDER BY ts_utc DESC LIMIT 1
  ` as any[];
  if (!trace[0]) return { device_id: deviceId, message: "No traces yet." };
  const hops = await sql`
    SELECT hop_num, ip, hostname, rtt_ms, isp, city, country, timeout
    FROM route_hops WHERE trace_id = ${trace[0].id} ORDER BY hop_num
  ` as any[];
  return { device_id: deviceId, traced_at: trace[0].ts_utc, target: trace[0].target, dest_ip: trace[0].dest_ip, hop_count: trace[0].hop_count, hops };
}

// ── SpeedRunner Extras ───────────────────────────────────────────────────────

async function getSpeedrunnerConfig(deviceId: string, tenantId: string) {
  if (!(await verifyDeviceTenant(deviceId, tenantId))) return { error: `Device ${deviceId} not found.` };
  const rows = await sql`SELECT * FROM device_config WHERE device_id = ${deviceId} LIMIT 1` as any[];
  return rows[0] ?? { device_id: deviceId, message: "No config found — using defaults." };
}

async function setSpeedrunnerConfig(deviceId: string, tenantId: string, args: Record<string, unknown>) {
  if (!(await verifyDeviceTenant(deviceId, tenantId))) return { error: `Device ${deviceId} not found.` };
  await sql`
    INSERT INTO device_config (device_id, speed_test_interval_seconds, speed_test_server_url, updated_at)
    VALUES (${deviceId}, ${args.test_interval_seconds as number ?? 3600}, ${args.server_url as string ?? null}, NOW())
    ON CONFLICT (device_id) DO UPDATE SET
      speed_test_interval_seconds = COALESCE(EXCLUDED.speed_test_interval_seconds, device_config.speed_test_interval_seconds),
      speed_test_server_url = COALESCE(EXCLUDED.speed_test_server_url, device_config.speed_test_server_url),
      updated_at = NOW()
  `;
  return { success: true, updated_fields: Object.keys(args).filter(k => k !== "device_id") };
}

async function getSpeedrunnerLive(deviceId: string, tenantId: string) {
  if (!(await verifyDeviceTenant(deviceId, tenantId))) return { error: `Device ${deviceId} not found.` };
  const rows = await sql`
    SELECT ts_utc, download_mbps, upload_mbps, ping_ms, jitter_ms, server_name, server_city
    FROM speed_results WHERE device_id = ${deviceId} AND error IS NULL
    ORDER BY ts_utc DESC LIMIT 1
  ` as any[];
  return rows[0] ?? { device_id: deviceId, message: "No speed results yet." };
}

// ── WebRunner Extras ─────────────────────────────────────────────────────────

async function getWebrunnerConfig(deviceId: string, tenantId: string) {
  if (!(await verifyDeviceTenant(deviceId, tenantId))) return { error: `Device ${deviceId} not found.` };
  const rows = await sql`SELECT * FROM device_config WHERE device_id = ${deviceId} LIMIT 1` as any[];
  return rows[0] ?? { device_id: deviceId, message: "No config found — using defaults." };
}

async function setWebrunnerConfig(deviceId: string, tenantId: string, args: Record<string, unknown>) {
  if (!(await verifyDeviceTenant(deviceId, tenantId))) return { error: `Device ${deviceId} not found.` };
  await sql`
    INSERT INTO device_config (device_id, webrunner_check_interval_seconds, updated_at)
    VALUES (${deviceId}, ${args.check_interval_seconds as number ?? 60}, NOW())
    ON CONFLICT (device_id) DO UPDATE SET
      webrunner_check_interval_seconds = EXCLUDED.webrunner_check_interval_seconds,
      updated_at = NOW()
  `;
  return { success: true, updated_fields: Object.keys(args).filter(k => k !== "device_id") };
}

async function getWebrunnerLive(deviceId: string, tenantId: string) {
  if (!(await verifyDeviceTenant(deviceId, tenantId))) return { error: `Device ${deviceId} not found.` };
  const results = await sql`
    SELECT url, http_ms AS latency_ms, dns_ms, status_code, http_err, ts_utc
    FROM measurements
    WHERE device_id = ${deviceId}
      AND ts_utc = (SELECT MAX(ts_utc) FROM measurements WHERE device_id = ${deviceId})
    ORDER BY url
  ` as any[];
  return {
    device_id: deviceId,
    ts_utc: results[0]?.ts_utc ?? null,
    results: results.map((r: any) => ({ url: r.url, status_code: r.status_code, latency_ms: r.latency_ms, dns_ms: r.dns_ms, up: !r.http_err })),
  };
}

// ── Sites ────────────────────────────────────────────────────────────────────

const SITES_TOOLS: MCPTool[] = [
  {
    name: "list_sites",
    description: "List all sites for this tenant. Returns site name, address, district, city, state, coordinates, device count, and online device count.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_site",
    description: "Get a single site by ID including all devices assigned to it.",
    inputSchema: { type: "object", properties: {
      site_id: { type: "string", description: "The site UUID." },
    }, required: ["site_id"] },
  },
  {
    name: "create_site",
    description: "Create a new site for this tenant.",
    inputSchema: { type: "object", properties: {
      name:     { type: "string", description: "Site name (e.g. Washington Elementary)." },
      address:  { type: "string", description: "Street address." },
      district: { type: "string", description: "District or organization name." },
      city:     { type: "string", description: "City." },
      state:    { type: "string", description: "State." },
      lat:      { type: "number", description: "Latitude." },
      lng:      { type: "number", description: "Longitude." },
    }, required: ["name"] },
  },
  {
    name: "update_site",
    description: "Update an existing site's details.",
    inputSchema: { type: "object", properties: {
      site_id:  { type: "string", description: "The site UUID." },
      name:     { type: "string", description: "New site name." },
      address:  { type: "string", description: "New address." },
      district: { type: "string", description: "New district." },
      city:     { type: "string", description: "New city." },
      state:    { type: "string", description: "New state." },
    }, required: ["site_id"] },
  },
];

MCP_TOOLS.push(...SITES_TOOLS);

// ── Sites Handlers ───────────────────────────────────────────────────────────

async function listSites(tenantId: string) {
  const rows = await sql`
    SELECT s.id, s.name, s.address, s.district, s.city, s.state, s.lat, s.lng,
      COUNT(d.device_id)::int AS device_count,
      COUNT(CASE WHEN d.last_seen > NOW() - INTERVAL '3 minutes' THEN 1 END)::int AS devices_online
    FROM sites s
    LEFT JOIN devices d ON d.site_name = s.name AND d.tenant_id = ${tenantId}::uuid
    WHERE s.tenant_id = ${tenantId}::uuid
    GROUP BY s.id ORDER BY s.name
  ` as any[];
  return { site_count: rows.length, sites: rows };
}

async function getSite(siteId: string, tenantId: string) {
  const rows = await sql`
    SELECT s.*, COUNT(d.device_id)::int AS device_count
    FROM sites s
    LEFT JOIN devices d ON d.site_name = s.name AND d.tenant_id = ${tenantId}::uuid
    WHERE s.id = ${siteId}::uuid AND s.tenant_id = ${tenantId}::uuid
    GROUP BY s.id
  ` as any[];
  if (rows.length === 0) return { error: `Site ${siteId} not found.` };
  return rows[0];
}

async function createSite(tenantId: string, args: Record<string, unknown>) {
  const { name, address, district, city, state, lat, lng } = args;
  if (!name) return { error: "name is required" };
  const rows = await sql`
    INSERT INTO sites (tenant_id, name, address, district, city, state, lat, lng)
    VALUES (${tenantId}::uuid, ${name as string}, ${address as string ?? null},
            ${district as string ?? null}, ${city as string ?? null},
            ${state as string ?? null}, ${lat as number ?? null}, ${lng as number ?? null})
    RETURNING *
  ` as any[];
  return { ok: true, site: rows[0] };
}

async function updateSite(siteId: string, tenantId: string, args: Record<string, unknown>) {
  const { name, address, district, city, state } = args;
  const rows = await sql`
    UPDATE sites SET
      name     = COALESCE(${name as string ?? null}, name),
      address  = COALESCE(${address as string ?? null}, address),
      district = COALESCE(${district as string ?? null}, district),
      city     = COALESCE(${city as string ?? null}, city),
      state    = COALESCE(${state as string ?? null}, state),
      updated_at = NOW()
    WHERE id = ${siteId}::uuid AND tenant_id = ${tenantId}::uuid
    RETURNING *
  ` as any[];
  if (rows.length === 0) return { error: `Site ${siteId} not found.` };
  return { ok: true, site: rows[0] };
}
