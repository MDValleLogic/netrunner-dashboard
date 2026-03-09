"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from "recharts";

// ─── Types ───────────────────────────────────────────────────────────────────

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
  nr_serial?: string;
  updated_at?: string;
};

// ─── Constants ───────────────────────────────────────────────────────────────

const CHART_COLORS = ["#3b82f6", "#10b981", "#f97316", "#a78bfa", "#ef4444", "#facc15"];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function fmtMs(val: number | undefined | null): string {
  if (val == null || isNaN(val)) return "—";
  return val < 1000 ? `${Math.round(val)}ms` : `${(val / 1000).toFixed(2)}s`;
}

function shortUrl(url: string) {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

// Get the latest point for each URL
function getLatestPerUrl(series: Record<string, Point[]>): Record<string, Point | null> {
  const result: Record<string, Point | null> = {};
  for (const [url, pts] of Object.entries(series)) {
    result[url] = pts.length > 0 ? pts[pts.length - 1] : null;
  }
  return result;
}

function computeStats(series: Record<string, Point[]>) {
  let totalPoints = 0, sumDns = 0, sumHttp = 0, errCount = 0;
  for (const pts of Object.values(series)) {
    for (const p of pts) {
      totalPoints++;
      sumDns += p.dns_ms || 0;
      sumHttp += p.http_ms || 0;
      if (p.http_err && p.http_err !== "null" && p.http_err !== "") errCount++;
    }
  }
  return {
    avgDns: totalPoints ? Math.round(sumDns / totalPoints) : null,
    avgHttp: totalPoints ? Math.round(sumHttp / totalPoints) : null,
    errCount,
    totalPoints,
    errorRate: totalPoints ? ((errCount / totalPoints) * 100).toFixed(1) : "0.0",
  };
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
    (a, b) =>
      new Date(a.ts_utc as any).getTime() - new Date(b.ts_utc as any).getTime()
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "var(--bg-overlay)",
      border: "1px solid var(--border-bright)",
      borderRadius: "var(--r-md)",
      padding: "10px 14px",
      fontSize: 12,
      fontFamily: "var(--font-mono)",
    }}>
      <div style={{ color: "var(--text-dim)", marginBottom: 6, fontSize: 10 }}>
        {fmtTime(String(label))}
      </div>
      {payload.map((entry: any) => (
        <div
          key={entry.dataKey}
          style={{ color: entry.color, marginBottom: 2, display: "flex", justifyContent: "space-between", gap: 16 }}
        >
          <span style={{ color: "var(--text-dim)" }}>
            {shortUrl(entry.dataKey).slice(0, 24)}
          </span>
          <strong>{fmtMs(entry.value)}</strong>
        </div>
      ))}
    </div>
  );
}

function StatusBadge({ ok, err }: { ok: boolean; err?: string | null }) {
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 5,
      padding: "3px 9px",
      borderRadius: 999,
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: "0.07em",
      textTransform: "uppercase" as const,
      background: ok ? "var(--green-dim)" : "var(--red-dim)",
      color: ok ? "var(--green)" : "var(--red)",
      border: `1px solid ${ok ? "rgba(16,185,129,0.25)" : "rgba(239,68,68,0.25)"}`,
    }}>
      <span style={{
        width: 5, height: 5, borderRadius: "50%",
        background: ok ? "var(--green)" : "var(--red)",
        boxShadow: ok ? "0 0 5px var(--green)" : "none",
        flexShrink: 0,
      }} />
      {ok ? "OK" : err?.includes("403") ? "403" : err?.includes("timeout") ? "TIMEOUT" : "FAIL"}
    </span>
  );
}

