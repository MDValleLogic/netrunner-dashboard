"use client";
import { useEffect, useState } from "react";
const DEVICE_ID = "pi-403c60f1-2557-408f-a3c8-ca7acaf034f5";
type Result = { id: number; ts_utc: string; region: string; region_city: string; download_mbps: number|null; upload_mbps: number|null; ping_ms: number|null; jitter_ms: number|null; isp: string|null; };
type RegionOption = { region: string; city: string };
const REGION_META: Record<string,string> = { "Northeast US":"🗽","Southeast US":"🌴","Midwest US":"🌽","West Coast US":"🌉","Europe":"🏰","Asia Pacific":"🗼" };
const REGION_COLORS: Record<string,string> = { "Northeast US":"#4ade80","Southeast US":"#f97316","Midwest US":"#60a5fa","West Coast US":"#a78bfa","Europe":"#fbbf24","Asia Pacific":"#f472b6" };
function speedColor(mbps: number|null, type: "down"|"up") { if(!mbps) return "var(--text-dim)"; const t=type==="down"?{g:400,ok:100,w:25}:{g:100,ok:20,w:5}; return mbps>=t.g?"var(--green)":mbps>=t.ok?"var(--accent)":mbps>=t.w?"var(--amber)":"#ef4444"; }
function pingColor(ms: number|null) { if(!ms) return "var(--text-dim)"; return ms<20?"var(--green)":ms<60?"var(--accent)":ms<120?"var(--amber)":"#ef4444"; }
function fmtTime(iso: string) { try { return new Date(iso).toLocaleString(); } catch { return iso; } }
function fmtShort(iso: string) { try { const d=new Date(iso); return `${d.getMonth()+1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')}`; } catch { return iso; } }

