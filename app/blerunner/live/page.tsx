"use client";
import { useDevice } from "@/lib/deviceContext";
import React, { useEffect, useState, useRef } from "react";

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

function isRandomizedMac(mac: string): boolean {
  const firstOctet = parseInt(mac.split(":")[0], 16);
  return (firstOctet & 0x02) !== 0;
}

function rssiColor(rssi: number | null): string {
  if (rssi === null) return "#6b7280";
  if (rssi > -60) return "#22c55e";
  if (rssi > -75) return "#f59e0b";
  return "#ef4444";
}

function rssiLabel(rssi: number | null): string {
  if (rssi === null) return "—";
  if (rssi > -60) return "Near";
  if (rssi > -75) return "Mid";
  return "Far";
}

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  return `${Math.floor(secs / 60)}m ago`;
}

export default function BLERunnerLive() {
  const { selectedDeviceId, devices, setSelectedDeviceId } = useDevice();
  const [scans, setScans] = useState<BLEScan[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [filter, setFilter] = useState("");
  const [showUnknownOnly, setShowUnknownOnly] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | undefined>(undefined);

  async function fetchLive() {
    try {
      const p = selectedDeviceId ? `?device_id=${selectedDeviceId}` : "";
      const res = await fetch(`/api/blerunner/live${p}`);
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
  }, [selectedDeviceId]);

  let filtered = scans;
  if (showUnknownOnly) filtered = filtered.filter(s => !s.name && isRandomizedMac(s.mac));
  if (filter) {
    const q = filter.toLowerCase();
    filtered = filtered.filter(s =>
      s.mac.toLowerCase().includes(q) ||
      (s.name?.toLowerCase().includes(q) ?? false) ||
      (s.manufacturer?.toLowerCase().includes(q) ?? false)
    );
  }
  const sorted = [...filtered].sort((a, b) => (b.rssi ?? -120) - (a.rssi ?? -120));

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">

      {/* Header */}
      <div className="flex items-center justify-between mb-6 max-w-6xl">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <span className="text-xl">🔵</span>
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-100 leading-tight">BLERunner — Live Feed</h1>
            <p className="text-xs text-gray-500 font-mono">
              Passive scan · last 5 min · {lastUpdate.toLocaleTimeString()}
            </p>
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
          <button onClick={fetchLive}
            className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg border border-gray-700 transition-colors font-mono">
            ↺ Refresh
          </button>
        </div>
      </div>

      <div className="max-w-6xl space-y-4">

        {/* Stat cards */}
        {stats && (
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "In Range",  value: stats.total_devices, color: "#60a5fa" },
              { label: "Near",      value: stats.near_devices,  color: "#22c55e" },
              { label: "Named",     value: stats.named_devices, color: "#e5e7eb" },
              { label: "Vendors",   value: stats.manufacturers, color: "#f59e0b" },
            ].map(c => (
              <div key={c.label} className="rounded-lg border border-gray-700/60 px-4 py-4 bg-gray-900/60">
                <div className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-2">{c.label}</div>
                <div className="text-2xl font-bold font-mono" style={{ color: c.color }}>{c.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Filter by MAC, name, or manufacturer…"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500 font-mono"
          />
          <button
            onClick={() => setShowUnknownOnly(!showUnknownOnly)}
            className={`text-xs px-4 py-2 rounded-lg border font-mono transition-colors ${
              showUnknownOnly
                ? "bg-red-950/40 border-red-700 text-red-300"
                : "bg-gray-900 border-gray-700 text-gray-500 hover:text-gray-300"
            }`}
          >
            ⚠ Unknown Only
          </button>
        </div>

        {/* Device table */}
        <div className="rounded-lg border border-gray-700/60 bg-gray-900/60 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-700/40 flex items-center justify-between">
            <span className="text-xs text-gray-500 font-mono">{sorted.length} device{sorted.length !== 1 ? "s" : ""} detected</span>
            <span className="text-xs text-gray-600 font-mono">sorted by signal strength</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-700/40 text-gray-500 uppercase tracking-wider">
                  <th className="px-4 py-2.5 text-left">MAC Address</th>
                  <th className="px-4 py-2.5 text-left">Name</th>
                  <th className="px-4 py-2.5 text-left">Manufacturer</th>
                  <th className="px-4 py-2.5 text-left">Signal</th>
                  <th className="px-4 py-2.5 text-left">Proximity</th>
                  <th className="px-4 py-2.5 text-left">Type</th>
                  <th className="px-4 py-2.5 text-left">Services</th>
                  <th className="px-4 py-2.5 text-left">Seen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/20">
                {loading && (
                  <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-600 font-mono">Loading…</td></tr>
                )}
                {!loading && sorted.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-600 font-mono">
                    {scans.length === 0 ? "No BLE devices detected in last 5 minutes" : "No results match filter"}
                  </td></tr>
                )}
                {sorted.map(s => {
                  const isRogue = isRandomizedMac(s.mac);
                  const isUnknownNear = isRogue && !s.name && s.rssi !== null && s.rssi > -60;
                  return (
                    <tr key={s.mac} className={`hover:bg-gray-800/30 transition-colors ${isUnknownNear ? "bg-red-950/10" : ""}`}>
                      <td className="px-4 py-2.5 font-mono" style={{ color: isUnknownNear ? "#fca5a5" : "#d1d5db" }}>{s.mac}</td>
                      <td className="px-4 py-2.5 text-gray-300">
                        {s.name ?? <span className="text-gray-600 italic">unknown</span>}
                      </td>
                      <td className="px-4 py-2.5 text-gray-500">
                        {s.manufacturer ?? <span className="text-gray-600">Unknown</span>}
                      </td>
                      <td className="px-4 py-2.5 font-mono font-semibold" style={{ color: rssiColor(s.rssi) }}>
                        {s.rssi !== null ? `${s.rssi} dBm` : "—"}
                      </td>
                      <td className="px-4 py-2.5 font-semibold" style={{ color: rssiColor(s.rssi) }}>
                        {rssiLabel(s.rssi)}
                      </td>
                      <td className="px-4 py-2.5">
                        {isRogue
                          ? <span className="text-yellow-500 text-[10px] font-mono">RANDOM</span>
                          : <span className="text-gray-600 text-[10px] font-mono">STATIC</span>}
                      </td>
                      <td className="px-4 py-2.5 text-gray-500">
                        {s.service_uuids?.length
                          ? <span title={s.service_uuids.join(", ")}>{s.service_uuids.length} svc</span>
                          : <span className="text-gray-700">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-gray-500 font-mono">{timeAgo(s.ts_utc)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
