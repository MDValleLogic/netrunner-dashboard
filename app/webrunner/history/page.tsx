"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { Clock } from "lucide-react";

type TimeseriesPoint = { ts_utc: string; avg_latency_ms: number | null; samples: number; ok_samples: number; fail_samples: number; };
type HistoryData = { ok: boolean; points: TimeseriesPoint[]; };
type DeviceRow = { device_id: string; nr_serial?: string; nickname?: string; };

const WINDOWS = [
  { value: 240,   label: "4 hrs"  },
  { value: 1440,  label: "24 hrs" },
  { value: 10080, label: "7 days" },
];
const BUCKETS = [
  { value: 60,   label: "1 min" },
  { value: 300,  label: "5 min" },
  { value: 3600, label: "1 hr"  },
];

function fmtMs(val: number | null | undefined): string {
  if (val == null || isNaN(val)) return "—";
  return val < 1000 ? `${Math.round(val)}ms` : `${(val / 1000).toFixed(2)}s`;
}
function fmtTick(ts: number, windowMinutes: number): string {
  const d = new Date(ts);
  if (windowMinutes <= 240) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" }) + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  return sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)];
}
function computeBaselines(points: TimeseriesPoint[]) {
  const vals = points.map(p => p.avg_latency_ms).filter((v): v is number => v != null && !isNaN(v)).sort((a, b) => a - b);
  if (!vals.length) return { p50: null, p95: null, p99: null, avg: null, min: null, max: null };
  return {
    p50: percentile(vals, 0.50), p95: percentile(vals, 0.95), p99: percentile(vals, 0.99),
    avg: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length),
    min: vals[0], max: vals[vals.length - 1],
  };
}

function HistoryTooltip({ active, payload, label, windowMinutes }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#111827", border: "1px solid #374151", borderRadius: 6, padding: "10px 14px", fontSize: 12, fontFamily: "monospace" }}>
      <div style={{ color: "#6b7280", marginBottom: 6, fontSize: 10 }}>{fmtTick(Number(label), windowMinutes)}</div>
      {payload.map((e: any) => (
        <div key={e.dataKey} style={{ color: e.color, marginBottom: 2 }}>
          {e.name}: <strong>{typeof e.value === "number" && e.dataKey !== "ok" && e.dataKey !== "fail" ? fmtMs(e.value) : e.value}</strong>
        </div>
      ))}
    </div>
  );
}

