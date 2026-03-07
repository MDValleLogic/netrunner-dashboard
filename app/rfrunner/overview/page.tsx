"use client";
import React, { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface RFNetwork {
  bssid: string; ssid: string; signal_dbm: number;
  channel: number; band: string; security: string;
}

export default function RFRunnerOverview() {
  const [networks, setNetworks] = useState<RFNetwork[]>([]);
  const [ts, setTs] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/rfrunner/live").then(r => r.json()).then(j => {
      if (j.networks) { setNetworks(j.networks); setTs(j.ts_utc); }
    }).finally(() => setLoading(false));
  }, []);

  const channelCounts: Record<number, number> = {};
  networks.forEach(n => { if (n.channel) channelCounts[n.channel] = (channelCounts[n.channel] || 0) + 1; });
  const channelData = Object.entries(channelCounts)
    .map(([ch, count]) => ({ channel: `Ch ${ch}`, count }))
    .sort((a, b) => parseInt(a.channel.split(" ")[1]) - parseInt(b.channel.split(" ")[1]));

  const band24 = networks.filter(n => n.band === "2.4GHz").length;
  const band5  = networks.filter(n => n.band === "5GHz").length;
  const strongest = networks[0];
  const weakest = networks[networks.length - 1];

  return (
    <div className="vl-page">
      <div className="vl-page-header">
        <div>
          <div className="vl-page-title">RFRunner &middot; Overview</div>
          <div className="vl-page-subtitle">RF environment summary</div>
        </div>
        {ts && <div style={{ fontSize: 12, color: "var(--vl-text-muted)" }}>Last scan: {new Date(ts).toLocaleTimeString()}</div>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        {[
          { label: "Networks Visible", value: loading ? "—" : networks.length },
          { label: "2.4 GHz", value: loading ? "—" : band24 },
          { label: "5 GHz", value: loading ? "—" : band5 },
          { label: "Strongest Signal", value: loading ? "—" : strongest ? `${strongest.signal_dbm} dBm` : "—" },
        ].map(({ label, value }) => (
          <div key={label} className="vl-card" style={{ padding: "20px 24px" }}>
            <div style={{ fontSize: 11, color: "var(--vl-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>{label}</div>
            <div style={{ fontSize: 28, fontWeight: 700 }}>{value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div className="vl-card">
          <div style={{ padding: "16px 20px 8px", fontWeight: 600, fontSize: 13 }}>Channel Congestion</div>
          <div style={{ height: 220, padding: "0 16px 16px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={channelData}>
                <XAxis dataKey="channel" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" radius={[4,4,0,0]}>
                  {channelData.map((entry, i) => (
                    <Cell key={i} fill={entry.count >= 4 ? "var(--vl-red)" : entry.count >= 2 ? "#E8A020" : "var(--vl-green)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="vl-card">
          <div style={{ padding: "16px 20px 8px", fontWeight: 600, fontSize: 13 }}>Top 10 by Signal Strength</div>
          <div style={{ padding: "0 20px 16px" }}>
            {networks.slice(0, 10).map(n => {
              const pct = Math.max(0, Math.min(100, ((n.signal_dbm + 100) / 70) * 100));
              const color = pct > 60 ? "var(--vl-green)" : pct > 30 ? "#E8A020" : "var(--vl-red)";
              return (
                <div key={n.bssid} style={{ display: "flex", alignItems: "center", gap: 12, padding: "6px 0", borderBottom: "1px solid var(--vl-border)" }}>
                  <div style={{ flex: 1, fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.ssid || "hidden"}</div>
                  <div style={{ width: 100, height: 5, background: "var(--vl-border)", borderRadius: 3 }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 3 }} />
                  </div>
                  <div style={{ fontSize: 12, color, fontFamily: "var(--vl-font-mono)", width: 60, textAlign: "right" }}>{n.signal_dbm} dBm</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}