"use client";
import { useEffect, useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  if (s === "online")  return "#10b981";
  if (s === "idle")    return "#f97316";
  if (s === "offline") return "#ef4444";
  return "#6b7280";
}

function fmtMs(v: number | null) {
  if (v === null) return "—";
  return v < 1000 ? `${v}ms` : `${(v / 1000).toFixed(1)}s`;
}

function fmtMbps(v: number | null) {
  if (v === null) return "—";
  return `${v} Mbps`;
}

function timeSince(iso: string | null) {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2)  return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── Compact Site Card (grid view) ───────────────────────────────────────────
function SiteCard({ site, onClick }: { site: SiteSummary; onClick: () => void }) {
  const color = statusColor(site.worst_status);
  const borderColor =
    site.worst_status === "offline" ? "rgba(239,68,68,0.45)" :
    site.worst_status === "idle"    ? "rgba(249,115,22,0.35)" :
    "rgba(55,65,81,0.7)";

  return (
    <div
      onClick={onClick}
      className="rounded-xl cursor-pointer transition-all duration-150"
      style={{ background: "#111827", border: `1px solid ${borderColor}` }}
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = color + "90"}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = borderColor}
    >
      {/* Card header */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="flex items-center gap-2 min-w-0">
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: color, flexShrink: 0, boxShadow: site.worst_status === "online" ? `0 0 8px ${color}` : "none" }} />
            <span className="text-sm font-bold text-gray-100 truncate tracking-wide">{site.site_name.toUpperCase()}</span>
          </div>
          <div className="text-[10px] font-mono px-2 py-0.5 rounded-full flex-shrink-0" style={{ color, background: `${color}15`, border: `1px solid ${color}30` }}>
            {site.devices_online}/{site.devices_total}
          </div>
        </div>
        {site.address && <div className="text-[10px] text-gray-600 pl-4 truncate">{site.address}</div>}
      </div>

      {/* Metrics grid */}
      <div className="px-3 pb-3 grid grid-cols-2 gap-1.5">
        {[
          { label: "AVG DNS",  value: fmtMs(site.avg_dns_ms),                alert: site.avg_dns_ms !== null && site.avg_dns_ms > 200 },
          { label: "AVG HTTP", value: fmtMs(site.avg_http_ms),               alert: site.avg_http_ms !== null && site.avg_http_ms > 500 },
          { label: "DOWN",     value: fmtMbps(site.avg_download_mbps),       alert: false },
          { label: "UP",       value: fmtMbps(site.avg_upload_mbps),         alert: false },
        ].map(({ label, value, alert }) => (
          <div key={label} className="rounded-lg px-2 py-1.5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
            <div className="text-[8px] font-mono text-gray-600 tracking-widest mb-0.5">{label}</div>
            <div className="text-xs font-mono font-bold" style={{ color: alert ? "#ef4444" : "#e5e7eb" }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-3 pb-3 flex items-center justify-between border-t border-gray-800 pt-2">
        <div className="text-[9px] font-mono text-gray-600">{site.devices_total} DEVICE{site.devices_total !== 1 ? "S" : ""}</div>
        <div className="text-[9px] font-mono px-2 py-0.5 rounded-full" style={{
          color: site.sla_alerts > 0 ? "#ef4444" : "#4b5563",
          background: site.sla_alerts > 0 ? "rgba(239,68,68,0.1)" : "transparent",
          border: `1px solid ${site.sla_alerts > 0 ? "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.06)"}`,
        }}>
          🔔 {site.sla_alerts} ALERTS
        </div>
      </div>
    </div>
  );
}

// ─── Appliance Card (site detail view) ───────────────────────────────────────
function ApplianceCard({ device, onClick }: { device: DeviceSummary; onClick: () => void }) {
  const color = statusColor(device.online_status);
  const borderColor =
    device.online_status === "offline" ? "rgba(239,68,68,0.4)" :
    device.online_status === "idle"    ? "rgba(249,115,22,0.3)" :
    "rgba(55,65,81,0.6)";

  return (
    <div
      onClick={onClick}
      className="rounded-xl cursor-pointer transition-all duration-150"
      style={{ background: "#111827", border: `1px solid ${borderColor}` }}
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = color + "80"}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = borderColor}
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-gray-800">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, boxShadow: device.online_status === "online" ? `0 0 6px ${color}` : "none" }} />
            <span className="text-sm font-semibold text-gray-100">{device.nickname || device.nr_serial}</span>
          </div>
          <span className="text-[10px] font-mono font-bold" style={{ color }}>{device.online_status.toUpperCase()}</span>
        </div>
        <div className="text-[10px] font-mono text-gray-500 pl-4">{device.nr_serial}</div>
        {device.location && <div className="text-[10px] text-gray-600 pl-4 mt-0.5">{device.location}</div>}
      </div>

      {/* Metrics */}
      <div className="p-3 grid grid-cols-2 gap-2">
        {[
          { label: "AVG DNS",  value: fmtMs(device.avg_dns_ms),       alert: device.avg_dns_ms !== null && device.avg_dns_ms > 200 },
          { label: "AVG HTTP", value: fmtMs(device.avg_http_ms),      alert: device.avg_http_ms !== null && device.avg_http_ms > 500 },
          { label: "DOWNLOAD", value: fmtMbps(device.download_mbps),  alert: false },
          { label: "UPLOAD",   value: fmtMbps(device.upload_mbps),    alert: false },
        ].map(({ label, value, alert }) => (
          <div key={label} className="rounded-lg px-2 py-2" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
            <div className="text-[8px] font-mono text-gray-600 tracking-widest mb-1">{label}</div>
            <div className="text-sm font-mono font-bold" style={{ color: alert ? "#ef4444" : "#e5e7eb" }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-3 pb-3 flex items-center justify-between">
        <div>
          <div className="text-[9px] font-mono text-gray-600">{timeSince(device.last_seen)}</div>
          {device.last_ip && <div className="text-[9px] font-mono text-gray-700 mt-0.5">{device.last_ip}</div>}
        </div>
        <div className="text-[9px] font-mono px-2 py-0.5 rounded-full" style={{
          color: device.sla_alerts > 0 ? "#ef4444" : "#4b5563",
          background: device.sla_alerts > 0 ? "rgba(239,68,68,0.1)" : "transparent",
          border: `1px solid ${device.sla_alerts > 0 ? "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.06)"}`,
        }}>
          🔔 {device.sla_alerts} ALERTS
        </div>
      </div>
    </div>
  );
}

// ─── Site Detail View ─────────────────────────────────────────────────────────
function SiteDetail({ site, onBack }: { site: SiteSummary; onBack: () => void }) {
  const router = useRouter();
  const color = statusColor(site.worst_status);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
      {/* Back button */}
      <div className="max-w-7xl mb-4">
        <button onClick={onBack} className="text-xs font-mono text-gray-500 px-3 py-1.5 rounded-lg cursor-pointer transition-colors"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
          ← NOC View
        </button>
      </div>

      {/* Site header */}
      <div className="max-w-7xl mb-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div style={{ width: 14, height: 14, borderRadius: "50%", background: color, boxShadow: `0 0 12px ${color}`, flexShrink: 0, marginTop: 4 }} />
            <div>
              <div className="text-[10px] font-mono tracking-widest mb-1" style={{ color: "#38bdf8" }}>NETRUNNER NOC · SITE DETAIL</div>
              <h1 className="text-3xl font-bold text-gray-100">{site.site_name.toUpperCase()}</h1>
              {site.address && <div className="text-sm text-gray-500 mt-1">{site.address}</div>}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-xs font-mono px-3 py-1.5 rounded-full font-bold" style={{ color, background: `${color}15`, border: `1px solid ${color}30` }}>
              {site.devices_online}/{site.devices_total} ONLINE
            </div>
            <div className="text-xs font-mono px-3 py-1.5 rounded-full" style={{ color: site.sla_alerts > 0 ? "#ef4444" : "#6b7280", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              🔔 {site.sla_alerts} ALERTS
            </div>
          </div>
        </div>

        {/* Site metrics summary */}
        <div className="grid grid-cols-4 gap-3 mt-5">
          {[
            { label: "AVG DNS",   value: fmtMs(site.avg_dns_ms),          alert: site.avg_dns_ms !== null && site.avg_dns_ms > 200 },
            { label: "AVG HTTP",  value: fmtMs(site.avg_http_ms),         alert: site.avg_http_ms !== null && site.avg_http_ms > 500 },
            { label: "AVG DOWN",  value: fmtMbps(site.avg_download_mbps), alert: false },
            { label: "AVG UP",    value: fmtMbps(site.avg_upload_mbps),   alert: false },
          ].map(({ label, value, alert }) => (
            <div key={label} className="rounded-xl border border-gray-700/60 bg-gray-900/60 px-5 py-4">
              <div className="text-[9px] font-mono text-gray-500 tracking-widest mb-2">{label}</div>
              <div className="text-2xl font-bold font-mono" style={{ color: alert ? "#ef4444" : "#f9fafb" }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Appliance grid */}
      <div className="max-w-7xl">
        <div className="text-[9px] font-mono text-gray-600 tracking-widest mb-3">
          APPLIANCES — {site.devices.length} DEVICE{site.devices.length !== 1 ? "S" : ""}
        </div>
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
          {site.devices.map(device => (
            <ApplianceCard
              key={device.device_id}
              device={device}
              onClick={() => router.push(`/webrunner/overview?device=${device.device_id}`)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Site Grid View ───────────────────────────────────────────────────────────
function SiteGrid({ sites, loading, lastUpdated, onRefresh, onSelectSite }: {
  sites: SiteSummary[];
  loading: boolean;
  lastUpdated: Date;
  onRefresh: () => void;
  onSelectSite: (site: SiteSummary) => void;
}) {
  const [filter, setFilter]   = useState<"all" | "online" | "idle" | "offline">("all");
  const [search, setSearch]   = useState("");

  const filtered = sites.filter(s => {
    if (filter !== "all" && s.worst_status !== filter) return false;
    if (search && !s.site_name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalOnline  = sites.reduce((a, s) => a + s.devices_online,  0);
  const totalIdle    = sites.reduce((a, s) => a + s.devices_idle,    0);
  const totalOffline = sites.reduce((a, s) => a + s.devices_offline, 0);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
      {/* Back to dashboard */}
      <div className="max-w-7xl mb-4">
        <Link href="/dashboard" className="text-xs font-mono text-gray-500 px-3 py-1.5 rounded-lg"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", textDecoration: "none", display: "inline-block" }}>
          ← Dashboard
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-6 max-w-7xl">
        <div>
          <div className="text-[10px] font-mono tracking-widest mb-1" style={{ color: "#38bdf8" }}>NETRUNNER NOC</div>
          <h1 style={{ color: "#ffffff", fontSize: 28, fontWeight: 700, margin: 0, lineHeight: 1.2 }}>NOC View</h1>
          <p className="text-xs font-mono text-gray-500 mt-1">
            Updated {lastUpdated.toLocaleTimeString()} · Auto-refresh 30s · 1hr averages
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap justify-end">
          {[
            { label: "ONLINE",  count: totalOnline,  color: "#10b981" },
            { label: "IDLE",    count: totalIdle,    color: "#f97316" },
            { label: "OFFLINE", count: totalOffline, color: "#ef4444" },
          ].map(({ label, count, color }) => (
            <div key={label} className="flex items-center gap-2 text-xs font-mono font-bold px-3 py-1.5 rounded-full"
              style={{ color, background: `${color}12`, border: `1px solid ${color}30` }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, display: "inline-block" }} />
              {count} {label}
            </div>
          ))}
          <button onClick={() => onRefresh()} className="px-3 py-1.5 rounded-lg text-xs font-mono text-gray-500 cursor-pointer"
            style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.08)" }}>
            ↻ REFRESH
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="max-w-7xl flex items-center gap-3 mb-5">
        {(["all", "online", "idle", "offline"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className="text-xs font-mono px-4 py-1.5 rounded-lg cursor-pointer transition-all capitalize"
            style={{
              background: filter === f ? "rgba(56,189,248,0.1)" : "rgba(255,255,255,0.03)",
              border: `1px solid ${filter === f ? "rgba(56,189,248,0.4)" : "rgba(255,255,255,0.08)"}`,
              color: filter === f ? "#38bdf8" : "#6b7280",
              fontWeight: filter === f ? 700 : 400,
            }}>
            {f.toUpperCase()}
            {f !== "all" && (
              <span className="ml-1.5 text-[9px] opacity-60">
                ({sites.filter(s => s.worst_status === f).length})
              </span>
            )}
          </button>
        ))}
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search sites..."
          className="ml-auto text-xs font-mono px-3 py-1.5 rounded-lg outline-none"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#e5e7eb", width: 200 }}
        />
      </div>

      {/* Site grid */}
      <div className="max-w-7xl">
        {loading ? (
          <div className="rounded-xl border border-gray-700/60 bg-gray-900/60 p-16 text-center">
            <div className="text-xs font-mono text-gray-600 tracking-widest">LOADING FLEET...</div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-gray-700/60 bg-gray-900/60 p-16 text-center">
            <div className="text-xs font-mono text-gray-600">NO SITES MATCH YOUR FILTER</div>
          </div>
        ) : (
          <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
            {filtered.map(site => (
              <SiteCard key={site.site_name} site={site} onClick={() => onSelectSite(site)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
function NOCPageInner() {
  const [sites, setSites]           = useState<SiteSummary[]>([]);
  const [loading, setLoading]       = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [selectedSite, setSelectedSite] = useState<SiteSummary | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();

  const fetchNOC = useCallback(async () => {
    const res  = await fetch("/api/noc/summary");
    const data = await res.json();
    if (data.ok) {
      setSites(data.sites);
      setLastUpdated(new Date());
      // If we have a site param, update the selected site with fresh data
      const siteParam = searchParams.get("site");
      if (siteParam) {
        const found = data.sites.find((s: SiteSummary) => s.site_name === decodeURIComponent(siteParam));
        if (found) setSelectedSite(found);
      }
    }
    setLoading(false);
  }, [searchParams]);

  useEffect(() => {
    fetchNOC();
    const t = setInterval(fetchNOC, 30000);
    return () => clearInterval(t);
  }, [fetchNOC]);

  // Sync selectedSite with URL
  useEffect(() => {
    const siteParam = searchParams.get("site");
    if (siteParam && sites.length > 0) {
      const found = sites.find(s => s.site_name === decodeURIComponent(siteParam));
      if (found) setSelectedSite(found);
    } else if (!siteParam) {
      setSelectedSite(null);
    }
  }, [searchParams, sites]);

  function handleSelectSite(site: SiteSummary) {
    setSelectedSite(site);
    router.push(`/noc?site=${encodeURIComponent(site.site_name)}`, { scroll: false });
  }

  function handleBack() {
    setSelectedSite(null);
    router.push("/noc", { scroll: false });
  }

  if (selectedSite) {
    return <SiteDetail site={selectedSite} onBack={handleBack} />;
  }

  return (
    <SiteGrid
      sites={sites}
      loading={loading}
      lastUpdated={lastUpdated}
      onRefresh={fetchNOC}
      onSelectSite={handleSelectSite}
    />
  );
}

export default function NOCPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-xs font-mono text-gray-600 tracking-widest">LOADING...</div>
      </div>
    }>
      <NOCPageInner />
    </Suspense>
  );
}
