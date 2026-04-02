"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type DeviceSummary = {
  device_id: string;
  nr_serial: string;
  nickname: string | null;
  location: string | null;
  last_seen: string | null;
  last_ip: string | null;
  agent_version: string | null;
  online_status: "online" | "idle" | "offline" | "unclaimed";
  avg_dns_ms: number | null;
  avg_http_ms: number | null;
  download_mbps: number | null;
  upload_mbps: number | null;
  ping_ms: number | null;
  sla_alerts: number;
};

type SiteSummary = {
  site_name: string;
  address: string | null;
  devices_total: number;
  devices_online: number;
  devices_idle: number;
  devices_offline: number;
  worst_status: "online" | "idle" | "offline" | "unclaimed";
  avg_dns_ms: number | null;
  avg_http_ms: number | null;
  avg_download_mbps: number | null;
  avg_upload_mbps: number | null;
  sla_alerts: number;
  devices: DeviceSummary[];
};

function statusColor(s: string) {
  if (s === "online")   return "#10b981";
  if (s === "idle")     return "#f97316";
  if (s === "offline")  return "#ef4444";
  return "#6b7280";
}

function fmtMs(v: number | null) {
  if (v === null) return "—";
  return v < 1000 ? `${v}ms` : `${(v/1000).toFixed(1)}s`;
}

function fmtMbps(v: number | null) {
  if (v === null) return "—";
  return `${v}`;
}

