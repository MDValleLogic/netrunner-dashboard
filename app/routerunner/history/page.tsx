"use client";
import { useEffect, useState, useMemo } from "react";
import { useDevice } from "@/lib/deviceContext";
import { Clock } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";

type Hop = { hop_num: number; ip: string|null; rtt_ms: number|null; timeout: boolean; org: string; };
type Trace = { id: number; ts_utc: string; target: string; dest_ip: string; hop_count: number; total_hops: number; hops: Hop[]; };

const TARGET_COLORS: Record<string, string> = {
  "8.8.8.8": "#4ade80", "1.1.1.1": "#60a5fa", "8.8.4.4": "#f97316", "1.0.0.1": "#a78bfa",
};
function tColor(t: string) { return TARGET_COLORS[t] || "#94a3b8"; }
function fmtTime(iso: string) { try { return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); } catch { return ""; } }
function fmtFull(iso: string) { try { return new Date(iso).toLocaleString(); } catch { return iso; } }
function rttColor(ms: number) { return ms < 20 ? "#22c55e" : ms < 80 ? "#60a5fa" : ms < 150 ? "#f59e0b" : "#ef4444"; }

const sel = { background: "#111827", border: "1px solid #374151", borderRadius: 6, color: "#e5e7eb", padding: "6px 10px", fontSize: 12, fontFamily: "monospace" };

const RANGES = [
  { label: "1 hr",  value: 60,   limit: 50  },
  { label: "4 hrs", value: 240,  limit: 100 },
  { label: "24 hrs",value: 1440, limit: 300 },
  { label: "7 days",value: 10080,limit: 500 },
];

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#111827", border: "1px solid #374151", borderRadius: 6, padding: "10px 14px", fontSize: 11, fontFamily: "monospace" }}>
      <div style={{ color: "#6b7280", marginBottom: 6 }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ color: p.color, marginBottom: 2 }}>
          {p.dataKey}: <strong>{p.value != null ? `${p.value.toFixed(1)}ms` : "—"}</strong>
        </div>
      ))}
    </div>
  );
}

