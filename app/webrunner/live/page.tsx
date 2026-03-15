"use client";
import { useEffect, useState, useMemo, useCallback } from "react";
import { Activity, Wifi, WifiOff } from "lucide-react";
import { useDevice } from "@/lib/deviceContext";
import { LineChart, Line, ResponsiveContainer, Tooltip } from "recharts";

type LiveMeasurement = { id: number; ts_utc: string; url: string; dns_ms: number | null; http_ms: number | null; http_status: number | null; http_err: string | null; success: boolean; device_id: string; };
type LiveDevice = { device_id: string; nr_serial: string; tenant_id: string | null; };
type LiveData = { ok: boolean; device_id: string; nr_serial: string; device: LiveDevice | null; measurements: LiveMeasurement[]; fetched_at_utc: string; };
type TsBucket = { bucket: string; avg_ms: number | null; };

function fmtMs(ms: number | null) { return ms == null ? "—" : ms < 1000 ? `${ms}ms` : `${(ms/1000).toFixed(1)}s`; }
function fmtTime(iso: string) { try { return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }); } catch { return ""; } }
function isOnline(last: string | undefined) { if (!last) return false; return (Date.now() - new Date(last).getTime()) < 90_000; }
function latencyColor(ms: number | null) {
  if (!ms) return "#6b7280";
  if (ms < 100) return "#22c55e";
  if (ms < 300) return "#60a5fa";
  if (ms < 800) return "#f59e0b";
  return "#ef4444";
}
function trendArrow(data: number[]) {
  if (data.length < 4) return { arrow: "→", color: "#6b7280" };
  const recent = data.slice(-3).reduce((a, b) => a + b, 0) / 3;
  const older = data.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
  const diff = recent - older;
  if (diff > 20) return { arrow: "↑", color: "#ef4444" };
  if (diff < -20) return { arrow: "↓", color: "#22c55e" };
  return { arrow: "→", color: "#6b7280" };
}

const TIME_WINDOWS = [
  { label: "15 min", value: 15 },
  { label: "30 min", value: 30 },
  { label: "1 hr",   value: 60 },
  { label: "3 hrs",  value: 180 },
];

const sel = { background: "#111827", border: "1px solid #374151", borderRadius: 6, color: "#e5e7eb", padding: "6px 10px", fontSize: 12, fontFamily: "monospace" };

