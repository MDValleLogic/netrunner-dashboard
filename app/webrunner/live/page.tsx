"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useDevice } from "@/lib/deviceContext";
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts";
import { Activity } from "lucide-react";

type LiveMeasurement = {
  id: string | number;
  device_id: string;
  nr_serial: string;
  ts_utc: string;
  url: string;
  http_ms: number | null;
  http_err: string | null;
  success: boolean;
};
type LiveDevice = {
  device_id: string; nr_serial: string; tenant_id: string | null;
  claimed: boolean; hostname: string | null; ip: string | null;
  mode: string | null; last_seen: string | null;
};
type LiveResponse = {
  ok: boolean; device_id: string; nr_serial: string;
  window_minutes: number; limit: number;
  device: LiveDevice | null; measurements: LiveMeasurement[]; fetched_at_utc: string;
};

function fmtTime(iso?: string | null) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }); }
  catch { return ""; }
}
function fmtMs(val: number | null | undefined): string {
  if (val == null || isNaN(val)) return "—";
  return val < 1000 ? `${Math.round(val)}ms` : `${(val / 1000).toFixed(2)}s`;
}
function isOnline(lastSeen?: string | null): boolean {
  if (!lastSeen) return false;
  return Date.now() - new Date(lastSeen).getTime() < 10 * 60 * 1000;
}

function LiveTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#111827", border: "1px solid #374151", borderRadius: 6, padding: "10px 14px", fontSize: 12, fontFamily: "monospace", minWidth: 160 }}>
      {payload.map((e: any) => (
        <div key={e.dataKey} style={{ color: e.color, display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 2 }}>
          <span style={{ color: "#9ca3af" }}>{e.name}</span>
          <strong>{e.name === "avg_latency_ms" ? fmtMs(e.value) : e.value}</strong>
        </div>
      ))}
    </div>
  );
}

