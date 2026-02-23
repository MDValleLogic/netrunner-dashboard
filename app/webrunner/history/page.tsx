"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

// ─── Types ─────────────────────────────────────────────────────────
type TimeseriesPoint = {
  ts_utc: string;
  avg_latency_ms: number | null;
  samples: number;
  ok_samples: number;
  fail_samples: number;
};

type HistoryData = {
  ok: boolean;
  points: TimeseriesPoint[];
};

type DeviceRow = {
  device_id: string;
  updated_at?: string;
};

type BucketOption = { value: number; label: string };

// ─── Constants ─────────────────────────────────────────────────────
const WINDOWS: { value: number; label: string }[] = [
  { value: 240,   label: "4 hrs"  },
  { value: 1440,  label: "24 hrs" },
  { value: 10080, label: "7 days" },
];

const BUCKETS: BucketOption[] = [
  { value: 60,   label: "1 min"  },
  { value: 300,  label: "5 min"  },
  { value: 3600, label: "1 hr"   },
];

// ─── Helpers ───────────────────────────────────────────────────────
function fmtMs(val: number | null | undefined): string {
  if (val == null || isNaN(val)) return "—";
  return val < 1000 ? `${Math.round(val)}ms` : `${(val / 1000).toFixed(2)}s`;
}

function fmtTick(ts: number, windowMinutes: number): string {
  const d = new Date(ts);
  if (windowMinutes <= 240) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" }) + " " +
         d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const idx = Math.ceil(p * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
}

function computeBaselines(points: TimeseriesPoint[]) {
  const vals = points
    .map((p) => p.avg_latency_ms)
    .filter((v): v is number => v != null && !isNaN(v))
    .sort((a, b) => a - b);

  if (!vals.length) return { p50: null, p95: null, p99: null, avg: null, min: null, max: null };
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  return {
    p50:  percentile(vals, 0.50),
    p95:  percentile(vals, 0.95),
    p99:  percentile(vals, 0.99),
    avg:  Math.round(avg),
    min:  vals[0],
    max:  vals[vals.length - 1],
  };
}

// ─── Custom Tooltip ────────────────────────────────────────────────
function HistoryTooltip({ active, payload, label, windowMinutes }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "var(--bg-overlay)",
      border: "1px solid var(--border-bright)",
      borderRadius: "var(--r-md)",
      padding: "10px 14px",
      fontSize: 12, fontFamily: "var(--font-mono)",
    }}>
      <div style={{ color: "var(--text-dim)", marginBottom: 6, fontSize: 10 }}>
        {fmtTick(Number(label), windowMinutes)}
      </div>
      {payload.map((e: any) => (
        <div key={e.dataKey} style={{ color: e.color || "var(--text-primary)", marginBottom: 2 }}>
          {e.name}: <strong>{typeof e.value === "number" && e.dataKey !== "ok" && e.dataKey !== "fail" ? fmtMs(e.value) : e.value}</strong>
        </div>
      ))}
    </div>
  );
}

