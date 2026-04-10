
// ── Global Runner Config Tools ───────────────────────────────────────────────

const RUNNER_CONFIG_TOOLS: MCPTool[] = [
  {
    name: "get_global_runner_config",
    description: "Get the tenant-wide global runner config. This is the fleet default that all VGER 1 appliances use unless a device-level override exists. Optionally filter to a single runner type.",
    inputSchema: {
      type: "object",
      properties: {
        runner_type: { type: "string", enum: ["speedrunner", "blerunner", "rfrunner", "webrunner", "routerunner"], description: "Optional: filter to a specific runner. Returns all runners if omitted." },
      },
    },
  },
  {
    name: "set_global_runner_config",
    description: "Update the tenant-wide global config for a runner. All devices without a device-level override will immediately use this config on their next heartbeat.",
    inputSchema: {
      type: "object",
      properties: {
        runner_type: { type: "string", enum: ["speedrunner", "blerunner", "rfrunner", "webrunner", "routerunner"], description: "The runner to configure." },
        config:      { type: "object", description: "Config object for the runner. Keys depend on runner type (e.g. interval_seconds, scan_enabled, urls, targets)." },
      },
      required: ["runner_type", "config"],
    },
  },
  {
    name: "get_device_runner_config",
    description: "Get runner config for a specific device. Returns config_source ('device' or 'global') per runner so you can see which devices are using overrides vs fleet defaults.",
    inputSchema: {
      type: "object",
      properties: {
        device_id:   { type: "string", description: "The device ID." },
        runner_type: { type: "string", enum: ["speedrunner", "blerunner", "rfrunner", "webrunner", "routerunner"], description: "Optional: filter to a specific runner. Returns all runners if omitted." },
      },
      required: ["device_id"],
    },
  },
  {
    name: "set_device_runner_config",
    description: "Set a device-level runner config override. This device will use this config instead of the global fleet default. Other devices are unaffected.",
    inputSchema: {
      type: "object",
      properties: {
        device_id:   { type: "string", description: "The device ID." },
        runner_type: { type: "string", enum: ["speedrunner", "blerunner", "rfrunner", "webrunner", "routerunner"], description: "The runner to override." },
        config:      { type: "object", description: "Device-specific config object for this runner." },
      },
      required: ["device_id", "runner_type", "config"],
    },
  },
  {
    name: "delete_device_runner_config",
    description: "Remove a device-level runner config override. The device will revert to the tenant global config for that runner.",
    inputSchema: {
      type: "object",
      properties: {
        device_id:   { type: "string", description: "The device ID." },
        runner_type: { type: "string", enum: ["speedrunner", "blerunner", "rfrunner", "webrunner", "routerunner"], description: "The runner override to remove." },
      },
      required: ["device_id", "runner_type"],
    },
  },
];

MCP_TOOLS.push(...RUNNER_CONFIG_TOOLS);

// ── Global Runner Config Handlers ────────────────────────────────────────────

const RUNNER_DEFAULTS_MCP: Record<string, object> = {
  speedrunner: { interval_seconds: 3600, regions: ["Northeast US", "Southeast US", "Midwest US", "West Coast US", "Europe", "Asia Pacific"] },
  blerunner:   { scan_enabled: true, scan_interval: 60 },
  rfrunner:    { scan_enabled: true, scan_interval: 60, active_enabled: false, active_ssid: "", active_psk: "", active_interval: 1800 },
  webrunner:   { urls: ["https://www.google.com/generate_204"], interval_seconds: 300, timeout_seconds: 10 },
  routerunner: { targets: ["8.8.8.8", "1.1.1.1"], interval_seconds: 300 },
};

const ALL_RUNNER_TYPES = ["speedrunner", "blerunner", "rfrunner", "webrunner", "routerunner"];

async function getGlobalRunnerConfig(tenantId: string, runnerType?: string) {
  if (runnerType) {
    const rows = await sql`
      SELECT runner_type, config, updated_at, updated_by
      FROM global_runner_config
      WHERE tenant_id = ${tenantId}::uuid AND runner_type = ${runnerType}
      LIMIT 1
    ` as any[];
    const config = rows.length ? rows[0].config : RUNNER_DEFAULTS_MCP[runnerType];
    return { runner_type: runnerType, config, config_source: rows.length ? "global" : "default", updated_at: rows[0]?.updated_at ?? null };
  }

  const rows = await sql`
    SELECT runner_type, config, updated_at FROM global_runner_config
    WHERE tenant_id = ${tenantId}::uuid
  ` as any[];

  const result: Record<string, any> = {};
  for (const rt of ALL_RUNNER_TYPES) {
    const row = rows.find((r: any) => r.runner_type === rt);
    result[rt] = { config: row ? row.config : RUNNER_DEFAULTS_MCP[rt], config_source: row ? "global" : "default", updated_at: row?.updated_at ?? null };
  }
  return { configs: result };
}

