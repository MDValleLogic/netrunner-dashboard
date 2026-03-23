"use client";

import { useEffect, useState } from "react";
import DashboardShell from "@/components/DashboardShell";
import { useDevice } from "@/lib/deviceContext";
import Link from "next/link";

type Stats = {
  total_devices: number;
  near_devices: number;
  named_devices: number;
  manufacturers: number;
  newest_scan: string | null;
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

type TopManufacturer = {
  manufacturer: string;
  device_count: number;
};

function rssiBar(rssi: number | null) {
  if (rssi === null) return <span className="text-zinc-600">—</span>;
  const pct = Math.max(0, Math.min(100, ((rssi + 100) / 70) * 100));
  const color = rssi > -60 ? "bg-green-400" : rssi > -80 ? "bg-yellow-400" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-zinc-400 tabular-nums">{rssi} dBm</span>
    </div>
  );
}

function timeAgo(ts: string | null) {
  if (!ts) return "never";
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

export default function BLERunnerOverview() {
  const { selectedDevice } = useDevice();
  const [stats, setStats] = useState<Stats | null>(null);
  const [topDevices, setTopDevices] = useState<TopDevice[]>([]);
  const [topManufacturers, setTopManufacturers] = useState<TopManufacturer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch24h() {
      setLoading(true);
      try {
        const liveParams = selectedDevice ? `?device_id=${selectedDevice.device_id}` : "";
        const histParams = selectedDevice ? `?device_id=${selectedDevice.device_id}&hours=24` : "?hours=24";
        const [liveRes, histRes] = await Promise.all([
          fetch(`/api/blerunner/live${liveParams}`),
          fetch(`/api/blerunner/history${histParams}`),
        ]);
        const [live, hist] = await Promise.all([liveRes.json(), histRes.json()]);
        setStats(live.stats);
        setTopDevices(hist.topDevices ?? []);
        setTopManufacturers(hist.topManufacturers ?? []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetch24h();
    const t = setInterval(fetch24h, 60_000);
    return () => clearInterval(t);
  }, [selectedDevice]);

  return (
    <DashboardShell>
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">🔵 BLERunner</h1>
            <p className="text-zinc-500 text-sm mt-0.5">Passive Bluetooth presence detection · last 24h</p>
          </div>
          <div className="flex gap-2">
            <Link href="/blerunner/live" className="text-sm bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg transition-colors font-medium">
              Live Feed →
            </Link>
            <Link href="/blerunner/history" className="text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-4 py-2 rounded-lg transition-colors">
              History
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Devices in Range", value: stats?.total_devices ?? "—", color: "text-blue-400" },
            { label: "Near (<-70 dBm)",  value: stats?.near_devices ?? "—",  color: "text-green-400" },
            { label: "Named Devices",    value: stats?.named_devices ?? "—", color: "text-white" },
            { label: "Manufacturers",    value: stats?.manufacturers ?? "—", color: "text-yellow-400" },
          ].map((c) => (
            <div key={c.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <p className="text-xs text-zinc-500 uppercase tracking-widest mb-1">{c.label}</p>
              <p className={`text-3xl font-bold tabular-nums ${c.color}`}>
                {loading ? <span className="text-zinc-700">…</span> : c.value}
              </p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-800">
              <h2 className="text-sm font-semibold text-zinc-300">Most Seen Devices (24h)</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-500 text-xs uppercase tracking-wider">
                    <th className="px-4 py-2 text-left">MAC</th>
                    <th className="px-4 py-2 text-left">Name</th>
                    <th className="px-4 py-2 text-left">Manufacturer</th>
                    <th className="px-4 py-2 text-left">Signal</th>
                    <th className="px-4 py-2 text-right">Sightings</th>
                    <th className="px-4 py-2 text-left">Last Seen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {topDevices.length === 0 && !loading && (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-zinc-600 text-xs">No BLE data yet — waiting for first scan</td></tr>
                  )}
                  {topDevices.map((d) => (
                    <tr key={d.mac} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="px-4 py-2.5 font-mono text-xs text-zinc-300">{d.mac}</td>
                      <td className="px-4 py-2.5 text-xs text-zinc-200">{d.name ?? <span className="text-zinc-600">—</span>}</td>
                      <td className="px-4 py-2.5 text-xs text-zinc-400">{d.manufacturer ?? <span className="text-zinc-600">Unknown</span>}</td>
                      <td className="px-4 py-2.5">{rssiBar(Math.round(d.avg_rssi))}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs text-zinc-300">{d.sightings}</td>
                      <td className="px-4 py-2.5 text-xs text-zinc-500">{timeAgo(d.last_seen)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-800">
              <h2 className="text-sm font-semibold text-zinc-300">By Manufacturer</h2>
            </div>
            <div className="p-4 space-y-3">
              {topManufacturers.length === 0 && !loading && (
                <p className="text-zinc-600 text-xs text-center py-4">No data yet</p>
              )}
              {topManufacturers.map((m, i) => {
                const max = topManufacturers[0]?.device_count ?? 1;
                const pct = Math.round((m.device_count / max) * 100);
                return (
                  <div key={m.manufacturer}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-zinc-300 truncate">{m.manufacturer}</span>
                      <span className="text-zinc-500 tabular-nums ml-2">{m.device_count}</span>
                    </div>
                    <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%`, opacity: 1 - i * 0.08 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
