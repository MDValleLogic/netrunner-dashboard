"use client";
import { useEffect, useState } from "react";

const RUNNERS = ["speedrunner", "blerunner", "rfrunner", "webrunner", "routerunner"] as const;
type RunnerType = typeof RUNNERS[number];

const RUNNER_LABELS: Record<RunnerType, string> = {
  speedrunner: "SpeedRunner",
  blerunner:   "BLERunner",
  rfrunner:    "RFRunner",
  webrunner:   "WebRunner",
  routerunner: "RouteRunner",
};

const RUNNER_COLORS: Record<RunnerType, string> = {
  speedrunner: "#f97316",
  blerunner:   "#3b82f6",
  rfrunner:    "#10b981",
  webrunner:   "#a78bfa",
  routerunner: "#e879f9",
};

// Master region list — matches speedrunner.py REGIONS exactly
const ALL_REGIONS = [
  { region: "Northeast US",       city: "New York, NY"    },
  { region: "Mid-Atlantic US",    city: "Ashburn, VA"     },
  { region: "Southeast US",       city: "Atlanta, GA"     },
  { region: "Midwest US",         city: "Chicago, IL"     },
  { region: "South Central US",   city: "Dallas, TX"      },
  { region: "Southwest US",       city: "Phoenix, AZ"     },
  { region: "West Coast US",      city: "Los Angeles, CA" },
  { region: "Europe - London",    city: "London, UK"      },
  { region: "Europe - Manchester",city: "Manchester, UK"  },
  { region: "Europe - Amsterdam", city: "Amsterdam, NL"   },
  { region: "Europe - Frankfurt", city: "Frankfurt, DE"   },
  { region: "Asia Pacific",       city: "Tokyo, Japan"    },
];

type Configs   = Record<RunnerType, Record<string, any>>;
type Sources   = Record<RunnerType, "global" | "default">;
type SaveState = Record<RunnerType, "idle" | "saving" | "saved" | "error">;

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 16, padding: "12px 0", borderBottom: "1px solid #1f2937" }}>
      <div style={{ width: 200, fontSize: 12, color: "#9ca3af", paddingTop: 6, flexShrink: 0 }}>{label}</div>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}

function NumberInput({ value, onChange, suffix }: { value: number; onChange: (v: number) => void; suffix?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <input
        type="number"
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: 120, background: "#0d1117", border: "1px solid #374151", borderRadius: 6, padding: "6px 10px", fontSize: 12, color: "#e5e7eb", fontFamily: "monospace", outline: "none" }}
      />
      {suffix && <span style={{ fontSize: 11, color: "#6b7280" }}>{suffix}</span>}
    </div>
  );
}

function TextInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{ width: "100%", background: "#0d1117", border: "1px solid #374151", borderRadius: 6, padding: "6px 10px", fontSize: 12, color: "#e5e7eb", fontFamily: "monospace", outline: "none", boxSizing: "border-box" }}
    />
  );
}

function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div
        onClick={() => onChange(!value)}
        style={{ width: 36, height: 20, borderRadius: 10, background: value ? "#10b981" : "#374151", cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0 }}
      >
        <div style={{ position: "absolute", top: 2, left: value ? 18 : 2, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
      </div>
      <span style={{ fontSize: 12, color: value ? "#e5e7eb" : "#6b7280" }}>{label}</span>
    </div>
  );
}

