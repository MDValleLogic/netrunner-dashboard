"use client";

import React, { useEffect, useState } from "react";
import DashboardShell from "@/components/DashboardShell";
import Link from "next/link";

interface MCPKey {
  id: string;
  label: string;
  created_at: string;
  last_used_at: string | null;
}

interface NewKey {
  rawKey: string;
  keyId: string;
  label: string;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      style={{ background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.3)", borderRadius: 5, color: copied ? "#10b981" : "#3b82f6", fontSize: 11, fontWeight: 600, padding: "4px 10px", cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s" }}
    >
      {copied ? "✓ Copied" : "Copy"}
    </button>
  );
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: ok ? "#10b981" : "#ef4444", boxShadow: ok ? "0 0 6px #10b981" : "0 0 6px #ef4444", marginRight: 7 }} />
  );
}

function fmtDate(iso: string | null) {
  if (!iso) return "Never";
  return new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

const card: React.CSSProperties = {
  background: "#111827", border: "1px solid #1f2937", borderRadius: 10, padding: "22px 24px", marginBottom: 16,
};

const label: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: "#6b7280", textTransform: "uppercase", marginBottom: 10,
};

const h2: React.CSSProperties = {
  fontSize: 15, fontWeight: 700, color: "#f3f4f6", marginBottom: 4,
};

const mono: React.CSSProperties = {
  fontFamily: "monospace", fontSize: 12, background: "#0d1117", border: "1px solid #374151",
  borderRadius: 6, padding: "10px 14px", color: "#e5e7eb", overflowX: "auto" as any, whiteSpace: "pre" as any,
};