type ChartProps = { data: Result[]; metric: keyof Result; label: string; unit: string; height?: number; };
function LineChart({ data, metric, label, unit, height=160 }: ChartProps) {
  if (!data.length) return null;
  const W = 900, H = height, PAD = { top: 10, right: 20, bottom: 30, left: 48 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  // Group by region
  const regions = Array.from(new Set(data.map(d => d.region))).filter(r => Object.keys(REGION_META).includes(r));
  const byRegion: Record<string, Result[]> = {};
  for (const r of regions) byRegion[r] = data.filter(d => d.region === r).sort((a,b) => new Date(a.ts_utc).getTime() - new Date(b.ts_utc).getTime());

  const allVals = data.map(d => d[metric] as number).filter(v => v != null && v > 0);
  if (!allVals.length) return null;
  const minV = 0;
  const maxV = Math.max(...allVals) * 1.1;
  const allTimes = data.map(d => new Date(d.ts_utc).getTime());
  const minT = Math.min(...allTimes);
  const maxT = Math.max(...allTimes);
  const rangeT = maxT - minT || 1;

  const xPos = (t: string) => PAD.left + ((new Date(t).getTime() - minT) / rangeT) * chartW;
  const yPos = (v: number) => PAD.top + chartH - ((v - minV) / (maxV - minV || 1)) * chartH;

  // Time axis labels
  const timeLabels: string[] = [];
  const step = Math.max(1, Math.floor(data.length / 6));
  const sorted = [...data].sort((a,b) => new Date(a.ts_utc).getTime() - new Date(b.ts_utc).getTime());
  for (let i=0; i<sorted.length; i+=step) timeLabels.push(sorted[i].ts_utc);

  // Y axis labels
  const yTicks = 4;
  const yLabels = Array.from({length: yTicks+1}, (_,i) => minV + (maxV-minV) * i / yTicks);

  return (
    <div style={{width:"100%",overflowX:"auto"}}>
      <div style={{fontSize:11,fontWeight:600,color:"var(--text-secondary)",marginBottom:6,paddingLeft:PAD.left}}>{label} ({unit})</div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height:H,display:"block"}}>
        {/* Grid lines */}
        {yLabels.map((v,i) => (
          <g key={i}>
            <line x1={PAD.left} y1={yPos(v)} x2={W-PAD.right} y2={yPos(v)} stroke="rgba(255,255,255,0.06)" strokeWidth="1"/>
            <text x={PAD.left-6} y={yPos(v)+4} textAnchor="end" fontSize="9" fill="rgba(255,255,255,0.3)">
              {v >= 1000 ? `${(v/1000).toFixed(1)}k` : v.toFixed(0)}
            </text>
          </g>
        ))}
        {/* Time labels */}
        {timeLabels.map((t,i) => (
          <text key={i} x={xPos(t)} y={H-4} textAnchor="middle" fontSize="8" fill="rgba(255,255,255,0.3)">{fmtShort(t)}</text>
        ))}
        {/* Lines per region */}
        {regions.map(region => {
          const pts = byRegion[region].filter(d => d[metric] != null);
          if (pts.length < 2) return null;
          const color = REGION_COLORS[region] || "#94a3b8";
          const d = pts.map((p,i) => `${i===0?"M":"L"}${xPos(p.ts_utc).toFixed(1)},${yPos(p[metric] as number).toFixed(1)}`).join(" ");
          return (
            <g key={region}>
              <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" opacity="0.85"/>
              {pts.map((p,i) => (
                <circle key={i} cx={xPos(p.ts_utc)} cy={yPos(p[metric] as number)} r="2.5" fill={color} opacity="0.9">
                  <title>{region}: {(p[metric] as number).toFixed(1)}{unit} @ {fmtTime(p.ts_utc)}</title>
                </circle>
              ))}
            </g>
          );
        })}
        {/* Y axis line */}
        <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top+chartH} stroke="rgba(255,255,255,0.15)" strokeWidth="1"/>
      </svg>
      {/* Legend */}
      <div style={{display:"flex",flexWrap:"wrap",gap:12,paddingLeft:PAD.left,marginTop:4}}>
        {regions.map(r => (
          <div key={r} style={{display:"flex",alignItems:"center",gap:5}}>
            <div style={{width:24,height:2,background:REGION_COLORS[r]||"#94a3b8",borderRadius:1}}/>
            <span style={{fontSize:10,color:"var(--text-dim)"}}>{REGION_META[r]||"🌐"} {r}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SpeedRunnerHistory() {
  const [results, setResults]   = useState<Result[]>([]);
  const [regions, setRegions]   = useState<RegionOption[]>([]);
  const [region, setRegion]     = useState("");
  const [loading, setLoading]   = useState(true);
  const [view, setView]         = useState<"chart"|"table">("chart");

  async function fetchData(r?: string) {
    setLoading(true);
    try {
      const rParam = r!==undefined?r:region;
      const url = `/api/speedrunner/results?device_id=${DEVICE_ID}&limit=100${rParam?`&region=${encodeURIComponent(rParam)}`:""}`;
      const j = await fetch(url).then(r=>r.json());
      if(j.ok){ setResults(j.history||[]); setRegions(j.regions||[]); }
    } finally { setLoading(false); }
  }
  useEffect(()=>{fetchData();},[]);
  useEffect(()=>{fetchData(region);},[region]);

  // Filter to known geo regions only for charts
  const chartData = results.filter(r => Object.keys(REGION_META).includes(r.region));

  return (
    <>
      <div className="vl-topbar">
        <div><div className="vl-topbar-title">SpeedRunner · History</div><div className="vl-topbar-sub">Speed test history by region</div></div>
        <div className="vl-topbar-spacer"/>
        <div style={{display:"flex",gap:4}}>
          {(["chart","table"] as const).map(v=>(
            <button key={v} onClick={()=>setView(v)} style={{padding:"6px 14px",borderRadius:6,fontSize:12,fontWeight:600,cursor:"pointer",border:view===v?"2px solid var(--accent)":"1px solid var(--border-mid)",background:view===v?"var(--accent-dim)":"var(--bg-card)",color:view===v?"var(--accent)":"var(--text-secondary)"}}>
              {v==="chart"?"📈 Chart":"📋 Table"}
            </button>
          ))}
        </div>
        <select className="vl-select" value={region} onChange={e=>setRegion(e.target.value)} style={{width:"auto",maxWidth:220}}>
          <option value="">All regions</option>
          {regions.map(r=><option key={r.region} value={r.region}>{REGION_META[r.region]||"🌐"} {r.region}</option>)}
        </select>
        <button className="vl-btn vl-btn-secondary" onClick={()=>fetchData(region)}>↻</button>
      </div>

      <div className="vl-main" style={{display:"flex",flexDirection:"column",gap:16}}>
        {loading ? (
          <div className="vl-card"><div className="vl-card-body" style={{color:"var(--text-dim)"}}>Loading…</div></div>
        ) : results.length===0 ? (
          <div className="vl-card"><div className="vl-card-body" style={{textAlign:"center",padding:"48px 0",color:"var(--text-dim)"}}>
            <div style={{fontSize:32,marginBottom:12}}>⚡</div><div style={{fontSize:14,fontWeight:600}}>No history yet</div>
          </div></div>
        ) : view==="chart" ? (
          <>
            {[
              { metric: "download_mbps" as keyof Result, label: "Download Speed", unit: "Mbps" },
              { metric: "upload_mbps"   as keyof Result, label: "Upload Speed",   unit: "Mbps" },
              { metric: "ping_ms"       as keyof Result, label: "Ping Latency",   unit: "ms"   },
              { metric: "jitter_ms"     as keyof Result, label: "Jitter",         unit: "ms"   },
            ].map(cfg => (
              <div key={cfg.metric} className="vl-card">
                <div className="vl-card-body" style={{padding:"16px 20px"}}>
                  <LineChart data={chartData} metric={cfg.metric} label={cfg.label} unit={cfg.unit}/>
                </div>
              </div>
            ))}
          </>
        ) : (
          <div className="vl-card">
            <div className="vl-card-header"><span style={{fontSize:13,fontWeight:600}}>Test History</span><span style={{fontSize:11,color:"var(--text-dim)"}}>{results.length} results</span></div>
            <div style={{overflowX:"auto"}}>
              <table className="vl-table">
                <thead><tr><th>Time</th><th>Region</th><th style={{textAlign:"right"}}>↓ Download</th><th style={{textAlign:"right"}}>↑ Upload</th><th style={{textAlign:"right"}}>Ping</th><th style={{textAlign:"right"}}>Jitter</th><th>ISP</th></tr></thead>
                <tbody>
                  {results.map(r=>(
                    <tr key={r.id}>
                      <td className="mono" style={{fontSize:11}}>{fmtTime(r.ts_utc)}</td>
                      <td><span style={{fontSize:12}}>{REGION_META[r.region]||"🌐"} {r.region}</span></td>
                      <td className="mono" style={{textAlign:"right",color:speedColor(r.download_mbps,"down"),fontWeight:600}}>{r.download_mbps!=null?`${r.download_mbps.toFixed(0)} Mbps`:"—"}</td>
                      <td className="mono" style={{textAlign:"right",color:speedColor(r.upload_mbps,"up"),fontWeight:600}}>{r.upload_mbps!=null?`${r.upload_mbps.toFixed(0)} Mbps`:"—"}</td>
                      <td className="mono" style={{textAlign:"right",color:pingColor(r.ping_ms)}}>{r.ping_ms!=null?`${r.ping_ms.toFixed(1)}ms`:"—"}</td>
                      <td className="mono" style={{textAlign:"right",color:"var(--text-secondary)"}}>{r.jitter_ms!=null?`±${r.jitter_ms.toFixed(1)}ms`:"—"}</td>
                      <td style={{fontSize:11,color:"var(--text-dim)"}}>{r.isp||"—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