function RegionChecklist({ selected, onChange }: { selected: string[]; onChange: (v: string[]) => void }) {
  const toggle = (region: string) => {
    if (selected.includes(region)) {
      onChange(selected.filter(r => r !== region));
    } else {
      onChange([...selected, region]);
    }
  };
  const allSelected = ALL_REGIONS.every(r => selected.includes(r.region));

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <div
          onClick={() => onChange(allSelected ? [] : ALL_REGIONS.map(r => r.region))}
          style={{ width: 16, height: 16, borderRadius: 4, border: "1px solid #374151", background: allSelected ? "#f97316" : "#0d1117", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
        >
          {allSelected && <span style={{ color: "#fff", fontSize: 11, fontWeight: 700, lineHeight: 1 }}>✓</span>}
        </div>
        <span style={{ fontSize: 11, color: "#6b7280", fontWeight: 600 }}>
          {allSelected ? "Deselect all" : "Select all"} — {selected.length}/{ALL_REGIONS.length} active
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        {ALL_REGIONS.map(r => {
          const on = selected.includes(r.region);
          return (
            <div
              key={r.region}
              onClick={() => toggle(r.region)}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "8px 12px", borderRadius: 6, cursor: "pointer",
                background: on ? "rgba(249,115,22,0.08)" : "#0d1117",
                border: on ? "1px solid rgba(249,115,22,0.3)" : "1px solid #1f2937",
                transition: "all 0.15s",
              }}
            >
              <div style={{ width: 16, height: 16, borderRadius: 4, border: "1px solid #374151", background: on ? "#f97316" : "#0d1117", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {on && <span style={{ color: "#fff", fontSize: 11, fontWeight: 700, lineHeight: 1 }}>✓</span>}
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: on ? "#f9fafb" : "#6b7280" }}>{r.region}</div>
                <div style={{ fontSize: 10, color: "#4b5563" }}>{r.city}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SpeedRunnerFields({ config, onChange }: { config: any; onChange: (c: any) => void }) {
  return (
    <>
      <FieldRow label="Test interval">
        <NumberInput value={config.interval_seconds ?? 3600} onChange={v => onChange({ ...config, interval_seconds: v })} suffix="seconds" />
      </FieldRow>
      <FieldRow label="Active regions">
        <RegionChecklist
          selected={config.regions ?? ALL_REGIONS.map((r: any) => r.region)}
          onChange={v => onChange({ ...config, regions: v })}
        />
      </FieldRow>
    </>
  );
}

function BLERunnerFields({ config, onChange }: { config: any; onChange: (c: any) => void }) {
  return (
    <>
      <FieldRow label="Scanning enabled">
        <Toggle value={config.scan_enabled ?? true} onChange={v => onChange({ ...config, scan_enabled: v })} label={config.scan_enabled ? "Enabled" : "Disabled"} />
      </FieldRow>
      <FieldRow label="Scan interval">
        <NumberInput value={config.scan_interval ?? 60} onChange={v => onChange({ ...config, scan_interval: v })} suffix="seconds" />
      </FieldRow>
    </>
  );
}

function RFRunnerFields({ config, onChange }: { config: any; onChange: (c: any) => void }) {
  return (
    <>
      <FieldRow label="Scanning enabled">
        <Toggle value={config.scan_enabled ?? true} onChange={v => onChange({ ...config, scan_enabled: v })} label={config.scan_enabled ? "Enabled" : "Disabled"} />
      </FieldRow>
      <FieldRow label="Scan interval">
        <NumberInput value={config.scan_interval ?? 60} onChange={v => onChange({ ...config, scan_interval: v })} suffix="seconds" />
      </FieldRow>
      <FieldRow label="Active mode enabled">
        <Toggle value={config.active_enabled ?? false} onChange={v => onChange({ ...config, active_enabled: v })} label={config.active_enabled ? "Enabled" : "Disabled"} />
      </FieldRow>
      <FieldRow label="Active SSID">
        <TextInput value={config.active_ssid ?? ""} onChange={v => onChange({ ...config, active_ssid: v })} />
      </FieldRow>
      <FieldRow label="Active PSK">
        <TextInput value={config.active_psk ?? ""} onChange={v => onChange({ ...config, active_psk: v })} />
      </FieldRow>
      <FieldRow label="Active mode interval">
        <NumberInput value={config.active_interval ?? 1800} onChange={v => onChange({ ...config, active_interval: v })} suffix="seconds" />
      </FieldRow>
    </>
  );
}

function WebRunnerFields({ config, onChange }: { config: any; onChange: (c: any) => void }) {
  const [draft, setDraft] = useState("");
  const urls = config.urls ?? [];
  return (
    <>
      <FieldRow label="Monitored URLs">
        <div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 8 }}>
            {urls.map((u: string, i: number) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ flex: 1, padding: "5px 10px", background: "#0d1117", border: "1px solid #1f2937", borderRadius: 6, fontSize: 12, color: "#e5e7eb", fontFamily: "monospace" }}>{u}</div>
                <span onClick={() => onChange({ ...config, urls: urls.filter((_: string, j: number) => j !== i) })} style={{ cursor: "pointer", color: "#6b7280", fontSize: 16, lineHeight: 1, padding: "0 4px" }}>x</span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={draft} onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && draft.trim()) { onChange({ ...config, urls: [...urls, draft.trim()] }); setDraft(""); e.preventDefault(); }}}
              placeholder="https://example.com and press Enter"
              style={{ flex: 1, background: "#0d1117", border: "1px solid #374151", borderRadius: 6, padding: "6px 10px", fontSize: 12, color: "#e5e7eb", fontFamily: "monospace", outline: "none" }}
            />
            <button onClick={() => { if (draft.trim()) { onChange({ ...config, urls: [...urls, draft.trim()] }); setDraft(""); }}}
              style={{ padding: "6px 12px", background: "#1f2937", border: "1px solid #374151", borderRadius: 6, fontSize: 11, color: "#9ca3af", cursor: "pointer", fontFamily: "inherit" }}>Add</button>
          </div>
        </div>
      </FieldRow>
      <FieldRow label="Check interval">
        <NumberInput value={config.interval_seconds ?? 300} onChange={v => onChange({ ...config, interval_seconds: v })} suffix="seconds" />
      </FieldRow>
      <FieldRow label="Timeout">
        <NumberInput value={config.timeout_seconds ?? 10} onChange={v => onChange({ ...config, timeout_seconds: v })} suffix="seconds" />
      </FieldRow>
    </>
  );
}

