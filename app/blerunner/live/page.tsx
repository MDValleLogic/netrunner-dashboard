"use client";

import { useEffect, useState, useRef } from "react";
import DashboardShell from "@/components/DashboardShell";
import { useDevice } from "@/lib/deviceContext";

type BLEScan = {
  mac: string;
  name: string | null;
  rssi: number | null;
  manufacturer: string | null;
  service_uuids: string[] | null;
  tx_power: number | null;
  ts_utc: string;
  device_id: string;
};

type Stats = {
  total_devices: number;
  near_devices: number;
  named_devices: number;
  manufacturers: number;
  newest_scan: string | null;
};

function rssiColor(rssi: number | null) {
  if (rssi === null) return "text-zinc-600";
  if (rssi > -60) return "text-green-400";
  if (rssi > -75) return "text-yellow-400";
  return "text-red-400";
}

function rssiLabel(rssi: number | null) {
  if (rssi === null) return "—";
  if (rssi > -60) return "Near";
  if (rssi > -75) return "Mid";
  return "Far";
}

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  return `${Math.floor(secs / 60)}m ago`;
}

export default function BLERunnerLive() {
  const { selectedDevice } = useDevice();
  const [scans, setScans] = useState<BLEScan[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [filter, setFilter] = useState("");
  const intervalRef = useRef<NodeJS.Timeout | undefined>(undefined);

  async function fetchLive() {
    try {
      const params = selectedDevice ? `?device_id=${selectedDevice.device_id}` : "";
      const res = await fetch(`/api/blerunner/live${params}`);
      const data = await res.json();
      setScans(data.scans ?? []);
      setStats(data.stats ?? null);
      setLastUpdate(new Date());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchLive();
    intervalRef.current = setInterval(fetchLive, 30_000);
    return () => clearInterval(intervalRef.current);
  }, [selectedDevice]);

  const filtered = scans.filter((s) => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return (
      s.mac.toLowerCase().includes(q) ||
      (s.name?.toLowerCase().includes(q) ?? false) ||
      (s.manufacturer?.toLowerCase().includes(q) ?? false)
    );
  });

  const sorted = [...filtered].sort((a, b) => (b.rssi ?? -120) - (a.rssi ?? -120));

  return (
    <DashboardShell>
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">🔵 BLERunner — Live Feed</h1>
            <p className="text-zinc-500 text-sm mt-0.5">
              Passive scan · last 5 minutes · refreshes every 30s · {lastUpdate.toLocaleTimeString()}
            </p>
          </div>
          <button onClick={fetchLive}
            className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-1.5 rounded-lg border border-zinc-700 transition-colors">
            ↺ Refresh
          </button>
        </div>

        {stats && (
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "In Range",  value: stats.total_devices, color: "text-blue-400"   },
              { label: "Near",      value: stats.near_devices,  color: "text-green-400"  },
              { label: "Named",     value: stats.named_devices, color: "text-white"      },
              { label: "Vendors",   value: stats.manufacturers, color: "text-yellow-400" },
            ].map((c) => (
              <div key={c.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-center">
                <p className={`text-2xl font-bold tabular-nums ${c.color}`}>{c.value}</p>
                <p className="text-xs text-zinc-500 mt-0.5">{c.label}</p>
              </div>
            ))}
          </div>
        )}

        <input
          type="text"
          placeholder="Filter by MAC, name, or manufacturer…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-blue-500 font-mono"
        />

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-zinc-800 flex items-center justify-between">
            <span className="text-xs text-zinc-500">{sorted.length} device{sorted.length !== 1 ? "s" : ""} detected</span>
            <span className="text-xs text-zinc-600">sorted by signal strength</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-500 text-xs uppercase tracking-wider">
                  <th className="px-4 py-2.5 text-left">MAC Address</th>
                  <th className="px-4 py-2.5 text-left">Name</th>
                  <th className="px-4 py-2.5 text-left">Manufacturer</th>
                  <th className="px-4 py-2.5 text-left">Signal</th>
                  <th className="px-4 py-2.5 text-left">Proximity</th>
                  <th className="px-4 py-2.5 text-left">Services</th>
                  <th className="px-4 py-2.5 text-left">Seen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/40">
                {loading && (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-zinc-600 text-xs">Loading…</td></tr>
                )}
                {!loading && sorted.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-zinc-600 text-xs">
                    {scans.length === 0 ? "No BLE devices detected in last 5 minutes" : "No results match your filter"}
                  </td></tr>
                )}
                {sorted.map((s) => (
                  <tr key={s.mac} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="px-4 py-2.5 font-mono text-xs text-zinc-200">{s.mac}</td>
                    <td className="px-4 py-2.5 text-xs text-zinc-300">
                      {s.name ?? <span className="text-zinc-600 italic">unknown</span>}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-zinc-400">
                      {s.manufacturer ?? <span className="text-zinc-600">Unknown</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`font-mono text-xs font-semibold ${rssiColor(s.rssi)}`}>
                        {s.rssi !== null ? `${s.rssi} dBm` : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs font-medium ${rssiColor(s.rssi)}`}>
                        {rssiLabel(s.rssi)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-zinc-500">
                      {s.service_uuids?.length
                        ? <span title={s.service_uuids.join(", ")}>{s.service_uuids.length} service{s.service_uuids.length !== 1 ? "s" : ""}</span>
                        : <span className="text-zinc-700">none</span>}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-zinc-500">{timeAgo(s.ts_utc)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
