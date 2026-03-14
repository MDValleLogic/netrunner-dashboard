"use client";
import { useDevice } from "@/lib/deviceContext";
import React, { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Radio } from "lucide-react";

interface RFNetwork {
  bssid: string;
  ssid: string;
  signal_dbm: number;
  channel: number | null;
  band: string | null;
  security: string;
  frequency_mhz: number | null;
}

function normalizeBand(n: RFNetwork): string {
  if (n.band) {
    if (n.band.includes("2.4")) return "2.4 GHz";
    if (n.band.includes("5")) return "5 GHz";
  }
  if (n.frequency_mhz) return n.frequency_mhz < 3000 ? "2.4 GHz" : "5 GHz";
  if (n.channel) return n.channel <= 14 ? "2.4 GHz" : "5 GHz";
  return "?";
}

function signalColor(dbm: number): string {
  const pct = Math.round(((Math.max(-90, Math.min(-30, dbm)) + 90) / 60) * 100);
  if (pct >= 70) return "#22c55e";
  if (pct >= 40) return "#f59e0b";
  return "#ef4444";
}

export default function RFRunnerOverview() {
  const { selectedDeviceId, devices, setSelectedDeviceId } = useDevice();
  const [networks, setNetworks] = useState<RFNetwork[]>([]);
  const [ts, setTs]             = useState<string | null>(null);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    fetch(`/api/rfrunner/live${selectedDeviceId ? "?device_id="+selectedDeviceId : ""}`)
      .then(r => r.json())
      .then(j => { if (j.networks) { setNetworks(j.networks); setTs(j.ts_utc); } })
      .finally(() => setLoading(false));
  }, []);

  // Derived stats
  const normalized = networks.map(n => ({ ...n, _band: normalizeBand(n) }));
  const band24     = normalized.filter(n => n._band === "2.4 GHz").length;
  const band5      = normalized.filter(n => n._band === "5 GHz").length;
  const openNets   = networks.filter(n => (n.security || "").toLowerCase() === "open").length;
  const uniqueSSIDs = new Set(networks.map(n => n.ssid || "(hidden)")).size;

  // Channel congestion
  const channelCounts: Record<number, number> = {};
  normalized.forEach(n => { if (n.channel) channelCounts[n.channel] = (channelCounts[n.channel] || 0) + 1; });
  const channelData = Object.entries(channelCounts)
    .map(([ch, count]) => ({ channel: `Ch ${ch}`, count, ch: parseInt(ch) }))
    .sort((a, b) => a.ch - b.ch);

  const sorted = [...networks].sort((a, b) => b.signal_dbm - a.signal_dbm);

  const stats = [
    { label: "Total APs",      value: loading ? "—" : networks.length },
    { label: "Unique SSIDs",   value: loading ? "—" : uniqueSSIDs },
    { label: "2.4 GHz APs",    value: loading ? "—" : band24 },
    { label: "5 GHz APs",      value: loading ? "—" : band5 },
    { label: "Open Networks",  value: loading ? "—" : openNets, alert: openNets > 0 },
    { label: "Best Signal",    value: loading ? "—" : sorted[0] ? `${sorted[0].signal_dbm} dBm` : "—" },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">

      {/* Header */}
      <div className="flex items-center justify-between mb-6 max-w-5xl">
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:0}}><select value={selectedDeviceId || ""} onChange={e => setSelectedDeviceId(e.target.value)} style={{ background: "#111827", border: "1px solid #374151", borderRadius: 6, color: "#e5e7eb", padding: "6px 10px", fontSize: 12, fontFamily: "monospace" }}>
            {devices.map(d => <option key={d.device_id} value={d.device_id}>{d.nickname ? `${d.nickname} (${d.nr_serial})` : d.nr_serial}</option>)}
          </select></div>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <Radio size={20} className="text-blue-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-100 leading-tight">RF Overview</h1>
            <p className="text-xs text-gray-500 font-mono">
              {ts ? `Last scan: ${new Date(ts).toLocaleTimeString()}` : "Loading…"}
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl space-y-6">

        {/* Stat cards */}
        <div className="grid grid-cols-6 gap-3">
          {stats.map(({ label, value, alert }) => (
            <div key={label} className={`rounded-lg border px-4 py-4 bg-gray-900/60 ${alert ? "border-red-700/60" : "border-gray-700/60"}`}>
              <div className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-2">{label}</div>
              <div className={`text-2xl font-bold font-mono ${alert ? "text-red-400" : "text-white"}`}>{value}</div>
            </div>
          ))}
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-2 gap-4">

          {/* Channel congestion */}
          <div className="rounded-lg border border-gray-700/60 bg-gray-900/60 p-4">
            <div className="text-sm font-semibold text-gray-200 mb-4">Channel Congestion</div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={channelData} barCategoryGap="30%">
                <XAxis dataKey="channel" tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} allowDecimals={false} width={20} />
                <Tooltip
                  contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: 6, fontSize: 12 }}
                  labelStyle={{ color: "#e5e7eb" }}
                  itemStyle={{ color: "#9ca3af" }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {channelData.map((entry, i) => (
                    <Cell key={i} fill={entry.count >= 4 ? "#ef4444" : entry.count >= 2 ? "#f59e0b" : "#22c55e"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Band distribution */}
          <div className="rounded-lg border border-gray-700/60 bg-gray-900/60 p-4">
            <div className="text-sm font-semibold text-gray-200 mb-4">Band Distribution</div>
            <div className="flex items-center gap-6 mb-4">
              <div>
                <div className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-1">2.4 GHz</div>
                <div className="text-3xl font-bold font-mono text-amber-400">{loading ? "—" : band24}</div>
              </div>
              <div className="text-gray-700 text-2xl font-thin">/</div>
              <div>
                <div className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-1">5 GHz</div>
                <div className="text-3xl font-bold font-mono text-blue-400">{loading ? "—" : band5}</div>
              </div>
            </div>
            {!loading && (band24 + band5) > 0 && (
              <div className="w-full h-3 rounded-full overflow-hidden bg-gray-800 flex">
                <div style={{ width: `${(band24 / (band24 + band5)) * 100}%` }} className="h-full bg-amber-400 transition-all" />
                <div style={{ width: `${(band5  / (band24 + band5)) * 100}%` }} className="h-full bg-blue-400 transition-all" />
              </div>
            )}
            <div className="flex gap-4 mt-2">
              <span className="text-[10px] font-mono text-amber-400">■ 2.4 GHz</span>
              <span className="text-[10px] font-mono text-blue-400">■ 5 GHz</span>
            </div>
          </div>
        </div>

        {/* Top 10 by signal */}
        <div className="rounded-lg border border-gray-700/60 bg-gray-900/60 p-4">
          <div className="text-sm font-semibold text-gray-200 mb-4">Top Networks by Signal Strength</div>
          <div className="grid grid-cols-[1fr_auto_auto_auto_120px_auto] gap-x-4 text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-2 px-1">
            <span>SSID</span>
            <span>BSSID</span>
            <span>Channel</span>
            <span>Band</span>
            <span>Signal</span>
            <span>Security</span>
          </div>
          {sorted.slice(0, 10).map(n => {
            const band = normalizeBand(n);
            const pct  = Math.round(((Math.max(-90, Math.min(-30, n.signal_dbm)) + 90) / 60) * 100);
            const color = signalColor(n.signal_dbm);
            return (
              <div key={n.bssid} className="grid grid-cols-[1fr_auto_auto_auto_120px_auto] gap-x-4 items-center px-1 py-2 border-t border-gray-800 hover:bg-gray-800/40 rounded transition-colors">
                <span className="font-mono text-sm text-gray-100 truncate">{n.ssid || "(hidden)"}</span>
                <span className="font-mono text-xs text-gray-500">{n.bssid}</span>
                <span className="font-mono text-xs text-gray-400">{n.channel ? `ch ${n.channel}` : "—"}</span>
                <span className="font-mono text-xs" style={{ color: band.includes("5") ? "#60a5fa" : "#f59e0b" }}>{band}</span>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div style={{ width: `${pct}%`, background: color }} className="h-full rounded-full transition-all" />
                  </div>
                  <span className="font-mono text-xs w-16 text-right" style={{ color }}>{n.signal_dbm} dBm</span>
                </div>
                <span className="font-mono text-xs text-gray-400">{n.security}</span>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}
