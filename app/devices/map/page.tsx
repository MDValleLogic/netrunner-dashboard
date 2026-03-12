"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { MapPin, Wifi, Activity, Shield, Clock, Edit2, X, Check, List } from "lucide-react";
import { useRouter } from "next/navigation";

interface Device {
  device_id: string;
  nr_serial: string;
  status: string;
  nickname: string | null;
  site_name: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  agent_version: string | null;
  last_seen: string | null;
  last_ip: string | null;
  image_version: string;
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

function statusColor(device: Device): string {
  if (device.status === "provisioned") return "#6b7280";
  if (device.status === "unclaimed") return "#f59e0b";
  if (!device.last_seen) return "#6b7280";
  const mins = (Date.now() - new Date(device.last_seen).getTime()) / 60000;
  if (mins < 5) return "#22c55e";
  if (mins < 30) return "#f59e0b";
  return "#ef4444";
}

function statusLabel(device: Device): string {
  if (device.status === "provisioned") return "Provisioned";
  if (device.status === "unclaimed") return "Unclaimed";
  if (!device.last_seen) return "Offline";
  const mins = (Date.now() - new Date(device.last_seen).getTime()) / 60000;
  if (mins < 5) return "Online";
  if (mins < 30) return "Idle";
  return "Offline";
}

// Edit modal component
function EditDeviceModal({ device, onSave, onClose }: {
  device: Device;
  onSave: (updates: { nickname?: string; address?: string; site_name?: string }) => Promise<void>;
  onClose: () => void;
}) {
  const [nickname, setNickname] = useState(device.nickname || "");
  const [address, setAddress] = useState(device.address || "");
  const [siteName, setSiteName] = useState(device.site_name || "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await onSave({ nickname, address, site_name: siteName });
    setSaving(false);
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center"
    }}>
      <div style={{
        background: "#111827", border: "1px solid #374151", borderRadius: 12,
        padding: 28, width: 420, boxShadow: "0 25px 50px rgba(0,0,0,0.5)"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#f9fafb" }}>Edit Device</div>
            <div style={{ fontSize: 11, color: "#6b7280", fontFamily: "monospace", marginTop: 2 }}>{device.nr_serial}</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer" }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ fontSize: 11, color: "#9ca3af", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 6 }}>
              Nickname
            </label>
            <input
              value={nickname}
              onChange={e => setNickname(e.target.value)}
              placeholder="e.g. Office Closet, Warehouse AP"
              style={{
                width: "100%", background: "#1f2937", border: "1px solid #374151",
                borderRadius: 8, padding: "10px 12px", color: "#f9fafb", fontSize: 14,
                outline: "none", boxSizing: "border-box"
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: 11, color: "#9ca3af", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 6 }}>
              Site Name
            </label>
            <input
              value={siteName}
              onChange={e => setSiteName(e.target.value)}
              placeholder="e.g. Acme Corp HQ, Branch Office"
              style={{
                width: "100%", background: "#1f2937", border: "1px solid #374151",
                borderRadius: 8, padding: "10px 12px", color: "#f9fafb", fontSize: 14,
                outline: "none", boxSizing: "border-box"
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: 11, color: "#9ca3af", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 6 }}>
              Address
            </label>
            <input
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="123 Main St, Freehold, NJ 07728"
              style={{
                width: "100%", background: "#1f2937", border: "1px solid #374151",
                borderRadius: 8, padding: "10px 12px", color: "#f9fafb", fontSize: 14,
                outline: "none", boxSizing: "border-box"
              }}
            />
            <div style={{ fontSize: 10, color: "#6b7280", marginTop: 4 }}>Address will be geocoded and placed on the map</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: "10px", background: "none", border: "1px solid #374151",
              borderRadius: 8, color: "#9ca3af", cursor: "pointer", fontSize: 14
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              flex: 1, padding: "10px", background: "#2563eb", border: "none",
              borderRadius: 8, color: "#fff", cursor: saving ? "not-allowed" : "pointer",
              fontSize: 14, fontWeight: 600, opacity: saving ? 0.7 : 1
            }}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Device popup card shown on map
function DevicePopup({ device, onEdit, onClose }: {
  device: Device;
  onEdit: () => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const color = statusColor(device);
  const label = statusLabel(device);

  return (
    <div style={{
      position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)",
      background: "#111827", border: "1px solid #374151", borderRadius: 12,
      padding: 20, width: 320, boxShadow: "0 20px 40px rgba(0,0,0,0.6)", zIndex: 100
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: "#f9fafb" }}>
              {device.nickname || device.nr_serial}
            </span>
            <span style={{ fontSize: 10, color, fontFamily: "monospace", background: `${color}20`, padding: "2px 6px", borderRadius: 4 }}>
              {label}
            </span>
          </div>
          <div style={{ fontSize: 11, color: "#6b7280", fontFamily: "monospace" }}>{device.nr_serial}</div>
          {device.site_name && (
            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{device.site_name}</div>
          )}
          {device.address && (
            <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{device.address}</div>
          )}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={onEdit} style={{ background: "none", border: "1px solid #374151", borderRadius: 6, padding: "4px 8px", color: "#9ca3af", cursor: "pointer" }}>
            <Edit2 size={12} />
          </button>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer" }}>
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
        {[
          { icon: <Clock size={12} />, label: "Last Seen", value: timeSince(device.last_seen) },
          { icon: <Activity size={12} />, label: "Agent", value: device.agent_version || "—" },
          { icon: <MapPin size={12} />, label: "IP", value: device.last_ip || "—" },
          { icon: <Wifi size={12} />, label: "Image", value: device.image_version || "—" },
        ].map(({ icon, label, value }) => (
          <div key={label} style={{ background: "#1f2937", borderRadius: 8, padding: "8px 10px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4, color: "#6b7280", marginBottom: 3 }}>
              {icon}
              <span style={{ fontSize: 9, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#e5e7eb", fontFamily: "monospace" }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
        {[
          { label: "RF", path: `/rfrunner/overview?device=${device.device_id}` },
          { label: "Speed", path: `/speedrunner/overview?device=${device.device_id}` },
          { label: "Web", path: `/webrunner/overview?device=${device.device_id}` },
        ].map(({ label, path }) => (
          <button
            key={label}
            onClick={() => router.push(path)}
            style={{
              padding: "8px", background: "#1d4ed820", border: "1px solid #1d4ed840",
              borderRadius: 8, color: "#60a5fa", cursor: "pointer", fontSize: 12, fontWeight: 600
            }}
          >
            {label} →
          </button>
        ))}
      </div>
    </div>
  );
}

export default function DevicesMapPage() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
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

  // Load Google Maps script
  useEffect(() => {
    if (typeof window === "undefined") return;
    if ((window as any).google?.maps) { initMap(); return; }

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.onload = () => initMap();
    document.head.appendChild(script);
  }, []);

  function initMap() {
    if (!mapRef.current || mapInstanceRef.current) return;
    mapInstanceRef.current = new (window as any).google.maps.Map(mapRef.current, {
      center: { lat: 40.1726, lng: -74.3237 }, // Freehold, NJ
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
      disableDefaultUI: false,
      zoomControl: true,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
    });
  }

  // Place markers when devices + map are ready
  useEffect(() => {
    if (!mapInstanceRef.current || devices.length === 0) return;
    const maps = (window as any).google?.maps;
    if (!maps) return;

    // Clear existing markers
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];

    const bounds = new maps.LatLngBounds();
    let hasCoords = false;

    devices.forEach(device => {
      if (!device.lat || !device.lng) return;
      hasCoords = true;

      const color = statusColor(device);
      const pos = { lat: device.lat, lng: device.lng };
      bounds.extend(pos);

      const marker = new maps.Marker({
        position: pos,
        map: mapInstanceRef.current,
        title: device.nickname || device.nr_serial,
        icon: {
          path: maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: color,
          fillOpacity: 1,
          strokeColor: "#111827",
          strokeWeight: 2,
        },
      });

      marker.addListener("click", () => setSelectedDevice(device));
      markersRef.current.push(marker);
    });

    if (hasCoords) mapInstanceRef.current!.fitBounds(bounds);
  }, [devices, mapInstanceRef.current]);

  async function handleSave(updates: { nickname?: string; address?: string; site_name?: string }) {
    if (!editingDevice) return;
    await fetch("/api/devices", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_id: editingDevice.device_id, ...updates }),
    });
    setEditingDevice(null);
    setSelectedDevice(null);
    fetchDevices();
  }

  const devicesWithCoords = devices.filter(d => d.lat && d.lng);
  const devicesWithout = devices.filter(d => !d.lat || !d.lng);

  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh", background: "#030712", overflow: "hidden" }}>

      {/* Header bar */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, zIndex: 50,
        background: "rgba(3,7,18,0.9)", backdropFilter: "blur(12px)",
        borderBottom: "1px solid #1f2937", padding: "12px 20px",
        display: "flex", alignItems: "center", justifyContent: "space-between"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <MapPin size={18} style={{ color: "#3b82f6" }} />
            <span style={{ fontSize: 15, fontWeight: 700, color: "#f9fafb" }}>Device Map</span>
          </div>
          <div style={{ fontSize: 11, color: "#6b7280", fontFamily: "monospace" }}>
            {loading ? "Loading…" : `${devices.length} device${devices.length !== 1 ? "s" : ""} · ${devicesWithCoords.length} mapped`}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => router.push("/devices/list")}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "6px 12px", background: "#1f2937", border: "1px solid #374151",
              borderRadius: 8, color: "#9ca3af", cursor: "pointer", fontSize: 12
            }}
          >
            <List size={13} /> List View
          </button>
        </div>
      </div>

      {/* Map */}
      <div ref={mapRef} style={{ width: "100%", height: "100%", paddingTop: 57 }} />

      {/* Unmapped devices panel */}
      {devicesWithout.length > 0 && (
        <div style={{
          position: "absolute", top: 72, left: 16, zIndex: 50,
          background: "rgba(17,24,39,0.95)", backdropFilter: "blur(8px)",
          border: "1px solid #374151", borderRadius: 10, padding: 12, minWidth: 220
        }}>
          <div style={{ fontSize: 10, color: "#6b7280", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
            No Address Set
          </div>
          {devicesWithout.map(device => (
            <div
              key={device.device_id}
              onClick={() => setEditingDevice(device)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "8px 10px", borderRadius: 8, cursor: "pointer",
                background: "#1f2937", marginBottom: 4
              }}
            >
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#e5e7eb" }}>
                  {device.nickname || device.nr_serial}
                </div>
                <div style={{ fontSize: 10, color: "#6b7280", fontFamily: "monospace" }}>{device.nr_serial}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4, color: "#3b82f6", fontSize: 11 }}>
                <Edit2 size={11} /> Add
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Device popup */}
      {selectedDevice && (
        <DevicePopup
          device={selectedDevice}
          onEdit={() => { setEditingDevice(selectedDevice); setSelectedDevice(null); }}
          onClose={() => setSelectedDevice(null)}
        />
      )}

      {/* Edit modal */}
      {editingDevice && (
        <EditDeviceModal
          device={editingDevice}
          onSave={handleSave}
          onClose={() => setEditingDevice(null)}
        />
      )}
    </div>
  );
}