export default function WebRunnerLivePage() {
  const [windowMinutes, setWindow] = useState(60);
  const [live, setLive]     = useState<LiveResponse | null>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [err, setErr]       = useState("");
  const [tick, setTick]     = useState(0);

  async function fetchAll() {
    try {
      setErr("");
      const [lR, tR] = await Promise.all([
        fetch(`/api/webrunner/live?window_minutes=${windowMinutes}&limit=100${selectedDeviceId ? "&device_id="+selectedDeviceId : ""}`),
        fetch(`/api/webrunner/timeseries?window_minutes=${windowMinutes}&bucket_seconds=60${selectedDeviceId ? "&device_id="+selectedDeviceId : ""}`),
      ]);
      const lJ = await lR.json();
      const tJ = await tR.json();
      if (!lJ.measurements) throw new Error("live endpoint failed");
      setLive({ ...lJ, measurements: lJ.measurements.map((m: any) => ({ ...m, success: !m.http_err || m.http_err === "" })) });
      if (tJ.buckets) {
        setChartData(tJ.buckets.map((b: any) => ({
          t: new Date(b.bucket).getTime(),
          avg_latency_ms: b.avg_ms,
          fail: b.total - b.success,
        })));
      }
      setTick(0);
    } catch (e: any) { setErr(e.message || "Unknown error"); }
  }

  useEffect(() => {
    fetchAll();
    const poll = setInterval(fetchAll, 5_000);
    return () => clearInterval(poll);
    const countdown = setInterval(() => setTick(t => t + 1), 1_000);
    return () => { clearInterval(poll); clearInterval(countdown); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowMinutes, selectedDeviceId]);

  const online = isOnline(live?.device?.last_seen);
  const liveStats = useMemo(() => {
    const ms = live?.measurements || [];
    const success = ms.filter(m => m.success);
    const avgMs = success.length ? Math.round(success.reduce((a, b) => a + (b.http_ms || 0), 0) / success.length) : null;
    return { total: ms.length, success: success.length, fail: ms.length - success.length, avgMs };
  }, [live]);

  const nextRefresh = Math.max(0, 5 - (tick % 5));

  const statCards = [
    { label: "Avg Latency", value: fmtMs(liveStats.avgMs), alert: !!(liveStats.avgMs && liveStats.avgMs > 500) },
    { label: "Samples",     value: String(liveStats.total), alert: false },
    { label: "Success",     value: String(liveStats.success), alert: false, green: true },
    { label: "Failures",    value: String(liveStats.fail), alert: liveStats.fail > 0 },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">

      {/* Header */}
      <div className="flex items-center justify-between mb-6 max-w-5xl">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <Activity size={20} className="text-blue-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-100 leading-tight">Live Feed</h1>
            <p className="text-xs text-gray-500 font-mono">Real-time measurements · polling every 5s</p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 11, color: "#6b7280", fontFamily: "monospace" }}>refresh in {nextRefresh}s</span>
          <select value={selectedDeviceId || ""} onChange={e => setSelectedDeviceId(e.target.value)} style={{ background: "#111827", border: "1px solid #374151", borderRadius: 6, color: "#e5e7eb", padding: "6px 10px", fontSize: 12, fontFamily: "monospace" }}>
            {devices.map(d => <option key={d.device_id} value={d.device_id}>{d.nickname ? `${d.nickname} (${d.nr_serial})` : d.nr_serial}</option>)}
          </select>
          <select value={windowMinutes} onChange={e => setWindow(Number(e.target.value))} style={{
            background: "#111827", border: "1px solid #374151", borderRadius: 6,
            color: "#e5e7eb", padding: "6px 10px", fontSize: 12, fontFamily: "monospace",
          }}>
            <option value={15}>15 min</option>
            <option value={60}>1 hr</option>
            <option value={240}>4 hrs</option>
          </select>
        </div>
      </div>

      <div className="max-w-5xl space-y-4">

        {err && (
          <div style={{ padding: "10px 16px", borderRadius: 8, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444", fontSize: 13 }}>
            ⚠ {err}
          </div>
        )}

        {/* Device card */}
        <div className="rounded-lg border border-gray-700/60 bg-gray-900/60 overflow-hidden">
          <div style={{ display: "flex", alignItems: "stretch", minHeight: 120 }}>
            <div style={{ width: 200, flexShrink: 0, background: "#0f1f3d", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px 20px", position: "relative" }}>
              <img src="/NetRunner_White.png" alt="NetRunner" style={{ width: "100%", maxWidth: 160, height: "auto", objectFit: "contain", filter: "drop-shadow(0 8px 24px rgba(0,0,0,0.6))" }} />
              <div style={{ position: "absolute", bottom: 10, left: 12, fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", color: "rgba(255,255,255,0.35)", textTransform: "uppercase" }}>NetRunner Appliance</div>
            </div>
            <div style={{ flex: 1, padding: "16px 20px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#e5e7eb", fontFamily: "monospace", marginBottom: 2 }}>{live?.device?.hostname || "NetRunner Appliance"}</div>
                  <div style={{ fontSize: 11, color: "#6b7280" }}>Edge monitoring appliance</div>
                </div>
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600,
                  background: online ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                  border: `1px solid ${online ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
                  color: online ? "#22c55e" : "#ef4444",
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: online ? "#22c55e" : "#ef4444", boxShadow: online ? "0 0 6px #22c55e" : "none" }} />
                  {online ? "Online" : "Offline"}
                </span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
                {[
                  { label: "Device",     value: live?.device?.nr_serial || live?.device?.device_id || "—" },
                  { label: "IP Address", value: live?.device?.ip || "—" },
                  { label: "Mode",       value: live?.device?.mode || "—" },
                  { label: "Last Seen",  value: fmtTime(live?.device?.last_seen) },
                ].map(f => (
                  <div key={f.label}>
                    <div style={{ fontSize: 9, fontFamily: "monospace", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>{f.label}</div>
                    <div style={{ fontFamily: "monospace", fontSize: 12, color: "#9ca3af" }}>{f.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-4 gap-3">
          {statCards.map(({ label, value, alert, green }) => (
            <div key={label} className={`rounded-lg border px-4 py-4 bg-gray-900/60 ${alert ? "border-red-700/60" : "border-gray-700/60"}`}>
              <div className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-2">{label}</div>
              <div style={{ fontSize: 24, fontWeight: 700, fontFamily: "monospace", color: alert ? "#ef4444" : (green as any) ? "#22c55e" : "#ffffff" }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Latency chart */}
        <div className="rounded-lg border border-gray-700/60 bg-gray-900/60 p-4">
          <div className="flex items-center justify-between mb-4">
            <span style={{ fontSize: 13, fontWeight: 600, color: "#e5e7eb" }}>Latency Timeline</span>
            <span style={{ fontSize: 11, color: "#6b7280", fontFamily: "monospace" }}>avg per 60s bucket</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="#1f2937" />
              <XAxis dataKey="t" type="number" domain={["dataMin", "dataMax"]}
                tickFormatter={v => new Date(Number(v)).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                tick={{ fill: "#6b7280", fontSize: 10, fontFamily: "monospace" }}
                axisLine={{ stroke: "#374151" }} tickLine={false} />
              <YAxis tick={{ fill: "#6b7280", fontSize: 10, fontFamily: "monospace" }}
                axisLine={false} tickLine={false} tickFormatter={v => `${v}ms`} width={52} />
              <Tooltip content={<LiveTooltip />} />
              <Line type="monotone" dataKey="avg_latency_ms" name="avg_latency_ms"
                stroke="#3b82f6" strokeWidth={2} dot={false} isAnimationActive={false} activeDot={{ r: 4 }} />
              <Line type="monotone" dataKey="fail" name="fail"
                stroke="#ef4444" strokeWidth={1} strokeDasharray="3 3" dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Measurements table */}
        <div className="rounded-lg border border-gray-700/60 bg-gray-900/60">
          <div className="flex items-center justify-between p-4 border-b border-gray-700/60">
            <span style={{ fontSize: 13, fontWeight: 600, color: "#e5e7eb" }}>Latest Measurements</span>
            <span style={{ fontSize: 11, color: "#6b7280", fontFamily: "monospace" }}>{live?.measurements?.length || 0} records</span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #1f2937" }}>
                  {["Time", "URL", "HTTP ms", "Status", "Error"].map(h => (
                    <th key={h} style={{ padding: "8px 16px", textAlign: "left", fontSize: 10, fontFamily: "monospace", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(live?.measurements || []).length === 0 ? (
                  <tr><td colSpan={5} style={{ padding: "32px 16px", textAlign: "center", color: "#6b7280", fontSize: 13 }}>No measurements in window</td></tr>
                ) : (
                  (live?.measurements || []).map(m => (
                    <tr key={String(m.id)} style={{ borderBottom: "1px solid #111827" }}>
                      <td style={{ padding: "8px 16px", fontFamily: "monospace", fontSize: 12, color: "#9ca3af" }}>{fmtTime(m.ts_utc)}</td>
                      <td style={{ padding: "8px 16px", fontFamily: "monospace", fontSize: 12, color: "#d1d5db", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {m.url.replace(/^https?:\/\//, "")}
                      </td>
                      <td style={{ padding: "8px 16px", fontFamily: "monospace", fontSize: 12, textAlign: "right", color: m.http_ms && m.http_ms > 500 ? "#ef4444" : "#9ca3af" }}>
                        {fmtMs(m.http_ms)}
                      </td>
                      <td style={{ padding: "8px 16px" }}>
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 4,
                          padding: "2px 7px", borderRadius: 999, fontSize: 10, fontWeight: 700,
                          background: m.success ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                          color: m.success ? "#22c55e" : "#ef4444",
                        }}>
                          {m.success ? "OK" : "FAIL"}
                        </span>
                      </td>
                      <td style={{ padding: "8px 16px", fontFamily: "monospace", fontSize: 11, color: "#ef4444", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
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
    </div>
  );
}