function LatencyBar({ ms, max }: { ms: number | null; max: number }) {
  if (ms == null) return <span style={{ color: "var(--text-dim)", fontSize: 11 }}>—</span>;
  const pct = Math.min((ms / Math.max(max, 1)) * 100, 100);
  const color = ms < 200 ? "var(--green)" : ms < 800 ? "var(--chart-1)" : "var(--red)";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{
        flex: 1, height: 4, borderRadius: 2,
        background: "var(--border-dim)",
        overflow: "hidden",
      }}>
        <div style={{
          width: `${pct}%`, height: "100%",
          background: color,
          borderRadius: 2,
          transition: "width 0.4s ease",
        }} />
      </div>
      <span style={{
        fontFamily: "var(--font-mono)",
        fontSize: 12,
        color,
        minWidth: 52,
        textAlign: "right" as const,
      }}>
        {fmtMs(ms)}
      </span>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function WebRunnerOverviewPage() {
  const [deviceId, setDeviceId] = useState("");
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [sinceMinutes, setSince] = useState(60);
  const [data, setData] = useState<TimeseriesResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [tick, setTick] = useState(0);

  // Load devices
  useEffect(() => {
    fetch("/api/devices/list")
      .then((r) => r.json())
      .then((j) => {
        if (j?.ok && Array.isArray(j.devices) && j.devices.length > 0) {
          setDevices(j.devices);
          setDeviceId(j.devices[0].device_id);
        }
      })
      .catch(() => {});
  }, []);

  // Auto-load data when device or time window changes
  useEffect(() => {
    if (!deviceId) return;
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId, sinceMinutes]);

  // Auto-refresh every 30s + countdown ticker
  useEffect(() => {
    const poll = setInterval(() => { loadData(); setTick(0); }, 30_000);
    const countdown = setInterval(() => setTick((t) => t + 1), 1_000);
    return () => { clearInterval(poll); clearInterval(countdown); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId, sinceMinutes]);

  async function loadData() {
    if (!deviceId) return;
    setLoading(true);
    setErr("");
    try {
      // First get configured URLs
      const cfgRes = await fetch(`/api/webrunner/config?device_id=${encodeURIComponent(deviceId)}`);
      const cfgJson = await cfgRes.json();
      const configUrls: string[] = (cfgJson?.config?.urls ?? [])
        .filter((u: string) => !u.includes("google.com/generate_204"))
        .slice(0, 6)
        .map((u: string) => u.replace(/\/$/, ""));

      if (configUrls.length === 0) {
        setData(null);
        setLoading(false);
        return;
      }

      const qp = new URLSearchParams();
      qp.set("device_id", deviceId);
      qp.set("since_minutes", String(sinceMinutes));
      for (const u of configUrls) qp.append("urls", u);

      const res = await fetch(`/api/measurements/timeseries?${qp}`);
      const json = (await res.json()) as TimeseriesResp;
      if (!json.ok) setErr(json.error || "Request failed");
      else {
        setData(json);
        setLastFetched(new Date());
      }
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  const stats = useMemo(() => data?.series ? computeStats(data.series) : null, [data]);
  const latest = useMemo(() => data?.series ? getLatestPerUrl(data.series) : {}, [data]);
  const dnsData = useMemo(() => data?.series ? mergeSeries(data.series, "dns_ms") : [], [data]);
  const httpData = useMemo(() => data?.series ? mergeSeries(data.series, "http_ms") : [], [data]);
  const urls = useMemo(() => data?.urls ?? [], [data]);

  const maxHttp = useMemo(() => {
    let max = 0;
    for (const p of Object.values(latest)) {
      if (p?.http_ms && p.http_ms > max) max = p.http_ms;
    }
    return max;
  }, [latest]);

  const nextRefresh = Math.max(0, 30 - (tick % 30));

  return (
    <>
      {/* ── Top bar ── */}
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
        <span style={{ fontSize: 11, color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
          Auto ({nextRefresh}s)
        </span>
        <select
          className="vl-select"
          value={sinceMinutes}
          onChange={(e) => setSince(Number(e.target.value))}
          style={{ width: "auto" }}
        >
          <option value={60}>Last 1 hr</option>
          <option value={240}>Last 4 hrs</option>
          <option value={1440}>Last 24 hrs</option>
        </select>
        {devices.length > 1 && (
          <select
            className="vl-select"
            value={deviceId}
            onChange={(e) => setDeviceId(e.target.value)}
            style={{ width: "auto" }}
          >
            {devices.map((d) => (
              <option key={d.device_id} value={d.device_id}>
                {d.nr_serial || d.device_id}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="vl-main" style={{ display: "flex", flexDirection: "column", gap: 16 }}>

        {err && (
          <div style={{
            padding: "10px 16px", borderRadius: "var(--r-md)",
            background: "var(--red-dim)",
            border: "1px solid rgba(239,68,68,0.3)",
            color: "var(--red)", fontSize: 13,
          }}>
            ⚠ {err}
          </div>
        )}

        {/* ── Stat tiles ── */}
        <div className="vl-grid-4">
          <div className="vl-stat">
            <div className="vl-stat-label">Avg DNS</div>
            <div className={`vl-stat-value ${stats?.avgDns != null && stats.avgDns > 200 ? "vl-stat-red" : "vl-stat-green"}`}>
              {stats ? fmtMs(stats.avgDns) : "—"}
            </div>
            <div className="vl-stat-sub">across all URLs</div>
          </div>
          <div className="vl-stat">
            <div className="vl-stat-label">Avg HTTP</div>
            <div className={`vl-stat-value ${stats?.avgHttp != null && stats.avgHttp > 500 ? "vl-stat-red" : ""}`}>
              {stats ? fmtMs(stats.avgHttp) : "—"}
            </div>
            <div className="vl-stat-sub">response time</div>
          </div>
          <div className="vl-stat">
            <div className="vl-stat-label">Error Rate</div>
            <div className={`vl-stat-value ${stats?.errCount ? "vl-stat-red" : "vl-stat-green"}`}>
              {stats ? `${stats.errorRate}%` : "—"}
            </div>
            <div className="vl-stat-sub">
              {stats ? `${stats.errCount} failure${stats.errCount !== 1 ? "s" : ""}` : ""}
            </div>
          </div>
          <div className="vl-stat">
            <div className="vl-stat-label">Data Points</div>
            <div className="vl-stat-value vl-stat-accent">
              {stats ? String(stats.totalPoints) : "—"}
            </div>
            <div className="vl-stat-sub">
              in last {sinceMinutes < 60 ? sinceMinutes + "m" : sinceMinutes / 60 + "h"}
            </div>
          </div>
        </div>

        {/* ── Per-URL status grid ── */}
        {urls.length > 0 && (
          <div className="vl-card">
            <div className="vl-card-header">
              <span style={{ fontSize: 13, fontWeight: 600 }}>URL Status</span>
              <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
                {urls.length} URL{urls.length !== 1 ? "s" : ""} monitored · latest result
              </span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table className="vl-table">
                <thead>
                  <tr>
                    <th style={{ width: 16 }}></th>
                    <th>URL</th>
                    <th style={{ textAlign: "right" as const }}>DNS</th>
                    <th>HTTP Response</th>
                    <th>Status</th>
                    <th style={{ textAlign: "right" as const }}>Last Checked</th>
                  </tr>
                </thead>
                <tbody>
                  {urls.map((url, idx) => {
                    const p = latest[url];
                    const ok = p ? (!p.http_err || p.http_err === "" || p.http_err === "null") : null;
                    return (
                      <tr key={url}>
                        <td>
                          <div style={{
                            width: 8, height: 8, borderRadius: "50%",
                            background: CHART_COLORS[idx % CHART_COLORS.length],
                            boxShadow: ok === true
                              ? `0 0 6px ${CHART_COLORS[idx % CHART_COLORS.length]}`
                              : "none",
                          }} />
                        </td>
                        <td className="mono" style={{
                          maxWidth: 260, overflow: "hidden",
                          textOverflow: "ellipsis", whiteSpace: "nowrap" as const,
                          color: "var(--text-primary)",
                        }}>
                          {shortUrl(url)}
                        </td>
                        <td className="mono" style={{ textAlign: "right" as const, color: "var(--text-secondary)" }}>
                          {p ? fmtMs(p.dns_ms) : "—"}
                        </td>
                        <td style={{ minWidth: 180 }}>
                          {p ? <LatencyBar ms={p.http_ms} max={maxHttp} /> : (
                            <span style={{ color: "var(--text-dim)", fontSize: 11 }}>No data</span>
                          )}
                        </td>
                        <td>
                          {ok !== null
                            ? <StatusBadge ok={ok === true} err={p?.http_err} />
                            : <span style={{ color: "var(--text-dim)", fontSize: 11 }}>—</span>
                          }
                        </td>
                        <td className="mono" style={{
                          textAlign: "right" as const,
                          fontSize: 11, color: "var(--text-dim)",
                        }}>
                          {p ? fmtTime(p.ts_utc) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Charts ── */}
        {(dnsData.length > 0 || httpData.length > 0) && (
          <>
            {[
              { title: "DNS Latency", chartData: dnsData, label: "milliseconds" },
              { title: "HTTP Response Time", chartData: httpData, label: "milliseconds" },
            ].map(({ title, chartData, label }) => (
              <div className="vl-card" key={title}>
                <div className="vl-card-header">
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{title}</span>
                  <span style={{ fontSize: 11, color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
                    {label}
                  </span>
                </div>
                <div className="vl-card-body">
                  <div className="vl-chart-wrap">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
                        <CartesianGrid strokeDasharray="2 4" stroke="var(--border-dim)" />
                        <XAxis
                          dataKey="ts_utc"
                          tickFormatter={fmtTime}
                          minTickGap={48}
                          tick={{ fill: "var(--text-dim)", fontSize: 10, fontFamily: "var(--font-mono)" }}
                          axisLine={{ stroke: "var(--border-mid)" }}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fill: "var(--text-dim)", fontSize: 10, fontFamily: "var(--font-mono)" }}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={(v) => `${v}ms`}
                          width={52}
                        />
                        <Tooltip content={<ChartTooltip />} />
                        {urls.map((u, idx) => (
                          <Line
                            key={u}
                            type="monotone"
                            dataKey={u}
                            stroke={CHART_COLORS[idx % CHART_COLORS.length]}
                            strokeWidth={2}
                            dot={false}
                            isAnimationActive={false}
                            connectNulls={true}
                            activeDot={{ r: 4, fill: CHART_COLORS[idx % CHART_COLORS.length] }}
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  {/* Legend */}
                  <div style={{
                    display: "flex", flexWrap: "wrap" as const,
                    gap: "8px 16px", marginTop: 12, paddingTop: 10,
                    borderTop: "1px solid var(--border-dim)",
                  }}>
                    {urls.map((u, idx) => (
                      <div key={u} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{
                          width: 20, height: 2,
                          background: CHART_COLORS[idx % CHART_COLORS.length],
                          borderRadius: 1,
                        }} />
                        <span style={{
                          fontSize: 11, color: "var(--text-secondary)",
                          fontFamily: "var(--font-mono)",
                        }}>
                          {shortUrl(u)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </>
        )}

        {/* ── Empty state ── */}
        {!loading && !data && (
          <div className="vl-card">
            <div className="vl-empty">
              <div style={{ fontSize: 32, marginBottom: 10 }}>◎</div>
              <div style={{ fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>
                No URLs configured
              </div>
              <div style={{ fontSize: 12, color: "var(--text-dim)" }}>
                Add URLs to monitor in{" "}
                <a href="/webrunner/config" style={{ color: "var(--accent)" }}>Config</a>
              </div>
            </div>
          </div>
        )}

        {/* ── Loading shimmer ── */}
        {loading && !data && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {[120, 280, 280].map((h, i) => (
              <div key={i} className="vl-card">
                <div className="vl-card-header">
                  <div className="vl-shimmer" style={{ width: 120, height: 14 }} />
                </div>
                <div className="vl-card-body">
                  <div className="vl-shimmer" style={{ height: h }} />
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </>
  );
}