export default function WebRunnerHistoryPage() {
  const [deviceId, setDeviceId] = useState("");
  const [devices, setDevices]   = useState<DeviceRow[]>([]);
  const [window_, setWindow]    = useState(1440);
  const [bucket, setBucket]     = useState(300);
  const [data, setData]         = useState<HistoryData | null>(null);
  const [loading, setLoading]   = useState(false);
  const [err, setErr]           = useState("");

  useEffect(() => {
    fetch("/api/devices/list").then(r => r.json()).then(j => {
      if (j?.ok && Array.isArray(j.devices)) {
        setDevices(j.devices);
        if (j.devices.length > 0) setDeviceId(j.devices[0].device_id);
      }
    }).catch(() => {});
  }, []);

  async function load() {
    if (!deviceId) return;
    setLoading(true); setErr(""); setData(null);
    try {
      const qp = new URLSearchParams({ device_id: deviceId, window_minutes: String(window_), bucket_seconds: String(bucket) });
      const r = await fetch(`/api/webrunner/timeseries?${qp}`);
      const j = await r.json();
      if (!j.buckets) throw new Error(j.error || "Failed");
      setData({ ok: true, points: j.buckets.map((b: any) => ({ ts_utc: b.bucket, avg_latency_ms: b.avg_ms, ok_samples: b.success, fail_samples: b.total - b.success, samples: b.total })) });
    } catch (e: any) { setErr(e.message || "Unknown error"); }
    finally { setLoading(false); }
  }

  useEffect(() => { if (deviceId) load(); }, [deviceId, window_, bucket]); // eslint-disable-line

  const chartData = useMemo(() =>
    (data?.points || []).map(p => ({ t: new Date(p.ts_utc).getTime(), latency: p.avg_latency_ms, ok: p.ok_samples, fail: p.fail_samples, samples: p.samples })),
    [data]
  );
  const baselines = useMemo(() => computeBaselines(data?.points || []), [data]);
  const successData = useMemo(() => chartData.map(d => ({ t: d.t, rate: d.samples > 0 ? Math.round((d.ok / d.samples) * 100) : null })), [chartData]);

  const baselineItems = [
    { label: "p50 (Median)", value: baselines.p50, color: "#e5e7eb" },
    { label: "p95",          value: baselines.p95, color: baselines.p95 != null && baselines.p95 > 400 ? "#ef4444" : "#e5e7eb" },
    { label: "p99",          value: baselines.p99, color: "#ef4444" },
    { label: "Average",      value: baselines.avg, color: "#60a5fa" },
    { label: "Min",          value: baselines.min, color: "#22c55e" },
    { label: "Max",          value: baselines.max, color: "#ef4444" },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">

      {/* Header */}
      <div className="flex items-center justify-between mb-6 max-w-5xl">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <Clock size={20} className="text-blue-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-100 leading-tight">History</h1>
            <p className="text-xs text-gray-500 font-mono">Baselines · trends · p50/p95</p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {[
            { value: deviceId, onChange: (v: string) => setDeviceId(v), options: devices.map(d => ({ value: d.device_id, label: d.nickname ? `${d.nickname} (${d.nr_serial})` : d.nr_serial || d.device_id })) },
            { value: String(window_), onChange: (v: string) => setWindow(Number(v)), options: WINDOWS.map(w => ({ value: String(w.value), label: w.label })) },
            { value: String(bucket),  onChange: (v: string) => setBucket(Number(v)),  options: BUCKETS.map(b => ({ value: String(b.value), label: b.label })) },
          ].map((s, i) => (
            <select key={i} value={s.value} onChange={e => s.onChange(e.target.value)} style={{
              background: "#111827", border: "1px solid #374151", borderRadius: 6,
              color: "#e5e7eb", padding: "6px 10px", fontSize: 12, fontFamily: "monospace",
            }}>
              {s.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          ))}
        </div>
      </div>

      <div className="max-w-5xl space-y-4">

        {err && (
          <div style={{ padding: "10px 16px", borderRadius: 8, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444", fontSize: 13 }}>⚠ {err}</div>
        )}

        {/* Baseline stats */}
        {data && (
          <div className="rounded-lg border border-gray-700/60 bg-gray-900/60 p-4">
            <div className="flex items-center justify-between mb-4">
              <span style={{ fontSize: 13, fontWeight: 600, color: "#e5e7eb" }}>Baseline Statistics</span>
              <span style={{ fontSize: 11, color: "#6b7280", fontFamily: "monospace" }}>
                {data.points?.length || 0} buckets · {WINDOWS.find(w => w.value === window_)?.label}
              </span>
            </div>
            <div className="grid grid-cols-6 gap-3">
              {baselineItems.map(item => (
                <div key={item.label} className="rounded-lg border border-gray-800 bg-gray-900 px-3 py-3">
                  <div style={{ fontSize: 9, fontFamily: "monospace", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>{item.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "monospace", color: item.color }}>{fmtMs(item.value)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Latency area chart */}
        <div className="rounded-lg border border-gray-700/60 bg-gray-900/60 p-4">
          <div className="flex items-center justify-between mb-4">
            <span style={{ fontSize: 13, fontWeight: 600, color: "#e5e7eb" }}>Latency Trend</span>
            <span style={{ fontSize: 11, color: "#6b7280", fontFamily: "monospace" }}>avg per bucket</span>
          </div>
          {loading ? (
            <div style={{ height: 240, background: "#1f2937", borderRadius: 6, opacity: 0.5 }} />
          ) : chartData.length === 0 ? (
            <div style={{ height: 240, display: "flex", alignItems: "center", justifyContent: "center", color: "#6b7280", fontSize: 13 }}>No data — select a device and load</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={chartData} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="latencyGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 4" stroke="#1f2937" />
                <XAxis dataKey="t" type="number" domain={["dataMin", "dataMax"]}
                  tickFormatter={v => fmtTick(Number(v), window_)}
                  tick={{ fill: "#6b7280", fontSize: 10, fontFamily: "monospace" }}
                  axisLine={{ stroke: "#374151" }} tickLine={false} />
                <YAxis tick={{ fill: "#6b7280", fontSize: 10, fontFamily: "monospace" }}
                  axisLine={false} tickLine={false} tickFormatter={v => `${v}ms`} width={52} />
                <Tooltip content={<HistoryTooltip windowMinutes={window_} />} />
                <Area type="monotone" dataKey="latency" name="Avg Latency"
                  stroke="#3b82f6" strokeWidth={2} fill="url(#latencyGrad)" dot={false} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Success rate + failures */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg border border-gray-700/60 bg-gray-900/60 p-4">
            <div className="flex items-center justify-between mb-4">
              <span style={{ fontSize: 13, fontWeight: 600, color: "#e5e7eb" }}>Success Rate</span>
              <span style={{ fontSize: 11, color: "#6b7280", fontFamily: "monospace" }}>%</span>
            </div>
            {loading ? (
              <div style={{ height: 180, background: "#1f2937", borderRadius: 6, opacity: 0.5 }} />
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={successData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="successGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="2 4" stroke="#1f2937" />
                  <XAxis dataKey="t" type="number" domain={["dataMin", "dataMax"]}
                    tickFormatter={v => fmtTick(Number(v), window_)}
                    tick={{ fill: "#6b7280", fontSize: 9, fontFamily: "monospace" }}
                    axisLine={{ stroke: "#374151" }} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fill: "#6b7280", fontSize: 9 }}
                    axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} width={36} />
                  <Tooltip content={<HistoryTooltip windowMinutes={window_} />} />
                  <Area type="monotone" dataKey="rate" name="Success %"
                    stroke="#22c55e" strokeWidth={2} fill="url(#successGrad)" dot={false} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="rounded-lg border border-gray-700/60 bg-gray-900/60 p-4">
            <div className="flex items-center justify-between mb-4">
              <span style={{ fontSize: 13, fontWeight: 600, color: "#e5e7eb" }}>Failures per Bucket</span>
              <span style={{ fontSize: 11, color: "#6b7280", fontFamily: "monospace" }}>count</span>
            </div>
            {loading ? (
              <div style={{ height: 180, background: "#1f2937", borderRadius: 6, opacity: 0.5 }} />
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke="#1f2937" vertical={false} />
                  <XAxis dataKey="t" type="number" domain={["dataMin", "dataMax"]}
                    tickFormatter={v => fmtTick(Number(v), window_)}
                    tick={{ fill: "#6b7280", fontSize: 9, fontFamily: "monospace" }}
                    axisLine={{ stroke: "#374151" }} tickLine={false} />
                  <YAxis tick={{ fill: "#6b7280", fontSize: 9 }} axisLine={false} tickLine={false} width={28} allowDecimals={false} />
                  <Tooltip content={<HistoryTooltip windowMinutes={window_} />} />
                  <Bar dataKey="fail" name="Failures" fill="#ef4444" opacity={0.8} radius={[2, 2, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
