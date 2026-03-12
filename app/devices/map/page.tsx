"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { MapPin, Edit2, X, List } from "lucide-react";
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
  image_version: string;
}

interface SiteGroup {
  site_name: string;
  lat: number;
  lng: number;
  devices: Device[];
  worstColor: string;
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

function deviceColor(device: Device): string {
  if (device.status === "provisioned") return "#6b7280";
  if (device.status === "unclaimed") return "#f59e0b";
  if (!device.last_seen) return "#6b7280";
  const mins = (Date.now() - new Date(device.last_seen).getTime()) / 60000;
  if (mins < 5) return "#22c55e";
  if (mins < 30) return "#f59e0b";
  return "#ef4444";
}

function deviceStatus(device: Device): string {
  if (device.status === "provisioned") return "Provisioned";
  if (device.status === "unclaimed") return "Unclaimed";
  if (!device.last_seen) return "Offline";
  const mins = (Date.now() - new Date(device.last_seen).getTime()) / 60000;
  if (mins < 5) return "Online";
  if (mins < 30) return "Idle";
  return "Offline";
}

function worstColor(devices: Device[]): string {
  const colors = devices.map(deviceColor);
  if (colors.includes("#ef4444")) return "#ef4444";
  if (colors.includes("#f59e0b")) return "#f59e0b";
  if (colors.includes("#22c55e")) return "#22c55e";
  return "#6b7280";
}

function groupBySite(devices: Device[]): SiteGroup[] {
  const map = new Map<string, SiteGroup>();
  for (const d of devices) {
    if (!d.lat || !d.lng) continue;
    const key = d.site_name || d.address || `${d.lat},${d.lng}`;
    if (!map.has(key)) {
      map.set(key, { site_name: d.site_name || d.address || "Unknown Site", lat: d.lat, lng: d.lng, devices: [], worstColor: "#6b7280" });
    }
    map.get(key)!.devices.push(d);
  }
  for (const site of map.values()) site.worstColor = worstColor(site.devices);
  return Array.from(map.values());
}

function EditDeviceModal({ device, onSave, onClose }: {
  device: Device;
  onSave: (updates: Record<string, string>) => Promise<void>;
  onClose: () => void;
}) {
  const [nickname, setNickname] = useState(device.nickname || "");
  const [address, setAddress] = useState(device.address || "");
  const [siteName, setSiteName] = useState(device.site_name || "");
  const [location, setLocation] = useState(device.location || "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await onSave({ nickname, address, site_name: siteName, location });
    setSaving(false);
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#111827", border: "1px solid #374151", borderRadius: 12, padding: 28, width: 420, boxShadow: "0 25px 50px rgba(0,0,0,0.5)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#f9fafb" }}>Edit Device</div>
            <div style={{ fontSize: 11, color: "#6b7280", fontFamily: "monospace", marginTop: 2 }}>{device.nr_serial}</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer" }}><X size={18} /></button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {[
            { label: "Nickname", value: nickname, set: setNickname, placeholder: "e.g. Pi Unit 1" },
            { label: "Site Name", value: siteName, set: setSiteName, placeholder: "e.g. Freehold HQ — devices sharing this name group on map" },
            { label: "Location", value: location, set: setLocation, placeholder: "e.g. Basement, 2nd Floor, Wiring Closet" },
            { label: "Address", value: address, set: setAddress, placeholder: "123 Main St, Freehold, NJ 07728" },
          ].map(({ label, value, set, placeholder }) => (
            <div key={label}>
              <label style={{ fontSize: 11, color: "#9ca3af", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 6 }}>{label}</label>
              <input value={value} onChange={e => set(e.target.value)} placeholder={placeholder}
                style={{ width: "100%", background: "#1f2937", border: "1px solid #374151", borderRadius: 8, padding: "10px 12px", color: "#f9fafb", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
            </div>
          ))}
          <div style={{ fontSize: 10, color: "#6b7280" }}>Devices with the same Site Name share a single map pin.</div>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "10px", background: "none", border: "1px solid #374151", borderRadius: 8, color: "#9ca3af", cursor: "pointer", fontSize: 14 }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ flex: 1, padding: "10px", background: "#2563eb", border: "none", borderRadius: 8, color: "#fff", cursor: saving ? "not-allowed" : "pointer", fontSize: 14, fontWeight: 600, opacity: saving ? 0.7 : 1 }}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SitePopup({ site, onEdit, onClose }: {
  site: SiteGroup;
  onEdit: (device: Device) => void;
  onClose: () => void;
}) {
  const router = useRouter();

  return (
    <div style={{
      position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)",
      background: "#111827", border: "1px solid #374151", borderRadius: 12,
      padding: 20, width: 380, boxShadow: "0 20px 40px rgba(0,0,0,0.6)", zIndex: 100,
      maxHeight: "70vh", overflowY: "auto"
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: site.worstColor }} />
            <span style={{ fontSize: 14, fontWeight: 700, color: "#f9fafb" }}>{site.site_name}</span>
            <span style={{ fontSize: 10, color: "#6b7280", background: "#1f2937", padding: "2px 8px", borderRadius: 10, fontFamily: "monospace" }}>
              {site.devices.length} device{site.devices.length !== 1 ? "s" : ""}
            </span>
          </div>
          {site.devices[0]?.address && (
            <div style={{ fontSize: 11, color: "#6b7280", paddingLeft: 18 }}>{site.devices[0].address}</div>
          )}
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer" }}><X size={16} /></button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {site.devices.map(device => {
          const dc = deviceColor(device);
          const ds = deviceStatus(device);
          return (
            <div key={device.device_id} style={{ background: "#1f2937", borderRadius: 10, padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: dc, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#f9fafb" }}>{device.nickname || device.nr_serial}</span>
                  </div>
                  <div style={{ paddingLeft: 13, display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 10, color: "#6b7280", fontFamily: "monospace" }}>{device.nr_serial}</span>
                    {device.location && (
                      <span style={{ fontSize: 10, color: "#9ca3af", background: "#374151", padding: "1px 6px", borderRadius: 4 }}>{device.location}</span>
                    )}
                    <span style={{ fontSize: 10, color: dc, background: `${dc}20`, padding: "1px 6px", borderRadius: 4 }}>{ds}</span>
                  </div>
                </div>
                <button onClick={() => onEdit(device)} style={{ background: "none", border: "1px solid #374151", borderRadius: 6, padding: "3px 7px", color: "#6b7280", cursor: "pointer" }}>
                  <Edit2 size={11} />
                </button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 8 }}>
                {[
                  { label: "Last Seen", value: timeSince(device.last_seen) },
                  { label: "IP", value: device.last_ip || "—" },
                ].map(({ label, value }) => (
                  <div key={label} style={{ background: "#111827", borderRadius: 6, padding: "6px 8px" }}>
                    <div style={{ fontSize: 9, color: "#6b7280", fontFamily: "monospace", textTransform: "uppercase", marginBottom: 2 }}>{label}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#e5e7eb", fontFamily: "monospace" }}>{value}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 5 }}>
                {[
                  { label: "RF", path: `/rfrunner/overview?device=${device.device_id}` },
                  { label: "Speed", path: `/speedrunner/overview?device=${device.device_id}` },
                  { label: "Web", path: `/webrunner/overview?device=${device.device_id}` },
                ].map(({ label, path }) => (
                  <button key={label} onClick={() => router.push(path)}
                    style={{ padding: "6px", background: "#1d4ed820", border: "1px solid #1d4ed840", borderRadius: 6, color: "#60a5fa", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>
                    {label} →
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function DevicesMapPage() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedSite, setSelectedSite] = useState<SiteGroup | null>(null);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const fetchDevices = useCallback(async () => {
    const res = await fetch("/api/devices");
    const data = await res.json();
    if (data.ok) setDevices(data.devices);
    setLoading(false);
  }, []);

  useEffect(() => { fetchDevices(); }, [fetchDevices]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if ((window as any).google?.maps) { initMap(); return; }
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
    script.async = true;
    script.onload = () => initMap();
    document.head.appendChild(script);
  }, []);

  function initMap() {
    if (!mapRef.current || mapInstanceRef.current) return;
    mapInstanceRef.current = new (window as any).google.maps.Map(mapRef.current, {
      center: { lat: 40.1726, lng: -74.3237 },
      zoom: 10,
      styles: [
        { elementType: "geometry", stylers: [{ color: "#1a1a2e" }] },
        { elementType: "labels.text.fill", stylers: [{ color: "#6b7280" }] },
        { elementType: "labels.text.stroke", stylers: [{ color: "#111827" }] },
        { featureType: "road", elementType: "geometry", stylers: [{ color: "#2d3748" }] },
        { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#4b5563" }] },
        { featureType: "water", elementType: "geometry", stylers: [{ color: "#0f172a" }] },
        { featureType: "poi", stylers: [{ visibility: "off" }] },
        { featureType: "transit", stylers: [{ visibility: "off" }] },
        { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#374151" }] },
      ],
      zoomControl: true,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
    });
  }

  useEffect(() => {
    if (!mapInstanceRef.current || devices.length === 0) return;
    const maps = (window as any).google?.maps;
    if (!maps) return;

    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];

    const sites = groupBySite(devices);
    const bounds = new maps.LatLngBounds();
    let hasCoords = false;

    sites.forEach(site => {
      hasCoords = true;
      const pos = { lat: site.lat, lng: site.lng };
      bounds.extend(pos);
      const count = site.devices.length;

      const marker = new maps.Marker({
        position: pos,
        map: mapInstanceRef.current,
        title: site.site_name,
        icon: {
          path: maps.SymbolPath.CIRCLE,
          scale: count > 1 ? 18 : 14,
          fillColor: site.worstColor,
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2.5,
        },
        label: count > 1 ? { text: String(count), color: "#ffffff", fontSize: "11px", fontWeight: "bold" } : undefined,
      });

      marker.addListener("click", () => setSelectedSite(site));
      markersRef.current.push(marker);
    });

    if (hasCoords) mapInstanceRef.current!.fitBounds(bounds);
  }, [devices, mapInstanceRef.current]);

  async function handleSave(updates: Record<string, string>) {
    if (!editingDevice) return;
    await fetch("/api/devices", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_id: editingDevice.device_id, ...updates }),
    });
    setEditingDevice(null);
    setSelectedSite(null);
    fetchDevices();
  }

  const sites = groupBySite(devices);
  const devicesWithout = devices.filter(d => !d.lat || !d.lng);

  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh", background: "#030712", overflow: "hidden" }}>
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, zIndex: 50,
        background: "rgba(3,7,18,0.9)", backdropFilter: "blur(12px)",
        borderBottom: "1px solid #1f2937", padding: "12px 20px",
        display: "flex", alignItems: "center", justifyContent: "space-between"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <MapPin size={18} style={{ color: "#3b82f6" }} />
          <span style={{ fontSize: 15, fontWeight: 700, color: "#f9fafb" }}>Device Map</span>
          <div style={{ fontSize: 11, color: "#6b7280", fontFamily: "monospace" }}>
            {loading ? "Loading…" : `${devices.length} device${devices.length !== 1 ? "s" : ""} · ${sites.length} site${sites.length !== 1 ? "s" : ""} · ${devicesWithout.length} unmapped`}
          </div>
        </div>
        <button onClick={() => router.push("/devices/list")}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", background: "#1f2937", border: "1px solid #374151", borderRadius: 8, color: "#9ca3af", cursor: "pointer", fontSize: 12 }}>
          <List size={13} /> List View
        </button>
      </div>

      <div ref={mapRef} style={{ width: "100%", height: "100%", paddingTop: 57 }} />

      {devicesWithout.length > 0 && (
        <div style={{
          position: "absolute", top: 72, left: 16, zIndex: 50,
          background: "rgba(17,24,39,0.95)", backdropFilter: "blur(8px)",
          border: "1px solid #374151", borderRadius: 10, padding: 12, minWidth: 220
        }}>
          <div style={{ fontSize: 10, color: "#6b7280", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>No Address Set</div>
          {devicesWithout.map(device => (
            <div key={device.device_id} onClick={() => setEditingDevice(device)}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", borderRadius: 8, cursor: "pointer", background: "#1f2937", marginBottom: 4 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#e5e7eb" }}>{device.nickname || device.nr_serial}</div>
                <div style={{ fontSize: 10, color: "#6b7280", fontFamily: "monospace" }}>{device.nr_serial}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4, color: "#3b82f6", fontSize: 11 }}>
                <Edit2 size={11} /> Add
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedSite && (
        <SitePopup site={selectedSite} onEdit={(device) => { setEditingDevice(device); setSelectedSite(null); }} onClose={() => setSelectedSite(null)} />
      )}

      {editingDevice && (
        <EditDeviceModal device={editingDevice} onSave={handleSave} onClose={() => setEditingDevice(null)} />
      )}
    </div>
  );
}
