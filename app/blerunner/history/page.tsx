"use client";

import { useEffect, useState } from "react";
import DashboardShell from "@/components/DashboardShell";
import { useDevice } from "@/lib/deviceContext";

type HourlyBucket = {
  hour_utc: string;
  device_id: string;
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

function fmt(ts: string) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function fmtDate(ts: string) {
  return new Date(ts).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function BLERunnerHistory() {
  const { selectedDevice } = useDevice();
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
        if (selectedDevice) params.set("device_id", selectedDevice.device_id);
        const res = await fetch(`/api/blerunner/history?${params}`);
        const data = await res.json();
        setHourly(data.hourly ?? []);
        setTopDevices(data.topDevices ?? []);
        setTopMfrs(data.topManufacturers ?? []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [hours, selectedDevice]);

  const maxDevices = Math.max(...hourly.map((h) => h.unique_devices), 1);

  return (
    <DashboardShell>
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">🔵 BLERunner — History</h1>
            <p className="text-zinc-500 text-sm mt-0.5">Hourly aggregated BLE presence data</p>
          </div>
          <div className="flex gap-2">
            {[6, 24, 48, 168].map((h) => (
              <button key={h} onClick={() => setHours(h)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                  hours === h
                    ? "bg-blue-600 border-blue-600 text-white"
                    : "bg-zinc-900 border-zinc-700 text-zinc-400 hover:text-zinc-200"
                }`}>
                {h < 48 ? `${h}h` : `${h / 24}d`}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-zinc-400 mb-4">Unique BLE Devices per Hour</h2>
          {hourly.length === 0 && !loading && (
            <p className="text-zinc-600 text-xs text-center py-8">No history data yet</p>
          )}
          {hourly.length > 0 && (
            <>
              <div className="flex items-end gap-0.5 h-24">
                {hourly.map((h, i) => {
                  const pct = (h.unique_devices / maxDevices) * 100;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center justify-end group relative"
                      title={`${fmt(h.hour_utc)}: ${h.unique_devices} devices`}>
                      <div className="w-full bg-blue-500/70 hover:bg-blue-400 rounded-sm transition-colors"
                        style={{ height: `${Math.max(pct, 2)}%` }} />
                      <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-10">
                        {fmt(h.hour_utc)}: {h.unique_devices} devices<br />
                        <span className="text-green-400">{h.new_devices} new</span> · <span className="text-zinc-400">{h.returning_devices} returning</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between text-xs text-zinc-600 mt-2">
                <span>{fmtDate(hourly[0].hour_utc)}</span>
                <span>{fmtDate(hourly[hourly.length - 1].hour_utc)}</span>
              </div>
            </>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-800">
              <h2 className="text-sm font-semibold text-zinc-300">Persistent Devices</h2>
              <p className="text-xs text-zinc-600 mt-0.5">Most frequently seen — likely local or owned</p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-500 text-xs uppercase tracking-wider">
                  <th className="px-4 py-2 text-left">MAC</th>
                  <th className="px-4 py-2 text-left">Name</th>
                  <th className="px-4 py-2 text-left">Vendor</th>
                  <th className="px-4 py-2 text-right">Sightings</th>
                  <th className="px-4 py-2 text-left">First / Last</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {topDevices.length === 0 && !loading && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-zinc-600 text-xs">No data for this period</td></tr>
                )}
                {topDevices.map((d) => (
                  <tr key={d.mac} className="hover:bg-zinc-800/30">
                    <td className="px-4 py-2 font-mono text-xs text-zinc-200">{d.mac}</td>
                    <td className="px-4 py-2 text-xs text-zinc-300">{d.name ?? <span className="text-zinc-600">—</span>}</td>
                    <td className="px-4 py-2 text-xs text-zinc-400">{d.manufacturer ?? <span className="text-zinc-600">Unknown</span>}</td>
                    <td className="px-4 py-2 text-right font-mono text-xs text-blue-400">{d.sightings}</td>
                    <td className="px-4 py-2 text-xs text-zinc-500">{fmtDate(d.first_seen)} → {fmtDate(d.last_seen)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-800">
              <h2 className="text-sm font-semibold text-zinc-300">Manufacturers</h2>
            </div>
            <div className="p-4 space-y-3">
              {topMfrs.length === 0 && !loading && (
                <p className="text-zinc-600 text-xs text-center py-4">No data</p>
              )}
              {topMfrs.map((m, i) => {
                const max = topMfrs[0]?.device_count ?? 1;
                const pct = Math.round((m.device_count / max) * 100);
                return (
                  <div key={m.manufacturer}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-zinc-300 truncate">{m.manufacturer}</span>
                      <span className="text-zinc-500 ml-2 tabular-nums">{m.device_count}</span>
                    </div>
                    <div className="h-1.5 bg-zinc-800 rounded-full">
                      <div className="h-full bg-blue-500 rounded-full"
                        style={{ width: `${pct}%`, opacity: 1 - i * 0.08 }} />
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
