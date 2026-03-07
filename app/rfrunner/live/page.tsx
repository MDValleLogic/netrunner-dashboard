"use client";
import React, { useEffect, useState } from "react";

interface RFNetwork {
  bssid: string; ssid: string; signal_dbm: number;
  channel: number; band: string; security: string;
}

function SignalBar({ dbm }: { dbm: number }) {
  const pct = Math.max(0, Math.min(100, ((dbm + 100) / 70) * 100));
  const color = pct > 60 ? "var(--vl-green)" : pct > 30 ? "#E8A020" : "var(--vl-red)";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ width: 80, height: 6, background: "var(--vl-border)", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 3 }} />
      </div>
      <span style={{ color, fontSize: 12, fontWeight: 600, fontFamily: "var(--vl-font-mono)" }}>{dbm} dBm</span>
    </div>
  );
}

export default function RFRunnerLive() {
  const [networks, setNetworks] = useState<RFNetwork[]>([]);
  const [ts, setTs] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  async function load() {
    try {
      const r = await fetch("/api/rfrunner/live");
      const j = await r.json();
      if (j.networks) { setNetworks(j.networks); setTs(j.ts_utc); }
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); const t = setInterval(load, 60000); return () => clearInterval(t); }, []);

  return (
    <div className="vl-page">
      <div className="vl-page-header">
        <div>
          <div className="vl-page-title">RFRunner &middot; Live Feed</div>
          <div className="vl-page-subtitle">WiFi environment scan &middot; auto-refresh 60s</div>
        </div>
        {ts && <div style={{ fontSize: 12, color: "var(--vl-text-muted)" }}>Last scan: {new Date(ts).toLocaleTimeString()}</div>}
      </div>
      <div className="vl-card">
        {loading ? <div className="vl-empty">Loading...</div>
        : err ? <div className="vl-empty" style={{ color: "var(--vl-red)" }}>{err}</div>
        : networks.length === 0 ? <div className="vl-empty">No networks found</div>
        : (
          <table className="vl-table" style={{ width: "100%" }}>
            <thead><tr><th>SSID</th><th>BSSID</th><th>Signal</th><th>Ch</th><th>Band</th><th>Security</th></tr></thead>
            <tbody>
              {networks.map((n) => (
                <tr key={n.bssid}>
                  <td style={{ fontWeight: 600 }}>{n.ssid || <span style={{ color: "var(--vl-text-muted)" }}>hidden</span>}</td>
                  <td style={{ fontFamily: "var(--vl-font-mono)", fontSize: 12 }}>{n.bssid}</td>
                  <td><SignalBar dbm={n.signal_dbm} /></td>
                  <td>{n.channel || "—"}</td>
                  <td>{n.band || "—"}</td>
                  <td>{n.security}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}