function RouteRunnerFields({ config, onChange }: { config: any; onChange: (c: any) => void }) {
  const [draft, setDraft] = useState("");
  const targets = config.targets ?? [];
  return (
    <>
      <FieldRow label="Trace targets">
        <div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
            {targets.map((t: string, i: number) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 5, padding: "3px 8px 3px 10px", background: "#1f2937", border: "1px solid #374151", borderRadius: 4, fontSize: 11, color: "#e5e7eb", fontFamily: "monospace" }}>
                {t}
                <span onClick={() => onChange({ ...config, targets: targets.filter((_: string, j: number) => j !== i) })} style={{ cursor: "pointer", color: "#6b7280", marginLeft: 2, fontSize: 13, lineHeight: 1 }}>x</span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={draft} onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && draft.trim()) { onChange({ ...config, targets: [...targets, draft.trim()] }); setDraft(""); e.preventDefault(); }}}
              placeholder="IP or hostname and press Enter"
              style={{ flex: 1, background: "#0d1117", border: "1px solid #374151", borderRadius: 6, padding: "6px 10px", fontSize: 12, color: "#e5e7eb", fontFamily: "monospace", outline: "none" }}
            />
            <button onClick={() => { if (draft.trim()) { onChange({ ...config, targets: [...targets, draft.trim()] }); setDraft(""); }}}
              style={{ padding: "6px 12px", background: "#1f2937", border: "1px solid #374151", borderRadius: 6, fontSize: 11, color: "#9ca3af", cursor: "pointer", fontFamily: "inherit" }}>Add</button>
          </div>
        </div>
      </FieldRow>
      <FieldRow label="Trace interval">
        <NumberInput value={config.interval_seconds ?? 300} onChange={v => onChange({ ...config, interval_seconds: v })} suffix="seconds" />
      </FieldRow>
    </>
  );
}

const RUNNER_FIELDS: Record<RunnerType, React.FC<{ config: any; onChange: (c: any) => void }>> = {
  speedrunner: SpeedRunnerFields,
  blerunner:   BLERunnerFields,
  rfrunner:    RFRunnerFields,
  webrunner:   WebRunnerFields,
  routerunner: RouteRunnerFields,
};

