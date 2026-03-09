"use client";
import { useEffect, useState } from "react";
import { Zap } from "lucide-react";

type RegionResult = { id: number; ts_utc: string; region: string; region_city: string; download_mbps: number|null; upload_mbps: number|null; ping_ms: number|null; jitter_ms: number|null; isp: string|null; server_name: string|null; server_city: string|null; };

const REGION_META: Record<string, { icon: string }> = {
  "Northeast US":  { icon: "🗽" },
  "Southeast US":  { icon: "🌴" },
  "Midwest US":    { icon: "🌽" },
  "West Coast US": { icon: "🌉" },
  "Europe":        { icon: "🏰" },
  "Asia Pacific":  { icon: "🗼" },
};

function speedColor(mbps: number|null, type: "down"|"up") {
  if (!mbps) return "#6b7280";
  const t = type === "down" ? { g: 400, ok: 100, w: 25 } : { g: 100, ok: 20, w: 5 };
  return mbps >= t.g ? "#22c55e" : mbps >= t.ok ? "#3b82f6" : mbps >= t.w ? "#f59e0b" : "#ef4444";
}
function pingColor(ms: number|null) {
  if (!ms) return "#6b7280";
  return ms < 20 ? "#22c55e" : ms < 60 ? "#3b82f6" : ms < 120 ? "#f59e0b" : "#ef4444";
}
function speedBar(mbps: number|null, max: number, color: string) {
  const pct = mbps != null ? Math.min(100, (mbps / max) * 100) : 0;
  return (
    <div style={{ height: 4, background: "#1f2937", borderRadius: 2, overflow: "hidden", marginTop: 4 }}>
      <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 2, transition: "width 0.6s ease" }} />
    </div>
  );
}
function fmtTime(iso: string) { try { return new Date(iso).toLocaleString(); } catch { return iso; } }

