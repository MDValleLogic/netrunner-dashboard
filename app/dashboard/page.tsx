"use client";

import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, CartesianGrid,
} from "recharts";

type Point = {
  ts_utc: string;
  dns_ms: number;
  http_ms: number;
  http_err: string;
};

type TimeseriesResp = {
  ok: boolean;
  device_id: string;
  since_minutes: number;
  urls: string[];
  points: number;
  series: Record<string, Point[]>;
  error?: string;
};

type DeviceRow = {
  device_id: string;
  updated_at?: string;
};

const CHART_COLORS = ["#3b82f6", "#10b981", "#f97316", "#a78bfa", "#ef4444"];

const TIME_RANGES = [
  { value: 60,   label: "Last 1 hr"  },
  { value: 240,  label: "Last 4 hrs" },
  { value: 1440, label: "Last 24 hrs"},
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
  return Array.from(byTs.values()).sort(
    (a, b) => new Date(a.ts_utc as any).getTime() - new Date(b.ts_utc as any).getTime()
  );
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
    errorRate: totalPoints ? ((errCount / totalPoints) * 100).toFixed(1) : null,
  };
}

function StatTile({ label, value, sub, accent }: {
  label: string; value: React.ReactNode; sub?: React.ReactNode;
  accent?: "default" | "green" | "red" | "accent";
}) {
  const cls = { default: "", green: "vl-stat-green", red: "vl-stat-red", accent: "vl-stat-accent" }[accent ?? "default"];
  return (
    <div className="vl-stat">
      <div className="vl-stat-label">{label}</div>
      <div className={`vl-stat-value ${cls}`}>{value}</div>
      {sub && <div className="vl-stat-sub">{sub}</div>}
    </div>
  );
}

