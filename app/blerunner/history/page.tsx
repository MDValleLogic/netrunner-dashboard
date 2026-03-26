"use client";
import { useDevice } from "@/lib/deviceContext";
import React, { useEffect, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from "recharts";

type HourlyBucket = {
  hour_utc: string;
  unique_devices: number;
  avg_rssi: number | null;
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

type TopMfr = { manufacturer: string; device_count: number };

function fmtHour(ts: string) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function fmtDate(ts: string) {
  return new Date(ts).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
function rssiColor(rssi: number | null): string {
  if (rssi === null) return "#6b7280";
  if (rssi > -60) return "#22c55e";
  if (rssi > -75) return "#f59e0b";
  return "#ef4444";
}

export default function BLERunnerHistory() {
  const { selectedDeviceId, devices, setSelectedDeviceId } = useDevice();
  const [hours, setHours] = useState(24);
  const [hourly, setHourly] = useState<HourlyBucket[]>([]);
  const [topDevices, setTopDevices] = useState<TopDevice[]>([]);
  const [topMfrs, setTopMfrs] = useState<TopMfr[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams({ hours: String(hours) });
        if (selectedDeviceId) params.set("device_id", selectedDeviceId);
        const res = await fetch(`/api/blerunner/history?${params}`);
        const data = await res.json();
        setHourly(data.hourly ?? []);
        setTopDevices(data.topDevices ?? []);
        setTopMfrs(data.topManufacturers ?? []);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [hours, selectedDeviceId]);

  const peakHour = hourly.reduce((a, b) => a.unique_devices > b.unique_devices ? a : b, hourly[0]);
  const totalSightings = topDevices.reduce((a, b) => a + b.sightings, 0);
  const avgDevicesPerHour = hourly.length ? Math.round(hourly.reduce((a, b) => a + b.unique_devices, 0) / hourly.length) : 0;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">

      {/* Header */}
      <div className="flex items-center justify-between mb-6 max-w-6xl">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <span className="text-xl">🔵</span>
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-100 leading-tight">BLERunner — History</h1>
            <p className="text-xs text-gray-500 font-mono">Hourly aggregated BLE presence data</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
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
          <div className="flex gap-1">
            {[6, 24, 48, 168].map(h => (
              <button key={h} onClick={() => setHours(h)}
                className="text-xs px-3 py-1.5 rounded-lg border font-mono transition-colors"
                style={{
                  background: hours === h ? "#1d4ed8" : "#111827",
                  borderColor: hours === h ? "#1d4ed8" : "#374151",
                  color: hours === h ? "#fff" : "#9ca3af",
                }}>
                {h < 48 ? `${h}h` : `${h / 24}d`}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-6xl space-y-5">

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Avg Devices/Hour", value: loading ? "—" : avgDevicesPerHour, color: "#60a5fa" },
            { label: "Peak Hour Devices", value: loading || !peakHour ? "—" : peakHour.unique_devices, color: "#22c55e" },
            { label: "Total Sightings", value: loading ? "—" : totalSightings.toLocaleString(), color: "#e5e7eb" },
          ].map(c => (
            <div key={c.label} className="rounded-lg border border-gray-700/60 px-4 py-4 bg-gray-900/60">
              <div className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-2">{c.label}</div>
              <div className="text-2xl font-bold font-mono" style={{ color: c.color }}>{c.value}</div>
              {c.label === "Peak Hour Devices" && peakHour && !loading && (
                <div className="text-[10px] text-gray-600 font-mono mt-1">{fmtDate(peakHour.hour_utc)}</div>
              )}
            </div>
          ))}
        </div>

        {/* Presence timeline */}
        <div className="rounded-lg border border-gray-700/60 bg-gray-900/60 p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-semibold text-gray-200">Device Presence Timeline</div>
            <div className="flex items-center gap-4 text-xs text-gray-500 font-mono">
              <span><span className="inline-block w-2 h-2 rounded-full bg-blue-400 mr-1"/>Total</span>
              <span><span className="inline-block w-2 h-2 rounded-full bg-green-400 mr-1"/>New</span>
              <span><span className="inline-block w-2 h-2 rounded-full bg-yellow-400 mr-1"/>Returning</span>
            </div>
          </div>
          {hourly.length === 0 && !loading ? (
            <p className="text-xs text-gray-600 text-center py-8 font-mono">No history data for this period</p>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={hourly} margin={{ top: 4, right: 0, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="totalGrad2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#60a5fa" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="newGrad2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="hour_utc" tickFormatter={fmtHour} tick={{ fontSize: 9, fill: "#6b7280" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 9, fill: "#6b7280" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: 6, fontSize: 11 }}
                  labelFormatter={fmtDate}
                  labelStyle={{ color: "#e5e7eb" }}
                  itemStyle={{ color: "#9ca3af" }}
                />
                <Area type="monotone" dataKey="unique_devices" name="Total" stroke="#60a5fa" fill="url(#totalGrad2)" strokeWidth={2} dot={false} />
                <Area type="monotone" dataKey="new_devices" name="New" stroke="#22c55e" fill="url(#newGrad2)" strokeWidth={1.5} dot={false} />
                <Area type="monotone" dataKey="returning_devices" name="Returning" stroke="#f59e0b" fill="none" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="grid grid-cols-3 gap-4">

          {/* Persistent devices */}
          <div className="col-span-2 rounded-lg border border-gray-700/60 bg-gray-900/60 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-700/40">
              <div className="text-sm font-semibold text-gray-200">Persistent Devices</div>
              <div className="text-[10px] text-gray-600 font-mono mt-0.5">Most frequently seen — likely local or owned</div>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-700/40 text-gray-500 uppercase tracking-wider">
                  <th className="px-4 py-2 text-left">MAC</th>
                  <th className="px-4 py-2 text-left">Name</th>
                  <th className="px-4 py-2 text-left">Vendor</th>
                  <th className="px-4 py-2 text-left">Avg Signal</th>
                  <th className="px-4 py-2 text-right">Sightings</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/20">
                {topDevices.length === 0 && !loading && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-600 font-mono">No data for this period</td></tr>
                )}
                {topDevices.slice(0, 12).map(d => (
                  <tr key={d.mac} className="hover:bg-gray-800/30">
                    <td className="px-4 py-2 font-mono text-gray-300">{d.mac}</td>
                    <td className="px-4 py-2 text-gray-300">{d.name ?? <span className="text-gray-600">—</span>}</td>
                    <td className="px-4 py-2 text-gray-500">{d.manufacturer ?? <span className="text-gray-600">Unknown</span>}</td>
                    <td className="px-4 py-2 font-mono font-semibold" style={{ color: rssiColor(Math.round(d.avg_rssi)) }}>
                      {Math.round(d.avg_rssi)} dBm
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-blue-400">{d.sightings}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Manufacturer breakdown */}
          <div className="rounded-lg border border-gray-700/60 bg-gray-900/60 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-700/40">
              <div className="text-sm font-semibold text-gray-200">Manufacturers</div>
            </div>
            {topMfrs.length === 0 && !loading ? (
              <p className="text-xs text-gray-600 text-center py-8 font-mono">No data</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={topMfrs} layout="vertical" margin={{ top: 12, right: 16, bottom: 8, left: 8 }}>
                  <XAxis type="number" tick={{ fontSize: 9, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="manufacturer" tick={{ fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} width={70} />
                  <Tooltip
                    contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: 6, fontSize: 11 }}
                    labelStyle={{ color: "#e5e7eb" }}
                    itemStyle={{ color: "#9ca3af" }}
                  />
                  <Bar dataKey="device_count" name="Devices" radius={[0, 4, 4, 0]}>
                    {topMfrs.map((_, i) => (
                      <Cell key={i} fill={`rgba(96,165,250,${1 - i * 0.08})`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
