"use client";

import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Globe } from "lucide-react";

type Point = { ts_utc: string; dns_ms: number; http_ms: number; http_err: string; };
type TimeseriesResp = { ok: boolean; device_id: string; urls: string[]; points: number; series: Record<string, Point[]>; error?: string; };
type DeviceRow = { device_id: string; nr_serial?: string; };

const CHART_COLORS = ["#3b82f6", "#10b981", "#f97316", "#a78bfa", "#ef4444"];
const TIME_RANGES = [
  { value: 60,   label: "Last 1 hr"   },
  { value: 240,  label: "Last 4 hrs"  },
  { value: 1440, label: "Last 24 hrs" },
];

function fmtTime(iso: string) {
  try { return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
  catch { return ""; }
}
function fmtMs(val: number | undefined | null): string {
  if (val == null || isNaN(val)) return "—";
  return val < 1000 ? `${Math.round(val)}ms` : `${(val / 1000).toFixed(2)}s`;
}
function mergeSeries(series: Record<string, Point[]>, field: "dns_ms" | "http_ms") {
  const byTs = new Map<string, Record<string, number>>();
  for (const [url, pts] of Object.entries(series)) {
    for (const p of pts) {
      if (!byTs.has(p.ts_utc)) byTs.set(p.ts_utc, { ts_utc: p.ts_utc as any });
      byTs.get(p.ts_utc)![url] = p[field];
    }
  }
  return Array.from(byTs.values()).sort((a, b) => new Date(a.ts_utc as any).getTime() - new Date(b.ts_utc as any).getTime());
}
function computeStats(series: Record<string, Point[]>) {
  let totalPoints = 0, sumDns = 0, sumHttp = 0, errCount = 0;
  for (const pts of Object.values(series)) {
    for (const p of pts) {
      totalPoints++;
      sumDns  += p.dns_ms  || 0;
      sumHttp += p.http_ms || 0;
      if (p.http_err && p.http_err !== "null" && p.http_err !== "") errCount++;
    }
  }
  return {
    avgDns:    totalPoints ? Math.round(sumDns / totalPoints)  : null,
    avgHttp:   totalPoints ? Math.round(sumHttp / totalPoints) : null,
    errCount, totalPoints,
    errorRate: totalPoints ? ((errCount / totalPoints) * 100).toFixed(1) : "0.0",
  };
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#111827", border: "1px solid #374151", borderRadius: 6, padding: "10px 14px", fontSize: 12, fontFamily: "monospace" }}>
      <div style={{ color: "#6b7280", marginBottom: 6, fontSize: 10 }}>{fmtTime(String(label))}</div>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} style={{ color: entry.color, marginBottom: 2 }}>
          {entry.dataKey.replace(/^https?:\/\//, "").slice(0, 28)}: <strong>{fmtMs(entry.value)}</strong>
        </div>
      ))}
    </div>
  );
}

const selStyle = {
  background: "#111827", border: "1px solid #374151", borderRadius: 6,
  color: "#e5e7eb", padding: "6px 10px", fontSize: 12, fontFamily: "monospace",
};