export default function GlobalRunnerConfigPage() {
  const [activeTab, setActiveTab] = useState<RunnerType>("speedrunner");
  const [configs, setConfigs]     = useState<Configs | null>(null);
  const [sources, setSources]     = useState<Sources | null>(null);
  const [saveState, setSaveState] = useState<SaveState>({ speedrunner: "idle", blerunner: "idle", rfrunner: "idle", webrunner: "idle", routerunner: "idle" });
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/config/global")
      .then(r => r.json())
      .then(d => {
        if (d.ok) { setConfigs(d.configs); setSources(d.sources); }
        else setError(d.error ?? "Failed to load");
        setLoading(false);
      })
      .catch(() => { setError("Network error"); setLoading(false); });
  }, []);

  function updateConfig(runner: RunnerType, config: Record<string, any>) {
    setConfigs(prev => prev ? { ...prev, [runner]: config } : prev);
    setSources(prev => prev ? { ...prev, [runner]: "global" } : prev);
  }

  async function save(runner: RunnerType) {
    if (!configs) return;
    setSaveState(prev => ({ ...prev, [runner]: "saving" }));
    try {
      const res = await fetch("/api/config/global", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runner_type: runner, config: configs[runner] }),
      });
      const d = await res.json();
      if (d.ok) {
        setSaveState(prev => ({ ...prev, [runner]: "saved" }));
        setSources(prev => prev ? { ...prev, [runner]: "global" } : prev);
        setTimeout(() => setSaveState(prev => ({ ...prev, [runner]: "idle" })), 2000);
      } else {
        setSaveState(prev => ({ ...prev, [runner]: "error" }));
        setTimeout(() => setSaveState(prev => ({ ...prev, [runner]: "idle" })), 3000);
      }
    } catch {
      setSaveState(prev => ({ ...prev, [runner]: "error" }));
      setTimeout(() => setSaveState(prev => ({ ...prev, [runner]: "idle" })), 3000);
    }
  }

  const card: React.CSSProperties = { background: "#111827", border: "1px solid #1f2937", borderRadius: 10, padding: "20px 24px", marginBottom: 16 };
  const accentColor = RUNNER_COLORS[activeTab];
  const FieldsComp = configs ? RUNNER_FIELDS[activeTab] : null;
  const currentSource = sources?.[activeTab];
  const st = saveState[activeTab];

  return (
    <div style={{ padding: "28px 32px", fontFamily: "monospace", color: "#e5e7eb", minHeight: "100vh", background: "#0d1117" }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: "#f9fafb", letterSpacing: "-0.02em" }}>Global Runner Config</div>
        <div style={{ fontSize: 11, color: "#6b7280", marginTop: 3 }}>Fleet-wide defaults for all runners — device-level overrides take precedence</div>
      </div>

      {loading ? (
        <div style={{ color: "#6b7280", fontSize: 13 }}>Loading config...</div>
      ) : error ? (
        <div style={{ color: "#ef4444", fontSize: 13 }}>{error}</div>
      ) : configs && sources ? (
        <>
          <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
            {RUNNERS.map(runner => {
              const isActive = runner === activeTab;
              const src = sources[runner];
              const color = RUNNER_COLORS[runner];
              return (
                <button key={runner} onClick={() => setActiveTab(runner)} style={{
                  padding: "8px 16px", borderRadius: 8,
                  border: isActive ? `1px solid ${color}44` : "1px solid #1f2937",
                  background: isActive ? `${color}18` : "#111827",
                  color: isActive ? color : "#6b7280",
                  cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "monospace",
                  display: "flex", alignItems: "center", gap: 8, transition: "all 0.15s",
                }}>
                  {RUNNER_LABELS[runner]}
                  <span style={{
                    fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", padding: "2px 5px", borderRadius: 4,
                    background: src === "global" ? "rgba(6,182,212,0.15)" : "rgba(251,191,36,0.12)",
                    color: src === "global" ? "#22d3ee" : "#fbbf24",
                  }}>{src === "global" ? "GLOBAL" : "DEFAULT"}</span>
                </button>
              );
            })}
          </div>

          <div style={{ ...card, borderColor: `${accentColor}22` }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 3, height: 20, borderRadius: 2, background: accentColor }} />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#f3f4f6" }}>{RUNNER_LABELS[activeTab]}</div>
                  <div style={{ fontSize: 10, color: "#6b7280", marginTop: 1 }}>
                    {currentSource === "global" ? "Custom fleet default saved" : "Using built-in defaults — no custom config saved yet"}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", padding: "3px 8px", borderRadius: 4,
                  background: currentSource === "global" ? "rgba(6,182,212,0.15)" : "rgba(251,191,36,0.12)",
                  color: currentSource === "global" ? "#22d3ee" : "#fbbf24",
                }}>{currentSource === "global" ? "GLOBAL" : "DEFAULT"}</span>
                <button onClick={() => save(activeTab)} disabled={st === "saving"} style={{
                  padding: "7px 18px", borderRadius: 7, border: "none",
                  cursor: st === "saving" ? "wait" : "pointer",
                  fontSize: 12, fontWeight: 700, fontFamily: "monospace",
                  background: st === "saved" ? "#10b981" : st === "error" ? "#ef4444" : accentColor,
                  color: "#fff", opacity: st === "saving" ? 0.7 : 1, transition: "all 0.2s",
                }}>
                  {st === "saving" ? "Saving..." : st === "saved" ? "Saved" : st === "error" ? "Error" : "Save to Fleet"}
                </button>
              </div>
            </div>
            <div>
              {FieldsComp && <FieldsComp config={configs[activeTab]} onChange={cfg => updateConfig(activeTab, cfg)} />}
            </div>
          </div>

          <div style={{ ...card, background: "rgba(59,130,246,0.05)", border: "1px solid rgba(59,130,246,0.15)", marginBottom: 0 }}>
            <div style={{ fontSize: 12, color: "#93c5fd", fontWeight: 600, marginBottom: 6 }}>Fleet Default vs Device Override</div>
            <div style={{ fontSize: 12, color: "#d1d5db", lineHeight: 1.8 }}>
              Settings saved here become the <strong>fleet default</strong> for all devices. Individual devices can override any runner config from the device detail page. When a device has an override, it shows a <span style={{ color: "#f59e0b", fontWeight: 700 }}>CUSTOM</span> badge — otherwise it inherits this global config.
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
