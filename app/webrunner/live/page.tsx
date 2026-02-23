"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from "recharts";

// ─── Types ─────────────────────────────────────────────────────────
type LiveMeasurement = {
  id: string | number;
  device_id: string;
  ts_utc: string;
  url: string;
  http_ms: number | null;
  http_err: string | null;
  success: boolean;
};

type LiveDevice = {
  device_id: string;
  tenant_id: string | null;
  claimed: boolean;
  hostname: string | null;
  ip: string | null;
  mode: string | null;
  last_seen: string | null;
};

type LiveResponse = {
  ok: boolean;
  device_id: string;
  window_minutes: number;
  limit: number;
  device: LiveDevice | null;
  measurements: LiveMeasurement[];
  fetched_at_utc: string;
};

type TimeseriesPoint = {
  ts_utc: string;
  avg_latency_ms: number | null;
  samples: number;
  ok_samples: number;
  fail_samples: number;
};

type TimeseriesResponse = {
  ok: boolean;
  device_id: string;
  points: TimeseriesPoint[];
};

// ─── Helpers ───────────────────────────────────────────────────────
function fmtTime(iso?: string | null) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }); }
  catch { return ""; }
}

function fmtDateTime(iso?: string | null) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString(); }
  catch { return ""; }
}

function fmtMs(val: number | null | undefined): string {
  if (val == null || isNaN(val)) return "—";
  return val < 1000 ? `${Math.round(val)}ms` : `${(val / 1000).toFixed(2)}s`;
}

function isOnline(lastSeen?: string | null): boolean {
  if (!lastSeen) return false;
  return Date.now() - new Date(lastSeen).getTime() < 2 * 60 * 1000;
}

// ─── Custom Tooltip ────────────────────────────────────────────────
function LiveTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "var(--bg-overlay)",
      border: "1px solid var(--border-bright)",
      borderRadius: "var(--r-md)",
      padding: "10px 14px",
      fontSize: 12,
      fontFamily: "var(--font-mono)",
      minWidth: 160,
    }}>
      <div style={{ color: "var(--text-dim)", marginBottom: 8, fontSize: 10 }}>
        {new Date(Number(label)).toLocaleTimeString()}
      </div>
      {payload.map((e: any) => (
        <div key={e.dataKey} style={{ color: e.color, display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 2 }}>
          <span style={{ color: "var(--text-secondary)" }}>{e.name}</span>
          <strong>{e.name === "avg_latency_ms" ? fmtMs(e.value) : e.value}</strong>
        </div>
      ))}
    </div>
  );
}

// ─── Pulse dot ─────────────────────────────────────────────────────
function PulseDot({ online }: { online: boolean }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "2px 8px", borderRadius: 999,
      background: online ? "var(--green-dim)" : "var(--red-dim)",
      border: `1px solid ${online ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`,
      fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" as const,
      color: online ? "var(--green)" : "var(--red)",
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: "50%",
        background: online ? "var(--green)" : "var(--red)",
        boxShadow: online ? "0 0 6px var(--green)" : "none",
        animation: online ? "pulse 2s infinite" : "none",
        flexShrink: 0,
      }}/>
      {online ? "Online" : "Offline"}
    </span>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────
