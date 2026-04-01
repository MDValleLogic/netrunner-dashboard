"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

interface Device {
  device_id: string;
  nr_serial: string;
  status: string;
  nickname: string | null;
  site_name: string | null;
  location: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  agent_version: string | null;
  last_seen: string | null;
  last_ip: string | null;
  image_version: string | null;
}

interface SiteTile {
  site_name: string;
  address: string | null;
  devices: Device[];
  worstStatus: "online" | "idle" | "offline" | "unclaimed";
}

function getDeviceStatus(device: Device): "online" | "idle" | "offline" | "unclaimed" {
  if (device.status === "provisioned" || device.status === "unclaimed") return "unclaimed";
  if (!device.last_seen) return "offline";
  const mins = (Date.now() - new Date(device.last_seen).getTime()) / 60000;
  if (mins < 5) return "online";
  if (mins < 30) return "idle";
  return "offline";
}

function getStatusColor(status: "online" | "idle" | "offline" | "unclaimed"): string {
  if (status === "online") return "#22c55e";
  if (status === "idle") return "#f59e0b";
  if (status === "offline") return "#ef4444";
  return "#6b7280";
}

function getStatusLabel(status: "online" | "idle" | "offline" | "unclaimed"): string {
  if (status === "online") return "ONLINE";
  if (status === "idle") return "IDLE";
  if (status === "offline") return "OFFLINE";
  return "UNCLAIMED";
}

function worstStatus(devices: Device[]): "online" | "idle" | "offline" | "unclaimed" {
  const statuses = devices.map(getDeviceStatus);
  if (statuses.includes("offline")) return "offline";
  if (statuses.includes("idle")) return "idle";
  if (statuses.includes("online")) return "online";
  return "unclaimed";
}

