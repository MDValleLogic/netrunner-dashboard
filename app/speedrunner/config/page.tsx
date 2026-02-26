"use client";
import { useEffect, useState } from "react";
const DEVICE_ID = "pi-403c60f1-2557-408f-a3c8-ca7acaf034f5";
const INTERVAL_OPTIONS = [
  { value: 3600,  label: "Every 1 hour"   },
  { value: 10800, label: "Every 3 hours"  },
  { value: 21600, label: "Every 6 hours"  },
  { value: 43200, label: "Every 12 hours" },
  { value: 86400, label: "Every 24 hours" },
];
const ALL_REGIONS = [
  { region: "Northeast US",  city: "New York, NY",    server_id: "1786",  icon: "🗽" },
  { region: "Southeast US",  city: "Atlanta, GA",     server_id: "10039", icon: "🌴" },
  { region: "Midwest US",    city: "Chicago, IL",     server_id: "1776",  icon: "🌽" },
  { region: "West Coast US", city: "Los Angeles, CA", server_id: "5114",  icon: "🌉" },
  { region: "Europe",        city: "London, UK",      server_id: "13873", icon: "🏰" },
  { region: "Asia Pacific",  city: "Tokyo, Japan",    server_id: "15047", icon: "🗼" },
];
export default function SpeedRunnerConfig() {
  const [interval, setIntervalS]     = useState(3600);
  const [enabledRegions, setEnabled] = useState<string[]>(ALL_REGIONS.map(r=>r.region));
  const [saving, setSaving]          = useState(false);
  const [msg, setMsg]                = useState<{type:"success"|"error";text:string}|null>(null);
  useEffect(()=>{
    fetch(`/api/speedrunner/config?device_id=${DEVICE_ID}`).then(r=>r.json())
      .then(j=>{if(j?.ok&&j.config){setIntervalS(j.config.interval_seconds||3600);setEnabled(j.config.regions||ALL_REGIONS.map(r=>r.region));}})
      .catch(()=>{});
  },[]);
  function toggleRegion(r: string) { setEnabled(prev=>prev.includes(r)?prev.filter(x=>x!==r):[...prev,r]); }
  async function save() {
    setSaving(true); setMsg(null);
    try {
      const res=await fetch("/api/speedrunner/config",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({device_id:DEVICE_ID,interval_seconds:interval,regions:enabledRegions})});
      const j=await res.json();
      if(!j.ok) throw new Error(j.error||"Save failed");
      setMsg({type:"success",text:"Config saved — appliance will pick up changes on next cycle"});
    } catch(e:any){setMsg({type:"error",text:e.message});}
    finally{setSaving(false);}
  }
  return (
    <>
      <div className="vl-topbar">
        <div><div className="vl-topbar-title">SpeedRunner · Config</div><div className="vl-topbar-sub">Configure test schedule and regions</div></div>
        <div className="vl-topbar-spacer"/>
        <button className="vl-btn vl-btn-primary" onClick={save} disabled={saving}>{saving?"Saving…":"Save Config → Push to Appliance"}</button>
      </div>
      <div className="vl-main" style={{display:"flex",flexDirection:"column",gap:16}}>
        {msg&&(
          <div style={{padding:"10px 16px",borderRadius:"var(--r-md)",fontSize:13,background:msg.type==="success"?"var(--green-dim)":"var(--red-dim)",border:`1px solid ${msg.type==="success"?"rgba(22,163,74,0.3)":"rgba(239,68,68,0.3)"}`,color:msg.type==="success"?"var(--green)":"var(--red)"}}>
            {msg.type==="success"?"✓":"⚠"} {msg.text}
          </div>
        )}
        <div className="vl-card">
          <div className="vl-card-header"><span style={{fontSize:13,fontWeight:600}}>Test Schedule</span></div>
          <div className="vl-card-body">
            <p style={{fontSize:12,color:"var(--text-dim)",marginBottom:12}}>⚠ Speed tests consume bandwidth. Hourly is recommended for most users.</p>
            <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
              {INTERVAL_OPTIONS.map(opt=>(
                <button key={opt.value} onClick={()=>setIntervalS(opt.value)} style={{padding:"8px 18px",borderRadius:8,fontSize:13,fontWeight:600,cursor:"pointer",border:interval===opt.value?"2px solid var(--accent)":"1px solid var(--border-mid)",background:interval===opt.value?"var(--accent-dim)":"var(--bg-card)",color:interval===opt.value?"var(--accent)":"var(--text-secondary)",transition:"all 0.15s"}}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="vl-card">
          <div className="vl-card-header"><span style={{fontSize:13,fontWeight:600}}>Test Regions</span><span style={{fontSize:11,color:"var(--text-dim)"}}>{enabledRegions.length} of {ALL_REGIONS.length} enabled</span></div>
          <div className="vl-card-body">
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:8}}>
              {ALL_REGIONS.map(r=>{
                const enabled=enabledRegions.includes(r.region);
                return (
                  <button key={r.region} onClick={()=>toggleRegion(r.region)} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",borderRadius:8,cursor:"pointer",border:enabled?"2px solid var(--accent)":"1px solid var(--border-dim)",background:enabled?"var(--accent-dim)":"var(--bg-overlay)",textAlign:"left",transition:"all 0.15s"}}>
                    <span style={{fontSize:24}}>{r.icon}</span>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:600,color:enabled?"var(--accent)":"var(--text-primary)"}}>{r.region}</div>
                      <div style={{fontSize:11,color:"var(--text-dim)"}}>{r.city} · Server #{r.server_id}</div>
                    </div>
                    <div style={{width:16,height:16,borderRadius:"50%",border:`2px solid ${enabled?"var(--accent)":"var(--border-mid)"}`,background:enabled?"var(--accent)":"transparent",display:"flex",alignItems:"center",justifyContent:"center"}}>
                      {enabled&&<span style={{fontSize:8,color:"white",fontWeight:900}}>✓</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
