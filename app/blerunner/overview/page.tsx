"use client";
import { useDevice } from "@/lib/deviceContext";
import React, { useEffect, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

type BLEScan = {
  mac: string;
  name: string | null;
  rssi: number | null;
  manufacturer: string | null;
  service_uuids: string[] | null;
  ts_utc: string;
  device_id: string;
};

type HourlyBucket = {
  hour_utc: string;
  unique_devices: number;
  new_devices: number;
  returning_devices: number;
};

type TopDevice = {
  mac: string;
  name: string | null;
  manufacturer: string | null;
  sightings: number;
  avg_rssi: number;
  first_seen: string;
  last_seen: string;
};

function isRandomizedMac(mac: string): boolean {
  const firstOctet = parseInt(mac.split(":")[0], 16);
  return (firstOctet & 0x02) !== 0;
}

function proximityLabel(rssi: number | null): string {
  if (rssi === null) return "Unknown";
  if (rssi > -60) return "Near";
  if (rssi > -75) return "Mid";
  return "Far";
}

function proximityColor(rssi: number | null): string {
  if (rssi === null) return "#6b7280";
  if (rssi > -60) return "#22c55e";
  if (rssi > -75) return "#f59e0b";
  return "#ef4444";
}

function timeAgo(ts: string | null) {
  if (!ts) return "never";
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

function fmtHour(ts: string) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function BLERunnerOverview() {
  const { selectedDeviceId, devices, setSelectedDeviceId } = useDevice();
  const [scans, setScans] = useState<BLEScan[]>([]);
  const [hourly, setHourly] = useState<HourlyBucket[]>([]);
  const [topDevices, setTopDevices] = useState<TopDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastTs, setLastTs] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const p = selectedDeviceId ? `?device_id=${selectedDeviceId}` : "";
        const hp = selectedDeviceId ? `?device_id=${selectedDeviceId}&hours=24` : "?hours=24";
        const [liveRes, histRes] = await Promise.all([
          fetch(`/api/blerunner/live${p}`),
          fetch(`/api/blerunner/history${hp}`),
        ]);
        const [live, hist] = await Promise.all([liveRes.json(), histRes.json()]);
        setScans(live.scans ?? []);
        setLastTs(live.stats?.newest_scan ?? null);
        setHourly(hist.hourly ?? []);
        setTopDevices(hist.topDevices ?? []);
      } finally {
        setLoading(false);
      }
    }
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [selectedDeviceId]);

  // Threat classification
  const nearDevices   = scans.filter(s => s.rssi !== null && s.rssi > -60);
  const rogueDevices  = scans.filter(s => isRandomizedMac(s.mac));
  const namedDevices  = scans.filter(s => s.name);
  const unknownNear   = nearDevices.filter(s => !s.name && isRandomizedMac(s.mac));

  const threatLevel = unknownNear.length > 5 ? "HIGH" : unknownNear.length > 2 ? "MEDIUM" : "LOW";
  const threatColor = threatLevel === "HIGH" ? "#ef4444" : threatLevel === "MEDIUM" ? "#f59e0b" : "#22c55e";
  const threatBg    = threatLevel === "HIGH" ? "border-red-700/60 bg-red-950/20" : threatLevel === "MEDIUM" ? "border-yellow-700/60 bg-yellow-950/20" : "border-green-700/60 bg-green-950/10";

  const stats = [
    { label: "In Range",     value: loading ? "—" : scans.length,        color: "#60a5fa" },
    { label: "Near (<-60)",  value: loading ? "—" : nearDevices.length,  color: "#22c55e" },
    { label: "Named",        value: loading ? "—" : namedDevices.length, color: "#e5e7eb" },
    { label: "Randomized",   value: loading ? "—" : rogueDevices.length, color: "#f59e0b" },
    { label: "Unknown Near", value: loading ? "—" : unknownNear.length,  color: unknownNear.length > 0 ? "#ef4444" : "#22c55e" },
    { label: "Threat Level", value: loading ? "—" : threatLevel,         color: threatColor },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">

      {/* Header */}
      <div className="flex items-center justify-between mb-6 max-w-6xl">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <span className="text-xl">🔵</span>
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-100 leading-tight">BLERunner</h1>
            <p className="text-xs text-gray-500 font-mono">
              {lastTs ? `Last scan: ${new Date(lastTs).toLocaleTimeString()}` : "Passive Bluetooth presence detection"}
            </p>
          </div>
        </div>
        <select
          value={selectedDeviceId || ""}
          onChange={e => setSelectedDeviceId(e.target.value)}
          style={{ background: "#111827", border: "1px solid #374151", borderRadius: 6, color: "#e5e7eb", padding: "6px 10px", fontSize: 12, fontFamily: "monospace" }}
        >
          {devices.map(d => (
            <option key={d.device_id} value={d.device_id}>
              {d.nickname ? `${d.nickname} (${d.nr_serial})` : d.nr_serial}
            </option>
          ))}
        </select>
      </div>

      <div className="max-w-6xl space-y-5">

        {/* Stat cards */}
        <div className="grid grid-cols-6 gap-3">
          {stats.map(({ label, value, color }) => (
            <div key={label} className="rounded-lg border border-gray-700/60 px-4 py-4 bg-gray-900/60">
              <div className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-2">{label}</div>
              <div className="text-2xl font-bold font-mono" style={{ color }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Threat View */}
        <div className={`rounded-lg border p-4 ${threatBg}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold" style={{ color: threatColor }}>
                ⚠ Threat Assessment
              </span>
              <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: threatColor + "22", color: threatColor }}>
                {threatLevel}
              </span>
            </div>
            <span className="text-xs text-gray-500">{unknownNear.length} unknown devices within range</span>
          </div>

          {unknownNear.length === 0 ? (
            <p className="text-xs text-green-400 font-mono">✓ No unknown devices in close proximity</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-500 uppercase tracking-wider border-b border-gray-700/40">
                    <th className="text-left py-2 pr-4">MAC</th>
                    <th className="text-left py-2 pr-4">Signal</th>
                    <th className="text-left py-2 pr-4">Proximity</th>
                    <th className="text-left py-2 pr-4">Services</th>
                    <th className="text-left py-2">Last Seen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700/20">
                  {unknownNear.map(s => (
                    <tr key={s.mac}>
                      <td className="py-2 pr-4 font-mono text-red-300">{s.mac}</td>
                      <td className="py-2 pr-4 font-mono" style={{ color: proximityColor(s.rssi) }}>{s.rssi} dBm</td>
                      <td className="py-2 pr-4" style={{ color: proximityColor(s.rssi) }}>{proximityLabel(s.rssi)}</td>
                      <td className="py-2 pr-4 text-gray-500">{s.service_uuids?.length ? `${s.service_uuids.length} service${s.service_uuids.length !== 1 ? "s" : ""}` : "none"}</td>
                      <td className="py-2 text-gray-500">{timeAgo(s.ts_utc)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Presence Map */}
        <div className="rounded-lg border border-gray-700/60 bg-gray-900/60 p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-semibold text-gray-200">Presence Map — 24h</div>
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span><span className="inline-block w-2 h-2 rounded-full bg-blue-400 mr-1"/>Total</span>
              <span><span className="inline-block w-2 h-2 rounded-full bg-green-400 mr-1"/>New</span>
              <span><span className="inline-block w-2 h-2 rounded-full bg-yellow-400 mr-1"/>Returning</span>
            </div>
          </div>
          {hourly.length === 0 ? (
            <p className="text-xs text-gray-600 text-center py-8 font-mono">No history data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={hourly} margin={{ top: 4, right: 0, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="totalGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#60a5fa" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="newGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="hour_utc" tickFormatter={fmtHour} tick={{ fontSize: 9, fill: "#6b7280" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 9, fill: "#6b7280" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: 6, fontSize: 11 }}
                  labelFormatter={fmtHour}
                  labelStyle={{ color: "#e5e7eb" }}
                  itemStyle={{ color: "#9ca3af" }}
                />
                <Area type="monotone" dataKey="unique_devices" name="Total" stroke="#60a5fa" fill="url(#totalGrad)" strokeWidth={2} dot={false} />
                <Area type="monotone" dataKey="new_devices" name="New" stroke="#22c55e" fill="url(#newGrad)" strokeWidth={1.5} dot={false} />
                <Area type="monotone" dataKey="returning_devices" name="Returning" stroke="#f59e0b" fill="none" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Proximity rings */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Near", subtitle: "< -60 dBm · likely same room", color: "#22c55e", border: "border-green-700/40", devices: scans.filter(s => s.rssi !== null && s.rssi > -60) },
            { label: "Mid",  subtitle: "-60 to -75 dBm · nearby space", color: "#f59e0b", border: "border-yellow-700/40", devices: scans.filter(s => s.rssi !== null && s.rssi <= -60 && s.rssi > -75) },
            { label: "Far",  subtitle: "< -75 dBm · distant", color: "#ef4444", border: "border-red-700/40",    devices: scans.filter(s => s.rssi === null || s.rssi <= -75) },
          ].map(ring => (
            <div key={ring.label} className={`rounded-lg border ${ring.border} bg-gray-900/60 p-4`}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold" style={{ color: ring.color }}>{ring.label}</span>
                <span className="text-2xl font-bold font-mono" style={{ color: ring.color }}>{ring.devices.length}</span>
              </div>
              <p className="text-[10px] text-gray-600 font-mono mb-3">{ring.subtitle}</p>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {ring.devices.slice(0, 8).map(s => (
                  <div key={s.mac} className="flex items-center justify-between">
                    <span className="font-mono text-[10px] text-gray-400">{s.name ?? s.mac.slice(0, 17)}</span>
                    <span className="font-mono text-[10px]" style={{ color: ring.color }}>{s.rssi} dBm</span>
                  </div>
                ))}
                {ring.devices.length > 8 && (
                  <p className="text-[10px] text-gray-600 text-center">+{ring.devices.length - 8} more</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Persistent devices */}
        <div className="rounded-lg border border-gray-700/60 bg-gray-900/60 p-4">
          <div className="text-sm font-semibold text-gray-200 mb-1">Persistent Devices — 24h</div>
          <p className="text-[10px] text-gray-600 font-mono mb-3">Devices seen most frequently — likely local or owned</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500 uppercase tracking-wider border-b border-gray-700/40">
                  <th className="text-left py-2 pr-4">MAC</th>
                  <th className="text-left py-2 pr-4">Name</th>
                  <th className="text-left py-2 pr-4">Vendor</th>
                  <th className="text-right py-2 pr-4">Sightings</th>
                  <th className="text-left py-2">First / Last</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/30">
                {topDevices.slice(0, 10).map(d => (
                  <tr key={d.mac} className="hover:bg-gray-800/30">
                    <td className="py-2 pr-4 font-mono text-gray-300">{d.mac}</td>
                    <td className="py-2 pr-4 text-gray-300">{d.name ?? <span className="text-gray-600">—</span>}</td>
                    <td className="py-2 pr-4 text-gray-500">{d.manufacturer ?? <span className="text-gray-600">Unknown</span>}</td>
                    <td className="py-2 pr-4 text-right font-mono text-blue-400">{d.sightings}</td>
                    <td className="py-2 text-gray-500 font-mono text-[10px]">
                      {new Date(d.first_seen).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} → {new Date(d.last_seen).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </td>
                  </tr>
                ))}
                {topDevices.length === 0 && !loading && (
                  <tr><td colSpan={5} className="py-6 text-center text-gray-600 font-mono">No data yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
// Wed Mar 25 21:09:14 EDT 2026
