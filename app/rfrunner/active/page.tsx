"use client";

import React, { useEffect, useState } from "react";
import { Shield, Wifi, Clock, Server, AlertTriangle } from "lucide-react";

interface OpenPort {
  host: string;
  port: number;
  service: string;
  hostname?: string;
}

interface WifiTest {
  id: string | number;
  device_id: string;
  ts_utc: string;
  ssid: string;
  assoc_success: boolean;
  assoc_time_ms: number;
  assoc_failure: string | null;
  dhcp_success: boolean;
  dhcp_time_ms: number;
  ip_assigned: string | null;
  gateway: string | null;
  dns_servers: string[];
  ping_success: boolean;
  ping_latency_ms: number | null;
  ping_loss_pct: number | null;
  bssid: string | null;
  rssi_dbm: number | null;
  channel: number | null;
  band: string | null;
  frequency_mhz: number | null;
  host_count: number | null;
  open_ports: OpenPort[];
  risk_score: string | null;
  findings: string[];
}

function fmtTime(iso: string) {
  try { return new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }); }
  catch { return iso; }
}
function fmtMs(ms: number | null | undefined) {
  if (ms == null) return "—";
  return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(2)}s`;
}
function signalColor(dbm: number | null) {
  if (dbm == null) return "#6b7280";
  if (dbm >= -60) return "#22c55e";
  if (dbm >= -75) return "#f59e0b";
  return "#ef4444";
}
function riskColor(risk: string | null) {
  const r = (risk || "").toLowerCase();
  if (r === "high")   return { text: "#ef4444", bg: "rgba(239,68,68,0.1)",  border: "rgba(239,68,68,0.3)"  };
  if (r === "medium") return { text: "#f59e0b", bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.3)" };
  return                     { text: "#22c55e", bg: "rgba(34,197,94,0.1)",  border: "rgba(34,197,94,0.3)"  };
}

function PhaseIndicator({ success, label }: { success: boolean | null; label: string }) {
  const color = success === null ? "#6b7280" : success ? "#22c55e" : "#ef4444";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <div style={{ width: 7, height: 7, borderRadius: "50%", background: color, boxShadow: success ? `0 0 5px ${color}` : "none", flexShrink: 0 }} />
      <span style={{ fontSize: 10, color, fontFamily: "monospace", fontWeight: 600 }}>{label}</span>
    </div>
  );
}

export default function ActiveModePage() {
  const [tests, setTests]           = useState<WifiTest[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    fetch("/api/devices/list")
      .then(r => r.json())
      .then(j => {
        if (j?.ok && j.devices?.length > 0) {
          const id = j.devices[0].device_id;
          return fetch(`/api/rfrunner/wifi-test?device_id=${encodeURIComponent(id)}&limit=20`);
        }
      })
      .then(r => r?.json())
      .then(j => {
        if (j?.ok && j.tests?.length > 0) {
          setTests(j.tests);
          setSelectedId(String(j.tests[0].id));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const selected = tests.find(t => String(t.id) === selectedId) ?? null;
  const risk = riskColor(selected?.risk_score ?? null);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">

      {/* Header */}
      <div className="flex items-center justify-between mb-6 max-w-6xl">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <Shield size={20} className="text-blue-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-100 leading-tight">Active Mode</h1>
            <p className="text-xs text-gray-500 font-mono">WiFi association · DHCP · security scan</p>
          </div>
        </div>
        {tests.length > 0 && (
          <span style={{ fontSize: 11, color: "#6b7280", fontFamily: "monospace" }}>
            {tests.length} test{tests.length !== 1 ? "s" : ""} on record
          </span>
        )}
      </div>

      {loading && (
        <div className="max-w-6xl rounded-lg border border-gray-700/60 bg-gray-900/60 p-8 text-center">
          <div style={{ color: "#6b7280", fontSize: 13 }}>Loading…</div>
        </div>
      )}

      {!loading && tests.length === 0 && (
        <div className="max-w-6xl rounded-lg border border-gray-700/60 bg-gray-900/60 p-12 text-center">
          <Shield size={32} className="text-gray-700 mx-auto mb-4" />
          <div style={{ fontWeight: 600, color: "#9ca3af", marginBottom: 6 }}>No tests recorded yet</div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>Run wifitest.py on the Pi to perform an Active Mode scan</div>
          <div style={{ marginTop: 12, fontFamily: "monospace", fontSize: 11, color: "#4b5563", background: "#111827", padding: "8px 16px", borderRadius: 6, display: "inline-block" }}>
            sudo python3 /opt/vallelogic/rfrunner/wifitest.py &lt;SSID&gt; &lt;PSK&gt;
          </div>
        </div>
      )}

      {!loading && tests.length > 0 && (
        <div className="max-w-6xl" style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 16 }}>

          {/* Left: Test history list */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: 10, fontFamily: "monospace", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
              Test History
            </div>
            {tests.map(t => {
              const rc = riskColor(t.risk_score);
              const isSelected = String(t.id) === selectedId;
              return (
                <button
                  key={String(t.id)}
                  onClick={() => setSelectedId(String(t.id))}
                  style={{
                    textAlign: "left",
                    background: isSelected ? "rgba(59,130,246,0.1)" : "rgba(17,24,39,0.6)",
                    border: `1px solid ${isSelected ? "rgba(59,130,246,0.4)" : "rgba(75,85,99,0.4)"}`,
                    borderRadius: 8, padding: "10px 12px", cursor: "pointer", transition: "all 0.15s",
                    width: "100%",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#e5e7eb", fontFamily: "monospace" }}>
                      {t.ssid || "unknown"}
                    </span>
                    <span style={{
                      fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", padding: "2px 6px", borderRadius: 4,
                      background: rc.bg, color: rc.text, border: `1px solid ${rc.border}`, textTransform: "uppercase",
                    }}>
                      {t.risk_score || "—"}
                    </span>
                  </div>
                  <div style={{ fontSize: 10, color: "#6b7280", fontFamily: "monospace", marginBottom: 6 }}>
                    {fmtTime(t.ts_utc)}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <PhaseIndicator success={t.assoc_success} label="ASSOC" />
                    <PhaseIndicator success={t.dhcp_success}  label="DHCP"  />
                    <PhaseIndicator success={t.ping_success}  label="PING"  />
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right: Selected test detail */}
          {selected && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

              {/* Risk banner */}
              <div style={{
                borderRadius: 10, padding: "14px 20px",
                background: risk.bg, border: `1px solid ${risk.border}`,
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Shield size={18} style={{ color: risk.text }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: risk.text, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      Risk: {selected.risk_score || "unknown"}
                    </div>
                    <div style={{ fontSize: 11, color: "#9ca3af", fontFamily: "monospace", marginTop: 2 }}>
                      {selected.ssid} · {fmtTime(selected.ts_utc)}
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: risk.text, fontFamily: "monospace" }}>
                    {selected.host_count ?? 0}
                  </div>
                  <div style={{ fontSize: 10, color: "#6b7280", fontFamily: "monospace" }}>hosts found</div>
                </div>
              </div>

              {/* Phase cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
                {/* Association */}
                <div className="rounded-lg border border-gray-700/60 bg-gray-900/60 p-4">
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                    <Wifi size={13} style={{ color: selected.assoc_success ? "#22c55e" : "#ef4444" }} />
                    <span style={{ fontSize: 10, fontFamily: "monospace", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em" }}>Association</span>
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "monospace", color: selected.assoc_success ? "#22c55e" : "#ef4444", marginBottom: 4 }}>
                    {selected.assoc_success ? "PASS" : "FAIL"}
                  </div>
                  <div style={{ fontSize: 11, color: "#9ca3af", fontFamily: "monospace" }}>{fmtMs(selected.assoc_time_ms)}</div>
                  {selected.bssid && <div style={{ fontSize: 10, color: "#6b7280", fontFamily: "monospace", marginTop: 4 }}>{selected.bssid}</div>}
                </div>

                {/* DHCP */}
                <div className="rounded-lg border border-gray-700/60 bg-gray-900/60 p-4">
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                    <Server size={13} style={{ color: selected.dhcp_success ? "#22c55e" : "#ef4444" }} />
                    <span style={{ fontSize: 10, fontFamily: "monospace", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em" }}>DHCP</span>
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "monospace", color: selected.dhcp_success ? "#22c55e" : "#ef4444", marginBottom: 4 }}>
                    {selected.dhcp_success ? "PASS" : "FAIL"}
                  </div>
                  <div style={{ fontSize: 11, color: "#9ca3af", fontFamily: "monospace" }}>{selected.ip_assigned || "—"}</div>
                  <div style={{ fontSize: 10, color: "#6b7280", fontFamily: "monospace", marginTop: 2 }}>gw {selected.gateway || "—"}</div>
                </div>

                {/* Ping */}
                <div className="rounded-lg border border-gray-700/60 bg-gray-900/60 p-4">
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                    <Clock size={13} style={{ color: selected.ping_success ? "#22c55e" : "#ef4444" }} />
                    <span style={{ fontSize: 10, fontFamily: "monospace", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em" }}>Gateway Ping</span>
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "monospace", color: selected.ping_success ? "#22c55e" : "#ef4444", marginBottom: 4 }}>
                    {fmtMs(selected.ping_latency_ms)}
                  </div>
                  <div style={{ fontSize: 11, color: "#9ca3af", fontFamily: "monospace" }}>
                    {selected.ping_loss_pct != null ? `${selected.ping_loss_pct}% loss` : "—"}
                  </div>
                  <div style={{ fontSize: 10, color: "#6b7280", fontFamily: "monospace", marginTop: 2 }}>{selected.gateway || "—"}</div>
                </div>

                {/* RF */}
                <div className="rounded-lg border border-gray-700/60 bg-gray-900/60 p-4">
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                    <Wifi size={13} style={{ color: signalColor(selected.rssi_dbm) }} />
                    <span style={{ fontSize: 10, fontFamily: "monospace", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em" }}>RF Details</span>
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "monospace", color: signalColor(selected.rssi_dbm), marginBottom: 4 }}>
                    {selected.rssi_dbm != null ? `${selected.rssi_dbm} dBm` : "—"}
                  </div>
                  <div style={{ fontSize: 11, color: "#9ca3af", fontFamily: "monospace" }}>
                    {selected.band || "—"} · Ch {selected.channel || "—"}
                  </div>
                  <div style={{ fontSize: 10, color: "#6b7280", fontFamily: "monospace", marginTop: 2 }}>
                    {selected.frequency_mhz ? `${selected.frequency_mhz} MHz` : "—"}
                  </div>
                </div>
              </div>

              {/* Security findings */}
              {selected.findings?.length > 0 && (
                <div style={{ borderRadius: 10, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.25)", padding: "14px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <AlertTriangle size={14} style={{ color: "#ef4444" }} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#ef4444", textTransform: "uppercase", letterSpacing: "0.08em" }}>Security Findings</span>
                  </div>
                  {selected.findings.map((f, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "6px 0", borderTop: i > 0 ? "1px solid rgba(239,68,68,0.15)" : "none" }}>
                      <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#ef4444", marginTop: 5, flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: "#fca5a5", fontFamily: "monospace" }}>{f}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Open ports */}
              {selected.open_ports?.length > 0 && (
                <div className="rounded-lg border border-gray-700/60 bg-gray-900/60 p-4">
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#e5e7eb", marginBottom: 12 }}>
                    Open Ports — {selected.open_ports.length} found
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid #1f2937" }}>
                        {["Host", "Hostname", "Port", "Service"].map(h => (
                          <th key={h} style={{ padding: "4px 8px", textAlign: "left", fontSize: 10, fontFamily: "monospace", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {selected.open_ports.map((p, i) => {
                        const isRisky = [23, 445, 3389].includes(p.port);
                        return (
                          <tr key={i} style={{ borderTop: "1px solid rgba(75,85,99,0.2)" }}>
                            <td style={{ padding: "6px 8px", fontSize: 12, fontFamily: "monospace", color: "#d1d5db" }}>{p.host}</td>
                            <td style={{ padding: "6px 8px", fontSize: 11, fontFamily: "monospace", color: "#9ca3af" }}>{p.hostname || "—"}</td>
                            <td style={{ padding: "6px 8px", fontSize: 12, fontFamily: "monospace", fontWeight: 700, color: isRisky ? "#ef4444" : "#60a5fa" }}>{p.port}</td>
                            <td style={{ padding: "6px 8px", fontSize: 11, fontFamily: "monospace", color: isRisky ? "#fca5a5" : "#9ca3af" }}>{p.service}{isRisky ? " ⚠" : ""}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* DNS servers */}
              {selected.dns_servers?.length > 0 && (
                <div className="rounded-lg border border-gray-700/60 bg-gray-900/60 p-4">
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#e5e7eb", marginBottom: 8 }}>DNS Servers</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {selected.dns_servers.map((d, i) => (
                      <span key={i} style={{ fontSize: 11, fontFamily: "monospace", color: "#60a5fa", background: "rgba(96,165,250,0.1)", border: "1px solid rgba(96,165,250,0.2)", padding: "3px 10px", borderRadius: 4 }}>
                        {d}
                      </span>
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}
        </div>
      )}
    </div>
  );
}
