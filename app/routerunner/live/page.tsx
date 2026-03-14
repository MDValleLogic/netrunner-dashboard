"use client";
import { useEffect, useState } from "react";
import { useDevice } from "@/lib/deviceContext";
import { Navigation } from "lucide-react";

const TARGET_LABELS: Record<string, string> = {
  "8.8.8.8": "Google DNS (8.8.8.8)", "1.1.1.1": "Cloudflare DNS (1.1.1.1)",
  "8.8.4.4": "Google DNS (8.8.4.4)", "1.0.0.1": "Cloudflare DNS (1.0.0.1)",
};
function targetLabel(t: string) { return TARGET_LABELS[t] || t; }

type Hop = { hop_num: number; ip: string|null; hostname: string|null; rtt_ms: number|null; timeout: boolean; org: string; isp: string; asn: string; country: string; city: string; };
type Trace = { id: number; ts_utc: string; target: string; dest_ip: string; hop_count: number; total_hops: number; };

function ispColor(org: string) {
  const o = org.toLowerCase();
  if (/google/.test(o))          return "#4ade80";
  if (/cloudflare/.test(o))      return "#f97316";
  if (/comcast|xfinity/.test(o)) return "#a78bfa";
  if (/cogent/.test(o))          return "#38bdf8";
  if (/level.?3|lumen/.test(o))  return "#fbbf24";
  if (/at&t|att/.test(o))        return "#60a5fa";
  if (/verizon/.test(o))         return "#f472b6";
  if (/akamai/.test(o))          return "#06b6d4";
  if (/amazon|aws/.test(o))      return "#fb923c";
  return "#94a3b8";
}
function fmtTime(iso: string) { try { return new Date(iso).toLocaleString(); } catch { return iso; } }
function rttColor(ms: number) { return ms < 20 ? "#22c55e" : ms < 80 ? "#60a5fa" : "#f97316"; }

const sel = { background: "#111827", border: "1px solid #374151", borderRadius: 6, color: "#e5e7eb", padding: "6px 10px", fontSize: 12, fontFamily: "monospace" };