export default function RouteRunnerHistory() {
  const { selectedDeviceId, devices, setSelectedDeviceId } = useDevice();
  const [traces, setTraces]   = useState<Trace[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange]     = useState(RANGES[1]);
  const [view, setView]       = useState<"charts"|"table">("charts");

  async function fetchHistory() {
    if (!selectedDeviceId) return;
    setLoading(true);
    try {
      const url = `/api/routerunner/results?limit=${range.limit}&device_id=${selectedDeviceId}`;
      const j = await fetch(url).then(r => r.json());
      setTraces((j.traces || []).reverse()); // oldest first for charts
    } finally { setLoading(false); }
  }

  useEffect(() => { fetchHistory(); }, [selectedDeviceId, range]); // eslint-disable-line

  // Unique targets
  const targets = useMemo(() => [...new Set(traces.map(t => t.target))], [traces]);

  // Latency over time — final RTT per target per trace
  const latencyData = useMemo(() => {
    const byTs: Record<string, any> = {};
    for (const trace of traces) {
      const key = trace.ts_utc;
      if (!byTs[key]) byTs[key] = { ts: fmtTime(trace.ts_utc), _full: trace.ts_utc };
      const finalHop = [...(trace.hops || [])].filter(h => !h.timeout && h.rtt_ms != null).pop();
      byTs[key][trace.target] = finalHop?.rtt_ms ?? null;
    }
    return Object.values(byTs);
  }, [traces]);

  // Hop count over time
  const hopData = useMemo(() => {
    const byTs: Record<string, any> = {};
    for (const trace of traces) {
      const key = `${trace.ts_utc}_${trace.target}`;
      byTs[key] = {
        ts: fmtTime(trace.ts_utc),
        target: trace.target,
        total: trace.total_hops,
        responding: trace.hop_count,
        timeouts: trace.total_hops - trace.hop_count,
      };
    }
    return Object.values(byTs);
  }, [traces]);

  // Timeout rate over time (rolling)
  const timeoutData = useMemo(() => {
    return traces.map(t => ({
      ts: fmtTime(t.ts_utc),
      target: t.target,
      pct: t.total_hops > 0 ? Math.round(((t.total_hops - t.hop_count) / t.total_hops) * 100) : 0,
    }));
  }, [traces]);

  // Per-target summary
  const summaries = useMemo(() => {
    return targets.map(target => {
      const tTraces = traces.filter(t => t.target === target);
      const rtts = tTraces.map(t => {
        const finalHop = [...(t.hops || [])].filter(h => !h.timeout && h.rtt_ms != null).pop();
        return finalHop?.rtt_ms ?? null;
      }).filter((r): r is number => r != null);
      const avg = rtts.length ? Math.round(rtts.reduce((a, b) => a + b, 0) / rtts.length) : null;
      const best = rtts.length ? Math.min(...rtts) : null;
      const worst = rtts.length ? Math.max(...rtts) : null;
      const latest = tTraces[tTraces.length - 1];
      const timeoutPct = tTraces.length ? Math.round(tTraces.reduce((a, t) => a + (t.total_hops - t.hop_count), 0) / tTraces.reduce((a, t) => a + t.total_hops, 0) * 100) : 0;

      // ISP path from latest trace
      const orgs = [...new Set((latest?.hops || []).filter(h => !h.timeout && h.org).map(h => h.org.replace(/^AS\d+\s+/, "").substring(0, 20)))];

      return { target, avg, best, worst, timeoutPct, orgs, count: tTraces.length };
    });
  }, [targets, traces]);

  // ISP path changes
  const pathChanges = useMemo(() => {
    const changes: { ts: string; target: string; from: string; to: string }[] = [];
    const lastPath: Record<string, string> = {};
    for (const trace of traces) {
      const path = [...new Set((trace.hops || []).filter(h => !h.timeout && h.org).map(h => h.org.replace(/^AS\d+\s+/, "").substring(0, 15)))].join(" → ");
      const key = trace.target;
      if (lastPath[key] && lastPath[key] !== path) {
        changes.push({ ts: fmtFull(trace.ts_utc), target: trace.target, from: lastPath[key], to: path });
      }
      lastPath[key] = path;
    }
    return changes.reverse();
  }, [traces]);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 max-w-6xl">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <Clock size={20} className="text-blue-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-100 leading-tight">RouteRunner · History</h1>
            <p className="text-xs text-gray-500 font-mono">Latency trends · path changes · timeout rates</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select value={selectedDeviceId || ""} onChange={e => setSelectedDeviceId(e.target.value)} style={sel}>
            {devices.map(d => <option key={d.device_id} value={d.device_id}>{d.nickname ? `${d.nickname} (${d.nr_serial})` : d.nr_serial}</option>)}
          </select>
          <div style={{ display: "flex", gap: 4 }}>
            {RANGES.map(r => (
              <button key={r.value} onClick={() => setRange(r)} style={{ padding: "6px 12px", borderRadius: 6, fontSize: 12, cursor: "pointer", fontFamily: "monospace", border: range.value === r.value ? "2px solid #3b82f6" : "1px solid #374151", background: range.value === r.value ? "rgba(59,130,246,0.1)" : "transparent", color: range.value === r.value ? "#60a5fa" : "#9ca3af" }}>{r.label}</button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {(["charts", "table"] as const).map(v => (
              <button key={v} onClick={() => setView(v)} style={{ padding: "6px 12px", borderRadius: 6, fontSize: 12, cursor: "pointer", fontFamily: "monospace", border: view === v ? "2px solid #3b82f6" : "1px solid #374151", background: view === v ? "rgba(59,130,246,0.1)" : "transparent", color: view === v ? "#60a5fa" : "#9ca3af", textTransform: "capitalize" }}>{v}</button>
            ))}
          </div>
          <button onClick={fetchHistory} style={{ ...sel, cursor: "pointer" }}>↻</button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "48px 0", color: "#6b7280" }}>Loading…</div>
      ) : traces.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 0", color: "#6b7280" }}>No trace data in this window</div>
      ) : (
        <div className="max-w-6xl space-y-4">

          {/* Per-target summary cards */}
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${targets.length}, 1fr)`, gap: 12 }}>
            {summaries.map(s => (
              <div key={s.target} style={{ background: "#0f172a", border: `1px solid ${tColor(s.target)}40`, borderRadius: 10, padding: "16px 20px" }}>
                <div style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 700, color: tColor(s.target), marginBottom: 12 }}>→ {s.target}</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                  {[
                    { label: "Avg RTT",  value: s.avg != null ? `${s.avg}ms` : "—",   color: s.avg != null ? rttColor(s.avg) : "#6b7280" },
                    { label: "Best",     value: s.best != null ? `${s.best.toFixed(1)}ms` : "—", color: "#22c55e" },
                    { label: "Worst",    value: s.worst != null ? `${s.worst.toFixed(1)}ms` : "—", color: "#ef4444" },
                    { label: "Timeouts", value: `${s.timeoutPct}%`, color: s.timeoutPct > 10 ? "#ef4444" : s.timeoutPct > 0 ? "#f59e0b" : "#6b7280" },
                  ].map(stat => (
                    <div key={stat.label} style={{ background: "#111827", borderRadius: 6, padding: "8px 10px" }}>
                      <div style={{ fontSize: 9, fontFamily: "monospace", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>{stat.label}</div>
                      <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "monospace", color: stat.color }}>{stat.value}</div>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 10, color: "#6b7280", fontFamily: "monospace" }}>
                  {s.orgs.slice(0, 3).join(" → ")}
                </div>
                <div style={{ fontSize: 10, color: "#4b5563", marginTop: 4 }}>{s.count} traces</div>
              </div>
            ))}
          </div>

          {view === "charts" && (
            <>
              {/* Latency over time */}
              <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 10, padding: "20px 24px" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#e5e7eb", marginBottom: 16 }}>Final RTT by Target</div>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={latencyData} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="2 4" stroke="#1e293b" />
                    <XAxis dataKey="ts" tick={{ fill: "#6b7280", fontSize: 10, fontFamily: "monospace" }} axisLine={{ stroke: "#374151" }} tickLine={false} minTickGap={40} />
                    <YAxis tick={{ fill: "#6b7280", fontSize: 10, fontFamily: "monospace" }} axisLine={false} tickLine={false} tickFormatter={v => `${v}ms`} width={52} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11, fontFamily: "monospace" }} />
                    {targets.map(t => (
                      <Line key={t} type="monotone" dataKey={t} stroke={tColor(t)} strokeWidth={2} dot={false} connectNulls isAnimationActive={false} activeDot={{ r: 4 }} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Hop count over time — one chart per target */}
              <div style={{ display: "grid", gridTemplateColumns: targets.length > 1 ? "1fr 1fr" : "1fr", gap: 12 }}>
                {targets.map(target => {
                  const tData = hopData.filter(d => d.target === target);
                  return (
                    <div key={target} style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 10, padding: "20px 24px" }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: tColor(target), marginBottom: 16 }}>Hop Count → {target}</div>
                      <ResponsiveContainer width="100%" height={160}>
                        <LineChart data={tData} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
                          <CartesianGrid strokeDasharray="2 4" stroke="#1e293b" />
                          <XAxis dataKey="ts" tick={{ fill: "#6b7280", fontSize: 10, fontFamily: "monospace" }} axisLine={{ stroke: "#374151" }} tickLine={false} minTickGap={40} />
                          <YAxis tick={{ fill: "#6b7280", fontSize: 10, fontFamily: "monospace" }} axisLine={false} tickLine={false} width={30} />
                          <Tooltip contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: 6, fontSize: 11, fontFamily: "monospace" }} />
                          <Line type="monotone" dataKey="total" stroke="#374151" strokeWidth={1} dot={false} isAnimationActive={false} name="Total" />
                          <Line type="monotone" dataKey="responding" stroke={tColor(target)} strokeWidth={2} dot={false} isAnimationActive={false} name="Responding" />
                          <Line type="monotone" dataKey="timeouts" stroke="#ef4444" strokeWidth={1} dot={false} isAnimationActive={false} name="Timeouts" strokeDasharray="3 3" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  );
                })}
              </div>

              {/* ISP Path Changes */}
              {pathChanges.length > 0 && (
                <div style={{ background: "#0f172a", border: "1px solid #f59e0b40", borderRadius: 10, padding: "20px 24px" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#f59e0b", marginBottom: 12 }}>⚡ ISP Path Changes Detected</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {pathChanges.slice(0, 5).map((c, i) => (
                      <div key={i} style={{ background: "#111827", borderRadius: 6, padding: "10px 14px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                          <span style={{ fontFamily: "monospace", fontSize: 11, color: tColor(c.target), fontWeight: 700 }}>→ {c.target}</span>
                          <span style={{ fontFamily: "monospace", fontSize: 10, color: "#6b7280" }}>{c.ts}</span>
                        </div>
                        <div style={{ fontSize: 11, color: "#ef4444", fontFamily: "monospace", marginBottom: 2 }}>− {c.from}</div>
                        <div style={{ fontSize: 11, color: "#22c55e", fontFamily: "monospace" }}>+ {c.to}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {view === "table" && (
            <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 10, overflow: "hidden" }}>
              <div style={{ padding: "12px 16px", borderBottom: "1px solid #1e293b", display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#e5e7eb" }}>Trace Log</span>
                <span style={{ fontSize: 11, color: "#6b7280", fontFamily: "monospace" }}>{traces.length} traces</span>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #1e293b" }}>
                      {["Time", "Target", "Dest IP", "Total Hops", "Responding", "Timeouts", "Final RTT"].map((h, i) => (
                        <th key={h} style={{ padding: "8px 16px", textAlign: i >= 3 ? "right" : "left", fontSize: 10, fontFamily: "monospace", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...traces].reverse().map(t => {
                      const timeouts = t.total_hops - t.hop_count;
                      const finalHop = [...(t.hops || [])].filter(h => !h.timeout && h.rtt_ms != null).pop();
                      const rtt = finalHop?.rtt_ms;
                      return (
                        <tr key={t.id} style={{ borderBottom: "1px solid #0f172a" }}>
                          <td style={{ padding: "8px 16px", fontFamily: "monospace", fontSize: 11, color: "#9ca3af" }}>{fmtFull(t.ts_utc)}</td>
                          <td style={{ padding: "8px 16px", fontFamily: "monospace", fontSize: 12, color: tColor(t.target) }}>{t.target}</td>
                          <td style={{ padding: "8px 16px", fontFamily: "monospace", fontSize: 11, color: "#6b7280" }}>{t.dest_ip || "—"}</td>
                          <td style={{ padding: "8px 16px", fontFamily: "monospace", fontSize: 12, color: "#e5e7eb", textAlign: "right" }}>{t.total_hops}</td>
                          <td style={{ padding: "8px 16px", fontFamily: "monospace", fontSize: 12, color: "#22c55e", textAlign: "right" }}>{t.hop_count}</td>
                          <td style={{ padding: "8px 16px", fontFamily: "monospace", fontSize: 12, color: timeouts > 0 ? "#f59e0b" : "#6b7280", textAlign: "right" }}>{timeouts}</td>
                          <td style={{ padding: "8px 16px", fontFamily: "monospace", fontSize: 12, textAlign: "right", color: rtt != null ? rttColor(rtt) : "#6b7280" }}>{rtt != null ? `${rtt.toFixed(1)}ms` : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