export default function SpeedRunnerOverview() {
  const [regions, setRegions]   = useState<RegionResult[]>([]);
  const [loading, setLoading]   = useState(true);
  const [tick, setTick]         = useState(0);
  const [deviceId, setDeviceId] = useState("");

  async function fetchData(devId?: string) {
    const id = devId || deviceId;
    if (!id) return;
    try {
      const j = await fetch(`/api/speedrunner/results?device_id=${id}`).then(r => r.json());
      if (j.ok) setRegions(j.latest_by_region || []);
    } finally { setLoading(false); }
  }

  useEffect(() => {
    fetch("/api/devices/list")
      .then(r => r.json())
      .then(j => {
        if (j?.ok && j.devices?.length > 0) {
          const id = j.devices[0].device_id;
          setDeviceId(id);
          fetchData(id);
        } else {
          setLoading(false);
        }
      }).catch(() => setLoading(false));

    const p = setInterval(() => fetchData(), 60_000);
    const c = setInterval(() => setTick(t => t + 1), 1000);
    return () => { clearInterval(p); clearInterval(c); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const maxDown = Math.max(...regions.map(r => r.download_mbps || 0), 1000);
  const maxUp   = Math.max(...regions.map(r => r.upload_mbps   || 0), 500);
  const nextRefresh = Math.max(0, 60 - (tick % 60));

  const avgDown  = regions.length ? regions.reduce((s, r) => s + (r.download_mbps || 0), 0) / regions.length : null;
  const avgUp    = regions.length ? regions.reduce((s, r) => s + (r.upload_mbps   || 0), 0) / regions.length : null;
  const avgPing  = regions.length ? regions.reduce((s, r) => s + (r.ping_ms       || 0), 0) / regions.length : null;
  const bestDown = regions.length ? Math.max(...regions.map(r => r.download_mbps || 0)) : null;

  const statCards = [
    { label: "Avg Download",  value: avgDown  != null ? `${avgDown.toFixed(0)} Mbps`  : "—", color: speedColor(avgDown, "down") },
    { label: "Avg Upload",    value: avgUp    != null ? `${avgUp.toFixed(0)} Mbps`    : "—", color: speedColor(avgUp, "up") },
    { label: "Avg Ping",      value: avgPing  != null ? `${avgPing.toFixed(0)} ms`    : "—", color: pingColor(avgPing) },
    { label: "Best Download", value: bestDown != null ? `${bestDown.toFixed(0)} Mbps` : "—", color: "#22c55e" },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">

      {/* Header */}
      <div className="flex items-center justify-between mb-6 max-w-5xl">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <Zap size={20} className="text-blue-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-100 leading-tight">SpeedRunner Overview</h1>
            <p className="text-xs text-gray-500 font-mono">Speed to every region of the internet</p>
          </div>
        </div>
        <span style={{ fontSize: 11, color: "#6b7280", fontFamily: "monospace" }}>refresh in {nextRefresh}s</span>
      </div>

      <div className="max-w-5xl space-y-4">

        {/* Stat cards */}
        {regions.length > 0 && (
          <div className="grid grid-cols-4 gap-3">
            {statCards.map(s => (
              <div key={s.label} className="rounded-lg border border-gray-700/60 bg-gray-900/60 px-4 py-4">
                <div className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-2">{s.label}</div>
                <div style={{ fontSize: 24, fontWeight: 700, fontFamily: "monospace", color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Region table */}
        <div className="rounded-lg border border-gray-700/60 bg-gray-900/60">
          <div className="flex items-center justify-between p-4 border-b border-gray-700/60">
            <span style={{ fontSize: 13, fontWeight: 600, color: "#e5e7eb" }}>Speed by Region</span>
            {regions.length > 0 && (
              <span style={{ fontSize: 11, color: "#6b7280", fontFamily: "monospace" }}>{regions.length} regions tested</span>
            )}
          </div>

          {loading ? (
            <div style={{ padding: "32px 20px", color: "#6b7280", fontSize: 13 }}>Loading…</div>
          ) : regions.length === 0 ? (
            <div style={{ padding: "48px 20px", textAlign: "center" }}>
              <Zap size={32} style={{ color: "#374151", margin: "0 auto 16px" }} />
              <div style={{ fontSize: 14, fontWeight: 600, color: "#9ca3af", marginBottom: 8 }}>No speed tests yet</div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>Deploy the SpeedRunner container on the Pi</div>
            </div>
          ) : (
            <div>
              {/* Table header */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 150px 150px 110px 110px 140px", gap: 0, padding: "8px 20px", borderBottom: "1px solid #1f2937" }}>
                {["Region", "Download", "Upload", "Ping", "Jitter", "Server"].map(h => (
                  <div key={h} style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#6b7280", fontFamily: "monospace" }}>{h}</div>
                ))}
              </div>
              {regions.map((r, i) => {
                const meta = REGION_META[r.region] || { icon: "🌐" };
                const dcol = speedColor(r.download_mbps, "down");
                const ucol = speedColor(r.upload_mbps, "up");
                return (
                  <div key={r.id} style={{
                    display: "grid", gridTemplateColumns: "1fr 150px 150px 110px 110px 140px",
                    gap: 0, padding: "14px 20px", alignItems: "center",
                    borderBottom: i < regions.length - 1 ? "1px solid #111827" : "none",
                    background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 20 }}>{meta.icon}</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#e5e7eb" }}>{r.region}</div>
                        <div style={{ fontSize: 10, color: "#6b7280" }}>{r.region_city}</div>
                      </div>
                    </div>
                    <div>
                      <div style={{ fontFamily: "monospace", fontSize: 16, fontWeight: 700, color: dcol }}>
                        {r.download_mbps != null ? `${r.download_mbps.toFixed(0)}` : "—"}
                        <span style={{ fontSize: 10, fontWeight: 400, color: "#6b7280", marginLeft: 3 }}>Mbps</span>
                      </div>
                      {speedBar(r.download_mbps, maxDown, dcol)}
                    </div>
                    <div>
                      <div style={{ fontFamily: "monospace", fontSize: 16, fontWeight: 700, color: ucol }}>
                        {r.upload_mbps != null ? `${r.upload_mbps.toFixed(0)}` : "—"}
                        <span style={{ fontSize: 10, fontWeight: 400, color: "#6b7280", marginLeft: 3 }}>Mbps</span>
                      </div>
                      {speedBar(r.upload_mbps, maxUp, ucol)}
                    </div>
                    <div style={{ fontFamily: "monospace", fontSize: 15, fontWeight: 600, color: pingColor(r.ping_ms) }}>
                      {r.ping_ms != null ? `${r.ping_ms.toFixed(1)}ms` : "—"}
                    </div>
                    <div style={{ fontFamily: "monospace", fontSize: 13, color: "#9ca3af" }}>
                      {r.jitter_ms != null ? `±${r.jitter_ms.toFixed(1)}ms` : "—"}
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: "#9ca3af" }}>{r.server_name || r.server_city || "—"}</div>
                      <div style={{ fontSize: 10, color: "#6b7280" }}>{fmtTime(r.ts_utc)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ISP footer */}
        {regions.length > 0 && regions[0].isp && (
          <div className="rounded-lg border border-gray-700/60 bg-gray-900/60 px-4 py-3 flex items-center gap-3">
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 6px #22c55e" }} />
            <span style={{ fontSize: 12, color: "#6b7280" }}>ISP: </span>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#e5e7eb" }}>{regions[0].isp}</span>
            <span style={{ marginLeft: "auto", fontSize: 11, color: "#6b7280" }}>via NetRunner Appliance</span>
          </div>
        )}
      </div>
    </div>
  );
}