function UrlTag({ url, colorIdx, onDelete }: { url: string; colorIdx: number; onDelete: () => void }) {
  const short = url.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return (
    <div className="vl-url-tag">
      <div className="vl-url-dot" style={{ background: CHART_COLORS[colorIdx % CHART_COLORS.length] }} />
      <span className="vl-url-label" title={url}>{short}</span>
      <button className="vl-btn vl-btn-danger vl-btn-sm" onClick={onDelete}>✕</button>
    </div>
  );
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "var(--bg-overlay)", border: "1px solid var(--border-bright)",
      borderRadius: "var(--r-md)", padding: "10px 14px",
      fontSize: 12, fontFamily: "var(--font-mono)",
    }}>
      <div style={{ color: "var(--text-dim)", marginBottom: 6, fontSize: 10 }}>{fmtTime(String(label))}</div>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} style={{ color: entry.color, marginBottom: 2 }}>
          {entry.dataKey.replace(/^https?:\/\//, "").slice(0, 28)}: <strong>{fmtMs(entry.value)}</strong>
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const [deviceId, setDeviceId]       = useState("");
  const [devices, setDevices]         = useState<DeviceRow[]>([]);
  const [sinceMinutes, setSince]      = useState(60);
  const [urls, setUrls]               = useState<string[]>([]);
  const [urlsLoading, setUrlsLoading] = useState(false);
  const [newUrl, setNewUrl]           = useState("");
  const [loading, setLoading]         = useState(false);
  const [data, setData]               = useState<TimeseriesResp | null>(null);
  const [err, setErr]                 = useState("");
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load devices on mount
  useEffect(() => {
    fetch("/api/devices")
      .then((r) => r.json())
      .then((j) => {
        if (j?.ok && Array.isArray(j.devices) && j.devices.length > 0) {
          setDevices(j.devices);
          setDeviceId(j.devices[0].device_id);
        }
      })
      .catch(() => {});
  }, []);

  // When device changes, fetch its active URLs from measurements
  useEffect(() => {
    if (!deviceId) return;
    setUrlsLoading(true);
    setUrls([]);
    setData(null);
    fetch(`/api/device/urls?device_id=${encodeURIComponent(deviceId)}`)
      .then((r) => r.json())
      .then((j) => {
        if (j?.ok && Array.isArray(j.urls) && j.urls.length > 0) {
          setUrls(j.urls);
        }
      })
      .catch(() => {})
      .finally(() => setUrlsLoading(false));
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
      const json = (await res.json()) as TimeseriesResp;
      if (!json.ok) setErr(json.error || "Request failed");
      else { setData(json); setLastFetched(new Date()); }
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, [deviceId, urls, sinceMinutes]);

  // Auto-run query when URLs load
  useEffect(() => {
    if (urls.length > 0 && deviceId) load();
  }, [urls]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-refresh
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (autoRefresh) timerRef.current = setInterval(load, 30_000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [autoRefresh, load]);

  function addUrl() {
    const u = newUrl.trim();
    if (!u || urls.includes(u) || urls.length >= 5) return;
    setUrls((prev) => [...prev, u]);
    setNewUrl("");
  }

  const dnsData  = useMemo(() => data?.series ? mergeSeries(data.series, "dns_ms")  : [], [data]);
  const httpData = useMemo(() => data?.series ? mergeSeries(data.series, "http_ms") : [], [data]);
  const stats    = useMemo(() => data?.series ? computeStats(data.series) : null, [data]);

  return (
    <>
      <div className="vl-topbar">
        <div>
          <div className="vl-topbar-title">Overview</div>
          <div className="vl-topbar-sub">DNS &amp; HTTP latency · multi-URL</div>
        </div>
        <div className="vl-topbar-spacer" />
        {lastFetched && (
          <span style={{ fontSize: 11, color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
            Updated {lastFetched.toLocaleTimeString()}
          </span>
        )}
        <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "var(--text-secondary)", cursor: "pointer" }}>
          <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)}
            style={{ accentColor: "var(--accent)" }} />
          Auto (30s)
        </label>
      </div>

      <div className="vl-main" style={{ display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Stat tiles */}
        <div className="vl-grid-4">
          <StatTile label="Avg DNS"    value={stats ? fmtMs(stats.avgDns)  : "—"} sub="across all URLs"
            accent={stats && stats.avgDns  != null && stats.avgDns  > 200 ? "red" : "green"} />
          <StatTile label="Avg HTTP"   value={stats ? fmtMs(stats.avgHttp) : "—"} sub="response time"
            accent={stats && stats.avgHttp != null && stats.avgHttp > 500 ? "red" : "default"} />
          <StatTile label="Error Rate" value={stats ? `${stats.errorRate}%` : "—"} sub={stats ? `${stats.errCount} failures` : ""}
            accent={stats && stats.errCount > 0 ? "red" : "green"} />
          <StatTile label="Data Points" value={stats ? String(stats.totalPoints) : "—"}
            sub={`in last ${sinceMinutes < 60 ? sinceMinutes + "m" : sinceMinutes / 60 + "h"}`} accent="accent" />
        </div>

        {/* Controls */}
        <div className="vl-card">
          <div className="vl-card-header">
            <span style={{ fontSize: 13, fontWeight: 600 }}>Query Settings</span>
            {err && <span style={{ fontSize: 12, color: "var(--red)" }}>⚠ {err}</span>}
          </div>
          <div className="vl-card-body">
            <div className="vl-grid-2" style={{ marginBottom: 16 }}>
              <div>
                <label className="vl-label">Device</label>
                <select className="vl-select" value={deviceId} onChange={(e) => setDeviceId(e.target.value)}>
                  {devices.length === 0
                    ? <option value="">No devices registered</option>
                    : devices.map((d) => <option key={d.device_id} value={d.device_id}>{d.device_id}</option>)
                  }
                </select>
              </div>
              <div>
                <label className="vl-label">Time Window</label>
                <select className="vl-select" value={sinceMinutes} onChange={(e) => setSince(Number(e.target.value))}>
                  {TIME_RANGES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
            </div>

            <label className="vl-label">
              URLs to Monitor <span style={{ color: "var(--text-dim)" }}>({urls.length}/5)</span>
              {urlsLoading && <span style={{ color: "var(--accent)", marginLeft: 8, fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>loading from device…</span>}
            </label>

            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <input className="vl-input" type="text" placeholder="https://example.com"
                value={newUrl} onChange={(e) => setNewUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addUrl()} />
              <button className="vl-btn vl-btn-ghost" onClick={addUrl} disabled={urls.length >= 5}>+ Add</button>
            </div>

            {urls.length === 0 && !urlsLoading && (
              <div style={{ fontSize: 12, color: "var(--text-dim)", padding: "8px 0" }}>
                No active URLs found for this device in the last 24h. Add one above.
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {urls.map((u, i) => (
                <UrlTag key={u} url={u} colorIdx={i} onDelete={() => setUrls((prev) => prev.filter((x) => x !== u))} />
              ))}
            </div>

            <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 10 }}>
              <button className="vl-btn vl-btn-primary" onClick={load}
                disabled={loading || urls.length === 0 || !deviceId}>
                {loading ? <><span style={{ display: "inline-block", animation: "spin 1s linear infinite" }}>◌</span> Loading…</> : "▶  Run Query"}
              </button>
              {data && (
                <span style={{ fontSize: 11, color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
                  {data.points} pts · {urls.length} URLs
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Charts */}
        {(dnsData.length > 0 || httpData.length > 0) && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {[
              { title: "DNS Latency", chartData: dnsData },
              { title: "HTTP Response Time", chartData: httpData },
            ].map(({ title, chartData }) => (
              <div className="vl-card" key={title}>
                <div className="vl-card-header">
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{title}</span>
                  <span style={{ fontSize: 11, color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>milliseconds</span>
                </div>
                <div className="vl-card-body">
                  <div className="vl-chart-wrap">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
                        <CartesianGrid strokeDasharray="2 4" stroke="var(--border-dim)" />
                        <XAxis dataKey="ts_utc" tickFormatter={fmtTime} minTickGap={48}
                          tick={{ fill: "var(--text-dim)", fontSize: 10, fontFamily: "var(--font-mono)" }}
                          axisLine={{ stroke: "var(--border-mid)" }} tickLine={false} />
                        <YAxis tick={{ fill: "var(--text-dim)", fontSize: 10, fontFamily: "var(--font-mono)" }}
                          axisLine={false} tickLine={false} tickFormatter={(v) => `${v}ms`} width={52} />
                        <Tooltip content={<ChartTooltip />} />
                        <Legend formatter={(val) => (
                          <span style={{ fontSize: 11, color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
                            {val.replace(/^https?:\/\//, "")}
                          </span>
                        )} />
                        {urls.map((u, idx) => (
                          <Line key={u} type="monotone" dataKey={u}
                            stroke={CHART_COLORS[idx % CHART_COLORS.length]}
                            strokeWidth={2} dot={false} isAnimationActive={false}
                            activeDot={{ r: 4, fill: CHART_COLORS[idx % CHART_COLORS.length] }} />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!data && !loading && !urlsLoading && (
          <div className="vl-card">
            <div className="vl-empty">
              <div style={{ fontSize: 32, marginBottom: 10 }}>◎</div>
              <div style={{ fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>No data loaded</div>
              <div>Select a device and click <strong style={{ color: "var(--accent)" }}>Run Query</strong></div>
            </div>
          </div>
        )}

        {(loading || urlsLoading) && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {[280, 280].map((h, i) => (
              <div key={i} className="vl-card">
                <div className="vl-card-header"><div className="vl-shimmer" style={{ width: 120, height: 14 }} /></div>
                <div className="vl-card-body"><div className="vl-shimmer" style={{ height: h }} /></div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
