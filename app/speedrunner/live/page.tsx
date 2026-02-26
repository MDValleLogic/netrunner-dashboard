"use client";
import { useEffect, useState } from "react";
const DEVICE_ID = "pi-403c60f1-2557-408f-a3c8-ca7acaf034f5";
type Result = { id: number; ts_utc: string; region: string; region_city: string; download_mbps: number|null; upload_mbps: number|null; ping_ms: number|null; jitter_ms: number|null; isp: string|null; server_name: string|null; server_city: string|null; result_url: string|null; };
const REGION_META: Record<string,string> = { "Northeast US":"🗽","Southeast US":"🌴","Midwest US":"🌽","West Coast US":"🌉","Europe":"🏰","Asia Pacific":"🗼" };
function speedColor(mbps: number|null, type: "down"|"up") { if(!mbps) return "var(--text-dim)"; const t=type==="down"?{g:400,ok:100,w:25}:{g:100,ok:20,w:5}; return mbps>=t.g?"var(--green)":mbps>=t.ok?"var(--accent)":mbps>=t.w?"var(--amber)":"#ef4444"; }
function pingColor(ms: number|null) { if(!ms) return "var(--text-dim)"; return ms<20?"var(--green)":ms<60?"var(--accent)":ms<120?"var(--amber)":"#ef4444"; }
function fmtTime(iso: string) { try { return new Date(iso).toLocaleString(); } catch { return iso; } }
export default function SpeedRunnerLive() {
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  async function fetchData() {
    try { const j = await fetch(`/api/speedrunner/results?device_id=${DEVICE_ID}&limit=12`).then(r=>r.json()); if(j.ok) setResults(j.history||[]); } finally { setLoading(false); }
  }
  useEffect(()=>{ fetchData(); const p=setInterval(fetchData,30_000); const c=setInterval(()=>setTick(t=>t+1),1000); return()=>{clearInterval(p);clearInterval(c);}; },[]);
  const nextRefresh = Math.max(0,30-(tick%30));
  return (
    <>
      <div className="vl-topbar">
        <div><div className="vl-topbar-title">SpeedRunner · Live Feed</div><div className="vl-topbar-sub">Most recent speed test results</div></div>
        <div className="vl-topbar-spacer"/>
        <span style={{fontSize:11,color:"var(--text-dim)",fontFamily:"var(--font-mono)"}}>refresh in {nextRefresh}s</span>
      </div>
      <div className="vl-main" style={{display:"flex",flexDirection:"column",gap:16}}>
        {loading?<div className="vl-card"><div className="vl-card-body" style={{color:"var(--text-dim)"}}>Loading…</div></div>
        :results.length===0?(
          <div className="vl-card"><div className="vl-card-body" style={{textAlign:"center",padding:"48px 0",color:"var(--text-dim)"}}>
            <div style={{fontSize:32,marginBottom:12}}>⚡</div><div style={{fontSize:14,fontWeight:600}}>No speed tests yet</div>
          </div></div>
        ):(
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:12}}>
            {results.slice(0,6).map(r=>(
              <div key={r.id} className="vl-card">
                <div className="vl-card-header">
                  <span style={{fontSize:14}}>{REGION_META[r.region]||"🌐"} <span style={{fontWeight:700,fontSize:13,color:"var(--text-primary)"}}>{r.region}</span></span>
                  <span style={{fontSize:10,color:"var(--text-dim)"}}>{fmtTime(r.ts_utc)}</span>
                </div>
                <div className="vl-card-body">
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
                    <div><div className="vl-stat-label">↓ Download</div><div style={{fontFamily:"var(--font-mono)",fontSize:22,fontWeight:700,color:speedColor(r.download_mbps,"down"),marginTop:2}}>{r.download_mbps!=null?r.download_mbps.toFixed(0):"—"}<span style={{fontSize:11,fontWeight:400,color:"var(--text-dim)",marginLeft:3}}>Mbps</span></div></div>
                    <div><div className="vl-stat-label">↑ Upload</div><div style={{fontFamily:"var(--font-mono)",fontSize:22,fontWeight:700,color:speedColor(r.upload_mbps,"up"),marginTop:2}}>{r.upload_mbps!=null?r.upload_mbps.toFixed(0):"—"}<span style={{fontSize:11,fontWeight:400,color:"var(--text-dim)",marginLeft:3}}>Mbps</span></div></div>
                    <div><div className="vl-stat-label">Ping</div><div style={{fontFamily:"var(--font-mono)",fontSize:16,fontWeight:600,color:pingColor(r.ping_ms),marginTop:2}}>{r.ping_ms!=null?`${r.ping_ms.toFixed(1)}ms`:"—"}</div></div>
                    <div><div className="vl-stat-label">Jitter</div><div style={{fontFamily:"var(--font-mono)",fontSize:16,fontWeight:600,color:"var(--text-secondary)",marginTop:2}}>{r.jitter_ms!=null?`±${r.jitter_ms.toFixed(1)}ms`:"—"}</div></div>
                  </div>
                  <div style={{fontSize:11,color:"var(--text-dim)",borderTop:"1px solid var(--border-dim)",paddingTop:8}}>
                    {r.region_city}{r.server_name?` · ${r.server_name}`:""}
                    {r.result_url&&<a href={r.result_url} target="_blank" rel="noopener" style={{marginLeft:8,color:"var(--accent)",fontSize:10}}>view result ↗</a>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
