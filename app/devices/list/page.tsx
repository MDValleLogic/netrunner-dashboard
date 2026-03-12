"use client";

import { useEffect, useState, useCallback } from "react";
import { MapPin, Edit2, X, Wifi, Clock, Activity, Server, Check } from "lucide-react";
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
  provisioned_at: string;
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

function EditModal({ device, onSave, onClose }: {
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
          {[
            { label: "Nickname", value: nickname, set: setNickname, placeholder: "e.g. Office Closet" },
            { label: "Site Name", value: siteName, set: setSiteName, placeholder: "e.g. Acme Corp HQ" },
            { label: "Address", value: address, set: setAddress, placeholder: "123 Main St, Freehold, NJ 07728" },
          ].map(({ label, value, set, placeholder }) => (
            <div key={label}>
              <label style={{ fontSize: 11, color: "#9ca3af", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 6 }}>
                {label}
              </label>
              <input
                value={value}
                onChange={e => set(e.target.value)}
                placeholder={placeholder}
                style={{
                  width: "100%", background: "#1f2937", border: "1px solid #374151",
                  borderRadius: 8, padding: "10px 12px", color: "#f9fafb", fontSize: 14,
                  outline: "none", boxSizing: "border-box"
                }}
              />
            </div>
          ))}
          <div style={{ fontSize: 10, color: "#6b7280" }}>Address will be geocoded and shown on the map</div>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "10px", background: "none", border: "1px solid #374151", borderRadius: 8, color: "#9ca3af", cursor: "pointer", fontSize: 14 }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving} style={{ flex: 1, padding: "10px", background: "#2563eb", border: "none", borderRadius: 8, color: "#fff", cursor: saving ? "not-allowed" : "pointer", fontSize: 14, fontWeight: 600, opacity: saving ? 0.7 : 1 }}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DevicesListPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const router = useRouter();

  const fetchDevices = useCallback(async () => {
    const res = await fetch("/api/devices");
    const data = await res.json();
    if (data.ok) setDevices(data.devices);
    setLoading(false);
  }, []);

  useEffect(() => { fetchDevices(); }, [fetchDevices]);

  async function handleSave(updates: { nickname?: string; address?: string; site_name?: string }) {
    if (!editingDevice) return;
    await fetch("/api/devices", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_id: editingDevice.device_id, ...updates }),
    });
    setEditingDevice(null);
    fetchDevices();
  }

  return (
    <div style={{ minHeight: "100vh", background: "#030712", color: "#f9fafb" }}>

      {/* Header */}
      <div style={{
        background: "rgba(17,24,39,0.95)", backdropFilter: "blur(12px)",
        borderBottom: "1px solid #1f2937", padding: "16px 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 0, zIndex: 50
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ padding: "6px 8px", background: "#1d4ed820", border: "1px solid #1d4ed840", borderRadius: 8 }}>
            <Server size={18} style={{ color: "#60a5fa" }} />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>Devices</div>
            <div style={{ fontSize: 11, color: "#6b7280", fontFamily: "monospace" }}>
              {loading ? "Loading…" : `${devices.length} device${devices.length !== 1 ? "s" : ""} registered`}
            </div>
          </div>
        </div>

        <button
          onClick={() => router.push("/devices/map")}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "8px 14px", background: "#1f2937", border: "1px solid #374151",
            borderRadius: 8, color: "#9ca3af", cursor: "pointer", fontSize: 13
          }}
        >
          <MapPin size={14} /> Map View
        </button>
      </div>

      <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>

        {loading ? (
          <div style={{ color: "#6b7280", fontFamily: "monospace", padding: 40, textAlign: "center" }}>Loading devices…</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {devices.map(device => {
              const color = statusColor(device);
              const label = statusLabel(device);
              return (
                <div
                  key={device.device_id}
                  style={{
                    background: "#111827", border: "1px solid #1f2937",
                    borderRadius: 12, padding: 20,
                    display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr auto",
                    alignItems: "center", gap: 16,
                    transition: "border-color 0.15s"
                  }}
                >
                  {/* Identity */}
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
                      <span style={{ fontSize: 14, fontWeight: 700, color: "#f9fafb" }}>
                        {device.nickname || device.nr_serial}
                      </span>
                    </div>
                    {device.nickname && (
                      <div style={{ fontSize: 11, color: "#6b7280", fontFamily: "monospace", paddingLeft: 16 }}>{device.nr_serial}</div>
                    )}
                    {device.site_name && (
                      <div style={{ fontSize: 11, color: "#9ca3af", paddingLeft: 16, marginTop: 2 }}>{device.site_name}</div>
                    )}
                    <div style={{ paddingLeft: 16, marginTop: 4 }}>
                      <span style={{ fontSize: 10, color, background: `${color}20`, padding: "2px 8px", borderRadius: 4, fontFamily: "monospace" }}>
                        {label}
                      </span>
                    </div>
                  </div>

                  {/* Address */}
                  <div>
                    <div style={{ fontSize: 10, color: "#6b7280", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Address</div>
                    <div style={{ fontSize: 13, color: device.address ? "#e5e7eb" : "#4b5563" }}>
                      {device.address || "—"}
                    </div>
                    {device.lat && device.lng && (
                      <div style={{ fontSize: 10, color: "#22c55e", fontFamily: "monospace", marginTop: 2 }}>
                        ✓ Geocoded
                      </div>
                    )}
                  </div>

                  {/* Telemetry */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {[
                      { icon: <Clock size={11} />, label: "Last Seen", value: timeSince(device.last_seen) },
                      { icon: <Activity size={11} />, label: "IP", value: device.last_ip || "—" },
                    ].map(({ icon, label, value }) => (
                      <div key={label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ color: "#6b7280" }}>{icon}</span>
                        <span style={{ fontSize: 10, color: "#6b7280", fontFamily: "monospace", width: 56 }}>{label}</span>
                        <span style={{ fontSize: 12, color: "#e5e7eb", fontFamily: "monospace" }}>{value}</span>
                      </div>
                    ))}
                  </div>

                  {/* Versions */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {[
                      { label: "Agent", value: device.agent_version || "—" },
                      { label: "Image", value: device.image_version || "—" },
                    ].map(({ label, value }) => (
                      <div key={label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 10, color: "#6b7280", fontFamily: "monospace", width: 40 }}>{label}</span>
                        <span style={{ fontSize: 12, color: "#e5e7eb", fontFamily: "monospace" }}>{value}</span>
                      </div>
                    ))}
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <button
                      onClick={() => setEditingDevice(device)}
                      style={{
                        display: "flex", alignItems: "center", gap: 6,
                        padding: "6px 12px", background: "#1f2937", border: "1px solid #374151",
                        borderRadius: 8, color: "#9ca3af", cursor: "pointer", fontSize: 12, whiteSpace: "nowrap"
                      }}
                    >
                      <Edit2 size={11} /> Edit
                    </button>
                    <button
                      onClick={() => router.push(`/rfrunner/overview?device=${device.device_id}`)}
                      style={{
                        display: "flex", alignItems: "center", gap: 6,
                        padding: "6px 12px", background: "#1d4ed820", border: "1px solid #1d4ed840",
                        borderRadius: 8, color: "#60a5fa", cursor: "pointer", fontSize: 12, whiteSpace: "nowrap"
                      }}
                    >
                      <Wifi size={11} /> Runners →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {editingDevice && (
        <EditModal
          device={editingDevice}
          onSave={handleSave}
          onClose={() => setEditingDevice(null)}
        />
      )}
    </div>
  );
}
