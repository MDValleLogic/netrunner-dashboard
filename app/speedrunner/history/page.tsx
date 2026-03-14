"use client";
import { useDevice } from "@/lib/deviceContext";
import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

type Result = { id: number; ts_utc: string; region: string; region_city: string; download_mbps: number|null; upload_mbps: number|null; ping_ms: number|null; jitter_ms: number|null; isp: string|null; };
type RegionOption = { region: string; city: string };
const REGION_META: Record<string, string> = { "Northeast US": "🗽", "Southeast US": "🌴", "Midwest US": "🌽", "West Coast US": "🌉", "Europe": "🏰", "Asia Pacific": "🗼" };
const REGION_COLORS: Record<string, string> = { "Northeast US": "#4ade80", "Southeast US": "#f97316", "Midwest US": "#60a5fa", "West Coast US": "#a78bfa", "Europe": "#fbbf24", "Asia Pacific": "#f472b6" };

function speedColor(mbps: number|null, type: "down"|"up") {
  if (!mbps) return "#6b7280";
  const t = type === "down" ? { g: 400, ok: 100, w: 25 } : { g: 100, ok: 20, w: 5 };
  return mbps >= t.g ? "#22c55e" : mbps >= t.ok ? "#60a5fa" : mbps >= t.w ? "#f59e0b" : "#ef4444";
}
function pingColor(ms: number|null) {
  if (!ms) return "#6b7280";
  return ms < 20 ? "#22c55e" : ms < 60 ? "#60a5fa" : ms < 120 ? "#f59e0b" : "#ef4444";
}
function fmtTime(iso: string) { try { return new Date(iso).toLocaleString(); } catch { return iso; } }
function fmtShort(iso: string) { try { const d = new Date(iso); return `${d.getMonth()+1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2,"0")}`; } catch { return iso; } }

