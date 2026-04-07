"use client";

import React, { useEffect, useState, useRef } from "react";
import DashboardShell from "@/components/DashboardShell";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Device {
  device_id: string;
  nickname: string;
  last_ip: string;
  status: string;
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

// ── Device Card ───────────────────────────────────────────────────────────────

function DeviceCard({ device, selected, onToggle }: { device: Device; selected: boolean; onToggle: () => void }) {
  const online = device.status === "claimed";
  return (
    <button
      onClick={onToggle}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 14px",
        background: selected ? `${CYAN}12` : "transparent",
        border: `1px solid ${selected ? CYAN : BORDER}`,
        borderRadius: 6,
        cursor: "pointer",
        fontFamily: "inherit",
        textAlign: "left",
        width: "100%",
        transition: "all 0.15s",
      }}
    >
      <div style={{
        width: 10, height: 10, borderRadius: "50%",
        background: online ? GREEN : RED,
        boxShadow: online ? `0 0 8px ${GREEN}` : `0 0 8px ${RED}`,
        flexShrink: 0,
      }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: selected ? CYAN : "#E0F7F5" }}>
          {device.nickname || device.device_id}
        </div>
        <div style={{ fontSize: 11, color: "rgba(224,247,245,0.4)", marginTop: 2 }}>
          {device.last_ip}
        </div>
      </div>
      <div style={{
        width: 18, height: 18, borderRadius: 4,
        border: `1.5px solid ${selected ? CYAN : BORDER}`,
        background: selected ? CYAN : "transparent",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}>
        {selected && <span style={{ color: "#030810", fontSize: 12, fontWeight: 900 }}>✓</span>}
      </div>
    </button>
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
        flex: 1,
        padding: "14px 10px",
        background: active ? `${CYAN}15` : "transparent",
        border: `1px solid ${active ? CYAN : BORDER}`,
        borderRadius: 6,
        cursor: "pointer",
        fontFamily: "inherit",
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
      borderRadius: 8,
      overflow: "hidden",
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
          background: statusColor,
          boxShadow: `0 0 6px ${statusColor}`,
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
              margin: 0,
              fontSize: 13,
              lineHeight: 1.7,
              color: result.status === "failed" ? "#FF8888" : "#A8F5E0",
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
              maxHeight: 400,
              overflowY: "auto",
              fontFamily: "inherit",
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
  const [devices, setDevices]           = useState<Device[]>([]);
  const [selected, setSelected]         = useState<Set<string>>(new Set());
  const [protocol, setProtocol]         = useState<Protocol>("CLI");
  const [vendor, setVendor]             = useState("extreme");
  const [targetIp, setTargetIp]         = useState("");
  const [username, setUsername]         = useState("");
  const [password, setPassword]         = useState("");
  const [command, setCommand]           = useState("show version");
  const [community, setCommunity]       = useState("public");
  const [oid, setOid]                   = useState("sysName");
  const [subnet, setSubnet]             = useState("");
  const [running, setRunning]           = useState(false);
  const [results, setResults]           = useState<CommandResult[]>([]);
  const pollRef                         = useRef<Record<string, NodeJS.Timeout>>({});

  useEffect(() => {
    fetch("/api/devices/list")
      .then(r => r.json())
      .then(d => {
        const devs = d.devices ?? [];
        setDevices(devs);
      })
      .catch(() => {});
  }, []);

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

  function pollResult(commandId: string, deviceId: string) {
    pollRef.current[commandId] = setInterval(async () => {
      try {
        const res = await fetch(`/api/commandrunner/execute?id=${commandId}`);
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
        const res = await fetch("/api/commandrunner/execute", {
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
              { label: "COMMANDS RUN", value: results.length },
              { label: "ONLINE", value: devices.filter(d => d.status === "claimed").length },
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
                <button
                  onClick={toggleAll}
                  style={{
                    width: "100%", padding: "8px 12px", marginBottom: 10,
                    background: selected.size === devices.length ? `${CYAN}15` : "transparent",
                    border: `1px solid ${BORDER}`, borderRadius: 6,
                    color: CYAN, fontSize: 12, fontWeight: 700,
                    cursor: "pointer", fontFamily: "inherit",
                    letterSpacing: "0.1em", textTransform: "uppercase",
                  }}
                >
                  {selected.size === devices.length ? "✓ ALL SELECTED" : "SELECT ALL"}
                </button>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {devices.length === 0
                    ? <div style={{ fontSize: 13, color: "rgba(224,247,245,0.3)", textAlign: "center", padding: 16 }}>Loading devices...</div>
                    : devices.map(d => (
                        <DeviceCard
                          key={d.device_id}
                          device={d}
                          selected={selected.has(d.device_id)}
                          onToggle={() => toggleDevice(d.device_id)}
                        />
                      ))
                  }
                </div>
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
                      <input value={username} onChange={e => setUsername(e.target.value)} placeholder="admin" style={styles.input} autoComplete="off" />
                    </div>
                    <div>
                      <span style={styles.fieldLabel}>Password</span>
                      <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" style={styles.input} autoComplete="off" />
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
                    borderRadius: 6,
                    fontSize: 11,
                    color: `${AMBER}CC`,
                    lineHeight: 1.6,
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