export default function WebRunnerLivePage() {
  const [deviceId, setDeviceId] = useState("pi-001");
  const [windowMinutes, setWindow] = useState(60);
  const [live, setLive]   = useState<LiveResponse | null>(null);
  const [series, setSeries] = useState<TimeseriesResponse | null>(null);
  const [err, setErr]     = useState("");
  const [tick, setTick]   = useState(0); // for countdown

  async function fetchAll() {
    try {
      setErr("");
      const [lR, tR] = await Promise.all([
        fetch(`/api/webrunner/live?device_id=${deviceId}&window_minutes=${windowMinutes}&limit=100`),
        fetch(`/api/webrunner/timeseries?device_id=${deviceId}&window_minutes=${windowMinutes}&bucket_seconds=60`),
      ]);
      const lJ = await lR.json();
      const tJ = await tR.json();
      if (!lJ.ok) throw new Error("live endpoint failed");
      if (!tJ.ok) throw new Error("timeseries endpoint failed");
      setLive(lJ);
      setSeries(tJ);
      setTick(0);
    } catch (e: any) {
      setErr(e.message || "Unknown error");
    }
  }

  // Poll every 5s
  useEffect(() => {
    fetchAll();
    const poll = setInterval(fetchAll, 5_000);
    const countdown = setInterval(() => setTick((t) => t + 1), 1_000);
    return () => { clearInterval(poll); clearInterval(countdown); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId, windowMinutes]);

  const chartData = useMemo(() =>
    (series?.points || []).map((p) => ({
      t: new Date(p.ts_utc).getTime(),
      avg_latency_ms: p.avg_latency_ms,
      ok: p.ok_samples,
      fail: p.fail_samples,
    })),
    [series]
  );

  const online = isOnline(live?.device?.last_seen);

  // Compute quick stats from measurements
  const liveStats = useMemo(() => {
    const ms = live?.measurements || [];
    const success = ms.filter((m) => m.success);
    const avgMs = success.length
      ? Math.round(success.reduce((a, b) => a + (b.http_ms || 0), 0) / success.length)
      : null;
    return { total: ms.length, success: success.length, fail: ms.length - success.length, avgMs };
  }, [live]);

  const nextRefresh = Math.max(0, 5 - (tick % 5));

  // ─── Render ────────────────────────────────────────────────────
  return (
    <>
      {/* Topbar */}
      <div className="vl-topbar">
        <div>
          <div className="vl-topbar-title">Live Feed</div>
          <div className="vl-topbar-sub">Real-time measurements · polling every 5s</div>
        </div>
        <div className="vl-topbar-spacer" />
        <span style={{ fontSize: 11, color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
          next refresh in {nextRefresh}s
        </span>
        <select
          className="vl-select"
          value={windowMinutes}
          onChange={(e) => setWindow(Number(e.target.value))}
          style={{ width: "auto" }}
        >
          <option value={15}>15 min</option>
          <option value={60}>1 hr</option>
          <option value={240}>4 hrs</option>
        </select>
      </div>

      <div className="vl-main" style={{ display: "flex", flexDirection: "column", gap: 16 }}>

        {err && (
          <div style={{
            padding: "10px 16px", borderRadius: "var(--r-md)",
            background: "var(--red-dim)", border: "1px solid rgba(239,68,68,0.3)",
            color: "var(--red)", fontSize: 13,
          }}>
            ⚠ {err}
          </div>
        )}

        {/* ── Device info row ─────────────────────────────────── */}
        <div className="vl-card">
          <div className="vl-card-header">
            <span style={{ fontSize: 13, fontWeight: 600, fontFamily: "var(--font-mono)" }}>
              {live?.device?.hostname || deviceId}
            </span>
            <PulseDot online={online} />
          </div>
          <div className="vl-card-body">
            <div className="vl-grid-4" style={{ gap: 10 }}>
              <div>
                <div className="vl-stat-label">Device ID</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-secondary)", marginTop: 3 }}>
                  {live?.device?.device_id || "—"}
                </div>
              </div>
              <div>
                <div className="vl-stat-label">IP Address</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-secondary)", marginTop: 3 }}>
                  {live?.device?.ip || "—"}
                </div>
              </div>
              <div>
                <div className="vl-stat-label">Mode</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-secondary)", marginTop: 3 }}>
                  {live?.device?.mode || "—"}
                </div>
              </div>
              <div>
                <div className="vl-stat-label">Last Seen</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-secondary)", marginTop: 3 }}>
                  {fmtTime(live?.device?.last_seen)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Quick stats ─────────────────────────────────────── */}
        <div className="vl-grid-4">
          <div className="vl-stat">
            <div className="vl-stat-label">Avg Latency</div>
            <div className="vl-stat-value">{fmtMs(liveStats.avgMs)}</div>
            <div className="vl-stat-sub">in window</div>
          </div>
          <div className="vl-stat">
            <div className="vl-stat-label">Samples</div>
            <div className="vl-stat-value vl-stat-accent">{liveStats.total}</div>
            <div className="vl-stat-sub">total measurements</div>
          </div>
          <div className="vl-stat">
            <div className="vl-stat-label">Success</div>
            <div className="vl-stat-value vl-stat-green">{liveStats.success}</div>
            <div className="vl-stat-sub">
              {liveStats.total ? ((liveStats.success / liveStats.total) * 100).toFixed(0) : 0}% success rate
            </div>
          </div>
          <div className="vl-stat">
            <div className="vl-stat-label">Failures</div>
            <div className={`vl-stat-value ${liveStats.fail > 0 ? "vl-stat-red" : ""}`}>
              {liveStats.fail}
            </div>
            <div className="vl-stat-sub">in window</div>
          </div>
        </div>

        {/* ── Latency chart ───────────────────────────────────── */}
        <div className="vl-card">
          <div className="vl-card-header">
            <span style={{ fontSize: 13, fontWeight: 600 }}>Latency Timeline</span>
            <span style={{ fontSize: 11, color: "var(--text-dim)" }}>avg per 60s bucket</span>
          </div>
          <div className="vl-card-body">
            <div className="vl-chart-wrap" style={{ height: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke="var(--border-dim)" />
                  <XAxis
                    dataKey="t"
                    type="number"
                    domain={["dataMin", "dataMax"]}
                    tickFormatter={(v) => new Date(Number(v)).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
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
                  <Tooltip content={<LiveTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="avg_latency_ms"
                    name="avg_latency_ms"
                    stroke="var(--chart-1)"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                    activeDot={{ r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="fail"
                    name="fail"
                    stroke="var(--red)"
                    strokeWidth={1}
                    strokeDasharray="3 3"
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* ── Measurements table ──────────────────────────────── */}
        <div className="vl-card">
          <div className="vl-card-header">
            <span style={{ fontSize: 13, fontWeight: 600 }}>Latest Measurements</span>
            <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
              {live?.measurements?.length || 0} records
            </span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="vl-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>URL</th>
                  <th style={{ textAlign: "right" }}>HTTP ms</th>
                  <th>Status</th>
                  <th>Error</th>
                </tr>
              </thead>
              <tbody>
                {(live?.measurements || []).length === 0 ? (
                  <tr>
                    <td colSpan={5}>
                      <div className="vl-empty">No measurements in window</div>
                    </td>
                  </tr>
                ) : (
                  (live?.measurements || []).map((m) => (
                    <tr key={String(m.id)}>
                      <td className="mono">{fmtTime(m.ts_utc)}</td>
                      <td className="mono" style={{ maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {m.url.replace(/^https?:\/\//, "")}
                      </td>
                      <td className="mono" style={{ textAlign: "right", color: m.http_ms && m.http_ms > 500 ? "var(--red)" : "var(--text-secondary)" }}>
                        {fmtMs(m.http_ms)}
                      </td>
                      <td>
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 4,
                          padding: "2px 7px", borderRadius: 999, fontSize: 10,
                          fontWeight: 700, letterSpacing: "0.07em",
                          background: m.success ? "var(--green-dim)" : "var(--red-dim)",
                          color: m.success ? "var(--green)" : "var(--red)",
                        }}>
                          {m.success ? "OK" : "FAIL"}
                        </span>
                      </td>
                      <td className="mono" style={{ fontSize: 11, color: "var(--red)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {m.http_err && m.http_err !== "null" ? m.http_err : ""}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </>
  );
}