export default function WebRunnerOverview() {
  const [deviceId, setDeviceId]   = useState("");
  const [devices, setDevices]     = useState<DeviceRow[]>([]);
  const [sinceMinutes, setSince]  = useState(60);
  const [urls, setUrls]           = useState<string[]>([]);
  const [loading, setLoading]     = useState(false);
  const [data, setData]           = useState<TimeseriesResp | null>(null);
  const [err, setErr]             = useState("");
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch("/api/devices/list").then(r => r.json()).then(j => {
      if (j?.ok && Array.isArray(j.devices) && j.devices.length > 0) {
        setDevices(j.devices);
        setDeviceId(j.devices[0].device_id);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!deviceId) return;
    setUrls([]); setData(null); setErr("");
    fetch(`/api/webrunner/config?device_id=${encodeURIComponent(deviceId)}`)
      .then(r => r.json())
      .then(j => {
        const configUrls: string[] = j?.config?.urls ?? [];
        const filtered = configUrls.filter(u => !u.includes("google.com/generate_204"));
        if (filtered.length > 0) setUrls(filtered.map(u => u.replace(/\/$/, "")));
      }).catch(() => {});
  }, [deviceId]);

  const load = useCallback(async () => {
    if (!deviceId || urls.length === 0) return;
    setErr(""); setLoading(true);
    try {
      const qp = new URLSearchParams();
      qp.set("device_id", deviceId);
      qp.set("since_minutes", String(sinceMinutes));
      for (const u of urls) qp.append("urls", u);
      const res  = await fetch(`/api/measurements/timeseries?${qp}`);
      const json = await res.json() as TimeseriesResp;
      if (!json.ok) setErr(json.error || "Request failed");
      else { setData(json); setLastFetched(new Date()); }
    } catch (e: any) { setErr(e?.message ?? String(e)); }
    finally { setLoading(false); }
  }, [deviceId, urls, sinceMinutes]);

  useEffect(() => { if (urls.length > 0 && deviceId) load(); }, [urls, deviceId]); // eslint-disable-line
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (autoRefresh) timerRef.current = setInterval(load, 30_000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [autoRefresh, load]);
  useEffect(() => { if (urls.length > 0 && deviceId) load(); }, [sinceMinutes]); // eslint-disable-line

  const dnsData  = useMemo(() => data?.series ? mergeSeries(data.series, "dns_ms")  : [], [data]);
  const httpData = useMemo(() => data?.series ? mergeSeries(data.series, "http_ms") : [], [data]);
  const stats    = useMemo(() => data?.series ? computeStats(data.series) : null, [data]);

  const statCards = [
    { label: "Avg DNS",     value: stats ? fmtMs(stats.avgDns)   : "—", alert: !!(stats?.avgDns  && stats.avgDns  > 200) },
    { label: "Avg HTTP",    value: stats ? fmtMs(stats.avgHttp)  : "—", alert: !!(stats?.avgHttp && stats.avgHttp > 500) },
    { label: "Error Rate",  value: stats ? `${stats.errorRate}%` : "—", alert: !!(stats?.errCount && stats.errCount > 0) },
    { label: "Data Points", value: stats ? String(stats.totalPoints) : "—", alert: false },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
      <div className="flex items-center justify-between mb-6 max-w-5xl">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <Globe size={20} className="text-blue-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-100 leading-tight">WebRunner Overview</h1>
            <p className="text-xs text-gray-500 font-mono">DNS &amp; HTTP latency · multi-URL</p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {lastFetched && <span style={{ fontSize: 11, color: "#6b7280", fontFamily: "monospace" }}>Updated {lastFetched.toLocaleTimeString()}</span>}
          <select value={deviceId} onChange={e => setDeviceId(e.target.value)} style={selStyle}>
            {devices.length === 0 ? <option value="">No devices</option> : devices.map(d => <option key={d.device_id} value={d.device_id}>{d.nickname ? `${d.nickname} (${d.nr_serial})` : d.nr_serial || d.device_id}</option>)}
          </select>
          <select value={sinceMinutes} onChange={e => setSince(Number(e.target.value))} style={selStyle}>
            {TIME_RANGES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#9ca3af", cursor: "pointer" }}>
            <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} style={{ accentColor: "#3b82f6" }} />
            Auto (30s)
          </label>
        </div>
      </div>

      <div className="max-w-5xl space-y-4">
        {err && <div style={{ padding: "10px 16px", borderRadius: 8, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444", fontSize: 13 }}>⚠ {err}</div>}

        <div className="grid grid-cols-4 gap-3">
          {statCards.map(({ label, value, alert }) => (
            <div key={label} className={`rounded-lg border px-4 py-4 bg-gray-900/60 ${alert ? "border-red-700/60" : "border-gray-700/60"}`}>
              <div className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-2">{label}</div>
              <div className={`text-2xl font-bold font-mono ${alert ? "text-red-400" : "text-white"}`}>{value}</div>
            </div>
          ))}
        </div>

        {urls.length > 0 && (
          <div className="rounded-lg border border-gray-700/60 bg-gray-900/60 px-4 py-3 flex items-center gap-4 flex-wrap">
            {urls.map((u, i) => (
              <div key={u} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: CHART_COLORS[i % CHART_COLORS.length] }} />
                <span style={{ fontSize: 11, fontFamily: "monospace", color: "#9ca3af" }}>{u.replace(/^https?:\/\//, "").replace(/\/$/, "")}</span>
              </div>
            ))}
            {loading && <span style={{ fontSize: 11, color: "#6b7280", fontFamily: "monospace", marginLeft: "auto" }}>Refreshing…</span>}
          </div>
        )}

        {(dnsData.length > 0 || httpData.length > 0) && (
          <>
            {[
              { title: "DNS Latency",        chartData: dnsData  },
              { title: "HTTP Response Time", chartData: httpData },
            ].map(({ title, chartData }) => (
              <div key={title} className="rounded-lg border border-gray-700/60 bg-gray-900/60 p-4">
                <div className="flex items-center justify-between mb-4">
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#e5e7eb" }}>{title}</span>
                  <span style={{ fontSize: 11, color: "#6b7280", fontFamily: "monospace" }}>milliseconds</span>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={chartData} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="2 4" stroke="#1f2937" />
                    <XAxis dataKey="ts_utc" tickFormatter={fmtTime} minTickGap={48}
                      tick={{ fill: "#6b7280", fontSize: 10, fontFamily: "monospace" }}
                      axisLine={{ stroke: "#374151" }} tickLine={false} />
                    <YAxis tick={{ fill: "#6b7280", fontSize: 10, fontFamily: "monospace" }}
                      axisLine={false} tickLine={false} tickFormatter={v => `${v}ms`} width={52} />
                    <Tooltip content={<ChartTooltip />} />
                    {urls.map((u, idx) => (
                      <Line key={u} type="monotone" dataKey={u}
                        stroke={CHART_COLORS[idx % CHART_COLORS.length]}
                        strokeWidth={2} dot={false} isAnimationActive={false} connectNulls
                        activeDot={{ r: 4 }} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ))}
          </>
        )}

        {loading && !data && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[220, 220].map((h, i) => (
              <div key={i} className="rounded-lg border border-gray-700/60 bg-gray-900/60 p-4">
                <div style={{ height: h, background: "#1f2937", borderRadius: 6, opacity: 0.5 }} />
              </div>
            ))}
          </div>
        )}

        {!loading && !data && urls.length === 0 && (
          <div className="rounded-lg border border-gray-700/60 bg-gray-900/60 p-12 text-center">
            <Globe size={32} className="text-gray-700 mx-auto mb-4" />
            <div style={{ fontWeight: 600, color: "#9ca3af", marginBottom: 6 }}>No URLs configured</div>
            <div style={{ fontSize: 12, color: "#6b7280" }}>Add URLs to monitor in <span style={{ color: "#3b82f6" }}>WebRunner → Config</span></div>
          </div>
        )}
      </div>
    </div>
  );
}
