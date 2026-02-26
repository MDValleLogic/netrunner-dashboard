"use client";
import { useEffect, useState } from "react";
const DEVICE_ID = "pi-403c60f1-2557-408f-a3c8-ca7acaf034f5";
const INTERVAL_OPTIONS = [
  { value: 60,   label: "Every 1 minute"   },
  { value: 300,  label: "Every 5 minutes"  },
  { value: 600,  label: "Every 10 minutes" },
  { value: 1800, label: "Every 30 minutes" },
  { value: 3600, label: "Every 1 hour"     },
];
const PRESETS = [
  { label: "Google DNS",      value: "8.8.8.8",                      icon: "🔍" },
  { label: "Cloudflare DNS",  value: "1.1.1.1",                      icon: "🛡️" },
  { label: "Netflix",         value: "www.netflix.com",               icon: "🎬" },
  { label: "YouTube",         value: "www.youtube.com",               icon: "▶️" },
  { label: "Microsoft 365",   value: "outlook.office365.com",         icon: "💼" },
  { label: "OneDrive",        value: "onedrive.live.com",             icon: "☁️" },
  { label: "Zoom",            value: "zoom.us",                       icon: "📹" },
  { label: "Google Meet",     value: "meet.google.com",               icon: "📹" },
  { label: "Slack",           value: "slack.com",                     icon: "💬" },
  { label: "AWS East",        value: "ec2.us-east-1.amazonaws.com",   icon: "☁️" },
  { label: "CNN",             value: "www.cnn.com",                   icon: "📰" },
  { label: "ESPN",            value: "www.espn.com",                  icon: "🏈" },
];
export default function RouteRunnerConfig() {
  const [targets, setTargets]   = useState<string[]>(["8.8.8.8","1.1.1.1"]);
  const [newTarget, setNewTarget] = useState("");
  const [interval, setIntervalS] = useState(300);
  const [saving, setSaving]     = useState(false);
  const [loading, setLoading]   = useState(true);
  const [msg, setMsg]           = useState<{type:"success"|"error";text:string}|null>(null);
  useEffect(() => {
    fetch(`/api/routerunner/config?device_id=${DEVICE_ID}`)
      .then(r => r.json())
      .then(j => { if (j?.ok && j.config) { setTargets(j.config.targets||["8.8.8.8","1.1.1.1"]); setIntervalS(j.config.interval_seconds||300); } })
      .catch(()=>{}).finally(()=>setLoading(false));
  }, []);
  async function save() {
    setSaving(true); setMsg(null);
    try {
      const res = await fetch("/api/routerunner/config", { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({device_id:DEVICE_ID,targets,interval_seconds:interval}) });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error||"Save failed");
      setMsg({type:"success",text:"Config saved — appliance will pick up changes on next cycle"});
    } catch(e:any) { setMsg({type:"error",text:e.message}); }
    finally { setSaving(false); }
  }
  function addTarget(val: string) { const v=val.trim(); if(!v||targets.includes(v)) return; setTargets([...targets,v]); setNewTarget(""); }
  function removeTarget(t: string) { setTargets(targets.filter(x=>x!==t)); }
  const available = PRESETS.filter(p => !targets.includes(p.value));
  return (
    <>
      <div className="vl-topbar">
        <div><div className="vl-topbar-title">RouteRunner · Config</div><div className="vl-topbar-sub">Configure trace destinations and schedule</div></div>
        <div className="vl-topbar-spacer" />
        <button className="vl-btn vl-btn-primary" onClick={save} disabled={saving}>{saving?"Saving…":"Save Config → Push to Appliance"}</button>
      </div>
      <div className="vl-main" style={{display:"flex",flexDirection:"column",gap:16}}>
        {msg && (
          <div style={{padding:"10px 16px",borderRadius:"var(--r-md)",fontSize:13,background:msg.type==="success"?"var(--green-dim)":"var(--red-dim)",border:`1px solid ${msg.type==="success"?"rgba(22,163,74,0.3)":"rgba(239,68,68,0.3)"}`,color:msg.type==="success"?"var(--green)":"var(--red)"}}>
            {msg.type==="success"?"✓":"⚠"} {msg.text}
          </div>
        )}
        <div className="vl-card">
          <div className="vl-card-header"><span style={{fontSize:13,fontWeight:600}}>Test Schedule</span></div>
          <div className="vl-card-body">
            <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
              {INTERVAL_OPTIONS.map(opt => (
                <button key={opt.value} onClick={()=>setIntervalS(opt.value)} style={{padding:"8px 18px",borderRadius:8,fontSize:13,fontWeight:600,cursor:"pointer",border:interval===opt.value?"2px solid var(--accent)":"1px solid var(--border-mid)",background:interval===opt.value?"var(--accent-dim)":"var(--bg-card)",color:interval===opt.value?"var(--accent)":"var(--text-secondary)",transition:"all 0.15s"}}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="vl-card">
          <div className="vl-card-header"><span style={{fontSize:13,fontWeight:600}}>Trace Destinations</span><span style={{fontSize:11,color:"var(--text-dim)"}}>{targets.length} configured</span></div>
          <div className="vl-card-body" style={{display:"flex",flexDirection:"column",gap:8}}>
            {targets.length===0 && <div style={{color:"var(--text-dim)",fontSize:13,padding:"8px 0"}}>No destinations configured</div>}
            {targets.map(t => {
              const preset = PRESETS.find(p=>p.value===t);
              return (
                <div key={t} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",borderRadius:8,background:"var(--bg-overlay)",border:"1px solid var(--border-dim)"}}>
                  <span style={{fontSize:18}}>{preset?.icon||"🎯"}</span>
                  <div style={{flex:1}}>
                    {preset && <div style={{fontSize:13,fontWeight:600,color:"var(--text-primary)"}}>{preset.label}</div>}
                    <div style={{fontFamily:"var(--font-mono)",fontSize:12,color:"var(--accent)"}}>{t}</div>
                  </div>
                  <button onClick={()=>removeTarget(t)} style={{background:"none",border:"none",color:"var(--text-dim)",cursor:"pointer",fontSize:16,padding:"4px 8px"}}>✕</button>
                </div>
              );
            })}
            <div style={{display:"flex",gap:8,marginTop:4}}>
              <input className="vl-input" placeholder="Add custom IP or hostname…" value={newTarget} onChange={e=>setNewTarget(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addTarget(newTarget)} style={{flex:1}}/>
              <button className="vl-btn vl-btn-secondary" onClick={()=>addTarget(newTarget)}>+ Add</button>
            </div>
          </div>
        </div>
        {available.length > 0 && (
          <div className="vl-card">
            <div className="vl-card-header"><span style={{fontSize:13,fontWeight:600}}>Quick Add — Common Destinations</span></div>
            <div className="vl-card-body">
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:8}}>
                {available.map(preset => (
                  <button key={preset.value} onClick={()=>addTarget(preset.value)} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderRadius:8,cursor:"pointer",background:"var(--bg-overlay)",border:"1px solid var(--border-dim)",textAlign:"left",transition:"all 0.15s"}}
                    onMouseOver={e=>(e.currentTarget.style.borderColor="var(--accent)")} onMouseOut={e=>(e.currentTarget.style.borderColor="var(--border-dim)")}>
                    <span style={{fontSize:20}}>{preset.icon}</span>
                    <div>
                      <div style={{fontSize:12,fontWeight:600,color:"var(--text-primary)"}}>{preset.label}</div>
                      <div style={{fontFamily:"var(--font-mono)",fontSize:10,color:"var(--text-dim)"}}>{preset.value}</div>
                    </div>
                    <span style={{marginLeft:"auto",color:"var(--accent)",fontSize:16}}>+</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
