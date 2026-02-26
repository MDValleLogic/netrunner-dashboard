"use client";

import React, { useEffect, useState } from "react";

type Hop = {
  id: number;
  hop_num: number;
  ip: string | null;
  hostname: string | null;
  rtt_ms: number | null;
  timeout: boolean;
  org: string;
  isp: string;
  asn: string;
  country: string;
  city: string;
};

type Trace = {
  id: number;
  ts_utc: string;
  target: string;
  dest_ip: string;
  hop_count: number;
  total_hops: number;
};

type RouteResponse = {
  ok: boolean;
  latest_trace: Trace | null;
  traces: Trace[];
  hops: Hop[];
  targets: string[];
};

function fmtTime(iso?: string | null) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString(); }
  catch { return ""; }
}

function OrgBadge({ org, asn }: { org: string; asn: string }) {
  if (!org && !asn) return <span style={{ color: "var(--text-dim)" }}>—</span>;
  const label = org || asn;
  const isGoogle  = /google/i.test(label);
  const isCF      = /cloudflare/i.test(label);
  const isComcast = /comcast|xfinity/i.test(label);
  const isCogent  = /cogent/i.test(label);
  const isLevel3  = /level.?3|lumen/i.test(label);
  const isATT     = /at&t|att/i.test(label);
  const isVerizon = /verizon/i.test(label);
  const color = isGoogle ? "#4ade80" : isCF ? "#f97316" : isComcast ? "#a78bfa" : isCogent ? "#38bdf8" : isLevel3 ? "#fbbf24" : isATT ? "#60a5fa" : isVerizon ? "#f472b6" : "var(--text-secondary)";
  return (
    <span style={{ fontSize: 11, fontWeight: 600, color, background: `${color}18`, padding: "2px 7px", borderRadius: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 200, display: "inline-block" }}>
      {label.replace(/^AS\d+\s+/, "").substring(0, 35)}
    </span>
  );
}

function RttBar({ rtt, max }: { rtt: number | null; max: number }) {
  if (rtt == null) return <span style={{ color: "var(--text-dim)", fontSize: 11 }}>timeout</span>;
  const pct = Math.min(100, (rtt / max) * 100);
  const color = rtt < 20 ? "var(--green)" : rtt < 80 ? "var(--accent)" : rtt < 200 ? "#f97316" : "var(--red)";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ width: 80, height: 6, background: "var(--border-dim)", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 3 }} />
      </div>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color, minWidth: 52 }}>
        {rtt.toFixed(1)}ms
      </span>
    </div>
  );
}