export default function RouteRunnerLive() {
  const { selectedDeviceId, devices, setSelectedDeviceId } = useDevice();
  const [targets, setTargets] = useState<string[]>([]);
  const [target, setTarget]   = useState("");
  const [trace, setTrace]     = useState<Trace|null>(null);
  const [hops, setHops]       = useState<Hop[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick]       = useState(0);

  async function fetchData(t?: string) {
    try {
      const tParam = t !== undefined ? t : target;
      const did = selectedDeviceId ? `device_id=${selectedDeviceId}&` : "";
      const url = `/api/routerunner/results?${did}${tParam ? "target="+encodeURIComponent(tParam) : ""}`;
      const j = await fetch(url).then(r => r.json());
      if (!j.traces) return;
      const latest = j.traces?.[0] || null;
      setTrace(latest); setHops(latest?.hops || []);
      const allTargets = [...new Set(j.traces.map((tr: any) => tr.target))] as string[];
      if (allTargets.length) { setTargets(allTargets); if (!target && !t) setTarget(allTargets[0]); }
    } finally { setLoading(false); }
  }

  useEffect(() => {
    fetchData();
    const poll = setInterval(() => fetchData(), 30_000);
    const cd   = setInterval(() => setTick(t => t + 1), 1000);
    return () => { clearInterval(poll); clearInterval(cd); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { if (target) fetchData(target); }, [target]); // eslint-disable-line
  useEffect(() => { fetchData(); }, [selectedDeviceId]); // eslint-disable-line

  const maxRtt = Math.max(...hops.filter(h => h.rtt_ms != null).map(h => h.rtt_ms!), 1);
  const nextRefresh = Math.max(0, 30 - (tick % 30));
  const finalRtt = hops.filter(h => !h.timeout).slice(-1)[0]?.rtt_ms;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 max-w-5xl">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <Navigation size={20} className="text-blue-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-100 leading-tight">RouteRunner · Live Feed</h1>
            <p className="text-xs text-gray-500 font-mono">Most recent trace result</p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 11, color: "#6b7280", fontFamily: "monospace" }}>refresh in {nextRefresh}s</span>
          {targets.length > 0 && (
            <select value={target} onChange={e => setTarget(e.target.value)} style={{ ...sel, maxWidth: 260 }}>
              {targets.map(t => <option key={t} value={t}>{targetLabel(t)}</option>)}
            </select>
          )}
        </div>
      </div>

      <div className="max-w-5xl space-y-4">
        {/* Trace summary */}
        {trace && (
          <div className="rounded-lg border border-gray-700/60 bg-gray-900/60 p-4">
            <div className="flex items-center justify-between mb-4">
              <span style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 700, color: "#60a5fa" }}>→ {targetLabel(trace.target)}</span>
              <span style={{ fontSize: 11, color: "#6b7280" }}>{fmtTime(trace.ts_utc)}</span>
            </div>
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: "Dest IP",    value: trace.dest_ip,    color: "#9ca3af", size: 13 },
                { label: "Total Hops", value: trace.total_hops, color: "#60a5fa", size: 24 },
                { label: "Responding", value: trace.hop_count,  color: "#22c55e", size: 24 },
                { label: "Final RTT",  value: finalRtt != null ? `${finalRtt.toFixed(1)}ms` : "—", color: "#e5e7eb", size: 24 },
              ].map(s => (
                <div key={s.label} className="rounded-lg border border-gray-800 bg-gray-900 px-3 py-3">
                  <div style={{ fontSize: 9, fontFamily: "monospace", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>{s.label}</div>
                  <div style={{ fontFamily: "monospace", fontSize: s.size, fontWeight: 700, color: s.color }}>{String(s.value)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bar chart */}
        {hops.length > 0 && (
          <div className="rounded-lg border border-gray-700/60 bg-gray-900/60 p-4">
            <div className="flex items-center justify-between mb-4">
              <span style={{ fontSize: 13, fontWeight: 600, color: "#e5e7eb" }}>Latency by Hop</span>
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 120, padding: "8px 0" }}>
              {hops.map((hop, i) => {
                const pct = hop.rtt_ms != null ? Math.max(4, (hop.rtt_ms / maxRtt) * 100) : 4;
                const color = hop.timeout ? "#374151" : rttColor(hop.rtt_ms!);
                return (
                  <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <div style={{ fontSize: 9, color: "#6b7280", fontFamily: "monospace" }}>{hop.rtt_ms != null ? hop.rtt_ms.toFixed(0) : "*"}</div>
                    <div style={{ width: "100%", height: `${pct}%`, background: color, borderRadius: "3px 3px 0 0", minHeight: 4, opacity: hop.timeout ? 0.3 : 1 }} />
                    <div style={{ fontSize: 9, color: "#6b7280", fontFamily: "monospace" }}>{hop.hop_num}</div>
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 16, marginTop: 4 }}>
              {[["#22c55e", "< 20ms"], ["#60a5fa", "20–80ms"], ["#f97316", "> 80ms"]].map(([c, l]) => (
                <div key={l} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: c }} />
                  <span style={{ fontSize: 10, color: "#6b7280" }}>{l}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Hop detail table */}
        {hops.length > 0 && (
          <div className="rounded-lg border border-gray-700/60 bg-gray-900/60">
            <div className="flex items-center justify-between p-4 border-b border-gray-700/60">
              <span style={{ fontSize: 13, fontWeight: 600, color: "#e5e7eb" }}>Hop Detail</span>
              <span style={{ fontSize: 11, color: "#6b7280", fontFamily: "monospace" }}>{hops.length} hops</span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #1f2937" }}>
                    {["#", "IP", "Hostname", "RTT", "Organization", "Location"].map(h => (
                      <th key={h} style={{ padding: "8px 16px", textAlign: "left", fontSize: 10, fontFamily: "monospace", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {hops.map((hop, i) => {
                    const color = ispColor(hop.org);
                    return (
                      <tr key={i} style={{ borderBottom: "1px solid #111827", opacity: hop.timeout ? 0.35 : 1 }}>
                        <td style={{ padding: "8px 16px", fontFamily: "monospace", fontSize: 12, fontWeight: 700, color: "#60a5fa" }}>{hop.hop_num}</td>
                        <td style={{ padding: "8px 16px", fontFamily: "monospace", fontSize: 12, color: "#d1d5db" }}>{hop.ip || <span style={{ color: "#6b7280" }}>*</span>}</td>
                        <td style={{ padding: "8px 16px", fontFamily: "monospace", fontSize: 11, color: "#6b7280", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{hop.hostname && hop.hostname !== hop.ip ? hop.hostname : "—"}</td>
                        <td style={{ padding: "8px 16px" }}>
                          {hop.rtt_ms != null
                            ? <span style={{ fontFamily: "monospace", fontSize: 12, color: rttColor(hop.rtt_ms) }}>{hop.rtt_ms.toFixed(1)}ms</span>
                            : <span style={{ color: "#6b7280", fontSize: 11 }}>timeout</span>}
                        </td>
                        <td style={{ padding: "8px 16px" }}>
                          {hop.org
                            ? <span style={{ fontSize: 11, fontWeight: 600, color, background: `${color}18`, padding: "2px 8px", borderRadius: 4 }}>{hop.org.replace(/^AS\d+\s+/, "").substring(0, 32)}</span>
                            : <span style={{ color: "#6b7280" }}>—</span>}
                        </td>
                        <td style={{ padding: "8px 16px", fontSize: 11, color: "#9ca3af" }}>{[hop.city, hop.country].filter(Boolean).join(", ") || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!loading && hops.length === 0 && (
          <div className="rounded-lg border border-gray-700/60 bg-gray-900/60 p-12 text-center">
            <div style={{ fontSize: 32, marginBottom: 12 }}>🗺️</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#e5e7eb", marginBottom: 8 }}>No trace data yet</div>
            <div style={{ fontSize: 12, color: "#6b7280" }}>Configure destinations in the Config tab</div>
          </div>
        )}
      </div>
    </div>
  );
}
