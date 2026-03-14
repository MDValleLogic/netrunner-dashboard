"use client";
import { useEffect, useState } from "react";
import { useDevice } from "@/lib/deviceContext";
import { Route } from "lucide-react";

const TARGET_LABELS: Record<string, string> = {
  "8.8.8.8":  "Google DNS (8.8.8.8)",
  "1.1.1.1":  "Cloudflare DNS (1.1.1.1)",
  "8.8.4.4":  "Google DNS (8.8.4.4)",
  "1.0.0.1":  "Cloudflare DNS (1.0.0.1)",
};
function targetLabel(t: string) { return TARGET_LABELS[t] || t; }

type Hop = { hop_num: number; ip: string|null; hostname: string|null; rtt_ms: number|null; timeout: boolean; org: string; isp: string; asn: string; country: string; city: string; };
type Trace = { id: number; ts_utc: string; target: string; dest_ip: string; hop_count: number; total_hops: number; };

function classifyDestination(org: string, hostname: string) {
  const o = (org + " " + hostname).toLowerCase();
  if (/amazon|aws|ec2/.test(o))         return { label: "AWS",           color: "#FF9900" };
  if (/google|gcp|googlecloud/.test(o)) return { label: "Google Cloud",  color: "#4285F4" };
  if (/microsoft|azure|msft/.test(o))   return { label: "Azure",         color: "#0078D4" };
  if (/cloudflare/.test(o))             return { label: "Cloudflare",    color: "#F38020" };
  if (/akamai/.test(o))                 return { label: "Akamai",        color: "#009BDE" };
  if (/fastly/.test(o))                 return { label: "Fastly",        color: "#FF282D" };
  if (/netflix/.test(o))                return { label: "Netflix CDN",   color: "#E50914" };
  if (/level.?3|lumen/.test(o))         return { label: "Lumen/Level3",  color: "#FBBF24" };
  if (/cogent/.test(o))                 return { label: "Cogent",        color: "#38BDF8" };
  return { label: org || "Unknown", color: "#64748B" };
}
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
function rttColor(ms: number) { return ms < 20 ? "#22c55e" : ms < 80 ? "#3b82f6" : ms < 150 ? "#f59e0b" : "#ef4444"; }