function timeSince(iso: string | null): string {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function groupBySite(devices: Device[]): SiteTile[] {
  const map = new Map<string, SiteTile>();
  for (const d of devices) {
    const key = d.site_name || "Unassigned";
    if (!map.has(key)) {
      map.set(key, {
        site_name: key,
        address: d.address,
        devices: [],
        worstStatus: "unclaimed",
      });
    }
    map.get(key)!.devices.push(d);
  }
  for (const site of map.values()) {
    site.worstStatus = worstStatus(site.devices);
  }
  // Sort: online first, then idle, then offline, then unclaimed
  const order = { online: 0, idle: 1, offline: 2, unclaimed: 3 };
  return Array.from(map.values()).sort((a, b) => order[a.worstStatus] - order[b.worstStatus]);
}

function SiteTile({ site }: { site: SiteTile }) {
  const [expanded, setExpanded] = useState(true);
  const router = useRouter();
  const color = getStatusColor(site.worstStatus);
  const onlineCount = site.devices.filter(d => getDeviceStatus(d) === "online").length;
  const totalCount = site.devices.length;

  return (
    <div style={{
      background: "#0d1117",
      border: `1px solid ${site.worstStatus === "offline" ? "rgba(239,68,68,0.3)" : site.worstStatus === "idle" ? "rgba(245,158,11,0.3)" : "rgba(255,255,255,0.08)"}`,
      borderRadius: 12,
      overflow: "hidden",
      transition: "all 0.2s",
    }}>
      {/* Tile Header */}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px", cursor: "pointer",
          background: expanded ? "rgba(255,255,255,0.02)" : "transparent",
          borderBottom: expanded ? "1px solid rgba(255,255,255,0.06)" : "none",
          transition: "background 0.15s",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* Status dot */}
          <div style={{
            width: 10, height: 10, borderRadius: "50%",
            background: color,
            boxShadow: site.worstStatus === "online" ? `0 0 8px ${color}` : "none",
            flexShrink: 0,
          }} />
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#f9fafb", letterSpacing: "0.01em" }}>
              {site.site_name.toUpperCase()}
            </div>
            {site.address && (
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{site.address}</div>
            )}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Device count badge */}
          <div style={{
            fontSize: 11, fontFamily: "monospace",
            color: color, background: `${color}15`,
            border: `1px solid ${color}30`,
            padding: "3px 10px", borderRadius: 20,
          }}>
            {onlineCount}/{totalCount} ONLINE
          </div>

          {/* Alert badge — future SLA */}
          <div style={{
            fontSize: 10, fontFamily: "monospace",
            color: "#6b7280", background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            padding: "3px 8px", borderRadius: 20,
          }}>
            🔔 0 ALERTS
          </div>

          {/* Expand chevron */}
          <div style={{
            color: "#6b7280", fontSize: 12, transition: "transform 0.2s",
            transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
          }}>▼</div>
        </div>
      </div>

      {/* Device rows */}
      {expanded && (
        <div>
          {site.devices.map((device, i) => {
            const ds = getDeviceStatus(device);
            const dc = getStatusColor(ds);
            const displayName = device.nickname || device.nr_serial;

            return (
              <div
                key={device.device_id}
                onClick={() => router.push(`/webrunner/overview?device=${device.device_id}`)}
                style={{
                  display: "grid",
                  gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 80px",
                  alignItems: "center",
                  padding: "12px 20px",
                  borderBottom: i < site.devices.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                  cursor: "pointer",
                  transition: "background 0.1s",
                  gap: 8,
                }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)"}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
              >
                {/* Device name */}
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{
                    width: 7, height: 7, borderRadius: "50%",
                    background: dc, flexShrink: 0,
                    boxShadow: ds === "online" ? `0 0 6px ${dc}` : "none",
                  }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#e5e7eb" }}>{displayName}</div>
                    {device.location && (
                      <div style={{ fontSize: 10, color: "#6b7280", marginTop: 1 }}>{device.location}</div>
                    )}
                  </div>
                </div>

                {/* Serial */}
                <div style={{ fontFamily: "monospace", fontSize: 11, color: "#38bdf8" }}>
                  {device.nr_serial}
                </div>

                {/* Status */}
                <div style={{
                  fontFamily: "monospace", fontSize: 10, fontWeight: 700,
                  color: dc, letterSpacing: "0.05em",
                }}>
                  {getStatusLabel(ds)}
                </div>

                {/* Last seen */}
                <div style={{ fontFamily: "monospace", fontSize: 11, color: "#9ca3af" }}>
                  {timeSince(device.last_seen)}
                </div>

                {/* IP */}
                <div style={{ fontFamily: "monospace", fontSize: 11, color: "#6b7280" }}>
                  {device.last_ip || "—"}
                </div>

                {/* Agent */}
                <div style={{ fontFamily: "monospace", fontSize: 10, color: "#4b5563", textAlign: "right" }}>
                  v{device.agent_version || "—"}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function NOCPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const router = useRouter();

  const fetchDevices = useCallback(async () => {
    const res = await fetch("/api/devices");
    const data = await res.json();
    if (data.ok) {
      setDevices(data.devices);
      setLastUpdated(new Date());
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchDevices();
    const interval = setInterval(fetchDevices, 30000); // auto-refresh every 30s
    return () => clearInterval(interval);
  }, [fetchDevices]);

  const sites = groupBySite(devices.filter(d => d.status !== "provisioned" && d.status !== "unclaimed" || d.nickname));
  const onlineCount = devices.filter(d => getDeviceStatus(d) === "online").length;
  const offlineCount = devices.filter(d => getDeviceStatus(d) === "offline").length;
  const idleCount = devices.filter(d => getDeviceStatus(d) === "idle").length;

  return (
    <div style={{ padding: "32px", maxWidth: 1100, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 }}>
        <div>
          <div style={{ fontFamily: "monospace", fontSize: 10, color: "#38bdf8", letterSpacing: "3px", marginBottom: 6 }}>
            NETRUNNER NOC
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#f9fafb", margin: 0 }}>
            NOC View
          </h1>
          <p style={{ fontSize: 13, color: "#6b7280", marginTop: 6, fontFamily: "monospace" }}>
            Updated {lastUpdated.toLocaleTimeString()} · Auto-refresh 30s
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {/* Summary pills */}
          <div style={{ display: "flex", gap: 8 }}>
            {[
              { label: "ONLINE", count: onlineCount, color: "#22c55e" },
              { label: "IDLE", count: idleCount, color: "#f59e0b" },
              { label: "OFFLINE", count: offlineCount, color: "#ef4444" },
            ].map(({ label, count, color }) => (
              <div key={label} style={{
                fontFamily: "monospace", fontSize: 11, fontWeight: 700,
                color, background: `${color}12`,
                border: `1px solid ${color}30`,
                padding: "5px 12px", borderRadius: 20,
                display: "flex", alignItems: "center", gap: 6,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, display: "inline-block" }} />
                {count} {label}
              </div>
            ))}
          </div>

          {/* Map View button */}
          <button
            onClick={() => router.push("/devices/map")}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "7px 14px", background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8,
              color: "#9ca3af", cursor: "pointer", fontSize: 12, fontWeight: 600,
              fontFamily: "inherit",
            }}
          >
            🗺 Map View
          </button>

          <button
            onClick={fetchDevices}
            style={{
              padding: "7px 14px", background: "transparent",
              border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8,
              color: "#6b7280", cursor: "pointer", fontSize: 12,
              fontFamily: "monospace", letterSpacing: "1px",
            }}
          >
            ↻ REFRESH
          </button>
        </div>
      </div>

      {/* Column headers */}
      {!loading && sites.length > 0 && (
        <div style={{
          display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 80px",
          padding: "6px 20px", marginBottom: 8, gap: 8,
          fontFamily: "monospace", fontSize: 9, color: "#4b5563", letterSpacing: "2px",
        }}>
          <span>DEVICE</span>
          <span>SERIAL</span>
          <span>STATUS</span>
          <span>LAST SEEN</span>
          <span>IP</span>
          <span style={{ textAlign: "right" }}>AGENT</span>
        </div>
      )}

      {/* Site tiles */}
      {loading ? (
        <div style={{ padding: 64, textAlign: "center", fontFamily: "monospace", fontSize: 11, color: "#4b5563", letterSpacing: "2px" }}>
          LOADING FLEET...
        </div>
      ) : sites.length === 0 ? (
        <div style={{ padding: 64, textAlign: "center", fontFamily: "monospace", fontSize: 11, color: "#4b5563" }}>
          NO DEVICES FOUND — ADD A DEVICE IN DEVICE SETUP
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {sites.map(site => (
            <SiteTile key={site.site_name} site={site} />
          ))}
        </div>
      )}
    </div>
  );
}