async function setGlobalRunnerConfig(tenantId: string, runnerType: string, config: object) {
  if (!ALL_RUNNER_TYPES.includes(runnerType)) return { error: `Invalid runner_type: ${runnerType}` };
  const rows = await sql`
    INSERT INTO global_runner_config (tenant_id, runner_type, config, updated_at, updated_by)
    VALUES (${tenantId}::uuid, ${runnerType}, ${JSON.stringify(config)}::jsonb, NOW(), 'mcp')
    ON CONFLICT (tenant_id, runner_type) DO UPDATE SET
      config     = EXCLUDED.config,
      updated_at = NOW(),
      updated_by = 'mcp'
    RETURNING runner_type, config, updated_at
  ` as any[];
  return { ok: true, runner_type: runnerType, config: rows[0].config, updated_at: rows[0].updated_at, message: `Global ${runnerType} config updated — all devices without overrides will use this on next heartbeat.` };
}

async function getDeviceRunnerConfig(deviceId: string, tenantId: string, runnerType?: string) {
  const deviceCheck = await sql`
    SELECT device_id FROM devices WHERE device_id = ${deviceId} AND tenant_id = ${tenantId}::uuid LIMIT 1
  ` as any[];
  if (!deviceCheck.length) return { error: `Device ${deviceId} not found.` };

  const rows = await sql`
    SELECT runner_type, config, updated_at FROM device_runner_config
    WHERE device_id = ${deviceId} AND tenant_id = ${tenantId}::uuid
    ${runnerType ? sql`AND runner_type = ${runnerType}` : sql``}
  ` as any[];

  if (runnerType) {
    const row = rows.find((r: any) => r.runner_type === runnerType);
    return { device_id: deviceId, runner_type: runnerType, config: row?.config ?? null, config_source: row ? "device" : "global", updated_at: row?.updated_at ?? null };
  }

  const result: Record<string, any> = {};
  for (const rt of ALL_RUNNER_TYPES) {
    const row = rows.find((r: any) => r.runner_type === rt);
    result[rt] = { config: row?.config ?? null, config_source: row ? "device" : "global", updated_at: row?.updated_at ?? null };
  }
  return { device_id: deviceId, runners: result };
}

async function setDeviceRunnerConfig(deviceId: string, tenantId: string, runnerType: string, config: object) {
  if (!ALL_RUNNER_TYPES.includes(runnerType)) return { error: `Invalid runner_type: ${runnerType}` };
  const deviceCheck = await sql`
    SELECT device_id FROM devices WHERE device_id = ${deviceId} AND tenant_id = ${tenantId}::uuid LIMIT 1
  ` as any[];
  if (!deviceCheck.length) return { error: `Device ${deviceId} not found.` };

  const rows = await sql`
    INSERT INTO device_runner_config (device_id, tenant_id, runner_type, config, updated_at, updated_by)
    VALUES (${deviceId}, ${tenantId}::uuid, ${runnerType}, ${JSON.stringify(config)}::jsonb, NOW(), 'mcp')
    ON CONFLICT (device_id, runner_type) DO UPDATE SET
      config     = EXCLUDED.config,
      updated_at = NOW(),
      updated_by = 'mcp'
    RETURNING runner_type, config, updated_at
  ` as any[];
  return { ok: true, device_id: deviceId, runner_type: runnerType, config: rows[0].config, config_source: "device", updated_at: rows[0].updated_at };
}

async function deleteDeviceRunnerConfig(deviceId: string, tenantId: string, runnerType: string) {
  if (!ALL_RUNNER_TYPES.includes(runnerType)) return { error: `Invalid runner_type: ${runnerType}` };
  await sql`
    DELETE FROM device_runner_config
    WHERE device_id = ${deviceId} AND tenant_id = ${tenantId}::uuid AND runner_type = ${runnerType}
  `;
  return { ok: true, device_id: deviceId, runner_type: runnerType, config_source: "global", message: `Device override removed — ${deviceId} now uses global ${runnerType} config.` };
}