// ─── Baseline card ─────────────────────────────────────────────────
function BaselineGrid({ baselines }: { baselines: ReturnType<typeof computeBaselines> }) {
  const items = [
    { label: "p50 (Median)",  value: baselines.p50,  accent: "default" },
    { label: "p95",           value: baselines.p95,  accent: baselines.p95 != null && baselines.p95 > 400 ? "red" : "default" },
    { label: "p99",           value: baselines.p99,  accent: "red"     },
    { label: "Average",       value: baselines.avg,  accent: "accent"  },
    { label: "Min",           value: baselines.min,  accent: "green"   },
    { label: "Max",           value: baselines.max,  accent: "red"     },
  ] as const;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10 }}>
      {items.map((item) => (
        <div key={item.label} className="vl-stat">
          <div className="vl-stat-label">{item.label}</div>
          <div className={`vl-stat-value ${
            item.accent === "green" ? "vl-stat-green" :
            item.accent === "red"   ? "vl-stat-red"   :
            item.accent === "accent"? "vl-stat-accent" : ""
          }`} style={{ fontSize: 20 }}>
            {fmtMs(item.value as number | null)}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────
export default function WebRunnerHistoryPage() {
  const [deviceId, setDeviceId]   = useState("pi-001");
  const [devices, setDevices]     = useState<DeviceRow[]>([]);
  const [window_, setWindow]      = useState(1440);
  const [bucket, setBucket]       = useState(300);
  const [data, setData]           = useState<HistoryData | null>(null);
  const [loading, setLoading]     = useState(false);
  const [err, setErr]             = useState("");

  // Load devices
  useEffect(() => {
    fetch("/api/devices").then((r) => r.json()).then((j) => {
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
      const qp = new URLSearchParams({
        device_id: deviceId,
        window_minutes: String(window_),
        bucket_seconds: String(bucket),
      });
      const r = await fetch(`/api/webrunner/timeseries?${qp}`);
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "Failed");
      setData(j);
    } catch (e: any) {
      setErr(e.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  // Auto-load when device/window/bucket changes
  useEffect(() => { if (deviceId) load(); }, [deviceId, window_, bucket]);

  const chartData = useMemo(() =>
    (data?.points || []).map((p) => ({
      t:         new Date(p.ts_utc).getTime(),
      latency:   p.avg_latency_ms,
      ok:        p.ok_samples,
      fail:      p.fail_samples,
      samples:   p.samples,
    })),
    [data]
  );

  const baselines = useMemo(() => computeBaselines(data?.points || []), [data]);

  // Success rate over time
  const successData = useMemo(() =>
    chartData.map((d) => ({
      t:    d.t,
      rate: d.samples > 0 ? Math.round((d.ok / d.samples) * 100) : null,
    })),
    [chartData]
  );

  // ─── Render ────────────────────────────────────────────────────
  return (
    <>
      {/* Topbar */}
      <div className="vl-topbar">
        <div>
          <div className="vl-topbar-title">History</div>
          <div className="vl-topbar-sub">Baselines · trends · p50/p95</div>
        </div>
        <div className="vl-topbar-spacer" />
        <select className="vl-select" value={deviceId} onChange={(e) => setDeviceId(e.target.value)} style={{ width: "auto" }}>
          {devices.map((d) => <option key={d.device_id} value={d.device_id}>{d.device_id}</option>)}
        </select>
        <select className="vl-select" value={window_} onChange={(e) => setWindow(Number(e.target.value))} style={{ width: "auto" }}>
          {WINDOWS.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
        </select>
        <select className="vl-select" value={bucket} onChange={(e) => setBucket(Number(e.target.value))} style={{ width: "auto" }}>
          {BUCKETS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
        </select>
      </div>

      <div className="vl-main" style={{ display: "flex", flexDirection: "column", gap: 16 }}>

        {err && (
          <div style={{
            padding: "10px 16px", borderRadius: "var(--r-md)",
            background: "var(--red-dim)", border: "1px solid rgba(239,68,68,0.3)",
            color: "var(--red)", fontSize: 13,
          }}>⚠ {err}</div>
        )}

        {/* ── Baselines ────────────────────────────────────────── */}
        {data && (
          <div className="vl-card">
            <div className="vl-card-header">
              <span style={{ fontSize: 13, fontWeight: 600 }}>Baseline Statistics</span>
              <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
                {data.points?.length || 0} buckets · {
                  WINDOWS.find((w) => w.value === window_)?.label
                }
              </span>
            </div>
            <div className="vl-card-body">
              <BaselineGrid baselines={baselines} />
            </div>
          </div>
        )}

        {/* ── Latency area chart ───────────────────────────────── */}
        <div className="vl-card">
          <div className="vl-card-header">
            <span style={{ fontSize: 13, fontWeight: 600 }}>Latency Trend</span>
            <span style={{ fontSize: 11, color: "var(--text-dim)" }}>avg per bucket</span>
          </div>
          <div className="vl-card-body">
            {loading ? (
              <div className="vl-shimmer" style={{ height: 240 }} />
            ) : chartData.length === 0 ? (
              <div className="vl-empty">No data — select a device and load</div>
            ) : (
              <div style={{ height: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="latencyGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="var(--chart-1)" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="2 4" stroke="var(--border-dim)" />
                    <XAxis
                      dataKey="t" type="number" domain={["dataMin", "dataMax"]}
                      tickFormatter={(v) => fmtTick(Number(v), window_)}
                      tick={{ fill: "var(--text-dim)", fontSize: 10, fontFamily: "var(--font-mono)" }}
                      axisLine={{ stroke: "var(--border-mid)" }} tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: "var(--text-dim)", fontSize: 10, fontFamily: "var(--font-mono)" }}
                      axisLine={false} tickLine={false}
                      tickFormatter={(v) => `${v}ms`} width={52}
                    />
                    <Tooltip content={<HistoryTooltip windowMinutes={window_} />} />
                    {baselines.p50 && (
                      <Line dataKey={() => baselines.p50} stroke="rgba(245,158,11,0.4)" strokeWidth={1} strokeDasharray="4 4" dot={false} legendType="none" />
                    )}
                    <Area
                      type="monotone" dataKey="latency" name="Avg Latency"
                      stroke="var(--chart-1)" strokeWidth={2}
                      fill="url(#latencyGrad)" dot={false} isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        {/* ── Success rate + failure chart ─────────────────────── */}
        <div className="vl-grid-2">
          <div className="vl-card">
            <div className="vl-card-header">
              <span style={{ fontSize: 13, fontWeight: 600 }}>Success Rate</span>
              <span style={{ fontSize: 11, color: "var(--text-dim)" }}>%</span>
            </div>
            <div className="vl-card-body">
              {loading ? (
                <div className="vl-shimmer" style={{ height: 180 }} />
              ) : (
                <div style={{ height: 180 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={successData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                      <defs>
                        <linearGradient id="successGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="var(--green)" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="var(--green)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="2 4" stroke="var(--border-dim)" />
                      <XAxis dataKey="t" type="number" domain={["dataMin", "dataMax"]}
                        tickFormatter={(v) => fmtTick(Number(v), window_)}
                        tick={{ fill: "var(--text-dim)", fontSize: 9, fontFamily: "var(--font-mono)" }}
                        axisLine={{ stroke: "var(--border-mid)" }} tickLine={false} />
                      <YAxis domain={[0, 100]} tick={{ fill: "var(--text-dim)", fontSize: 9 }}
                        axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} width={36} />
                      <Tooltip content={<HistoryTooltip windowMinutes={window_} />} />
                      <Area type="monotone" dataKey="rate" name="Success %"
                        stroke="var(--green)" strokeWidth={2}
                        fill="url(#successGrad)" dot={false} isAnimationActive={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          <div className="vl-card">
            <div className="vl-card-header">
              <span style={{ fontSize: 13, fontWeight: 600 }}>Failures per Bucket</span>
              <span style={{ fontSize: 11, color: "var(--text-dim)" }}>count</span>
            </div>
            <div className="vl-card-body">
              {loading ? (
                <div className="vl-shimmer" style={{ height: 180 }} />
              ) : (
                <div style={{ height: 180 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="2 4" stroke="var(--border-dim)" vertical={false} />
                      <XAxis dataKey="t" type="number" domain={["dataMin", "dataMax"]}
                        tickFormatter={(v) => fmtTick(Number(v), window_)}
                        tick={{ fill: "var(--text-dim)", fontSize: 9, fontFamily: "var(--font-mono)" }}
                        axisLine={{ stroke: "var(--border-mid)" }} tickLine={false} />
                      <YAxis tick={{ fill: "var(--text-dim)", fontSize: 9 }}
                        axisLine={false} tickLine={false} width={28} allowDecimals={false} />
                      <Tooltip content={<HistoryTooltip windowMinutes={window_} />} />
                      <Bar dataKey="fail" name="Failures" fill="var(--red)" opacity={0.8}
                        radius={[2, 2, 0, 0]} isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </>
  );
}