function timeSince(iso: string | null) {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2)  return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs/24)}d ago`;
}

function ApplianceCard({ device, onClick }: { device: DeviceSummary; onClick: () => void }) {
  const color = statusColor(device.online_status);
  const name  = device.nickname || device.nr_serial;

  return (
    <div
      onClick={onClick}
      className="rounded-lg border bg-gray-900/60 cursor-pointer transition-all"
      style={{ borderColor: device.online_status === "offline" ? "rgba(239,68,68,0.4)" : device.online_status === "idle" ? "rgba(249,115,22,0.4)" : "rgba(55,65,81,0.6)" }}
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = color + "80"}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = device.online_status === "offline" ? "rgba(239,68,68,0.4)" : device.online_status === "idle" ? "rgba(249,115,22,0.4)" : "rgba(55,65,81,0.6)"}
    >
      {/* Card header */}
      <div className="px-4 pt-4 pb-3 border-b border-gray-700/60">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, boxShadow: device.online_status === "online" ? `0 0 6px ${color}` : "none" }} />
            <span className="text-sm font-semibold text-gray-100">{name}</span>
          </div>
          <span className="text-xs font-mono font-bold" style={{ color }}>{device.online_status.toUpperCase()}</span>
        </div>
        <div className="text-xs font-mono text-gray-500 pl-4">{device.nr_serial}</div>
        {device.location && <div className="text-xs text-gray-600 pl-4 mt-0.5">{device.location}</div>}
      </div>

      {/* Metrics */}
      <div className="p-3 grid grid-cols-2 gap-2">
        {[
          { label: "AVG DNS",      value: fmtMs(device.avg_dns_ms),            alert: device.avg_dns_ms !== null && device.avg_dns_ms > 200 },
          { label: "AVG HTTP",     value: fmtMs(device.avg_http_ms),           alert: device.avg_http_ms !== null && device.avg_http_ms > 500 },
          { label: "DOWNLOAD",     value: device.download_mbps ? `${fmtMbps(device.download_mbps)} Mbps` : "—", alert: false },
          { label: "UPLOAD",       value: device.upload_mbps   ? `${fmtMbps(device.upload_mbps)} Mbps`   : "—", alert: false },
        ].map(({ label, value, alert }) => (
          <div key={label} className="rounded bg-gray-950/80 px-2 py-2">
            <div className="text-[9px] font-mono text-gray-600 tracking-widest mb-1">{label}</div>
            <div className="text-sm font-mono font-bold" style={{ color: alert ? "#ef4444" : "#e5e7eb" }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-3 pb-3 flex items-center justify-between">
        <div className="text-[10px] font-mono text-gray-600">{timeSince(device.last_seen)}</div>
        <div
          className="text-[10px] font-mono px-2 py-0.5 rounded-full"
          style={{
            color: device.sla_alerts > 0 ? "#ef4444" : "#6b7280",
            background: device.sla_alerts > 0 ? "rgba(239,68,68,0.1)" : "rgba(255,255,255,0.04)",
            border: `1px solid ${device.sla_alerts > 0 ? "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.08)"}`,
          }}
        >
          🔔 {device.sla_alerts} ALERTS
        </div>
      </div>
    </div>
  );
}

function SiteCard({ site }: { site: SiteSummary }) {
  const [expanded, setExpanded] = useState(false);
  const router = useRouter();
  const color = statusColor(site.worst_status);

  return (
    <div
      className="rounded-xl border transition-all"
      style={{ borderColor: site.worst_status === "offline" ? "rgba(239,68,68,0.4)" : site.worst_status === "idle" ? "rgba(249,115,22,0.3)" : "rgba(55,65,81,0.6)", background: "#111827" }}
    >
      {/* Site header */}
      <div
        className="p-5 cursor-pointer"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-start justify-between">
          {/* Left: site name + address */}
          <div className="flex items-center gap-3">
            <div style={{ width: 12, height: 12, borderRadius: "50%", background: color, boxShadow: site.worst_status === "online" ? `0 0 10px ${color}` : "none", flexShrink: 0, marginTop: 2 }} />
            <div>
              <div className="text-base font-bold text-gray-100 tracking-wide">{site.site_name.toUpperCase()}</div>
              {site.address && <div className="text-xs text-gray-500 mt-0.5">{site.address}</div>}
            </div>
          </div>

          {/* Right: device count + expand */}
          <div className="flex items-center gap-3">
            <div className="text-xs font-mono px-3 py-1 rounded-full" style={{ color, background: `${color}15`, border: `1px solid ${color}30` }}>
              {site.devices_online}/{site.devices_total} ONLINE
            </div>
            <div className="text-[10px] font-mono px-2 py-1 rounded-full" style={{ color: site.sla_alerts > 0 ? "#ef4444" : "#6b7280", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              🔔 {site.sla_alerts} ALERTS
            </div>
            <div className="text-gray-600 text-xs transition-transform duration-200" style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}>▼</div>
          </div>
        </div>

        {/* Site metrics row */}
        <div className="mt-4 grid grid-cols-4 gap-3">
          {[
            { label: "AVG DNS",    value: fmtMs(site.avg_dns_ms),                                        alert: site.avg_dns_ms !== null && site.avg_dns_ms > 200 },
            { label: "AVG HTTP",   value: fmtMs(site.avg_http_ms),                                       alert: site.avg_http_ms !== null && site.avg_http_ms > 500 },
            { label: "DOWNLOAD",   value: site.avg_download_mbps ? `${fmtMbps(site.avg_download_mbps)} Mbps` : "—", alert: false },
            { label: "UPLOAD",     value: site.avg_upload_mbps   ? `${fmtMbps(site.avg_upload_mbps)} Mbps`   : "—", alert: false },
          ].map(({ label, value, alert }) => (
            <div key={label} className="rounded-lg border border-gray-700/60 bg-gray-900/60 px-4 py-3">
              <div className="text-[9px] font-mono text-gray-500 tracking-widest mb-1.5">{label}</div>
              <div className="text-xl font-bold font-mono" style={{ color: alert ? "#ef4444" : "#f9fafb" }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Expanded appliance grid */}
      {expanded && (
        <div className="px-5 pb-5 border-t border-gray-700/40 pt-4">
          <div className="text-[9px] font-mono text-gray-600 tracking-widest mb-3">APPLIANCES — {site.devices.length} DEVICE{site.devices.length !== 1 ? "S" : ""}</div>
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
            {site.devices.map(device => (
              <ApplianceCard
                key={device.device_id}
                device={device}
                onClick={() => router.push(`/webrunner/overview?device=${device.device_id}`)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function NOCPage() {
  const [sites, setSites]           = useState<SiteSummary[]>([]);
  const [loading, setLoading]       = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const router = useRouter();

  const fetchNOC = useCallback(async () => {
    const res  = await fetch("/api/noc/summary");
    const data = await res.json();
    if (data.ok) { setSites(data.sites); setLastUpdated(new Date()); }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchNOC();
    const t = setInterval(fetchNOC, 30000);
    return () => clearInterval(t);
  }, [fetchNOC]);

  const totalOnline  = sites.reduce((a, s) => a + s.devices_online,  0);
  const totalIdle    = sites.reduce((a, s) => a + s.devices_idle,    0);
  const totalOffline = sites.reduce((a, s) => a + s.devices_offline, 0);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
      {/* Header */}
      <div className="max-w-6xl mb-4">
        <Link href="/dashboard" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "#6b7280", textDecoration: "none", padding: "5px 10px", borderRadius: 6, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>← Dashboard</Link>
      </div>
      <div className="flex items-start justify-between mb-6 max-w-6xl">
        <div>
          <div className="text-[10px] font-mono text-blue-400 tracking-widest mb-1">NETRUNNER NOC</div>
          <h1 style={{ color: "#ffffff", fontSize: 24, fontWeight: 700, margin: 0 }}>NOC View</h1>
          <p className="text-xs font-mono text-gray-500 mt-1">
            Updated {lastUpdated.toLocaleTimeString()} · Auto-refresh 30s · 1hr averages
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Status pills */}
          {[
            { label: "ONLINE",  count: totalOnline,  color: "#10b981" },
            { label: "IDLE",    count: totalIdle,    color: "#f97316" },
            { label: "OFFLINE", count: totalOffline, color: "#ef4444" },
          ].map(({ label, count, color }) => (
            <div key={label} className="flex items-center gap-2 text-xs font-mono font-bold px-3 py-1.5 rounded-full" style={{ color, background: `${color}12`, border: `1px solid ${color}30` }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, display: "inline-block" }} />
              {count} {label}
            </div>
          ))}

          <button onClick={() => router.push("/devices/map")} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-400 cursor-pointer" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}>
            🗺 Map View
          </button>

          <button onClick={fetchNOC} className="px-3 py-1.5 rounded-lg text-xs font-mono text-gray-500 cursor-pointer" style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.08)" }}>
            ↻ REFRESH
          </button>
        </div>
      </div>

      {/* Site cards */}
      <div className="max-w-6xl grid grid-cols-1 xl:grid-cols-2 gap-4">
        {loading ? (
          <div className="rounded-xl border border-gray-700/60 bg-gray-900/60 p-16 text-center">
            <div className="text-xs font-mono text-gray-600 tracking-widest">LOADING FLEET...</div>
          </div>
        ) : sites.length === 0 ? (
          <div className="rounded-xl border border-gray-700/60 bg-gray-900/60 p-16 text-center">
            <div className="text-xs font-mono text-gray-600">NO SITES FOUND — CONFIGURE DEVICES IN DEVICE SETUP</div>
          </div>
        ) : (
          sites.map(site => <SiteCard key={site.site_name} site={site} />)
        )}
      </div>
    </div>
  );
}
