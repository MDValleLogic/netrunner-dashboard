"use client";
import { useDevice } from "@/lib/deviceContext";

import { useEffect, useState } from "react";
import { History, Radio } from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell, Legend
} from "recharts";

interface HourlyRow {
  hour_utc: string;
  ap_count: number;
  ssid_count: number;
  best_signal: number;
  avg_signal: number;
  band_24_count: number;
  band_5_count: number;
  open_count: number;
  scan_count: number;
}

const fmt = (ts: string) => {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const fmtDate = (ts: string) => {
  const d = new Date(ts);
  return d.toLocaleDateString([], { month: "short", day: "numeric" }) + " " +
         d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const tooltipStyle = {
  contentStyle: { background: "#111827", border: "1px solid #374151", borderRadius: 6, fontSize: 12 },
  labelStyle: { color: "#e5e7eb" },
  itemStyle: { color: "#9ca3af" },
};

export default function RFRunnerHistoryPage() {
  const { selectedDeviceId, devices, setSelectedDeviceId } = useDevice();
  const [rows, setRows]       = useState<HourlyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [range, setRange]     = useState<"24h" | "7d" | "30d">("24h");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/rfrunner/history?range=${range}${selectedDeviceId ? "&device_id="+selectedDeviceId : ""}`)
      .then(r => r.json())
      .then(j => setRows(j.rows ?? []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [range]);
  useEffect(() => { fetchData(); }, [selectedDeviceId]); // eslint-disable-line

  // Chart data — oldest first for left-to-right time flow
  const chartData = [...rows].reverse().map(r => ({
    ...r,
    label: fmt(r.hour_utc),
    labelFull: fmtDate(r.hour_utc),
  }));

  // Summary stats from most recent row
  const latest = rows[0];

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">

      {/* Header */}
      <div className="flex items-center justify-between mb-6 max-w-5xl">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <Radio size={20} className="text-blue-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-100 leading-tight">RF History</h1>
            <p className="text-xs text-gray-500 font-mono">Hourly aggregated RF environment data</p>
          </div>
        </div>

        {/* Range selector */}
        <div className="flex gap-2">
          {(["24h", "7d", "30d"] as const).map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-colors ${
                range === r
                  ? "bg-blue-600 text-white"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700 border border-gray-700"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-5xl space-y-4">

        {/* Error */}
        {error && (
          <div className="px-4 py-3 rounded-lg bg-red-900/30 border border-red-700/50 text-red-400 text-sm font-mono">
            ⚠ {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-48 rounded-lg bg-gray-800/60 animate-pulse" />
            ))}
          </div>
        )}

        {!loading && rows.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-gray-600">
            <History size={40} className="mb-3 opacity-30" />
            <p className="text-sm font-mono">No history data yet — check back after the first hourly archive runs</p>
          </div>
        )}

        {!loading && rows.length > 0 && (
          <>
            {/* Stat cards */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: "Hours of Data",   value: rows.length },
                { label: "Latest AP Count", value: latest?.ap_count ?? "—" },
                { label: "Best Signal",     value: latest ? `${latest.best_signal} dBm` : "—" },
                { label: "Avg Signal",      value: latest ? `${latest.avg_signal} dBm` : "—" },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-lg border border-gray-700/60 bg-gray-900/60 px-4 py-4">
                  <div className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-2">{label}</div>
                  <div className="text-2xl font-bold font-mono text-white">{value}</div>
                </div>
              ))}
            </div>

            {/* AP Count over time */}
            <div className="rounded-lg border border-gray-700/60 bg-gray-900/60 p-4">
              <div className="text-sm font-semibold text-gray-200 mb-4">APs Visible Over Time</div>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData}>
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} width={30} />
                  <Tooltip {...tooltipStyle} labelFormatter={(l, p) => p?.[0]?.payload?.labelFull ?? l} />
                  <Line type="monotone" dataKey="ap_count" stroke="#60a5fa" strokeWidth={2} dot={false} name="APs" />
                  <Line type="monotone" dataKey="ssid_count" stroke="#a78bfa" strokeWidth={2} dot={false} name="SSIDs" />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Signal over time */}
            <div className="rounded-lg border border-gray-700/60 bg-gray-900/60 p-4">
              <div className="text-sm font-semibold text-gray-200 mb-4">Signal Strength Over Time (dBm)</div>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData}>
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} width={40} domain={['dataMin - 5', 'dataMax + 5']} />
                  <Tooltip {...tooltipStyle} labelFormatter={(l, p) => p?.[0]?.payload?.labelFull ?? l} />
                  <Line type="monotone" dataKey="best_signal" stroke="#22c55e" strokeWidth={2} dot={false} name="Best" />
                  <Line type="monotone" dataKey="avg_signal"  stroke="#f59e0b" strokeWidth={2} dot={false} name="Avg" />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Band distribution over time */}
            <div className="rounded-lg border border-gray-700/60 bg-gray-900/60 p-4">
              <div className="text-sm font-semibold text-gray-200 mb-4">Band Distribution Over Time</div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} barCategoryGap="20%">
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} width={30} />
                  <Tooltip {...tooltipStyle} labelFormatter={(l, p) => p?.[0]?.payload?.labelFull ?? l} />
                  <Bar dataKey="band_24_count" name="2.4 GHz" stackId="a" fill="#f59e0b" radius={[0,0,0,0]} />
                  <Bar dataKey="band_5_count"  name="5 GHz"   stackId="a" fill="#60a5fa" radius={[4,4,0,0]} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Raw table */}
            <div className="rounded-lg border border-gray-700/60 bg-gray-900/60 p-4">
              <div className="text-sm font-semibold text-gray-200 mb-4">Hourly Log</div>
              <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto_auto] gap-x-4 text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-2 px-1">
                <span>Hour</span>
                <span className="text-right">APs</span>
                <span className="text-right">SSIDs</span>
                <span className="text-right">Best</span>
                <span className="text-right">Avg</span>
                <span className="text-right">2.4G</span>
                <span className="text-right">5G</span>
              </div>
              {rows.map(r => (
                <div key={r.hour_utc} className="grid grid-cols-[1fr_auto_auto_auto_auto_auto_auto] gap-x-4 items-center px-1 py-1.5 border-t border-gray-800 hover:bg-gray-800/40 rounded transition-colors">
                  <span className="font-mono text-xs text-gray-400">{fmtDate(r.hour_utc)}</span>
                  <span className="font-mono text-xs text-white text-right">{r.ap_count}</span>
                  <span className="font-mono text-xs text-purple-400 text-right">{r.ssid_count}</span>
                  <span className="font-mono text-xs text-green-400 text-right">{r.best_signal}</span>
                  <span className="font-mono text-xs text-amber-400 text-right">{r.avg_signal}</span>
                  <span className="font-mono text-xs text-amber-400 text-right">{r.band_24_count}</span>
                  <span className="font-mono text-xs text-blue-400 text-right">{r.band_5_count}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
