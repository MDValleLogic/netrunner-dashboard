"use client";
import { useEffect, useState } from "react";

type Trace = { id: number; ts_utc: string; target: string; dest_ip: string; hop_count: number; total_hops: number; };
function fmtTime(iso: string) { try { return new Date(iso).toLocaleString(); } catch { return iso; } }
export default function RouteRunnerHistory() {
  const [traces, setTraces]   = useState<Trace[]>([]);
  const [targets, setTargets] = useState<string[]>([]);
  const [target, setTarget]   = useState("");
  const [loading, setLoading] = useState(true);
  async function fetchHistory(t?: string) {
    setLoading(true);
    try {
      const tParam = t !== undefined ? t : target;
      const j = await fetch(url).then(r => r.json());
      if (!j.traces) return;
      setTraces(j.traces || []);
      if (j.targets?.length) setTargets(j.targets);
    } finally { setLoading(false); }
  }
  useEffect(() => { fetchHistory(); }, []);
  useEffect(() => { fetchHistory(target); }, [target]);
  return (
    <>
      <div className="vl-topbar">
        <div><div className="vl-topbar-title">RouteRunner · History</div><div className="vl-topbar-sub">All recorded traces</div></div>
        <div className="vl-topbar-spacer" />
        <select className="vl-select" value={target} onChange={e => setTarget(e.target.value)} style={{width:"auto",maxWidth:240}}>
          <option value="">All targets</option>
          {targets.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <button className="vl-btn vl-btn-secondary" onClick={() => fetchHistory(target)}>↻ Refresh</button>
      </div>
      <div className="vl-main">
        <div className="vl-card">
          <div className="vl-card-header">
            <span style={{fontSize:13,fontWeight:600}}>Trace History</span>
            <span style={{fontSize:11,color:"var(--text-dim)"}}>{traces.length} traces</span>
          </div>
          {loading ? (
            <div className="vl-card-body" style={{color:"var(--text-dim)",fontSize:13}}>Loading…</div>
          ) : traces.length === 0 ? (
            <div className="vl-card-body">
              <div style={{textAlign:"center",padding:"48px 0",color:"var(--text-dim)"}}>
                <div style={{fontSize:32,marginBottom:12}}>🗺️</div>
                <div style={{fontSize:14,fontWeight:600}}>No traces yet</div>
              </div>
            </div>
          ) : (
            <div style={{overflowX:"auto"}}>
              <table className="vl-table">
                <thead><tr><th>Time</th><th>Target</th><th>Destination IP</th><th style={{textAlign:"right"}}>Total Hops</th><th style={{textAlign:"right"}}>Responding</th><th style={{textAlign:"right"}}>Timeouts</th></tr></thead>
                <tbody>
                  {traces.map(t => (
                    <tr key={t.id}>
                      <td className="mono" style={{fontSize:11}}>{fmtTime(t.ts_utc)}</td>
                      <td className="mono" style={{fontSize:12,color:"var(--accent)"}}>{t.target}</td>
                      <td className="mono" style={{fontSize:11,color:"var(--text-dim)"}}>{t.dest_ip||"—"}</td>
                      <td className="mono" style={{textAlign:"right"}}>{t.total_hops}</td>
                      <td className="mono" style={{textAlign:"right",color:"var(--green)"}}>{t.hop_count}</td>
                      <td className="mono" style={{textAlign:"right",color:t.total_hops-t.hop_count>0?"var(--amber)":"var(--text-dim)"}}>{t.total_hops-t.hop_count}</td>
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
