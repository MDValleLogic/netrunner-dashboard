"use client";

import React, { useEffect, useState, useRef } from "react";
import DashboardShell from "@/components/DashboardShell";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Device {
  device_id: string;
  nickname: string;
  last_ip: string;
  status: string;
  site_name: string | null;
  site_id: string | null;
  building: string | null;
  floor: string | null;
}

interface CommandResult {
  id: string;
  device_id: string;
  device_name: string;
  protocol: string;
  target: string;
  command: string;
  status: "pending" | "running" | "complete" | "failed";
  output: string | null;
  started_at: string;
  completed_at: string | null;
}

type Protocol = "CLI" | "SNMP" | "DISCOVERY";

// ── Hierarchy grouping ────────────────────────────────────────────────────────

interface BuildingGroup {
  building: string;
  devices: Device[];
}

interface SiteGroup {
  site_name: string;
  buildings: BuildingGroup[];
}

function groupDevices(devices: Device[]): SiteGroup[] {
  const siteMap = new Map<string, Map<string, Device[]>>();

  for (const d of devices) {
    const site     = d.site_name || "Unassigned";
    const building = d.building  || "—";
    if (!siteMap.has(site)) siteMap.set(site, new Map());
    const bMap = siteMap.get(site)!;
    if (!bMap.has(building)) bMap.set(building, []);
    bMap.get(building)!.push(d);
  }

  return Array.from(siteMap.entries()).map(([site_name, bMap]) => ({
    site_name,
    buildings: Array.from(bMap.entries()).map(([building, devs]) => ({
      building,
      devices: devs,
    })),
  }));
}

// ── Vendors / Commands ────────────────────────────────────────────────────────

const VENDORS = [
  { label: "Extreme EXOS",       value: "extreme"        },
  { label: "Extreme VOSS",       value: "extreme_voss"   },
  { label: "Cisco IOS/IOS-XE",  value: "cisco_ios"      },
  { label: "Cisco Nexus",        value: "cisco_nxos"     },
  { label: "Cisco IOS-XR",      value: "cisco_iosxr"    },
  { label: "Cisco WLC",          value: "cisco_wlc"      },
  { label: "Juniper JunOS",      value: "juniper_junos"  },
  { label: "HPE ProCurve/Aruba", value: "hp_procurve"    },
  { label: "HPE Comware",        value: "hp_comware"     },
];

const CLI_QUICK_COMMANDS: Record<string, string[]> = {
  extreme:        ["show version", "show ports stats", "show vlan", "show ipconfig", "show switch", "show log"],
  extreme_voss:   ["show sys-info", "show interfaces gigabitEthernet", "show vlan", "show ip route"],
  cisco_ios:      ["show version", "show interfaces", "show ip interface brief", "show running-config", "show cdp neighbors"],
  cisco_nxos:     ["show version", "show interfaces", "show vlan brief", "show ip route"],
  cisco_iosxr:    ["show version", "show interfaces", "show ip route"],
  cisco_wlc:      ["show sysinfo", "show ap summary", "show client summary"],
  juniper_junos:  ["show version", "show interfaces", "show route", "show bgp summary"],
  hp_procurve:    ["show version", "show interfaces", "show vlan"],
  hp_comware:     ["display version", "display interface", "display vlan all"],
};

const SNMP_QUICK_OIDS = [
  { label: "System Name",        value: "sysName"        },
  { label: "System Description", value: "sysDescr"       },
  { label: "System Uptime",      value: "sysUpTime"      },
  { label: "Interface Table",    value: "ifTable"        },
  { label: "Interface Status",   value: "ifOperStatus"   },
  { label: "In Errors",          value: "ifInErrors"     },
  { label: "Out Errors",         value: "ifOutErrors"    },
  { label: "CPU Load",           value: "hrProcessorLoad"},
  { label: "Memory Size",        value: "hrMemorySize"   },
];

// ── Styles ────────────────────────────────────────────────────────────────────

const CYAN   = "#33FF00";
const AMBER  = "#FFB800";
const RED    = "#FF3B3B";
const GREEN  = "#00E87A";
const DIM    = "rgba(0,229,204,0.15)";
const BORDER = "rgba(0,229,204,0.2)";

