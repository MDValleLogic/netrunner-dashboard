"use client";
import { useEffect, useState } from "react";
const DEVICE_ID = "pi-403c60f1-2557-408f-a3c8-ca7acaf034f5";
type RegionResult = { id: number; ts_utc: string; region: string; region_city: string; download_mbps: number|null; upload_mbps: number|null; ping_ms: number|null; jitter_ms: number|null; isp: string|null; server_name: string|null; server_city: string|null; };
const REGION_META: Record<string,{icon:string}> = { "Northeast US":{icon:"🗽"},"Southeast US":{icon:"🌴"},"Midwest US":{icon:"🌽"},"West Coast US":{icon:"🌉"},"Europe":{icon:"🏰"},"Asia Pacific":{icon:"🗼"} };
function speedColor(mbps: number|null, type: "down"|"up") {
  if(!mbps) return "var(--text-dim)";
  const t = type==="down"?{g:400,ok:100,w:25}:{g:100,ok:20,w:5};
  return mbps>=t.g?"var(--green)":mbps>=t.ok?"var(--accent)":mbps>=t.w?"var(--amber)":"#ef4444";
}
function pingColor(ms: number|null) { if(!ms) return "var(--text-dim)"; return ms<20?"var(--green)":ms<60?"var(--accent)":ms<120?"var(--amber)":"#ef4444"; }
function speedBar(mbps: number|null, max: number, color: string) {
  const pct = mbps!=null?Math.min(100,(mbps/max)*100):0;
  return <div style={{height:4,background:"var(--bg-overlay)",borderRadius:2,overflow:"hidden",marginTop:4}}><div style={{height:"100%",width:`${pct}%`,background:color,borderRadius:2,transition:"width 0.6s ease"}}/></div>;
}
function fmtTime(iso: string) { try { return new Date(iso).toLocaleString(); } catch { return iso; } }
export default function SpeedRunnerOverview() {
  const [regions, setRegions] = useState<RegionResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  async function fetchData() {
    try { const j = await fetch(`/api/speedrunner/results?device_id=${DEVICE_ID}`).then(r=>r.json()); if(j.ok) setRegions(j.latest_by_region||[]); } finally { setLoading(false); }
  }
  useEffect(() => { fetchData(); const p=setInterval(fetchData,60_000); const c=setInterval(()=>setTick(t=>t+1),1000); return()=>{clearInterval(p);clearInterval(c);}; },[]);
  const maxDown = Math.max(...regions.map(r=>r.download_mbps||0),1000);
  const maxUp   = Math.max(...regions.map(r=>r.upload_mbps||0),500);
  const nextRefresh = Math.max(0,60-(tick%60));
  const avgDown  = regions.length?regions.reduce((s,r)=>s+(r.download_mbps||0),0)/regions.length:null;
  const avgUp    = regions.length?regions.reduce((s,r)=>s+(r.upload_mbps||0),0)/regions.length:null;
  const avgPing  = regions.length?regions.reduce((s,r)=>s+(r.ping_ms||0),0)/regions.length:null;
  const bestDown = regions.length?Math.max(...regions.map(r=>r.download_mbps||0)):null;
  return (
    <>
      <div className="vl-topbar">
        <div><div className="vl-topbar-title">SpeedRunner · Overview</div><div className="vl-topbar-sub">Speed to every region of the internet</div></div>
        <div className="vl-topbar-spacer"/>
        <span style={{fontSize:11,color:"var(--text-dim)",fontFamily:"var(--font-mono)"}}>refresh in {nextRefresh}s</span>
      </div>
      <div className="vl-main" style={{display:"flex",flexDirection:"column",gap:16}}>
        {regions.length>0 && (
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
            {[
              {label:"Avg Download",value:avgDown!=null?`${avgDown.toFixed(0)} Mbps`:"—",color:speedColor(avgDown,"down")},
              {label:"Avg Upload",  value:avgUp!=null?`${avgUp.toFixed(0)} Mbps`:"—",  color:speedColor(avgUp,"up")},
              {label:"Avg Ping",    value:avgPing!=null?`${avgPing.toFixed(0)} ms`:"—", color:pingColor(avgPing)},
              {label:"Best Download",value:bestDown!=null?`${bestDown.toFixed(0)} Mbps`:"—",color:"var(--green)"},
            ].map(s=>(
              <div key={s.label} className="vl-card"><div className="vl-card-body" style={{padding:"16px 20px"}}>
                <div className="vl-stat-label">{s.label}</div>
                <div style={{fontFamily:"var(--font-mono)",fontSize:24,fontWeight:700,color:s.color,marginTop:4}}>{s.value}</div>
              </div></div>
            ))}
          </div>
        )}
        <div className="vl-card">
          <div className="vl-card-header">
            <span style={{fontSize:13,fontWeight:600}}>Speed by Region</span>
            {regions.length>0&&<span style={{fontSize:11,color:"var(--text-dim)"}}>{regions.length} regions tested</span>}
          </div>
          <div className="vl-card-body" style={{padding:0}}>
            {loading?<div style={{padding:"32px 20px",color:"var(--text-dim)",fontSize:13}}>Loading…</div>
            :regions.length===0?(
              <div style={{padding:"48px 20px",textAlign:"center",color:"var(--text-dim)"}}>
                <div style={{fontSize:32,marginBottom:12}}>⚡</div>
                <div style={{fontSize:14,fontWeight:600,marginBottom:8}}>No speed tests yet</div>
                <div style={{fontSize:12}}>Deploy the SpeedRunner container on the Pi</div>
              </div>
            ):(
              <div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 160px 160px 120px 120px 140px",gap:0,padding:"8px 20px",borderBottom:"1px solid var(--border-dim)"}}>
                  {["Region","Download","Upload","Ping","Jitter","Server"].map(h=>(
                    <div key={h} style={{fontSize:10,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",color:"var(--text-dim)"}}>{h}</div>
                  ))}
                </div>
                {regions.map((r,i)=>{
                  const meta=REGION_META[r.region]||{icon:"🌐"};
                  const dcol=speedColor(r.download_mbps,"down");
                  const ucol=speedColor(r.upload_mbps,"up");
                  return (
                    <div key={r.id} style={{display:"grid",gridTemplateColumns:"1fr 160px 160px 120px 120px 140px",gap:0,padding:"14px 20px",alignItems:"center",borderBottom:i<regions.length-1?"1px solid var(--border-dim)":"none",background:i%2===0?"transparent":"var(--bg-overlay)"}}>
                      <div style={{display:"flex",alignItems:"center",gap:10}}>
                        <span style={{fontSize:20}}>{meta.icon}</span>
                        <div>
                          <div style={{fontSize:13,fontWeight:600,color:"var(--text-primary)"}}>{r.region}</div>
                          <div style={{fontSize:10,color:"var(--text-dim)"}}>{r.region_city}</div>
                        </div>
                      </div>
                      <div>
                        <div style={{fontFamily:"var(--font-mono)",fontSize:16,fontWeight:700,color:dcol}}>
                          {r.download_mbps!=null?`${r.download_mbps.toFixed(0)}`:"—"}<span style={{fontSize:10,fontWeight:400,color:"var(--text-dim)",marginLeft:3}}>Mbps</span>
                        </div>
                        {speedBar(r.download_mbps,maxDown,dcol)}
                      </div>
                      <div>
                        <div style={{fontFamily:"var(--font-mono)",fontSize:16,fontWeight:700,color:ucol}}>
                          {r.upload_mbps!=null?`${r.upload_mbps.toFixed(0)}`:"—"}<span style={{fontSize:10,fontWeight:400,color:"var(--text-dim)",marginLeft:3}}>Mbps</span>
                        </div>
                        {speedBar(r.upload_mbps,maxUp,ucol)}
                      </div>
                      <div style={{fontFamily:"var(--font-mono)",fontSize:15,fontWeight:600,color:pingColor(r.ping_ms)}}>{r.ping_ms!=null?`${r.ping_ms.toFixed(1)}ms`:"—"}</div>
                      <div style={{fontFamily:"var(--font-mono)",fontSize:13,color:"var(--text-secondary)"}}>{r.jitter_ms!=null?`±${r.jitter_ms.toFixed(1)}ms`:"—"}</div>
                      <div>
                        <div style={{fontSize:11,color:"var(--text-secondary)"}}>{r.server_name||r.server_city||"—"}</div>
                        <div style={{fontSize:10,color:"var(--text-dim)"}}>{fmtTime(r.ts_utc)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        {regions.length>0&&regions[0].isp&&(
          <div className="vl-card"><div className="vl-card-body" style={{padding:"14px 20px",display:"flex",alignItems:"center",gap:12}}>
            <div style={{width:8,height:8,borderRadius:"50%",background:"var(--green)",boxShadow:"0 0 6px var(--green)"}}/>
            <div><span style={{fontSize:12,color:"var(--text-dim)"}}>ISP: </span><span style={{fontSize:13,fontWeight:600,color:"var(--text-primary)"}}>{regions[0].isp}</span></div>
            <div style={{marginLeft:"auto",fontSize:11,color:"var(--text-dim)"}}>via NetRunner Appliance</div>
          </div></div>
        )}
      </div>
    </>
  );
}
