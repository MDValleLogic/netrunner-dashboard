"use client";
import { useEffect, useState } from "react";


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
  if (/amazon|aws|ec2/.test(o))        return { label: "AWS",           color: "#FF9900", icon: "☁️" };
  if (/google|gcp|googlecloud/.test(o)) return { label: "Google Cloud", color: "#4285F4", icon: "☁️" };
  if (/microsoft|azure|msft/.test(o))  return { label: "Azure",         color: "#0078D4", icon: "☁️" };
  if (/cloudflare/.test(o))            return { label: "Cloudflare",    color: "#F38020", icon: "🛡️" };
  if (/akamai/.test(o))                return { label: "Akamai",        color: "#009BDE", icon: "🌐" };
  if (/fastly/.test(o))                return { label: "Fastly",        color: "#FF282D", icon: "⚡" };
  if (/netflix/.test(o))               return { label: "Netflix CDN",   color: "#E50914", icon: "🎬" };
  if (/level.?3|lumen/.test(o))        return { label: "Lumen/Level3",  color: "#FBBF24", icon: "🔌" };
  if (/cogent/.test(o))                return { label: "Cogent",        color: "#38BDF8", icon: "🔌" };
  return { label: org || "Unknown", color: "#64748B", icon: "🌐" };
}
function ispColor(org: string) {
  const o = org.toLowerCase();
  if (/google/.test(o))         return "#4ade80";
  if (/cloudflare/.test(o))     return "#f97316";
  if (/comcast|xfinity/.test(o)) return "#a78bfa";
  if (/cogent/.test(o))         return "#38bdf8";
  if (/level.?3|lumen/.test(o)) return "#fbbf24";
  if (/at&t|att/.test(o))       return "#60a5fa";
  if (/verizon/.test(o))        return "#f472b6";
  if (/akamai/.test(o))         return "#06b6d4";
  if (/amazon|aws/.test(o))     return "#fb923c";
  return "#94a3b8";
}
function fmtTime(iso: string) { try { return new Date(iso).toLocaleString(); } catch { return iso; } }
export default function RouteRunnerOverview() {
  const [targets, setTargets] = useState<string[]>([]);
  const [target, setTarget]   = useState("");
  const [trace, setTrace]     = useState<Trace|null>(null);
  const [hops, setHops]       = useState<Hop[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick]       = useState(0);
  async function fetchData(t?: string) {
    try {
      const tParam = t !== undefined ? t : target;
      const url = `/api/routerunner/results${tParam ? "?target="+encodeURIComponent(tParam) : ""}`;
      const j = await fetch(url).then(r => r.json());
      if (!j.traces) return;
      setTrace(j.latest_trace || null);
      setHops(j.hops || []);
      if (j.targets?.length) { setTargets(j.targets); if (!target && !t) setTarget(j.targets[0]); }
    } finally { setLoading(false); }
  }
  useEffect(() => {
    fetchData();
    const poll = setInterval(() => fetchData(), 60_000);
    const cd   = setInterval(() => setTick(t => t+1), 1000);
    return () => { clearInterval(poll); clearInterval(cd); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { if (target) fetchData(target); }, [target]);
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
  return (
    <>
      <div className="vl-topbar">
        <div><div className="vl-topbar-title">RouteRunner · Overview</div><div className="vl-topbar-sub">Every hop · every carrier · every destination</div></div>
        <div className="vl-topbar-spacer" />
        <span style={{fontSize:11,color:"var(--text-dim)",fontFamily:"var(--font-mono)"}}>refresh in {nextRefresh}s</span>
        {targets.length > 0 && (
          <select className="vl-select" value={target} onChange={e => setTarget(e.target.value)} style={{width:"auto",maxWidth:280}}>
            {targets.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
      </div>
      <div className="vl-main" style={{display:"flex",flexDirection:"column",gap:16}}>
        <div className="vl-card">
          <div className="vl-card-header">
            <span style={{fontSize:13,fontWeight:600}}>Path Overview</span>
            {trace && <span style={{fontSize:11,color:"var(--text-dim)"}}>{fmtTime(trace.ts_utc)}</span>}
          </div>
          <div className="vl-card-body">
            <div style={{display:"flex",alignItems:"center",gap:0,overflowX:"auto",padding:"8px 0"}}>
              <div style={{flexShrink:0,background:"var(--bg-card)",border:"1px solid var(--border-mid)",borderRadius:12,padding:"16px 20px",minWidth:160}}>
                <div style={{fontSize:9,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:"var(--text-dim)",marginBottom:8}}>Source</div>
                <div style={{fontFamily:"var(--font-mono)",fontSize:11,color:"var(--text-secondary)",marginBottom:4}}>{respondingHops[0]?.ip || "10.10.10.x"} <span style={{fontSize:10,color:"var(--text-dim)"}}>private</span></div>
                <div style={{marginTop:8,display:"flex",alignItems:"center",gap:5}}>
                  <div style={{width:7,height:7,borderRadius:"50%",background:"var(--green)",boxShadow:"0 0 6px var(--green)"}}/>
                  <span style={{fontSize:10,color:"var(--green)",fontWeight:600}}>NetRunner Appliance</span>
                </div>
              </div>
              {orgGroups.map((group, gi) => (
                <div key={gi} style={{display:"flex",alignItems:"center",flexShrink:0}}>
                  <div style={{display:"flex",alignItems:"center",padding:"0 4px"}}>
                    <div style={{width:32,height:2,background:group.color,opacity:0.5}}/>
                    <div style={{width:0,height:0,borderTop:"5px solid transparent",borderBottom:"5px solid transparent",borderLeft:`7px solid ${group.color}`,opacity:0.5}}/>
                  </div>
                  <div style={{background:`${group.color}12`,border:`1px solid ${group.color}40`,borderRadius:10,padding:"10px 14px",minWidth:120,maxWidth:180}}>
                    <div style={{fontSize:9,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",color:group.color,marginBottom:6}}>{group.org.replace(/^AS\d+\s+/,"").substring(0,24)}</div>
                    {group.hops.map((h,hi) => (
                      <div key={hi} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,marginBottom:3}}>
                        <span style={{fontFamily:"var(--font-mono)",fontSize:10,color:"var(--text-dim)"}}>hop {h.hop_num}</span>
                        <span style={{fontFamily:"var(--font-mono)",fontSize:10,color:group.color}}>{h.rtt_ms!=null?`${h.rtt_ms.toFixed(1)}ms`:"?"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {lastHop && dest && (
                <div style={{display:"flex",alignItems:"center",flexShrink:0}}>
                  <div style={{display:"flex",alignItems:"center",padding:"0 4px"}}>
                    <div style={{width:32,height:2,background:dest.color,opacity:0.6}}/>
                    <div style={{width:0,height:0,borderTop:"5px solid transparent",borderBottom:"5px solid transparent",borderLeft:`7px solid ${dest.color}`,opacity:0.6}}/>
                  </div>
                  <div style={{background:`${dest.color}18`,border:`1px solid ${dest.color}50`,borderRadius:12,padding:"16px 20px",minWidth:160}}>
                    <div style={{fontSize:9,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:dest.color,marginBottom:8}}>{dest.icon} {dest.label}</div>
                    <div style={{fontFamily:"var(--font-mono)",fontSize:12,color:"var(--text-primary)",fontWeight:700,marginBottom:4}}>{targetLabel(trace?.target||"")}</div>
                    <div style={{fontFamily:"var(--font-mono)",fontSize:10,color:"var(--text-dim)",marginBottom:4}}>{trace?.dest_ip}</div>
                    <div style={{fontSize:10,color:"var(--text-dim)"}}>{[lastHop.city,lastHop.country].filter(Boolean).join(", ")}</div>
                    <div style={{marginTop:6,fontSize:10,color:dest.color}}>{lastHop.asn?.split(" ")[0]}</div>
                  </div>
                </div>
              )}
              {respondingHops.length === 0 && !loading && (
                <div style={{flex:1,textAlign:"center",padding:"32px 0",color:"var(--text-dim)",fontSize:13}}>No trace data yet — configure targets in Config tab</div>
              )}
            </div>
          </div>
        </div>
        {trace && (
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
            {[
              {label:"Total Hops",    value:trace.total_hops,  color:"var(--accent)"},
              {label:"Responding",    value:trace.hop_count,   color:"var(--green)"},
              {label:"ISPs Traversed",value:orgGroups.length,  color:"var(--amber)"},
              {label:"Final RTT",     value:lastHop?.rtt_ms!=null?`${lastHop.rtt_ms.toFixed(1)}ms`:"—", color:"var(--text-primary)"},
            ].map(s => (
              <div key={s.label} className="vl-card">
                <div className="vl-card-body" style={{padding:"16px 20px"}}>
                  <div className="vl-stat-label">{s.label}</div>
                  <div style={{fontFamily:"var(--font-mono)",fontSize:28,fontWeight:700,color:s.color,marginTop:4}}>{s.value}</div>
                </div>
              </div>
            ))}
          </div>
        )}
        {hops.length > 0 && (
          <div className="vl-card">
            <div className="vl-card-header">
              <span style={{fontSize:13,fontWeight:600}}>Hop Detail</span>
              <span style={{fontSize:11,color:"var(--text-dim)"}}>{hops.length} hops to {targetLabel(trace?.target||"")}</span>
            </div>
            <div style={{overflowX:"auto"}}>
              <table className="vl-table">
                <thead><tr><th style={{width:40}}>#</th><th>IP</th><th>Hostname</th><th>RTT</th><th>Organization</th><th>ASN</th><th>Location</th></tr></thead>
                <tbody>
                  {hops.map((hop,i) => {
                    const color = ispColor(hop.org);
                    const isFirst = i===0; const isLast = i===hops.length-1;
                    return (
                      <tr key={i} style={{opacity:hop.timeout?0.35:1}}>
                        <td className="mono" style={{fontWeight:700,color:"var(--accent)"}}>{hop.hop_num}</td>
                        <td className="mono" style={{fontSize:12}}>
                          {hop.ip ? <span>{hop.ip}{isFirst&&<span style={{marginLeft:6,fontSize:9,color:"var(--green)",fontWeight:700}}>SRC</span>}{isLast&&<span style={{marginLeft:6,fontSize:9,color:"var(--amber)",fontWeight:700}}>DEST</span>}</span> : <span style={{color:"var(--text-dim)"}}>*</span>}
                        </td>
                        <td className="mono" style={{fontSize:11,color:"var(--text-dim)",maxWidth:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{hop.hostname&&hop.hostname!==hop.ip?hop.hostname:"—"}</td>
                        <td>{hop.rtt_ms!=null?<span className="mono" style={{fontSize:12,color:hop.rtt_ms<20?"var(--green)":hop.rtt_ms<80?"var(--accent)":"#f97316"}}>{hop.rtt_ms.toFixed(1)}ms</span>:<span style={{color:"var(--text-dim)",fontSize:11}}>timeout</span>}</td>
                        <td>{hop.org?<span style={{fontSize:11,fontWeight:600,color,background:`${color}18`,padding:"2px 8px",borderRadius:4}}>{hop.org.replace(/^AS\d+\s+/,"").substring(0,32)}</span>:<span style={{color:"var(--text-dim)"}}>—</span>}</td>
                        <td className="mono" style={{fontSize:10,color:"var(--text-dim)"}}>{hop.asn?.split(" ")[0]||"—"}</td>
                        <td style={{fontSize:11,color:"var(--text-secondary)"}}>{[hop.city,hop.country].filter(Boolean).join(", ")||"—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