type ChartProps = { data: Result[]; metric: keyof Result; label: string; unit: string; height?: number };
function LineChart({ data, metric, label, unit, height = 160 }: ChartProps) {
  if (!data.length) return null;
  const W = 900, H = height, PAD = { top: 10, right: 20, bottom: 30, left: 48 };
  const chartW = W - PAD.left - PAD.right, chartH = H - PAD.top - PAD.bottom;
  const regions = Array.from(new Set(data.map(d => d.region))).filter(r => REGION_META[r]);
  const byRegion: Record<string, Result[]> = {};
  for (const r of regions) byRegion[r] = data.filter(d => d.region === r).sort((a, b) => new Date(a.ts_utc).getTime() - new Date(b.ts_utc).getTime());
  const allVals = data.map(d => d[metric] as number).filter(v => v != null && v > 0);
  if (!allVals.length) return null;
  const maxV = Math.max(...allVals) * 1.1;
  const allTimes = data.map(d => new Date(d.ts_utc).getTime());
  const minT = Math.min(...allTimes), maxT = Math.max(...allTimes), rangeT = maxT - minT || 1;
  const xPos = (t: string) => PAD.left + ((new Date(t).getTime() - minT) / rangeT) * chartW;
  const yPos = (v: number) => PAD.top + chartH - (v / (maxV || 1)) * chartH;
  const sorted = [...data].sort((a, b) => new Date(a.ts_utc).getTime() - new Date(b.ts_utc).getTime());
  const step = Math.max(1, Math.floor(sorted.length / 6));
  const timeLabels = sorted.filter((_, i) => i % step === 0).map(d => d.ts_utc);
  const yTicks = 4;
  const yLabels = Array.from({ length: yTicks + 1 }, (_, i) => (maxV * i) / yTicks);
  return (
    <div style={{ width: "100%", overflowX: "auto" }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", marginBottom: 6, paddingLeft: PAD.left }}>{label} ({unit})</div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: H, display: "block" }}>
        {yLabels.map((v, i) => (
          <g key={i}>
            <line x1={PAD.left} y1={yPos(v)} x2={W - PAD.right} y2={yPos(v)} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
            <text x={PAD.left - 6} y={yPos(v) + 4} textAnchor="end" fontSize="10" fill="rgba(255,255,255,0.5)" fontWeight="600">{v >= 1000 ? `${(v/1000).toFixed(1)}k` : v.toFixed(0)}</text>
          </g>
        ))}
        {timeLabels.map((t, i) => (
          <text key={i} x={xPos(t)} y={H - 4} textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.4)">{fmtShort(t)}</text>
        ))}
        {regions.map(region => {
          const pts = byRegion[region].filter(d => d[metric] != null);
          if (pts.length < 2) return null;
          const color = REGION_COLORS[region] || "#94a3b8";
          const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${xPos(p.ts_utc).toFixed(1)},${yPos(p[metric] as number).toFixed(1)}`).join(" ");
          return (
            <g key={region}>
              <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" opacity="0.85" />
              {pts.map((p, i) => (
                <circle key={i} cx={xPos(p.ts_utc)} cy={yPos(p[metric] as number)} r="3" fill={color} opacity="0.9">
                  <title>{region}: {(p[metric] as number).toFixed(1)}{unit}</title>
                </circle>
              ))}
            </g>
          );
        })}
        <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + chartH} stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
      </svg>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, paddingLeft: PAD.left, marginTop: 4 }}>
        {regions.map(r => (
          <div key={r} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 24, height: 2, background: REGION_COLORS[r] || "#94a3b8", borderRadius: 1 }} />
            <span style={{ fontSize: 10, color: "#6b7280" }}>{REGION_META[r] || "🌐"} {r}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const sel = { background: "#111827", border: "1px solid #374151", borderRadius: 6, color: "#e5e7eb", padding: "6px 10px", fontSize: 12, fontFamily: "monospace" };

export default function SpeedRunnerHistory() {
  const { selectedDeviceId, devices, setSelectedDeviceId } = useDevice();
  const [results, setResults] = useState<Result[]>([]);
  const [regions, setRegions] = useState<RegionOption[]>([]);
  const [region, setRegion]   = useState("");
  const [loading, setLoading] = useState(true);
  const [view, setView]       = useState<"chart"|"table">("chart");

  async function fetchData(r?: string) {
    setLoading(true);
    try {
      const rParam = r !== undefined ? r : region;
      const url = `/api/speedrunner/results?device_id=${selectedDeviceId || ""}&limit=100${rParam ? `&region=${encodeURIComponent(rParam)}` : ""}`;
      const j = await fetch(url).then(r => r.json());
      if (j.ok) { setResults(j.history || []); setRegions(j.regions || []); }
    } finally { setLoading(false); }
  }

  useEffect(() => { fetchData(); }, []); // eslint-disable-line
  useEffect(() => { fetchData(region); }, [region]); // eslint-disable-line
  useEffect(() => { fetchData(); }, [selectedDeviceId]); // eslint-disable-line

  const chartData = results.filter(r => REGION_META[r.region]);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 max-w-5xl">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <Clock size={20} className="text-blue-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-100 leading-tight">SpeedRunner · History</h1>
            <p className="text-xs text-gray-500 font-mono">Speed test history by region</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ display: "flex", gap: 4 }}>
            {(["chart", "table"] as const).map(v => (
              <button key={v} onClick={() => setView(v)} style={{
                padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer",
                border: view === v ? "2px solid #3b82f6" : "1px solid #374151",
                background: view === v ? "rgba(59,130,246,0.1)" : "#111827",
                color: view === v ? "#60a5fa" : "#9ca3af",
              }}>{v === "chart" ? "📈 Chart" : "📋 Table"}</button>
            ))}
          </div>
          <select value={region} onChange={e => setRegion(e.target.value)} style={{ ...sel, maxWidth: 220 }}>
            <option value="">All regions</option>
            {regions.map(r => <option key={r.region} value={r.region}>{REGION_META[r.region] || "🌐"} {r.region}</option>)}
          </select>
          <select value={selectedDeviceId || ""} onChange={e => setSelectedDeviceId(e.target.value)} style={{ background: "#111827", border: "1px solid #374151", borderRadius: 6, color: "#e5e7eb", padding: "6px 10px", fontSize: 12, fontFamily: "monospace" }}>
            {devices.map(d => <option key={d.device_id} value={d.device_id}>{d.nickname ? `${d.nickname} (${d.nr_serial})` : d.nr_serial}</option>)}
          </select>
          <button onClick={() => fetchData(region)} style={{ background: "transparent", border: "1px solid #374151", borderRadius: 6, color: "#9ca3af", padding: "6px 12px", fontSize: 13, cursor: "pointer" }}>↻</button>
        </div>
      </div>

      <div className="max-w-5xl space-y-4">
        {loading ? (
          <div className="rounded-lg border border-gray-700/60 bg-gray-900/60 p-8 text-center" style={{ color: "#6b7280" }}>Loading…</div>
        ) : results.length === 0 ? (
          <div className="rounded-lg border border-gray-700/60 bg-gray-900/60 p-12 text-center">
            <div style={{ fontSize: 32, marginBottom: 12 }}>⚡</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#e5e7eb" }}>No history yet</div>
          </div>
        ) : view === "chart" ? (
          <>
            {[
              { metric: "download_mbps" as keyof Result, label: "Download Speed", unit: "Mbps" },
              { metric: "upload_mbps"   as keyof Result, label: "Upload Speed",   unit: "Mbps" },
              { metric: "ping_ms"       as keyof Result, label: "Ping Latency",   unit: "ms"   },
              { metric: "jitter_ms"     as keyof Result, label: "Jitter",         unit: "ms"   },
            ].map(cfg => (
              <div key={cfg.metric} className="rounded-lg border border-gray-700/60 bg-gray-900/60 p-4">
                <LineChart data={chartData} metric={cfg.metric} label={cfg.label} unit={cfg.unit} />
              </div>
            ))}
          </>
        ) : (
          <div className="rounded-lg border border-gray-700/60 bg-gray-900/60">
            <div className="flex items-center justify-between p-4 border-b border-gray-700/60">
              <span style={{ fontSize: 13, fontWeight: 600, color: "#e5e7eb" }}>Test History</span>
              <span style={{ fontSize: 11, color: "#6b7280", fontFamily: "monospace" }}>{results.length} results</span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #1f2937" }}>
                    {["Time", "Region", "↓ Download", "↑ Upload", "Ping", "Jitter", "ISP"].map((h, i) => (
                      <th key={h} style={{ padding: "8px 16px", textAlign: i >= 2 && i <= 5 ? "right" : "left", fontSize: 10, fontFamily: "monospace", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results.map(r => (
                    <tr key={r.id} style={{ borderBottom: "1px solid #111827" }}>
                      <td style={{ padding: "8px 16px", fontFamily: "monospace", fontSize: 11, color: "#9ca3af" }}>{fmtTime(r.ts_utc)}</td>
                      <td style={{ padding: "8px 16px", fontSize: 12, color: "#e5e7eb" }}>{REGION_META[r.region] || "🌐"} {r.region}</td>
                      <td style={{ padding: "8px 16px", fontFamily: "monospace", fontSize: 12, color: speedColor(r.download_mbps, "down"), fontWeight: 600, textAlign: "right" }}>{r.download_mbps != null ? `${r.download_mbps.toFixed(0)} Mbps` : "—"}</td>
                      <td style={{ padding: "8px 16px", fontFamily: "monospace", fontSize: 12, color: speedColor(r.upload_mbps, "up"), fontWeight: 600, textAlign: "right" }}>{r.upload_mbps != null ? `${r.upload_mbps.toFixed(0)} Mbps` : "—"}</td>
                      <td style={{ padding: "8px 16px", fontFamily: "monospace", fontSize: 12, color: pingColor(r.ping_ms), textAlign: "right" }}>{r.ping_ms != null ? `${r.ping_ms.toFixed(1)}ms` : "—"}</td>
                      <td style={{ padding: "8px 16px", fontFamily: "monospace", fontSize: 12, color: "#9ca3af", textAlign: "right" }}>{r.jitter_ms != null ? `±${r.jitter_ms.toFixed(1)}ms` : "—"}</td>
                      <td style={{ padding: "8px 16px", fontSize: 11, color: "#6b7280" }}>{r.isp || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
