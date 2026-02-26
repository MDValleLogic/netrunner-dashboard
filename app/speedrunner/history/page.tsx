"use client";
import { useEffect, useState } from "react";
const DEVICE_ID = "pi-403c60f1-2557-408f-a3c8-ca7acaf034f5";
type Result = { id: number; ts_utc: string; region: string; region_city: string; download_mbps: number|null; upload_mbps: number|null; ping_ms: number|null; jitter_ms: number|null; isp: string|null; };
type RegionOption = { region: string; city: string };
const REGION_META: Record<string,string> = { "Northeast US":"🗽","Southeast US":"🌴","Midwest US":"🌽","West Coast US":"🌉","Europe":"🏰","Asia Pacific":"🗼" };
function speedColor(mbps: number|null, type: "down"|"up") { if(!mbps) return "var(--text-dim)"; const t=type==="down"?{g:400,ok:100,w:25}:{g:100,ok:20,w:5}; return mbps>=t.g?"var(--green)":mbps>=t.ok?"var(--accent)":mbps>=t.w?"var(--amber)":"#ef4444"; }
function pingColor(ms: number|null) { if(!ms) return "var(--text-dim)"; return ms<20?"var(--green)":ms<60?"var(--accent)":ms<120?"var(--amber)":"#ef4444"; }
function fmtTime(iso: string) { try { return new Date(iso).toLocaleString(); } catch { return iso; } }
export default function SpeedRunnerHistory() {
  const [results, setResults] = useState<Result[]>([]);
  const [regions, setRegions] = useState<RegionOption[]>([]);
  const [region, setRegion]   = useState("");
  const [loading, setLoading] = useState(true);
  async function fetchData(r?: string) {
    setLoading(true);
    try {
      const rParam=r!==undefined?r:region;
      const url=`/api/speedrunner/results?device_id=${DEVICE_ID}&limit=100${rParam?`&region=${encodeURIComponent(rParam)}`:""}`;
      const j=await fetch(url).then(r=>r.json());
      if(j.ok){setResults(j.history||[]);setRegions(j.regions||[]);}
    } finally{setLoading(false);}
  }
  useEffect(()=>{fetchData();},[]);
  useEffect(()=>{fetchData(region);},[region]);
  return (
    <>
      <div className="vl-topbar">
        <div><div className="vl-topbar-title">SpeedRunner · History</div><div className="vl-topbar-sub">Speed test history by region</div></div>
        <div className="vl-topbar-spacer"/>
        <select className="vl-select" value={region} onChange={e=>setRegion(e.target.value)} style={{width:"auto",maxWidth:220}}>
          <option value="">All regions</option>
          {regions.map(r=><option key={r.region} value={r.region}>{REGION_META[r.region]||"🌐"} {r.region}</option>)}
        </select>
        <button className="vl-btn vl-btn-secondary" onClick={()=>fetchData(region)}>↻ Refresh</button>
      </div>
      <div className="vl-main">
        <div className="vl-card">
          <div className="vl-card-header"><span style={{fontSize:13,fontWeight:600}}>Test History</span><span style={{fontSize:11,color:"var(--text-dim)"}}>{results.length} results</span></div>
          {loading?<div className="vl-card-body" style={{color:"var(--text-dim)"}}>Loading…</div>
          :results.length===0?(
            <div className="vl-card-body" style={{textAlign:"center",padding:"48px 0",color:"var(--text-dim)"}}>
              <div style={{fontSize:32,marginBottom:12}}>⚡</div><div style={{fontSize:14,fontWeight:600}}>No history yet</div>
            </div>
          ):(
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
          )}
        </div>
      </div>
    </>
  );
}