export default function CommandRunnerPage() {
  const [serverOk, setServerOk] = useState<boolean | null>(null);
  const [keys, setKeys] = useState<MCPKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKeyLabel, setNewKeyLabel] = useState("");
  const [generating, setGenerating] = useState(false);
  const [newKey, setNewKey] = useState<NewKey | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"status" | "keys" | "setup" | "docs">("status");

  useEffect(() => {
    // Check server health
    fetch("/api/mcp").then(r => r.json()).then(d => setServerOk(d.status === "ok")).catch(() => setServerOk(false));
    // Load keys
    fetch("/api/mcp/keys").then(r => r.json()).then(d => { setKeys(d.keys ?? []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  async function generateKey() {
    if (!newKeyLabel.trim()) return;
    setGenerating(true);
    const res = await fetch("/api/mcp/keys", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label: newKeyLabel.trim() }) });
    const data = await res.json();
    if (data.rawKey) {
      setNewKey({ rawKey: data.rawKey, keyId: data.keyId, label: newKeyLabel.trim() });
      setKeys(prev => [{ id: data.keyId, label: newKeyLabel.trim(), created_at: new Date().toISOString(), last_used_at: null }, ...prev]);
      setNewKeyLabel("");
    }
    setGenerating(false);
  }

  async function revokeKey(keyId: string) {
    setRevoking(keyId);
    await fetch(`/api/mcp/keys?id=${keyId}`, { method: "DELETE" });
    setKeys(prev => prev.filter(k => k.id !== keyId));
    setRevoking(null);
  }

  const tabStyle = (t: string): React.CSSProperties => ({
    padding: "8px 18px", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "none",
    fontFamily: "inherit", transition: "all 0.15s",
    background: activeTab === t ? "rgba(59,130,246,0.2)" : "transparent",
    color: activeTab === t ? "#3b82f6" : "#6b7280",
  });

  const claudeConfig = `{
  "mcpServers": {
    "vger-os": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://app.vallelogic.com/api/mcp",
        "--header",
        "Authorization: Bearer YOUR_API_KEY"
      ]
    }
  }
}`;

  return (
    <DashboardShell>
      <div style={{ padding: "28px 32px", fontFamily: "monospace", color: "#e5e7eb", minHeight: "100vh", background: "#0d1117" }}>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: "linear-gradient(135deg, #1d4ed8, #0d7a8a)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="1.5"><rect x="1" y="2" width="14" height="12" rx="2"/><polyline points="4,6 7,8 4,10"/><line x1="8" y1="10" x2="12" y2="10"/></svg>
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#f9fafb", letterSpacing: "-0.02em" }}>VGER OS</div>
              <div style={{ fontSize: 11, color: "#6b7280" }}>VGER OS · AI-Queryable Network Intelligence · <span style={{ color: "#0d7a8a" }}>vger-os-1.0</span></div>
            </div>
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 7, background: serverOk === null ? "rgba(107,114,128,0.1)" : serverOk ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)", border: `1px solid ${serverOk === null ? "#374151" : serverOk ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}` }}>
              {serverOk !== null && <StatusDot ok={serverOk} />}
              <span style={{ fontSize: 11, fontWeight: 700, color: serverOk === null ? "#6b7280" : serverOk ? "#10b981" : "#ef4444" }}>
                {serverOk === null ? "Checking…" : serverOk ? "Claude Connected" : "MCP Server Offline"}
              </span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 24, background: "#111827", border: "1px solid #1f2937", borderRadius: 9, padding: 4, width: "fit-content" }}>
          {(["status", "keys", "setup", "docs"] as const).map(t => (
            <button key={t} style={tabStyle(t)} onClick={() => setActiveTab(t)}>
              {t === "status" ? "Status" : t === "keys" ? "API Keys" : t === "setup" ? "Claude Desktop Setup" : "Docs"}
            </button>
          ))}
        </div>

        {/* STATUS TAB */}
        {activeTab === "status" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
              {[
                { label: "Protocol", value: "MCP 2024-11-05" },
                { label: "Server", value: "VGER OS 1.0" },
                { label: "Endpoint", value: "https://app.vallelogic.com/api/mcp" },
                { label: "Active Keys", value: loading ? "…" : String(keys.length) },
              ].map(stat => (
                <div key={stat.label} style={card}>
                  <div style={label}>{stat.label}</div>
                  <div style={{ fontSize: 13, color: "#f3f4f6", fontWeight: 600 }}>{stat.value}</div>
                </div>
              ))}
            </div>

            <div style={card}>
              <div style={label}>Available Tools (27)</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {[
                  { name: "list_devices", desc: "All devices + online status" },
                  { name: "get_device_status", desc: "Single device health check" },
                  { name: "queue_command", desc: "Queue CLI/SNMP/Discovery command to Pi" },
                  { name: "get_pending_commands", desc: "Command history + output + error" },
                  { name: "get_noc_summary", desc: "Fleet-wide NOC status" },
                  { name: "get_noc_alerts", desc: "Active alerts — offline, gaps" },
                  { name: "get_noc_event_log", desc: "Recent device events" },
                  { name: "list_sites", desc: "All sites with device counts" },
                  { name: "get_site", desc: "Single site + assigned devices" },
                  { name: "create_site", desc: "Create a new site" },
                  { name: "update_site", desc: "Update site details" },
                  { name: "get_speed_results", desc: "Download / upload / ping trends" },
                  { name: "get_speedrunner_live", desc: "Most recent speed test per device" },
                  { name: "get_speedrunner_config", desc: "SpeedRunner configuration" },
                  { name: "get_route_trace", desc: "Traceroute hops + ISP path" },
                  { name: "get_routerunner_live", desc: "Most recent traceroute result" },
                  { name: "get_routerunner_config", desc: "RouterRunner configuration" },
                  { name: "get_webrunner_data", desc: "HTTP latency + DNS + uptime" },
                  { name: "get_webrunner_live", desc: "Most recent HTTP check results" },
                  { name: "get_webrunner_config", desc: "WebRunner configuration" },
                  { name: "get_measurements_timeseries", desc: "Time-bucketed aggregated data" },
                  { name: "get_ble_devices", desc: "All BLE devices detected by a Pi" },
                  { name: "get_ble_history", desc: "Hourly BLE scan summaries" },
                  { name: "get_ble_live_feed", desc: "BLE devices detected in last 5 min" },
                  { name: "get_ble_device_detail", desc: "Full history for a specific BLE MAC" },
                  { name: "get_rf_history", desc: "WiFi scan history + band data" },
                  { name: "get_rf_active_scan", desc: "Most recent active RF scan" },
                ].map(tool => (
                  <div key={tool.name} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px", background: "rgba(59,130,246,0.05)", border: "1px solid rgba(59,130,246,0.1)", borderRadius: 7 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: "rgba(59,130,246,0.15)", color: "#3b82f6", marginTop: 1, whiteSpace: "nowrap" }}>fn</span>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#e5e7eb" }}>{tool.name}</div>
                      <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{tool.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={card}>
              <div style={label}>Example Queries (ask Claude Desktop)</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  "List all my ValleLogic devices",
                  "Show me speed test results for Office1 over the last 24 hours",
                  "What happened to my network last Tuesday at 3pm?",
                  "Which device has the worst WiFi signal trends this week?",
                  "Show me traceroute hops for Basement 1 — is my ISP routing changing?",
                  "Compare speed results across all 3 devices",
                ].map(q => (
                  <div key={q} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 12px", background: "#0d1117", borderRadius: 6, border: "1px solid #1f2937" }}>
                    <span style={{ fontSize: 12, color: "#d1d5db" }}>"{q}"</span>
                    <CopyButton text={q} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* API KEYS TAB */}
        {activeTab === "keys" && (
          <div>
            {newKey && (
              <div style={{ ...card, background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.3)", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <StatusDot ok={true} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#10b981" }}>Key generated — copy it now. It will not be shown again.</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <code style={{ ...mono, flex: 1, padding: "10px 14px" }}>{newKey.rawKey}</code>
                  <CopyButton text={newKey.rawKey} />
                </div>
                <div style={{ marginTop: 10, fontSize: 11, color: "#6b7280" }}>Label: <span style={{ color: "#e5e7eb" }}>{newKey.label}</span></div>
                <button onClick={() => setNewKey(null)} style={{ marginTop: 10, fontSize: 11, color: "#6b7280", background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit" }}>Dismiss</button>
              </div>
            )}

            <div style={card}>
              <div style={label}>Generate New API Key</div>
              <div style={{ display: "flex", gap: 10 }}>
                <input
                  value={newKeyLabel}
                  onChange={e => setNewKeyLabel(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && generateKey()}
                  placeholder="Label (e.g. Claude Desktop, Cursor, Production)"
                  style={{ flex: 1, background: "#0d1117", border: "1px solid #374151", borderRadius: 7, color: "#e5e7eb", fontSize: 12, padding: "9px 12px", fontFamily: "monospace", outline: "none" }}
                />
                <button
                  onClick={generateKey}
                  disabled={generating || !newKeyLabel.trim()}
                  style={{ padding: "9px 18px", background: "rgba(59,130,246,0.2)", border: "1px solid rgba(59,130,246,0.4)", borderRadius: 7, color: "#3b82f6", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", opacity: generating || !newKeyLabel.trim() ? 0.5 : 1 }}
                >
                  {generating ? "Generating…" : "Generate Key"}
                </button>
              </div>
            </div>

            <div style={card}>
              <div style={label}>Active Keys ({keys.length})</div>
              {loading ? (
                <div style={{ color: "#6b7280", fontSize: 12 }}>Loading…</div>
              ) : keys.length === 0 ? (
                <div style={{ color: "#6b7280", fontSize: 12 }}>No active keys. Generate one above.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {keys.map(k => (
                    <div key={k.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "#0d1117", borderRadius: 7, border: "1px solid #1f2937" }}>
                      <StatusDot ok={true} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#e5e7eb" }}>{k.label}</div>
                        <div style={{ fontSize: 10, color: "#6b7280", marginTop: 2 }}>
                          Created {fmtDate(k.created_at)} · Last used {fmtDate(k.last_used_at)}
                        </div>
                      </div>
                      <button
                        onClick={() => revokeKey(k.id)}
                        disabled={revoking === k.id}
                        style={{ padding: "5px 12px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 6, color: "#ef4444", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                      >
                        {revoking === k.id ? "Revoking…" : "Revoke"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ ...card, background: "rgba(234,179,8,0.06)", border: "1px solid rgba(234,179,8,0.2)" }}>
              <div style={{ fontSize: 12, color: "#fbbf24", fontWeight: 600, marginBottom: 6 }}>⚠ Security Notes</div>
              <ul style={{ fontSize: 11, color: "#d1d5db", lineHeight: 1.8, paddingLeft: 16, margin: 0 }}>
                <li>Each key is scoped to your tenant — it cannot access other tenants' data</li>
                <li>Keys are stored hashed (SHA-256) — raw keys are never stored</li>
                <li>Raw key is shown exactly once at generation — copy it immediately</li>
                <li>Revoke keys you no longer use or that may have been compromised</li>
                <li>Never commit API keys to git or paste them in shared chats</li>
              </ul>
            </div>
          </div>
        )}

        {/* CLAUDE DESKTOP SETUP TAB */}
        {activeTab === "setup" && (
          <div>
            <div style={card}>
              <div style={label}>Step 1 — Download Claude Desktop</div>
              <div style={{ fontSize: 12, color: "#d1d5db", marginBottom: 12, lineHeight: 1.7 }}>
                Claude Desktop is Anthropic's native Mac/Windows app with built-in MCP support. It's free to download and uses your existing Claude account.
              </div>
              <a href="https://claude.ai/download" target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 16px", background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.3)", borderRadius: 7, color: "#3b82f6", fontSize: 12, fontWeight: 700, textDecoration: "none" }}>
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M8 1v10M4 7l4 4 4-4"/><path d="M2 14h12"/></svg>
                Download Claude Desktop → claude.ai/download
              </a>
            </div>

            <div style={card}>
              <div style={label}>Step 2 — Generate an API Key</div>
              <div style={{ fontSize: 12, color: "#d1d5db", lineHeight: 1.7 }}>
                Go to the <button onClick={() => setActiveTab("keys")} style={{ background: "none", border: "none", color: "#3b82f6", cursor: "pointer", fontFamily: "monospace", fontSize: 12, padding: 0, textDecoration: "underline" }}>API Keys tab</button> and generate a new key labelled "Claude Desktop". Copy the raw key — it's shown once.
              </div>
            </div>

            <div style={card}>
              <div style={label}>Step 3 — Edit Claude Desktop Config</div>
              <div style={{ fontSize: 12, color: "#d1d5db", marginBottom: 12, lineHeight: 1.7 }}>
                Open the Claude Desktop config file at:
              </div>
              <div style={{ ...mono, marginBottom: 12 }}>~/Library/Application Support/Claude/claude_desktop_config.json</div>
              <div style={{ fontSize: 12, color: "#d1d5db", marginBottom: 12 }}>Add the <code style={{ color: "#a78bfa" }}>mcpServers</code> section — replace <code style={{ color: "#fbbf24" }}>YOUR_API_KEY</code> with your generated key:</div>
              <div style={{ position: "relative" }}>
                <div style={mono}>{claudeConfig}</div>
                <div style={{ position: "absolute", top: 10, right: 10 }}><CopyButton text={claudeConfig} /></div>
              </div>
            </div>

            <div style={card}>
              <div style={label}>Step 4 — Restart Claude Desktop</div>
              <div style={{ fontSize: 12, color: "#d1d5db", lineHeight: 1.7 }}>
                Fully quit Claude Desktop (Cmd+Q — not just close the window) and relaunch it. The ValleLogic connector will appear under Settings → Connectors with a <span style={{ color: "#10b981" }}>LOCAL DEV</span> badge.
              </div>
            </div>

            <div style={card}>
              <div style={label}>Step 5 — Start Asking Questions</div>
              <div style={{ fontSize: 12, color: "#d1d5db", lineHeight: 1.7, marginBottom: 12 }}>
                Open a new chat in Claude Desktop and try:
              </div>
              <div style={{ ...mono }}>"List all my ValleLogic devices"</div>
              <div style={{ marginTop: 8, ...mono }}>"Show me speed test results for Office1 over the last 24 hours"</div>
              <div style={{ marginTop: 8, ...mono }}>"What happened to my network last Tuesday at 3pm?"</div>
            </div>

            <div style={{ ...card, background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.2)" }}>
              <div style={{ fontSize: 12, color: "#10b981", fontWeight: 700, marginBottom: 8 }}>✓ How it works</div>
              <div style={{ fontSize: 12, color: "#d1d5db", lineHeight: 1.8 }}>
                Claude connects to <strong>VGER OS</strong> at <code style={{ color: "#a78bfa" }}>app.vallelogic.com/api/mcp</code>. Your API key authenticates the connection and scopes all queries to your VGER 1 fleet only. No other tenant can see your devices or data.
              </div>
            </div>
          </div>
        )}

        {/* DOCS TAB */}
        {activeTab === "docs" && (
          <div>
            <div style={card}>
              <div style={label}>Documentation</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#f3f4f6", marginBottom: 6 }}>ValleLogic / NetRunner Platform Docs</div>
              <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 20, lineHeight: 1.7 }}>
                Full documentation for the NetRunner platform — runners, APIs, MCP, and device management.
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[
                  { title: "CommandRunner MCP", desc: "AI-queryable network data via MCP protocol", href: "/docs/commandrunner", icon: "terminal" },
                  { title: "WebRunner", desc: "HTTP monitoring, DNS latency, uptime tracking", href: "/docs/webrunner", icon: "grid" },
                  { title: "RouteRunner", desc: "Traceroute, ISP path analysis, hop RTT", href: "/docs/routerunner", icon: "route" },
                  { title: "SpeedRunner", desc: "Download/upload/ping benchmarks", href: "/docs/speedrunner", icon: "zap" },
                  { title: "RFRunner", desc: "WiFi RF scanning, band distribution, AP inventory", href: "/docs/rfrunner", icon: "wifi" },
                  { title: "Device Management", desc: "Claiming, provisioning, BYOPI install", href: "/docs/devices", icon: "cpu" },
                  { title: "API Reference", desc: "All REST endpoints, auth, tenant isolation", href: "/docs/api", icon: "shield" },
                  { title: "MCP Tool Reference", desc: "All 27 MCP tools, params, and example responses", href: "/docs/mcp-tools", icon: "activity" },
                ].map(doc => (
                  <Link key={doc.href} href={doc.href} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 16px", background: "#0d1117", border: "1px solid #1f2937", borderRadius: 8, textDecoration: "none", transition: "border-color 0.15s" }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = "#374151")}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = "#1f2937")}
                  >
                    <div style={{ width: 30, height: 30, borderRadius: 7, background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#3b82f6" strokeWidth="1.5"><rect x="1" y="2" width="14" height="12" rx="2"/><polyline points="4,6 7,8 4,10"/><line x1="8" y1="10" x2="12" y2="10"/></svg>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#e5e7eb", marginBottom: 3 }}>{doc.title}</div>
                      <div style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.5 }}>{doc.desc}</div>
                    </div>
                    <svg style={{ marginLeft: "auto", flexShrink: 0, marginTop: 6 }} width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="#374151" strokeWidth="2"><path d="M3 8h10M9 4l4 4-4 4"/></svg>
                  </Link>
                ))}
              </div>
            </div>

            <div style={card}>
              <div style={label}>External Resources</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { title: "Model Context Protocol (MCP) Spec", url: "https://spec.modelcontextprotocol.io" },
                  { title: "Claude Desktop Download", url: "https://claude.ai/download" },
                  { title: "Anthropic MCP Documentation", url: "https://docs.anthropic.com/en/docs/agents-and-tools/mcp" },
                ].map(link => (
                  <a key={link.url} href={link.url} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "#0d1117", border: "1px solid #1f2937", borderRadius: 7, textDecoration: "none" }}>
                    <span style={{ fontSize: 12, color: "#d1d5db" }}>{link.title}</span>
                    <span style={{ fontSize: 11, color: "#6b7280" }}>{link.url.replace("https://", "")} ↗</span>
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
