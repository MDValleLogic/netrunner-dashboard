"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Edit2, Check, X } from "lucide-react";

interface Device {
  device_id: string; nr_serial: string; nickname?: string; site_name?: string;
  location?: string; address?: string; agent_version?: string; last_ip?: string;
  last_seen?: string; status?: string;
}
interface Heartbeat { ts_utc: string; ip: string; ok: boolean; uptime_s: number; }

function timeAgo(iso: string) {
  if (!iso) return "Never";
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 2) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function isOnline(last?: string) {
  if (!last) return false;
  return (Date.now() - new Date(last).getTime()) < 90_000;
}

function HeartbeatTimeline({ deviceId }: { deviceId: string }) {
  const [beats, setBeats] = useState<Heartbeat[]>([]);
  useEffect(() => {
    fetch(`/api/devices/heartbeat?device_id=${deviceId}`)
      .then(r => r.json())
      .then(j => setBeats(j.heartbeats || []));
  }, [deviceId]);

  if (!beats.length) return <div style={{ fontSize: 11, color: "#6b7280", fontFamily: "monospace" }}>No heartbeat history yet</div>;

  // Show last 60 beats as small blocks
  const recent = beats.slice(0, 60).reverse();
  return (
    <div>
      <div style={{ fontSize: 10, color: "#6b7280", fontFamily: "monospace", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>
        Heartbeat · last {recent.length} beats · 1 block = 60s
      </div>
      <div style={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
        {recent.map((b, i) => (
          <div key={i} title={`${new Date(b.ts_utc).toLocaleTimeString()} — ${b.ok ? "OK" : "MISS"} — ${b.ip}`}
            style={{ width: 8, height: 20, borderRadius: 2, background: b.ok ? "#22c55e" : "#ef4444", opacity: 0.85 }} />
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
        <span style={{ fontSize: 9, color: "#4b5563", fontFamily: "monospace" }}>
          {recent.length > 0 ? new Date(recent[0].ts_utc).toLocaleTimeString() : ""}
        </span>
        <span style={{ fontSize: 9, color: "#4b5563", fontFamily: "monospace" }}>
          {recent.length > 0 ? new Date(recent[recent.length - 1].ts_utc).toLocaleTimeString() : ""}
        </span>
      </div>
    </div>
  );
}

function DeviceCard({ device, onSaved }: { device: Device; onSaved: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [nickname, setNickname] = useState(device.nickname || "");
  const [siteName, setSiteName] = useState(device.site_name || "");
  const [location, setLocation] = useState(device.location || "");
  const [address, setAddress] = useState(device.address || "");
  const [saving, setSaving] = useState(false);
  const online = isOnline(device.last_seen);

  async function save() {
    setSaving(true);
    try {
      await fetch("/api/devices/update", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ device_id: device.device_id, nickname, site_name: siteName, location, address }),
      });
      setEditing(false);
      onSaved();
    } finally { setSaving(false); }
  }

  return (
    <div style={{ background: "#0f172a", border: `1px solid ${online ? "#1e3a2f" : "#1e293b"}`, borderRadius: 12, overflow: "hidden" }}>
      {/* Main row */}
      <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}
        onClick={() => setExpanded(e => !e)}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {/* NetRunner icon */}
          <svg width="48" height="28" viewBox="0 0 72 40" fill="none">
            <rect x="1" y="10" width="70" height="20" rx="5" fill="#0f172a" stroke="#334155" strokeWidth="1.5"/>
            <rect x="4" y="13" width="64" height="14" rx="3" fill="#1e293b"/>
            <circle cx="14" cy="20" r="4" fill="#0ea5e9" opacity="0.9"/>
            <circle cx="14" cy="20" r="2" fill="#38bdf8"/>
            <rect x="24" y="17" width="28" height="2" rx="1" fill="#334155"/>
            <rect x="24" y="21" width="20" height="2" rx="1" fill="#334155"/>
            <rect x="58" y="16" width="4" height="8" rx="1" fill={online ? "#22c55e" : "#475569"} opacity="0.8"/>
          </svg>
          <div>
            <div style={{ fontWeight: 700, color: "#f9fafb", fontSize: 15 }}>
              {device.nickname || "NetRunner Appliance"}
            </div>
            <div style={{ fontSize: 12, color: "#22d3ee", fontFamily: "monospace", letterSpacing: "0.08em" }}>
              {device.nr_serial}
            </div>
            {device.site_name && (
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{device.site_name}{device.location ? ` · ${device.location}` : ""}</div>
            )}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 9, color: "#6b7280", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.08em" }}>IP Address</div>
            <div style={{ fontSize: 13, color: "#e5e7eb", fontFamily: "monospace" }}>{device.last_ip || "—"}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 9, color: "#6b7280", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.08em" }}>Agent</div>
            <div style={{ fontSize: 13, color: "#e5e7eb", fontFamily: "monospace" }}>{device.agent_version || "—"}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 9, color: "#6b7280", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.08em" }}>Last Seen</div>
            <div style={{ fontSize: 13, color: "#e5e7eb" }}>{timeAgo(device.last_seen || "")}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 20,
            background: online ? "#22c55e15" : "#6b728015", border: `1px solid ${online ? "#22c55e40" : "#6b728040"}` }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: online ? "#22c55e" : "#6b7280" }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: online ? "#22c55e" : "#6b7280" }}>{online ? "Online" : "Offline"}</span>
          </div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>{expanded ? "▲" : "▼"}</div>
        </div>
      </div>

      {/* Expanded panel */}
      {expanded && (
        <div style={{ borderTop: "1px solid #1e293b", padding: "20px 24px", background: "#080f1e" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 20 }}>
            {/* Left — heartbeat */}
            <div>
              <HeartbeatTimeline deviceId={device.device_id} />
            </div>
            {/* Right — device info / edit */}
            <div>
              {editing ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {[
                    { label: "Nickname", val: nickname, set: setNickname, placeholder: "e.g. Basement Pi" },
                    { label: "Site Name", val: siteName, set: setSiteName, placeholder: "e.g. Freehold HQ" },
                    { label: "Location", val: location, set: setLocation, placeholder: "e.g. Wiring Closet" },
                    { label: "Address", val: address, set: setAddress, placeholder: "123 Main St, Freehold NJ" },
                  ].map(f => (
                    <div key={f.label}>
                      <div style={{ fontSize: 10, color: "#6b7280", fontFamily: "monospace", textTransform: "uppercase", marginBottom: 4 }}>{f.label}</div>
                      <input value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.placeholder}
                        style={{ width: "100%", background: "#111827", border: "1px solid #374151", borderRadius: 6,
                          color: "#e5e7eb", padding: "7px 10px", fontSize: 12, fontFamily: "monospace", boxSizing: "border-box" }} />
                    </div>
                  ))}
                  <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                    <button onClick={save} disabled={saving} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 6, background: "#1d4ed8", border: "none", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                      <Check size={13} /> {saving ? "Saving…" : "Save"}
                    </button>
                    <button onClick={() => setEditing(false)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 6, background: "transparent", border: "1px solid #374151", color: "#9ca3af", fontSize: 12, cursor: "pointer" }}>
                      <X size={13} /> Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                    {[
                      { label: "Nickname", value: device.nickname || "—" },
                      { label: "Site", value: device.site_name || "—" },
                      { label: "Location", value: device.location || "—" },
                      { label: "Address", value: device.address || "—" },
                      { label: "Device ID", value: device.device_id.substring(0, 20) + "…" },
                      { label: "Serial", value: device.nr_serial },
                    ].map(s => (
                      <div key={s.label}>
                        <div style={{ fontSize: 9, color: "#6b7280", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>{s.label}</div>
                        <div style={{ fontSize: 12, color: "#e5e7eb", fontFamily: "monospace" }}>{s.value}</div>
                      </div>
                    ))}
                  </div>
                  <button onClick={e => { e.stopPropagation(); setEditing(true); }} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 6, background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.3)", color: "#60a5fa", fontSize: 12, cursor: "pointer" }}>
                    <Edit2 size={13} /> Edit Device
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DevicesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [devices, setDevices] = useState<Device[]>([]);
  const [serial, setSerial] = useState("");
  const [claiming, setClaiming] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function loadDevices() {
    const j = await fetch("/api/devices/list").then(r => r.json());
    if (j.ok) setDevices(j.devices || []);
  }

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status === "authenticated") loadDevices();
  }, [status]);

  async function claimDevice() {
    if (!serial.trim()) return;
    setClaiming(true); setMsg(null);
    try {
      const res = await fetch("/api/devices/claim", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nr_serial: serial.trim().toUpperCase() }),
      });
      const j = await res.json();
      if (j.ok) { setMsg({ ok: true, text: `Device ${serial} claimed successfully!` }); setSerial(""); loadDevices(); }
      else setMsg({ ok: false, text: j.error || "Claim failed" });
    } finally { setClaiming(false); }
  }

  if (status === "loading") return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400">Loading…</div>;

  return (
    <div style={{ minHeight: "100vh", background: "#030712", padding: "32px 40px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#f9fafb", marginBottom: 4 }}>Device Setup</h1>
          <p style={{ fontSize: 13, color: "#6b7280" }}>Claim and manage your NetRunner Appliances</p>
        </div>

        {/* Claim */}
        <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12, padding: "24px 28px", marginBottom: 32 }}>
          <div style={{ fontWeight: 600, color: "#e5e7eb", marginBottom: 6 }}>Claim a New Appliance</div>
          <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 16 }}>Enter the serial number printed on the bottom of your NetRunner Appliance.</p>
          {msg && (
            <div style={{ marginBottom: 16, padding: "10px 14px", borderRadius: 8,
              background: msg.ok ? "#22c55e15" : "#ef444415", border: `1px solid ${msg.ok ? "#22c55e40" : "#ef444440"}`,
              color: msg.ok ? "#22c55e" : "#ef4444", fontSize: 13 }}>
              {msg.ok ? "✓" : "✗"} {msg.text}
            </div>
          )}
          <div style={{ display: "flex", gap: 10 }}>
            <input value={serial} onChange={e => setSerial(e.target.value)}
              onKeyDown={e => e.key === "Enter" && claimDevice()}
              placeholder="NR-XXXX-XXXX"
              style={{ flex: 1, background: "#111827", border: "1px solid #374151", borderRadius: 8,
                color: "#e5e7eb", padding: "10px 14px", fontSize: 14, fontFamily: "monospace", letterSpacing: "0.05em" }} />
            <button onClick={claimDevice} disabled={claiming || !serial.trim()}
              style={{ padding: "10px 24px", borderRadius: 8, background: "#0ea5e9", border: "none",
                color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", opacity: claiming ? 0.6 : 1 }}>
              {claiming ? "Claiming…" : "Claim Device"}
            </button>
          </div>
        </div>

        {/* Device list */}
        <div style={{ marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: "#e5e7eb" }}>Your Appliances</h2>
          <span style={{ fontSize: 12, color: "#6b7280", fontFamily: "monospace" }}>{devices.length} device{devices.length !== 1 ? "s" : ""}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {devices.map(d => <DeviceCard key={d.device_id} device={d} onSaved={loadDevices} />)}
        </div>
      </div>
    </div>
  );
}