function SparkLine({ data, color }: { data: number[]; color: string }) {
  const pts = data.map((v, i) => ({ v }));
  return (
    <ResponsiveContainer width="100%" height={40}>
      <LineChart data={pts}>
        <Line type="monotone" dataKey="v" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function UrlCard({ url, measurements }: { url: string; measurements: LiveMeasurement[] }) {
  const latest = measurements[0];
  const httpVals = measurements.map(m => m.http_ms).filter((v): v is number => v != null);
  const dnsVals = measurements.map(m => m.dns_ms).filter((v): v is number => v != null);
  const avgHttp = httpVals.length ? Math.round(httpVals.reduce((a, b) => a + b, 0) / httpVals.length) : null;
  const avgDns = dnsVals.length ? Math.round(dnsVals.reduce((a, b) => a + b, 0) / dnsVals.length) : null;
  const successRate = measurements.length ? Math.round((measurements.filter(m => m.success).length / measurements.length) * 100) : 100;
  const { arrow, color: arrowColor } = trendArrow(httpVals.slice().reverse());
  const sparkData = httpVals.slice().reverse();
  const currentMs = latest?.http_ms ?? null;
  const isOk = latest?.success !== false;
  const hostname = (() => { try { return new URL(url).hostname; } catch { return url; } })();

  const statusColor = !isOk ? "#ef4444" : currentMs && currentMs > 800 ? "#f59e0b" : "#22c55e";
  const statusLabel = !isOk ? "FAIL" : currentMs && currentMs > 800 ? "SLOW" : "OK";

  return (
    <div style={{
      background: "#0f172a",
      border: `1px solid ${!isOk ? "#ef444440" : "#1e293b"}`,
      borderRadius: 12,
      padding: "20px 24px",
      display: "flex",
      flexDirection: "column",
      gap: 12,
      minWidth: 0,
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 700, color: "#e5e7eb", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {hostname}
          </div>
          <div style={{ fontSize: 10, color: "#6b7280", marginTop: 2, fontFamily: "monospace", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {url}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, marginLeft: 8 }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: arrowColor, fontFamily: "monospace" }}>{arrow}</span>
          <span style={{
            padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700,
            fontFamily: "monospace", background: `${statusColor}20`, color: statusColor,
            border: `1px solid ${statusColor}40`
          }}>{statusLabel}</span>
        </div>
      </div>

      {/* Main metric */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontSize: 36, fontWeight: 700, fontFamily: "monospace", color: latencyColor(currentMs) }}>
          {fmtMs(currentMs)}
        </span>
        <span style={{ fontSize: 11, color: "#6b7280", fontFamily: "monospace" }}>HTTP</span>
      </div>

      {/* Sparkline */}
      {sparkData.length > 1 && (
        <div style={{ margin: "0 -4px" }}>
          <SparkLine data={sparkData} color={latencyColor(avgHttp)} />
        </div>
      )}

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        {[
          { label: "DNS", value: fmtMs(avgDns) },
          { label: "Avg HTTP", value: fmtMs(avgHttp) },
          { label: "Success", value: `${successRate}%`, color: successRate < 95 ? "#ef4444" : successRate < 99 ? "#f59e0b" : "#22c55e" },
        ].map(stat => (
          <div key={stat.label} style={{ background: "#111827", borderRadius: 6, padding: "8px 10px" }}>
            <div style={{ fontSize: 9, fontFamily: "monospace", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>{stat.label}</div>
            <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "monospace", color: stat.color || "#e5e7eb" }}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Last tested */}
      {latest && (
        <div style={{ fontSize: 10, color: "#4b5563", fontFamily: "monospace" }}>
          Last tested {fmtTime(latest.ts_utc)}
          {latest.http_status && <span style={{ marginLeft: 8, color: "#374151" }}>HTTP {latest.http_status}</span>}
        </div>
      )}
    </div>
  );
}

export default function WebRunnerLive() {
  const { selectedDeviceId, devices, setSelectedDeviceId } = useDevice();
  const [live, setLive] = useState<LiveData | null>(null);
  const [timeseries, setTimeseries] = useState<TsBucket[]>([]);
  const [loading, setLoading] = useState(true);
  const [windowMinutes, setWindowMinutes] = useState(60);
  const [tick, setTick] = useState(0);

  const fetchAll = useCallback(async () => {
    if (!selectedDeviceId) return;
    try {
      const [lR, tR] = await Promise.all([
        fetch(`/api/webrunner/live?window_minutes=${windowMinutes}&limit=200${selectedDeviceId ? "&device_id="+selectedDeviceId : ""}`),
        fetch(`/api/webrunner/timeseries?window_minutes=${windowMinutes}&bucket_seconds=60${selectedDeviceId ? "&device_id="+selectedDeviceId : ""}`),
      ]);
      const [lJ, tJ] = await Promise.all([lR.json(), tR.json()]);
      if (!lJ.measurements) throw new Error("live endpoint failed");
      setLive({ ...lJ, measurements: lJ.measurements.map((m: any) => ({ ...m, success: !m.http_err || m.http_err === "" })) });
      setTimeseries(tJ.buckets || []);
    } catch {}
    finally { setLoading(false); }
  }, [selectedDeviceId, windowMinutes]);

  useEffect(() => {
    fetchAll();
    const poll = setInterval(fetchAll, 5_000);
    const t = setInterval(() => setTick(n => n + 1), 1000);
    return () => { clearInterval(poll); clearInterval(t); };
  }, [fetchAll]);

  const online = isOnline(live?.device?.last_seen);
  const nextRefresh = Math.max(0, 5 - (tick % 5));

  // Group measurements by URL
  const urlGroups = useMemo(() => {
    const ms = live?.measurements || [];
    const map: Record<string, LiveMeasurement[]> = {};
    for (const m of ms) {
      if (!map[m.url]) map[m.url] = [];
      map[m.url].push(m);
    }
    return map;
  }, [live]);

  const urls = Object.keys(urlGroups);

  // Overall stats
  const allMs = (live?.measurements || []).filter(m => m.success && m.http_ms != null);
  const avgMs = allMs.length ? Math.round(allMs.reduce((a, b) => a + (b.http_ms || 0), 0) / allMs.length) : null;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 max-w-6xl">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <Activity size={20} className="text-blue-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-100 leading-tight">Live Feed</h1>
            <p className="text-xs text-gray-500 font-mono">Real-time measurements · polling every 5s</p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color: "#6b7280", fontFamily: "monospace" }}>refresh in {nextRefresh}s</span>
          <select value={selectedDeviceId || ""} onChange={e => setSelectedDeviceId(e.target.value)} style={sel}>
            {devices.map(d => <option key={d.device_id} value={d.device_id}>{d.nickname ? `${d.nickname} (${d.nr_serial})` : d.nr_serial}</option>)}
          </select>
          <select value={windowMinutes} onChange={e => setWindowMinutes(Number(e.target.value))} style={sel}>
            {TIME_WINDOWS.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
          </select>
        </div>
      </div>

      {/* Device card */}
      <div className="max-w-6xl mb-6">
        <div className="rounded-lg border border-gray-700/60 bg-gray-900/60 p-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src="/assets/NetRunner_White.png" alt="NetRunner" style={{ width: 80, opacity: 0.9 }} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#e5e7eb", fontFamily: "monospace" }}>NetRunner Appliance</div>
              <div style={{ fontSize: 11, color: "#6b7280" }}>Edge monitoring appliance</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 32, alignItems: "center" }}>
            {[
              { label: "Device", value: live?.nr_serial || "—" },
              { label: "Avg Latency", value: fmtMs(avgMs), color: latencyColor(avgMs) },
              { label: "Samples", value: String(live?.measurements?.length || 0) },
              { label: "Last Seen", value: live?.device?.last_seen ? fmtTime(live.device.last_seen) : "—" },
            ].map(s => (
              <div key={s.label}>
                <div style={{ fontSize: 9, fontFamily: "monospace", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "monospace", color: s.color || "#e5e7eb" }}>{s.value}</div>
              </div>
            ))}
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 20, background: online ? "#22c55e15" : "#ef444415", border: `1px solid ${online ? "#22c55e40" : "#ef444440"}` }}>
              {online ? <Wifi size={14} className="text-green-400" /> : <WifiOff size={14} className="text-red-400" />}
              <span style={{ fontSize: 12, fontWeight: 600, color: online ? "#22c55e" : "#ef4444" }}>{online ? "Online" : "Offline"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* URL Cards */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "48px 0", color: "#6b7280" }}>Loading…</div>
      ) : urls.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 0", color: "#6b7280" }}>No measurements yet — waiting for next test cycle</div>
      ) : (
        <div className="max-w-6xl" style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(urls.length, 3)}, 1fr)`, gap: 16 }}>
          {urls.map(url => (
            <UrlCard key={url} url={url} measurements={urlGroups[url]} />
          ))}
        </div>
      )}
    </div>
  );
}
