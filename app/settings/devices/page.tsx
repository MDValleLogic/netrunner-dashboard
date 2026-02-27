"use client";
import { useState, useEffect } from "react";

interface Device {
  device_id: string;
  nr_serial: string;
  vlos_version: string;
  ip: string;
  hostname: string;
  claimed: boolean;
  last_seen: string;
}

export default function DevicesPage() {
  const [devices, setDevices]   = useState<Device[]>([]);
  const [serial, setSerial]     = useState("");
  const [claiming, setClaiming] = useState(false);
  const [msg, setMsg]           = useState<{ok: boolean, text: string} | null>(null);

  async function loadDevices() {
    const r = await fetch("/api/devices/list");
    const d = await r.json();
    if (d.ok) setDevices(d.devices);
  }

  useEffect(() => { loadDevices(); }, []);

  async function claim() {
    if (!serial.trim()) return;
    setClaiming(true);
    setMsg(null);
    try {
      const r = await fetch("/api/devices/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nr_serial: serial.trim().toUpperCase() })
      });
      const d = await r.json();
      if (d.ok) {
        setMsg({ ok: true, text: `✅ Device ${d.device.nr_serial} claimed successfully!` });
        setSerial("");
        loadDevices();
      } else {
        setMsg({ ok: false, text: `❌ ${d.error}` });
      }
    } catch (e) {
      setMsg({ ok: false, text: "❌ Network error" });
    }
    setClaiming(false);
  }

  function timeAgo(ts: string) {
    const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
    return `${Math.floor(diff/86400)}d ago`;
  }

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-2xl font-bold text-white mb-2">Device Setup</h1>
      <p className="text-slate-400 mb-8">Claim and manage your NetRunner Appliances</p>

      {/* Claim box */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 mb-8">
        <h2 className="text-white font-semibold mb-1">Claim a New Appliance</h2>
        <p className="text-slate-400 text-sm mb-4">
          Enter the serial number printed on the bottom of your NetRunner Appliance.
          Make sure it is powered on and connected to the internet first.
        </p>
        <div className="flex gap-3">
          <input
            type="text"
            value={serial}
            onChange={e => setSerial(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === "Enter" && claim()}
            placeholder="NR-XXXX-XXXX"
            className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white font-mono text-lg tracking-widest placeholder-slate-600 focus:outline-none focus:border-cyan-500"
          />
          <button
            onClick={claim}
            disabled={claiming || !serial.trim()}
            className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-semibold px-6 py-2 rounded-lg transition-colors"
          >
            {claiming ? "Claiming..." : "Claim Device"}
          </button>
        </div>
        {msg && (
          <p className={`mt-3 text-sm ${msg.ok ? "text-green-400" : "text-red-400"}`}>
            {msg.text}
          </p>
        )}
      </div>

      {/* Device list */}
      <h2 className="text-white font-semibold mb-4">Your Appliances</h2>
      {devices.length === 0 ? (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 text-center text-slate-500">
          No appliances claimed yet. Enter your serial number above to get started.
        </div>
      ) : (
        <div className="space-y-3">
          {devices.map(d => {
            const online = (Date.now() - new Date(d.last_seen).getTime()) < 5 * 60 * 1000;
            return (
              <div key={d.device_id} className="bg-slate-800 border border-slate-700 rounded-xl p-5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-slate-700 rounded-lg flex items-center justify-center text-xl">📡</div>
                  <div>
                    <div className="text-white font-semibold">NetRunner Appliance</div>
                    <div className="text-slate-400 text-sm font-mono">{d.nr_serial}</div>
                  </div>
                </div>
                <div className="flex items-center gap-8 text-sm">
                  <div>
                    <div className="text-slate-500 text-xs">VLOS</div>
                    <div className="text-slate-300">{d.vlos_version}</div>
                  </div>
                  <div>
                    <div className="text-slate-500 text-xs">IP</div>
                    <div className="text-slate-300 font-mono">{d.ip}</div>
                  </div>
                  <div>
                    <div className="text-slate-500 text-xs">LAST SEEN</div>
                    <div className="text-slate-300">{timeAgo(d.last_seen)}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${online ? "bg-green-400" : "bg-slate-600"}`} />
                    <span className={online ? "text-green-400" : "text-slate-500"}>
                      {online ? "Online" : "Offline"}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