const styles: Record<string, React.CSSProperties> = {
  page: {
    background: "#0A0A0A",
    minHeight: "100vh",
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
    color: "#E0F7F5",
    padding: "0",
  },
  topbar: {
    borderBottom: `1px solid ${BORDER}`,
    padding: "20px 32px",
    display: "flex",
    alignItems: "center",
    gap: 16,
    background: "rgba(0,229,204,0.03)",
  },
  title: {
    fontSize: 28,
    fontWeight: 800,
    color: CYAN,
    letterSpacing: "-0.02em",
    margin: 0,
  },
  subtitle: {
    fontSize: 13,
    color: "rgba(0,229,204,0.5)",
    marginTop: 2,
    letterSpacing: "0.1em",
    textTransform: "uppercase" as const,
  },
  body: {
    display: "grid",
    gridTemplateColumns: "420px 1fr",
    gap: 0,
    height: "calc(100vh - 85px)",
  },
  leftPanel: {
    borderRight: `1px solid ${BORDER}`,
    overflowY: "auto" as const,
    padding: "24px 20px",
    display: "flex",
    flexDirection: "column" as const,
    gap: 20,
  },
  rightPanel: {
    display: "flex",
    flexDirection: "column" as const,
    overflow: "hidden",
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.2em",
    color: CYAN,
    textTransform: "uppercase" as const,
    marginBottom: 10,
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  sectionNum: {
    width: 20,
    height: 20,
    borderRadius: "50%",
    background: CYAN,
    color: "#030810",
    fontSize: 10,
    fontWeight: 900,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    background: "rgba(0,229,204,0.04)",
    border: `1px solid ${BORDER}`,
    borderRadius: 8,
    padding: "16px 18px",
  },
  input: {
    width: "100%",
    background: "#060F1A",
    border: `1px solid ${BORDER}`,
    borderRadius: 6,
    color: "#E0F7F5",
    fontSize: 14,
    padding: "10px 12px",
    fontFamily: "inherit",
    outline: "none",
    boxSizing: "border-box" as const,
  },
  select: {
    width: "100%",
    background: "#060F1A",
    border: `1px solid ${BORDER}`,
    borderRadius: 6,
    color: "#E0F7F5",
    fontSize: 14,
    padding: "10px 12px",
    fontFamily: "inherit",
    outline: "none",
    cursor: "pointer",
    appearance: "none" as const,
    boxSizing: "border-box" as const,
  },
  fieldLabel: {
    fontSize: 11,
    color: "rgba(0,229,204,0.6)",
    letterSpacing: "0.1em",
    textTransform: "uppercase" as const,
    marginBottom: 6,
    display: "block",
  },
  runButton: {
    width: "100%",
    padding: "14px",
    background: `linear-gradient(135deg, ${CYAN}22, ${CYAN}11)`,
    border: `1.5px solid ${CYAN}`,
    borderRadius: 8,
    color: CYAN,
    fontSize: 16,
    fontWeight: 800,
    cursor: "pointer",
    fontFamily: "inherit",
    letterSpacing: "0.1em",
    textTransform: "uppercase" as const,
    transition: "all 0.15s",
  },
  outputHeader: {
    padding: "16px 24px",
    borderBottom: `1px solid ${BORDER}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    background: "rgba(0,229,204,0.02)",
  },
  terminal: {
    flex: 1,
    overflowY: "auto" as const,
    padding: "20px 24px",
    display: "flex",
    flexDirection: "column" as const,
    gap: 16,
  },
};

// ── Checkbox helper ───────────────────────────────────────────────────────────

function Checkbox({ checked, partial, onChange }: { checked: boolean; partial?: boolean; onChange: () => void }) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onChange(); }}
      style={{
        width: 16, height: 16, borderRadius: 3, flexShrink: 0,
        border: `1.5px solid ${checked || partial ? CYAN : BORDER}`,
        background: checked ? CYAN : partial ? `${CYAN}44` : "transparent",
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer", padding: 0,
      }}
    >
      {checked && <span style={{ color: "#030810", fontSize: 10, fontWeight: 900, lineHeight: 1 }}>✓</span>}
      {partial && !checked && <span style={{ color: CYAN, fontSize: 10, fontWeight: 900, lineHeight: 1 }}>−</span>}
    </button>
  );
}

// ── Device Row ────────────────────────────────────────────────────────────────

function DeviceRow({ device, selected, onToggle }: { device: Device; selected: boolean; onToggle: () => void }) {
  const online = device.status === "claimed";
  return (
    <button
      onClick={onToggle}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "9px 10px 9px 28px",
        background: selected ? `${CYAN}10` : "transparent",
        border: `1px solid ${selected ? CYAN + "66" : "transparent"}`,
        borderRadius: 5, cursor: "pointer", fontFamily: "inherit",
        textAlign: "left", width: "100%", transition: "all 0.12s",
      }}
    >
      <div style={{
        width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
        background: online ? GREEN : RED,
        boxShadow: online ? `0 0 5px ${GREEN}` : `0 0 5px ${RED}`,
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: selected ? CYAN : "#E0F7F5", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {device.nickname || device.device_id}
        </div>
        <div style={{ fontSize: 10, color: "rgba(224,247,245,0.35)", marginTop: 1 }}>
          {device.last_ip}{device.floor ? ` · ${device.floor}` : ""}
        </div>
      </div>
      <Checkbox checked={selected} onChange={onToggle} />
    </button>
  );
}

// ── Building Group ────────────────────────────────────────────────────────────

function BuildingGroup({ group, selected, onToggleAll, onToggleDevice }: {
  group: BuildingGroup;
  selected: Set<string>;
  onToggleAll: () => void;
  onToggleDevice: (id: string) => void;
}) {
  const ids       = group.devices.map(d => d.device_id);
  const selCount  = ids.filter(id => selected.has(id)).length;
  const allSel    = selCount === ids.length;
  const partSel   = selCount > 0 && selCount < ids.length;

  if (group.building === "—") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {group.devices.map(d => (
          <DeviceRow key={d.device_id} device={d} selected={selected.has(d.device_id)} onToggle={() => onToggleDevice(d.device_id)} />
        ))}
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 4 }}>
      <button
        onClick={onToggleAll}
        style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "6px 10px 6px 16px", width: "100%",
          background: "transparent", border: "none",
          cursor: "pointer", fontFamily: "inherit",
        }}
      >
        <Checkbox checked={allSel} partial={partSel} onChange={onToggleAll} />
        <span style={{ fontSize: 10, color: "rgba(0,229,204,0.5)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
          ■ {group.building}
        </span>
        <span style={{ fontSize: 9, color: "rgba(224,247,245,0.25)", marginLeft: "auto" }}>
          {selCount}/{ids.length}
        </span>
      </button>
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {group.devices.map(d => (
          <DeviceRow key={d.device_id} device={d} selected={selected.has(d.device_id)} onToggle={() => onToggleDevice(d.device_id)} />
        ))}
      </div>
    </div>
  );
}

// ── Site Group ────────────────────────────────────────────────────────────────

function SiteGroup({ group, selected, onToggleAll, onToggleBuilding, onToggleDevice }: {
  group: SiteGroup;
  selected: Set<string>;
  onToggleAll: () => void;
  onToggleBuilding: (building: string) => void;
  onToggleDevice: (id: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const allIds   = group.buildings.flatMap(b => b.devices.map(d => d.device_id));
  const selCount = allIds.filter(id => selected.has(id)).length;
  const allSel   = selCount === allIds.length;
  const partSel  = selCount > 0 && selCount < allIds.length;

  return (
    <div style={{
      background: "rgba(0,229,204,0.03)",
      border: `1px solid ${BORDER}`,
      borderRadius: 7, marginBottom: 8, overflow: "hidden",
    }}>
      <button
        onClick={() => setCollapsed(!collapsed)}
        style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "10px 12px", width: "100%",
          background: "rgba(0,229,204,0.05)", border: "none",
          cursor: "pointer", fontFamily: "inherit",
          borderBottom: collapsed ? "none" : `1px solid ${BORDER}`,
        }}
      >
        <Checkbox checked={allSel} partial={partSel} onChange={onToggleAll} />
        <span style={{ fontSize: 12, fontWeight: 800, color: CYAN, letterSpacing: "0.08em", flex: 1, textAlign: "left" }}>
          ◆ {group.site_name}
        </span>
        <span style={{ fontSize: 9, color: "rgba(224,247,245,0.3)", marginRight: 6 }}>
          {selCount}/{allIds.length} selected
        </span>
        <span style={{ fontSize: 10, color: "rgba(0,229,204,0.4)" }}>{collapsed ? "▶" : "▼"}</span>
      </button>
      {!collapsed && (
        <div style={{ padding: "8px 6px" }}>
          {group.buildings.map(b => (
            <BuildingGroup
              key={b.building}
              group={b}
              selected={selected}
              onToggleAll={() => onToggleBuilding(b.building)}
              onToggleDevice={onToggleDevice}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Protocol Tab ─────────────────────────────────────────────────────────────

function ProtocolTab({ label, icon, desc, active, onClick }: {
  label: string; icon: string; desc: string; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, padding: "14px 10px",
        background: active ? `${CYAN}15` : "transparent",
        border: `1px solid ${active ? CYAN : BORDER}`,
        borderRadius: 6, cursor: "pointer", fontFamily: "inherit",
        transition: "all 0.15s",
      }}
    >
      <div style={{ fontSize: 20, marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: 13, fontWeight: 800, color: active ? CYAN : "#9ECFCA", letterSpacing: "0.05em" }}>{label}</div>
      <div style={{ fontSize: 10, color: "rgba(224,247,245,0.35)", marginTop: 3, lineHeight: 1.4 }}>{desc}</div>
    </button>
  );
}

// ── Result Card ───────────────────────────────────────────────────────────────

function ResultCard({ result }: { result: CommandResult }) {
  const [expanded, setExpanded] = useState(true);
  const statusColor = { pending: AMBER, running: CYAN, complete: GREEN, failed: RED }[result.status];
  const statusLabel = { pending: "PENDING", running: "RUNNING", complete: "COMPLETE", failed: "FAILED" }[result.status];

  return (
    <div style={{
      background: "#060F1A",
      border: `1px solid ${result.status === "failed" ? RED + "44" : result.status === "complete" ? GREEN + "33" : BORDER}`,
      borderRadius: 8, overflow: "hidden",
    }}>
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "12px 16px", cursor: "pointer",
          background: "rgba(0,229,204,0.03)",
          borderBottom: expanded ? `1px solid ${BORDER}` : "none",
        }}
      >
        <div style={{
          width: 8, height: 8, borderRadius: "50%",
          background: statusColor, boxShadow: `0 0 6px ${statusColor}`,
          animation: result.status === "pending" || result.status === "running" ? "pulse 1.5s infinite" : "none",
        }} />
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#E0F7F5" }}>{result.device_name}</span>
          <span style={{ fontSize: 12, color: "rgba(224,247,245,0.4)", marginLeft: 10 }}>→ {result.target}</span>
          <span style={{ fontSize: 11, color: "rgba(224,247,245,0.3)", marginLeft: 10 }}>{result.command}</span>
        </div>
        <span style={{
          fontSize: 10, fontWeight: 800, letterSpacing: "0.12em",
          padding: "3px 8px", borderRadius: 4,
          background: `${statusColor}22`, color: statusColor,
          border: `1px solid ${statusColor}44`,
        }}>{statusLabel}</span>
        <span style={{ fontSize: 12, color: "rgba(224,247,245,0.3)" }}>{expanded ? "▲" : "▼"}</span>
      </div>
      {expanded && (
        <div style={{ padding: "14px 16px" }}>
          {(result.status === "pending" || result.status === "running") && (
            <div style={{ fontSize: 13, color: AMBER, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>◌</span>
              Waiting for Pi to pick up command...
            </div>
          )}
          {(result.status === "complete" || result.status === "failed") && (
            <pre style={{
              margin: 0, fontSize: 13, lineHeight: 1.7,
              color: result.status === "failed" ? "#FF8888" : "#A8F5E0",
              whiteSpace: "pre-wrap", wordBreak: "break-all",
              maxHeight: 400, overflowY: "auto", fontFamily: "inherit",
            }}>
              {result.output || (result.status === "failed" ? "Command failed — no output returned." : "Command completed with no output.")}
            </pre>
          )}
          <div style={{ marginTop: 10, fontSize: 10, color: "rgba(224,247,245,0.25)", letterSpacing: "0.05em" }}>
            STARTED {new Date(result.started_at).toLocaleTimeString()} · {result.protocol} · {result.device_id.slice(0, 12)}...
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function CommandRunnerV2() {
  const [devices, setDevices]     = useState<Device[]>([]);
  const [selected, setSelected]   = useState<Set<string>>(new Set());
  const [protocol, setProtocol]   = useState<Protocol>("CLI");
  const [vendor, setVendor]       = useState("extreme");
  const [targetIp, setTargetIp]   = useState("");
  const [username, setUsername]   = useState("");
  const [password, setPassword]   = useState("");
  const [command, setCommand]     = useState("show version");
  const [community, setCommunity] = useState("public");
  const [oid, setOid]             = useState("sysName");
  const [subnet, setSubnet]       = useState("");
  const [running, setRunning]     = useState(false);
  const [results, setResults]     = useState<CommandResult[]>([]);
  const pollRef                   = useRef<Record<string, NodeJS.Timeout>>({});

  useEffect(() => {
    if (!(window as any).JSZip) {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
      document.head.appendChild(s);
    }

    fetch("/api/devices")
      .then(r => r.json())
      .then(d => {
        const devs = d.devices ?? [];
        setDevices(devs);
        setResults(prev => prev.map(r => {
          const match = devs.find((d: Device) => d.device_id === r.device_id);
          return match ? { ...r, device_name: match.nickname || match.device_id } : r;
        }));
      })
      .catch(() => {});

    fetch("/api/commandrunner/execute?recent=5")
      .then(r => r.json())
      .then(d => {
        if (!d.commands) return;
        const loaded: CommandResult[] = d.commands.map((c: any) => ({
          id:           c.id,
          device_id:    c.device_id,
          device_name:  c.device_id,
          protocol:     c.command_type === "run_cli_command" ? "CLI" : c.command_type === "run_snmp_get" ? "SNMP" : "DISCOVERY",
          target:       c.payload?.target_ip || c.payload?.subnet || "—",
          command:      c.payload?.command || c.payload?.oid || c.payload?.subnet || "—",
          status:       c.status === "executing" ? "running" : c.status,
          output:       c.output ?? c.error ?? null,
          started_at:   c.created_at,
          completed_at: c.completed_at ?? null,
        }));
        setResults(loaded);
      })
      .catch(() => {});
  }, []);

  // ── Selection helpers ───────────────────────────────────────────────────────

  function toggleDevice(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === devices.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(devices.map(d => d.device_id)));
    }
  }

  function toggleSite(siteName: string) {
    const ids = devices.filter(d => (d.site_name || "Unassigned") === siteName).map(d => d.device_id);
    const allSel = ids.every(id => selected.has(id));
    setSelected(prev => {
      const next = new Set(prev);
      ids.forEach(id => allSel ? next.delete(id) : next.add(id));
      return next;
    });
  }

  function toggleBuilding(siteName: string, building: string) {
    const ids = devices
      .filter(d => (d.site_name || "Unassigned") === siteName && (d.building || "—") === building)
      .map(d => d.device_id);
    const allSel = ids.every(id => selected.has(id));
    setSelected(prev => {
      const next = new Set(prev);
      ids.forEach(id => allSel ? next.delete(id) : next.add(id));
      return next;
    });
  }

  // ── Poll for result ─────────────────────────────────────────────────────────

  function pollResult(commandId: string, deviceId: string) {
    pollRef.current[commandId] = setInterval(async () => {
      try {
        const res  = await fetch(`/api/commandrunner/execute?id=${commandId}`);
        const data = await res.json();
        if (data.status === "complete" || data.status === "failed") {
          setResults(prev => prev.map(r =>
            r.id === commandId
              ? { ...r, status: data.status, output: data.output, completed_at: data.completed_at }
              : r
          ));
          clearInterval(pollRef.current[commandId]);
          delete pollRef.current[commandId];
        }
      } catch {}
    }, 3000);
  }

  // ── Run ─────────────────────────────────────────────────────────────────────

  async function runCommands() {
    if (selected.size === 0) return alert("Select at least one device.");
    setRunning(true);

    const payload: Record<string, string> = { protocol };

    if (protocol === "CLI") {
      if (!targetIp || !username || !password || !command) {
        setRunning(false);
        return alert("Fill in all CLI fields.");
      }
      payload.target_ip = targetIp;
      payload.username  = username;
      payload.password  = password;
      payload.command   = command;
      payload.vendor    = vendor;
    } else if (protocol === "SNMP") {
      if (!targetIp) { setRunning(false); return alert("Enter target IP."); }
      payload.target_ip = targetIp;
      payload.community = community;
      payload.oid       = oid;
    } else {
      if (!subnet) { setRunning(false); return alert("Enter subnet."); }
      payload.subnet = subnet;
    }

    const cmdType = protocol === "CLI" ? "run_cli_command"
      : protocol === "SNMP" ? "run_snmp_get"
      : "run_network_discovery";

    const newResults: CommandResult[] = [];

    for (const deviceId of Array.from(selected)) {
      const device = devices.find(d => d.device_id === deviceId);
      try {
        const res  = await fetch("/api/commandrunner/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ device_id: deviceId, command_type: cmdType, payload }),
        });
        const data = await res.json();
        if (data.command_id) {
          const result: CommandResult = {
            id:           data.command_id,
            device_id:    deviceId,
            device_name:  device?.nickname || deviceId,
            protocol,
            target:       targetIp || subnet || "—",
            command:      command || oid || subnet,
            status:       "pending",
            output:       null,
            started_at:   new Date().toISOString(),
            completed_at: null,
          };
          newResults.push(result);
          pollResult(data.command_id, deviceId);
        }
      } catch (e) {
        console.error(e);
      }
    }

    setResults(prev => [...newResults, ...prev]);
    setRunning(false);
  }

  const quickCommands = CLI_QUICK_COMMANDS[vendor] ?? [];
  const siteGroups    = groupDevices(devices);

  return (
    <DashboardShell>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700;800&display=swap');
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes spin  { to{transform:rotate(360deg)} }
        ::-webkit-scrollbar { width:4px; background:transparent }
        ::-webkit-scrollbar-thumb { background:${BORDER}; border-radius:2px }
        select option { background:#060F1A; color:#E0F7F5 }
      `}</style>

      <div style={styles.page}>

        {/* TOP BAR */}
        <div style={styles.topbar}>
          <div style={{
            width: 44, height: 44, borderRadius: 10,
            background: `${CYAN}18`, border: `1.5px solid ${CYAN}44`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 20, color: CYAN, fontWeight: 900,
          }}>
            &gt;_
          </div>
          <div>
            <div style={styles.title}>CommandRunner</div>
            <div style={styles.subtitle}>CLI · SNMP · Discovery — Powered by NetRunner + Claude</div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 20 }}>
            {[
              { label: "DEVICES SELECTED", value: selected.size },
              { label: "COMMANDS RUN",     value: results.length },
              { label: "ONLINE",           value: devices.filter(d => d.status === "claimed").length },
            ].map(stat => (
              <div key={stat.label} style={{ textAlign: "right" }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: CYAN }}>{stat.value}</div>
                <div style={{ fontSize: 9, color: "rgba(0,229,204,0.4)", letterSpacing: "0.15em" }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={styles.body}>

          {/* LEFT PANEL */}
          <div style={styles.leftPanel}>

            {/* 1. SELECT DEVICES */}
            <div>
              <div style={styles.sectionLabel}>
                <div style={styles.sectionNum}>1</div>
                Select Devices
              </div>
              <div style={styles.card}>
                {/* SELECT ALL */}
                <button
                  onClick={toggleAll}
                  style={{
                    width: "100%", padding: "8px 12px", marginBottom: 12,
                    background: selected.size === devices.length && devices.length > 0 ? `${CYAN}15` : "transparent",
                    border: `1px solid ${BORDER}`, borderRadius: 6,
                    color: CYAN, fontSize: 12, fontWeight: 700,
                    cursor: "pointer", fontFamily: "inherit",
                    letterSpacing: "0.1em", textTransform: "uppercase",
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                  }}
                >
                  <span>{selected.size === devices.length && devices.length > 0 ? "✓ ALL SELECTED" : "SELECT ALL"}</span>
                  <span style={{ fontSize: 10, color: "rgba(0,229,204,0.4)" }}>{selected.size}/{devices.length}</span>
                </button>

                {/* HIERARCHY TREE */}
                {devices.length === 0
                  ? <div style={{ fontSize: 13, color: "rgba(224,247,245,0.3)", textAlign: "center", padding: 16 }}>Loading devices...</div>
                  : siteGroups.map(sg => (
                      <SiteGroup
                        key={sg.site_name}
                        group={sg}
                        selected={selected}
                        onToggleAll={() => toggleSite(sg.site_name)}
                        onToggleBuilding={(building) => toggleBuilding(sg.site_name, building)}
                        onToggleDevice={toggleDevice}
                      />
                    ))
                }
              </div>
            </div>

            {/* 2. SELECT PROTOCOL */}
            <div>
              <div style={styles.sectionLabel}>
                <div style={styles.sectionNum}>2</div>
                Select Protocol
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <ProtocolTab label="CLI"       icon=">_" desc="SSH to device" active={protocol === "CLI"}       onClick={() => setProtocol("CLI")}       />
                <ProtocolTab label="SNMP"      icon="~"  desc="Query MIBs"   active={protocol === "SNMP"}      onClick={() => setProtocol("SNMP")}      />
                <ProtocolTab label="DISCOVERY" icon="◎"  desc="Scan subnet"  active={protocol === "DISCOVERY"} onClick={() => setProtocol("DISCOVERY")} />
              </div>
            </div>

            {/* 3. PARAMETERS */}
            <div>
              <div style={styles.sectionLabel}>
                <div style={styles.sectionNum}>3</div>
                {protocol === "CLI" ? "CLI Parameters" : protocol === "SNMP" ? "SNMP Parameters" : "Discovery Parameters"}
              </div>
              <div style={{ ...styles.card, display: "flex", flexDirection: "column", gap: 12 }}>

                {protocol === "CLI" && <>
                  <div>
                    <span style={styles.fieldLabel}>Vendor</span>
                    <select value={vendor} onChange={e => { setVendor(e.target.value); setCommand(CLI_QUICK_COMMANDS[e.target.value]?.[0] ?? ""); }} style={styles.select}>
                      {VENDORS.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <span style={styles.fieldLabel}>Quick Commands</span>
                    <select value={command} onChange={e => setCommand(e.target.value)} style={styles.select}>
                      {quickCommands.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <span style={styles.fieldLabel}>Command</span>
                    <input value={command} onChange={e => setCommand(e.target.value)} placeholder="show version" style={styles.input} autoComplete="off" />
                  </div>
                  <div>
                    <span style={styles.fieldLabel}>Target IP</span>
                    <input value={targetIp} onChange={e => setTargetIp(e.target.value)} placeholder="10.10.10.1" style={styles.input} autoComplete="off" />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div>
                      <span style={styles.fieldLabel}>Username</span>
                      <input value={username} onChange={e => setUsername(e.target.value)} placeholder="admin" style={styles.input} autoComplete="nope" />
                    </div>
                    <div>
                      <span style={styles.fieldLabel}>Password</span>
                      <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" style={styles.input} autoComplete="new-password" />
                    </div>
                  </div>
                </>}

                {protocol === "SNMP" && <>
                  <div>
                    <span style={styles.fieldLabel}>Target IP</span>
                    <input value={targetIp} onChange={e => setTargetIp(e.target.value)} placeholder="10.10.10.1" style={styles.input} autoComplete="off" />
                  </div>
                  <div>
                    <span style={styles.fieldLabel}>Community String</span>
                    <input value={community} onChange={e => setCommunity(e.target.value)} placeholder="public" style={styles.input} autoComplete="off" />
                  </div>
                  <div>
                    <span style={styles.fieldLabel}>Quick OIDs</span>
                    <select value={oid} onChange={e => setOid(e.target.value)} style={styles.select}>
                      {SNMP_QUICK_OIDS.map(o => <option key={o.value} value={o.value}>{o.label} ({o.value})</option>)}
                    </select>
                  </div>
                  <div>
                    <span style={styles.fieldLabel}>OID / Name</span>
                    <input value={oid} onChange={e => setOid(e.target.value)} placeholder="sysName or 1.3.6.1..." style={styles.input} autoComplete="off" />
                  </div>
                </>}

                {protocol === "DISCOVERY" && <>
                  <div>
                    <span style={styles.fieldLabel}>Subnet</span>
                    <input value={subnet} onChange={e => setSubnet(e.target.value)} placeholder="10.10.10.0/24" style={styles.input} autoComplete="off" />
                  </div>
                  <div style={{
                    padding: "10px 12px",
                    background: `${AMBER}11`,
                    border: `1px solid ${AMBER}33`,
                    borderRadius: 6, fontSize: 11,
                    color: `${AMBER}CC`, lineHeight: 1.6,
                  }}>
                    Discovery will scan the subnet from each selected Pi. Results include live hosts, open ports, and vendor fingerprinting via nmap.
                  </div>
                </>}

              </div>
            </div>

            {/* RUN BUTTON */}
            <button
              onClick={runCommands}
              disabled={running || selected.size === 0}
              style={{
                ...styles.runButton,
                opacity: running || selected.size === 0 ? 0.4 : 1,
                cursor: running || selected.size === 0 ? "not-allowed" : "pointer",
              }}
            >
              {running ? "◌ QUEUING..." : `▶  RUN ON ${selected.size} DEVICE${selected.size !== 1 ? "S" : ""}`}
            </button>

          </div>

          {/* RIGHT PANEL — OUTPUT */}
          <div style={styles.rightPanel}>
            <div style={styles.outputHeader}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.2em", color: CYAN }}>
                OUTPUT TERMINAL
              </div>
              <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                {results.length > 0 && (
                  <>
                    <span style={{ fontSize: 11, color: "rgba(224,247,245,0.3)" }}>
                      {results.filter(r => r.status === "complete").length}/{results.length} complete
                    </span>
                    <button
                      onClick={() => {
                        const JSZip = (window as any).JSZip;
                        if (!JSZip) { alert("JSZip not loaded"); return; }
                        const zip = new JSZip();
                        results.forEach(r => {
                          const ts   = new Date(r.started_at).toISOString().replace(/[:.]/g, "-");
                          const name = `${r.device_name}_${r.command.replace(/[^a-z0-9]/gi,"_")}_${ts}.txt`;
                          const body = [
                            `Device:    ${r.device_name}`,
                            `Protocol:  ${r.protocol}`,
                            `Target:    ${r.target}`,
                            `Command:   ${r.command}`,
                            `Status:    ${r.status}`,
                            `Started:   ${r.started_at}`,
                            `Completed: ${r.completed_at ?? "—"}`,
                            ``,
                            `--- OUTPUT ---`,
                            r.output ?? "(no output)",
                          ].join("\n");
                          zip.file(name, body);
                        });
                        zip.generateAsync({ type: "blob" }).then((blob: Blob) => {
                          const url = URL.createObjectURL(blob);
                          const a   = document.createElement("a");
                          a.href     = url;
                          a.download = `commandrunner_${new Date().toISOString().slice(0,19).replace(/[:.]/g,"-")}.zip`;
                          a.click();
                          URL.revokeObjectURL(url);
                        });
                      }}
                      style={{
                        fontSize: 11, color: CYAN, background: "transparent",
                        border: `1px solid ${CYAN}44`, borderRadius: 4,
                        padding: "4px 10px", cursor: "pointer", fontFamily: "inherit",
                        letterSpacing: "0.1em",
                      }}
                    >
                      ↓ ZIP
                    </button>
                    <button
                      onClick={() => setResults([])}
                      style={{
                        fontSize: 11, color: RED, background: "transparent",
                        border: `1px solid ${RED}44`, borderRadius: 4,
                        padding: "4px 10px", cursor: "pointer", fontFamily: "inherit",
                        letterSpacing: "0.1em",
                      }}
                    >
                      CLEAR
                    </button>
                  </>
                )}
              </div>
            </div>

            <div style={styles.terminal}>
              {results.length === 0 ? (
                <div style={{
                  flex: 1, display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center",
                  color: `${CYAN}30`, gap: 16,
                }}>
                  <div style={{ fontSize: 64, lineHeight: 1 }}>&gt;_</div>
                  <div style={{ fontSize: 16, letterSpacing: "0.15em", textAlign: "center" }}>
                    SELECT DEVICES → PROTOCOL → RUN
                  </div>
                  <div style={{ fontSize: 12, color: `${CYAN}20`, letterSpacing: "0.1em" }}>
                    Results appear here in real-time
                  </div>
                </div>
              ) : (
                results.map(r => <ResultCard key={r.id} result={r} />)
              )}
            </div>
          </div>

        </div>
      </div>
    </DashboardShell>
  );
}
