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
export default function RouteRunnerLive() {
  const [targets, setTargets] = useState<string[]>([]);
  const [target, setTarget]   = useState("");
  const [trace, setTrace]     = useState<Trace|null>(null);
  const [hops, setHops]       = useState<Hop[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick]       = useState(0);
  async function fetchData(t?: string) {
    try {
      const tParam = t !== undefined ? t : target;
      const url = `/api/routerunner/results${tParam?`?target=${encodeURIComponent(tParam)}`:""}`;
      const j = await fetch(url).then(r => r.json());
      if (!j.traces) return;
      setTrace(j.latest_trace || null);
      setHops(j.hops || []);
      if (j.targets?.length) { setTargets(j.targets); if (!target&&!t) setTarget(j.targets[0]); }
    } finally { setLoading(false); }
  }
  useEffect(() => {
    fetchData();
    const poll = setInterval(() => fetchData(), 30_000);
    const cd   = setInterval(() => setTick(t => t+1), 1000);
    return () => { clearInterval(poll); clearInterval(cd); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { if (target) fetchData(target); }, [target]);
  const maxRtt = Math.max(...hops.filter(h => h.rtt_ms!=null).map(h => h.rtt_ms!), 1);
  const nextRefresh = Math.max(0, 30 - (tick % 30));
  const finalRtt = hops.filter(h => !h.timeout).slice(-1)[0]?.rtt_ms;
  return (
    <>
      <div className="vl-topbar">
        <div><div className="vl-topbar-title">RouteRunner · Live Feed</div><div className="vl-topbar-sub">Most recent trace result</div></div>
        <div className="vl-topbar-spacer" />
        <span style={{fontSize:11,color:"var(--text-dim)",fontFamily:"var(--font-mono)"}}>refresh in {nextRefresh}s</span>
        {targets.length > 0 && (
          <select className="vl-select" value={target} onChange={e => setTarget(e.target.value)} style={{width:"auto",maxWidth:260}}>
            {targets.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
      </div>
      <div className="vl-main" style={{display:"flex",flexDirection:"column",gap:16}}>
        {trace && (
          <div className="vl-card">
            <div className="vl-card-header">
              <span style={{fontFamily:"var(--font-mono)",fontSize:13,fontWeight:700,color:"var(--accent)"}}>→ {targetLabel(trace.target)}</span>
              <span style={{fontSize:11,color:"var(--text-dim)"}}>{fmtTime(trace.ts_utc)}</span>
            </div>
            <div className="vl-card-body">
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
                {[
                  {label:"Dest IP",    value:trace.dest_ip,  mono:true,  color:"var(--text-secondary)"},
                  {label:"Total Hops", value:trace.total_hops, mono:true, color:"var(--accent)"},
                  {label:"Responding", value:trace.hop_count,  mono:true, color:"var(--green)"},
                  {label:"Final RTT",  value:finalRtt!=null?`${finalRtt.toFixed(1)}ms`:"—", mono:true, color:"var(--text-primary)"},
                ].map(s => (
                  <div key={s.label}>
                    <div className="vl-stat-label">{s.label}</div>
                    <div style={{fontFamily:s.mono?"var(--font-mono)":undefined,fontSize:s.label==="Dest IP"?13:24,fontWeight:700,color:s.color,marginTop:3}}>{s.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        {hops.length > 0 && (
          <div className="vl-card">
            <div className="vl-card-header"><span style={{fontSize:13,fontWeight:600}}>Latency by Hop</span></div>
            <div className="vl-card-body">
              <div style={{display:"flex",alignItems:"flex-end",gap:6,height:120,padding:"8px 0"}}>
                {hops.map((hop,i) => {
                  const pct = hop.rtt_ms!=null ? Math.max(4,(hop.rtt_ms/maxRtt)*100) : 4;
                  const color = hop.timeout?"var(--border-mid)":hop.rtt_ms!<20?"var(--green)":hop.rtt_ms!<80?"var(--accent)":"#f97316";
                  return (
                    <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                      <div style={{fontSize:9,color:"var(--text-dim)",fontFamily:"var(--font-mono)"}}>{hop.rtt_ms!=null?`${hop.rtt_ms.toFixed(0)}`:"*"}</div>
                      <div style={{width:"100%",height:`${pct}%`,background:color,borderRadius:"3px 3px 0 0",minHeight:4,opacity:hop.timeout?0.3:1}}/>
                      <div style={{fontSize:9,color:"var(--text-dim)",fontFamily:"var(--font-mono)"}}>{hop.hop_num}</div>
                    </div>
                  );
                })}
              </div>
              <div style={{display:"flex",gap:16,marginTop:4}}>
                {[["var(--green)","< 20ms"],["var(--accent)","20–80ms"],["#f97316","> 80ms"]].map(([c,l]) => (
                  <div key={l} style={{display:"flex",alignItems:"center",gap:5}}>
                    <div style={{width:10,height:10,borderRadius:2,background:c}}/><span style={{fontSize:10,color:"var(--text-dim)"}}>{l}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        {hops.length > 0 && (
          <div className="vl-card">
            <div className="vl-card-header"><span style={{fontSize:13,fontWeight:600}}>Hop Detail</span><span style={{fontSize:11,color:"var(--text-dim)"}}>{hops.length} hops</span></div>
            <div style={{overflowX:"auto"}}>
              <table className="vl-table">
                <thead><tr><th style={{width:40}}>#</th><th>IP</th><th>Hostname</th><th>RTT</th><th>Organization</th><th>Location</th></tr></thead>
                <tbody>
                  {hops.map((hop,i) => {
                    const color = ispColor(hop.org);
                    return (
                      <tr key={i} style={{opacity:hop.timeout?0.35:1}}>
                        <td className="mono" style={{fontWeight:700,color:"var(--accent)"}}>{hop.hop_num}</td>
                        <td className="mono" style={{fontSize:12}}>{hop.ip||<span style={{color:"var(--text-dim)"}}>*</span>}</td>
                        <td className="mono" style={{fontSize:11,color:"var(--text-dim)",maxWidth:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{hop.hostname&&hop.hostname!==hop.ip?hop.hostname:"—"}</td>
                        <td>{hop.rtt_ms!=null?<span className="mono" style={{fontSize:12,color:hop.rtt_ms<20?"var(--green)":hop.rtt_ms<80?"var(--accent)":"#f97316"}}>{hop.rtt_ms.toFixed(1)}ms</span>:<span style={{color:"var(--text-dim)",fontSize:11}}>timeout</span>}</td>
                        <td>{hop.org?<span style={{fontSize:11,fontWeight:600,color,background:`${color}18`,padding:"2px 8px",borderRadius:4}}>{hop.org.replace(/^AS\d+\s+/,"").substring(0,32)}</span>:<span style={{color:"var(--text-dim)"}}>—</span>}</td>
                        <td style={{fontSize:11,color:"var(--text-secondary)"}}>{[hop.city,hop.country].filter(Boolean).join(", ")||"—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {!loading && hops.length===0 && (
          <div className="vl-card"><div className="vl-card-body">
            <div style={{textAlign:"center",padding:"48px 0",color:"var(--text-dim)"}}>
              <div style={{fontSize:32,marginBottom:12}}>🗺️</div>
              <div style={{fontSize:14,fontWeight:600,marginBottom:8}}>No trace data yet</div>
              <div style={{fontSize:12}}>Configure destinations in the Config tab</div>
            </div>
          </div></div>
        )}
      </div>
    </>
  );
}