export default function RouteRunnerOverview() {
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
      const latest = j.traces?.[0] || null; setTrace(latest);
      setHops(latest?.hops || []);
      const allTargets = [...new Set(j.traces.map((t: any) => t.target))] as string[];
      if (allTargets.length) { setTargets(allTargets); if (!target && !t) setTarget(j.targets?.[0] || allTargets[0]); }
    } finally { setLoading(false); }
  }

  useEffect(() => {
    fetchData();
    const poll = setInterval(() => fetchData(), 60_000);
    const cd   = setInterval(() => setTick(t => t+1), 1000);
    return () => { clearInterval(poll); clearInterval(cd); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { if (target) fetchData(target); }, [target]); // eslint-disable-line
  useEffect(() => { fetchData(); }, [selectedDeviceId]); // eslint-disable-line

  const respondingHops = hops.filter(h => !h.timeout && h.ip);
  const lastHop = respondingHops[respondingHops.length - 1];
  const dest = lastHop ? classifyDestination(lastHop.org, lastHop.hostname || "") : null;

  const orgGroups: { org: string; hops: Hop[]; color: string }[] = [];
  for (const hop of respondingHops) {
    const last = orgGroups[orgGroups.length - 1];
    if (last && last.org === (hop.org || "Unknown")) { last.hops.push(hop); }
    else { orgGroups.push({ org: hop.org || "Unknown", hops: [hop], color: ispColor(hop.org) }); }
  }

  const nextRefresh = Math.max(0, 60 - (tick % 60));

  const statCards = trace ? [
    { label: "Total Hops",     value: trace.total_hops,  color: "#60a5fa" },
    { label: "Responding",     value: trace.hop_count,   color: "#22c55e" },
    { label: "ISPs Traversed", value: orgGroups.length,  color: "#f59e0b" },
    { label: "Final RTT",      value: lastHop?.rtt_ms != null ? `${lastHop.rtt_ms.toFixed(1)}ms` : "—", color: "#e5e7eb" },
  ] : [];

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">

      {/* Header */}
      <div className="flex items-center justify-between mb-6 max-w-6xl">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <Route size={20} className="text-blue-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-100 leading-tight">RouteRunner Overview</h1>
            <p className="text-xs text-gray-500 font-mono">Every hop · every carrier · every destination</p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ fontSize: 11, color: "#6b7280", fontFamily: "monospace" }}>refresh in {nextRefresh}s</span>
          <select value={selectedDeviceId || ""} onChange={e => setSelectedDeviceId(e.target.value)} style={{ background: "#111827", border: "1px solid #374151", borderRadius: 6, color: "#e5e7eb", padding: "6px 10px", fontSize: 12, fontFamily: "monospace" }}>
            {devices.map(d => <option key={d.device_id} value={d.device_id}>{d.nickname ? `${d.nickname} (${d.nr_serial})` : d.nr_serial}</option>)}
          </select>
          {targets.length > 0 && (
            <select value={target} onChange={e => setTarget(e.target.value)} style={{ background: "#111827", border: "1px solid #374151", borderRadius: 6, color: "#e5e7eb", padding: "6px 10px", fontSize: 12, fontFamily: "monospace" }}>
              {targets.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          )}
        </div>
      </div>

      <div className="max-w-6xl space-y-4">

        {/* Stat cards */}
        {statCards.length > 0 && (
          <div className="grid grid-cols-4 gap-3">
            {statCards.map(s => (
              <div key={s.label} className="rounded-lg border border-gray-700/60 bg-gray-900/60 px-4 py-4">
                <div className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-2">{s.label}</div>
                <div style={{ fontSize: 26, fontWeight: 700, fontFamily: "monospace", color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Path overview */}
        <div className="rounded-lg border border-gray-700/60 bg-gray-900/60 p-4">
          <div className="flex items-center justify-between mb-4">
            <span style={{ fontSize: 13, fontWeight: 600, color: "#e5e7eb" }}>Path Overview</span>
            {trace && <span style={{ fontSize: 11, color: "#6b7280", fontFamily: "monospace" }}>{fmtTime(trace.ts_utc)}</span>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 0, overflowX: "auto", padding: "8px 0" }}>

            {/* Source node */}
            <div style={{ flexShrink: 0, background: "#111827", border: "1px solid #374151", borderRadius: 10, padding: "14px 18px", minWidth: 150 }}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#6b7280", marginBottom: 8 }}>Source</div>
              <div style={{ fontFamily: "monospace", fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>
                {respondingHops[0]?.ip || "—"} <span style={{ fontSize: 10, color: "#6b7280" }}>private</span>
              </div>
              <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 6px #22c55e" }} />
                <span style={{ fontSize: 10, color: "#22c55e", fontWeight: 600 }}>NetRunner Pi</span>
              </div>
            </div>

            {/* ISP groups */}
            {orgGroups.map((group, gi) => (
              <div key={gi} style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
                <div style={{ display: "flex", alignItems: "center", padding: "0 4px" }}>
                  <div style={{ width: 28, height: 2, background: group.color, opacity: 0.5 }} />
                  <div style={{ width: 0, height: 0, borderTop: "5px solid transparent", borderBottom: "5px solid transparent", borderLeft: `7px solid ${group.color}`, opacity: 0.5 }} />
                </div>
                <div style={{ background: `${group.color}12`, border: `1px solid ${group.color}40`, borderRadius: 10, padding: "10px 14px", minWidth: 110 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: group.color, marginBottom: 6 }}>
                    {group.org.replace(/^AS\d+\s+/, "").substring(0, 22)}
                  </div>
                  {group.hops.map((h, hi) => (
                    <div key={hi} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 3 }}>
                      <span style={{ fontFamily: "monospace", fontSize: 10, color: "#6b7280" }}>hop {h.hop_num}</span>
                      <span style={{ fontFamily: "monospace", fontSize: 10, color: group.color }}>
                        {h.rtt_ms != null ? `${h.rtt_ms.toFixed(1)}ms` : "?"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Destination */}
            {lastHop && dest && (
              <div style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
                <div style={{ display: "flex", alignItems: "center", padding: "0 4px" }}>
                  <div style={{ width: 28, height: 2, background: dest.color, opacity: 0.6 }} />
                  <div style={{ width: 0, height: 0, borderTop: "5px solid transparent", borderBottom: "5px solid transparent", borderLeft: `7px solid ${dest.color}`, opacity: 0.6 }} />
                </div>
                <div style={{ background: `${dest.color}18`, border: `1px solid ${dest.color}50`, borderRadius: 10, padding: "14px 18px", minWidth: 150 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: dest.color, marginBottom: 8 }}>{dest.label}</div>
                  <div style={{ fontFamily: "monospace", fontSize: 12, color: "#e5e7eb", fontWeight: 700, marginBottom: 4 }}>{targetLabel(trace?.target || "")}</div>
                  <div style={{ fontFamily: "monospace", fontSize: 10, color: "#6b7280", marginBottom: 4 }}>{trace?.dest_ip}</div>
                  <div style={{ fontSize: 10, color: "#9ca3af" }}>{[lastHop.city, lastHop.country].filter(Boolean).join(", ")}</div>
                  <div style={{ marginTop: 6, fontSize: 10, color: dest.color }}>{lastHop.asn?.split(" ")[0]}</div>
                </div>
              </div>
            )}

            {respondingHops.length === 0 && !loading && (
              <div style={{ flex: 1, textAlign: "center", padding: "32px 0", color: "#6b7280", fontSize: 13 }}>
                No trace data yet — configure targets in Config tab
              </div>
            )}
          </div>
        </div>

        {/* Hop detail table */}
        {hops.length > 0 && (
          <div className="rounded-lg border border-gray-700/60 bg-gray-900/60">
            <div className="flex items-center justify-between p-4 border-b border-gray-700/60">
              <span style={{ fontSize: 13, fontWeight: 600, color: "#e5e7eb" }}>Hop Detail</span>
              <span style={{ fontSize: 11, color: "#6b7280", fontFamily: "monospace" }}>{hops.length} hops to {targetLabel(trace?.target || "")}</span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #1f2937" }}>
                    {["#", "IP", "Hostname", "RTT", "Organization", "ASN", "Location"].map(h => (
                      <th key={h} style={{ padding: "8px 16px", textAlign: "left", fontSize: 10, fontFamily: "monospace", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {hops.map((hop, i) => {
                    const color = ispColor(hop.org);
                    const isFirst = i === 0; const isLast = i === hops.length - 1;
                    return (
                      <tr key={i} style={{ opacity: hop.timeout ? 0.35 : 1, borderBottom: "1px solid #111827" }}>
                        <td style={{ padding: "10px 16px", fontFamily: "monospace", fontWeight: 700, color: "#60a5fa", fontSize: 12 }}>{hop.hop_num}</td>
                        <td style={{ padding: "10px 16px", fontFamily: "monospace", fontSize: 12, color: "#d1d5db" }}>
                          {hop.ip ? (
                            <span>
                              {hop.ip}
                              {isFirst && <span style={{ marginLeft: 6, fontSize: 9, color: "#22c55e", fontWeight: 700 }}>SRC</span>}
                              {isLast  && <span style={{ marginLeft: 6, fontSize: 9, color: "#f59e0b", fontWeight: 700 }}>DEST</span>}
                            </span>
                          ) : <span style={{ color: "#6b7280" }}>*</span>}
                        </td>
                        <td style={{ padding: "10px 16px", fontFamily: "monospace", fontSize: 11, color: "#6b7280", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {hop.hostname && hop.hostname !== hop.ip ? hop.hostname : "—"}
                        </td>
                        <td style={{ padding: "10px 16px" }}>
                          {hop.rtt_ms != null
                            ? <span style={{ fontFamily: "monospace", fontSize: 12, color: rttColor(hop.rtt_ms) }}>{hop.rtt_ms.toFixed(1)}ms</span>
                            : <span style={{ color: "#6b7280", fontSize: 11 }}>timeout</span>}
                        </td>
                        <td style={{ padding: "10px 16px" }}>
                          {hop.org
                            ? <span style={{ fontSize: 11, fontWeight: 600, color, background: `${color}18`, padding: "2px 8px", borderRadius: 4 }}>
                                {hop.org.replace(/^AS\d+\s+/, "").substring(0, 32)}
                              </span>
                            : <span style={{ color: "#6b7280" }}>—</span>}
                        </td>
                        <td style={{ padding: "10px 16px", fontFamily: "monospace", fontSize: 10, color: "#6b7280" }}>{hop.asn?.split(" ")[0] || "—"}</td>
                        <td style={{ padding: "10px 16px", fontSize: 11, color: "#9ca3af" }}>{[hop.city, hop.country].filter(Boolean).join(", ") || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