export default function RouteRunnerPage() {
  const [data, setData]       = useState<RouteResponse | null>(null);
  const [target, setTarget]   = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState("");
  const [tick, setTick]       = useState(0);
  const deviceId = "pi-403c60f1-2557-408f-a3c8-ca7acaf034f5";

  async function fetchData(t?: string) {
    try {
      setErr("");
      const tParam = t !== undefined ? t : target;
      const url = `/api/routerunner/results?device_id=${deviceId}${tParam ? `&target=${encodeURIComponent(tParam)}` : ""}`;
      const res = await fetch(url);
      const j = await res.json();
      if (!j.ok) throw new Error(j.error || "fetch failed");
      setData(j);
      if (!target && j.targets?.length) setTarget(j.targets[0]);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
    const poll      = setInterval(() => fetchData(), 30_000);
    const countdown = setInterval(() => setTick(t => t + 1), 1_000);
    return () => { clearInterval(poll); clearInterval(countdown); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (target) fetchData(target);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  const hops   = data?.hops || [];
  const trace  = data?.latest_trace;
  const maxRtt = Math.max(...hops.filter(h => h.rtt_ms != null).map(h => h.rtt_ms!), 1);
  const nextRefresh = Math.max(0, 30 - (tick % 30));
  const noData = !loading && hops.length === 0;

  return (
    <>
      <div className="vl-topbar">
        <div>
          <div className="vl-topbar-title">RouteRunner</div>
          <div className="vl-topbar-sub">Every hop · every IP · every carrier on the path</div>
        </div>
        <div className="vl-topbar-spacer" />
        <span style={{ fontSize: 11, color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>refresh in {nextRefresh}s</span>
        {data?.targets && data.targets.length > 0 && (
          <select className="vl-select" value={target} onChange={e => setTarget(e.target.value)} style={{ width: "auto", maxWidth: 240 }}>
            {data.targets.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
      </div>

      <div className="vl-main" style={{ display: "flex", flexDirection: "column", gap: 16 }}>

        {err && (
          <div style={{ padding: "10px 16px", borderRadius: "var(--r-md)", background: "var(--red-dim)", border: "1px solid rgba(239,68,68,0.3)", color: "var(--red)", fontSize: 13 }}>⚠ {err}</div>
        )}

        {trace && (
          <div className="vl-card">
            <div className="vl-card-header">
              <span style={{ fontSize: 13, fontWeight: 600, fontFamily: "var(--font-mono)" }}>→ {trace.target}</span>
              <span style={{ fontSize: 11, color: "var(--text-dim)" }}>{fmtTime(trace.ts_utc)}</span>
            </div>
            <div className="vl-card-body">
              <div className="vl-grid-4" style={{ gap: 10 }}>
                <div><div className="vl-stat-label">Destination IP</div><div style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--text-secondary)", marginTop: 3 }}>{trace.dest_ip || "—"}</div></div>
                <div><div className="vl-stat-label">Total Hops</div><div style={{ fontFamily: "var(--font-mono)", fontSize: 20, fontWeight: 700, color: "var(--accent)", marginTop: 3 }}>{trace.total_hops}</div></div>
                <div><div className="vl-stat-label">Responding</div><div style={{ fontFamily: "var(--font-mono)", fontSize: 20, fontWeight: 700, color: "var(--green)", marginTop: 3 }}>{trace.hop_count}</div></div>
                <div><div className="vl-stat-label">Final RTT</div><div style={{ fontFamily: "var(--font-mono)", fontSize: 20, fontWeight: 700, color: "var(--text-primary)", marginTop: 3 }}>{hops.filter(h => !h.timeout).slice(-1)[0]?.rtt_ms?.toFixed(1) ?? "—"}ms</div></div>
              </div>
            </div>
          </div>
        )}

        {noData && (
          <div className="vl-card">
            <div className="vl-card-body">
              <div className="vl-empty" style={{ padding: "48px 0", display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>🗺️</div>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>No route data yet</div>
                <div style={{ fontSize: 13, color: "var(--text-dim)", maxWidth: 400, textAlign: "center", lineHeight: 1.6 }}>
                  Deploy the RouteRunner container on your NetRunner Appliance to start seeing hop-by-hop traceroutes.
                </div>
              </div>
            </div>
          </div>
        )}

        {hops.length > 0 && (
          <div className="vl-card">
            <div className="vl-card-header">
              <span style={{ fontSize: 13, fontWeight: 600 }}>Hop-by-Hop Path</span>
              <span style={{ fontSize: 11, color: "var(--text-dim)" }}>{hops.length} hops</span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table className="vl-table">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>#</th>
                    <th>IP Address</th>
                    <th>Hostname</th>
                    <th>RTT</th>
                    <th>Organization / Carrier</th>
                    <th>ASN</th>
                    <th>Location</th>
                  </tr>
                </thead>
                <tbody>
                  {hops.map(hop => (
                    <tr key={hop.id} style={{ opacity: hop.timeout ? 0.4 : 1 }}>
                      <td className="mono" style={{ fontWeight: 700, color: "var(--accent)" }}>{hop.hop_num}</td>
                      <td className="mono" style={{ fontSize: 12 }}>{hop.ip || <span style={{ color: "var(--text-dim)" }}>*</span>}</td>
                      <td className="mono" style={{ fontSize: 11, color: "var(--text-dim)", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {hop.hostname && hop.hostname !== hop.ip ? hop.hostname : "—"}
                      </td>
                      <td><RttBar rtt={hop.rtt_ms} max={maxRtt} /></td>
                      <td><OrgBadge org={hop.org} asn={hop.asn} /></td>
                      <td className="mono" style={{ fontSize: 10, color: "var(--text-dim)" }}>{hop.asn?.split(" ")[0] || "—"}</td>
                      <td style={{ fontSize: 11, color: "var(--text-secondary)" }}>{[hop.city, hop.country].filter(Boolean).join(", ") || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {data?.traces && data.traces.length > 1 && (
          <div className="vl-card">
            <div className="vl-card-header">
              <span style={{ fontSize: 13, fontWeight: 600 }}>Recent Traces</span>
              <span style={{ fontSize: 11, color: "var(--text-dim)" }}>{data.traces.length} runs</span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table className="vl-table">
                <thead>
                  <tr>
                    <th>Time</th><th>Target</th><th>Dest IP</th>
                    <th style={{ textAlign: "right" }}>Hops</th>
                    <th style={{ textAlign: "right" }}>Responding</th>
                  </tr>
                </thead>
                <tbody>
                  {data.traces.map(t => (
                    <tr key={t.id} style={{ cursor: "pointer", background: t.id === trace?.id ? "var(--bg-overlay)" : undefined }} onClick={() => setTarget(t.target)}>
                      <td className="mono" style={{ fontSize: 11 }}>{fmtTime(t.ts_utc)}</td>
                      <td className="mono" style={{ fontSize: 12, color: "var(--accent)" }}>{t.target}</td>
                      <td className="mono" style={{ fontSize: 11, color: "var(--text-dim)" }}>{t.dest_ip}</td>
                      <td className="mono" style={{ textAlign: "right" }}>{t.total_hops}</td>
                      <td className="mono" style={{ textAlign: "right", color: "var(--green)" }}>{t.hop_count}</td>
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
