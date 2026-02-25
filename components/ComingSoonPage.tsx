"use client";

import React from "react";

type RunnerDef = {
  name: string;
  phase: string;
  phaseLabel: string;
  tagline: string;
  description: string;
  capabilities: { icon: string; title: string; detail: string }[];
  applianceRequirement: string;
  accentColor: string;
};

const RUNNERS: Record<string, RunnerDef> = {
  routerunner: {
    name: "RouteRunner",
    phase: "2",
    phaseLabel: "Phase 2 · Next Up",
    tagline: "Why is it slow? Whose fault is it?",
    description: "Per-URL traceroute on every monitoring cycle. Identifies every ISP in the path, detects CDN edge nodes, and alerts when BGP rerouting changes your traffic path.",
    capabilities: [
      { icon: "◈", title: "Traceroute Engine", detail: "Per-URL traceroute every cycle. Tracks all hops, RTT per hop, and hop stability over time." },
      { icon: "⬡", title: "ISP Detection", detail: "ASN lookup per hop. Identifies Comcast, Cogent, Level3 and flags where latency spikes originate." },
      { icon: "◎", title: "CDN Fingerprinting", detail: "Identifies Cloudflare, Akamai, Fastly, and AWS CloudFront edge nodes by IP range and PTR record." },
      { icon: "⟳", title: "Path Learning", detail: "Baselines the normal path per URL. Alerts on BGP rerouting and shows path divergence over time." },
    ],
    applianceRequirement: "traceroute · WHOIS/MaxMind ASN · PTR records",
    accentColor: "#0D7A8A",
  },
  speedrunner: {
    name: "SpeedRunner",
    phase: "2",
    phaseLabel: "Phase 2 · Next Up",
    tagline: "Is your ISP actually delivering what you're paying for?",
    description: "Edge bandwidth measurement from the NetRunner Appliance — download, upload, and jitter. Scheduled tests against the nearest server with trending to detect ISP throttling over time.",
    capabilities: [
      { icon: "⬆", title: "Download & Upload", detail: "Measures real throughput from the edge, not from the cloud. Catches ISP throttling at the source." },
      { icon: "∿", title: "Jitter Analysis", detail: "Tracks packet timing variance — critical signal for VoIP, video conferencing, and latency-sensitive apps." },
      { icon: "◈", title: "Scheduled Tests", detail: "Configurable test frequency. Runs against nearest server to minimize last-mile noise." },
      { icon: "↗", title: "Trend Detection", detail: "24hr and 7-day bandwidth trends. Surface gradual degradation before users notice." },
    ],
    applianceRequirement: "iperf3 · speedtest-cli · scheduled cron",
    accentColor: "#E8A020",
  },
  stormrunner: {
    name: "StormRunner",
    phase: "3",
    phaseLabel: "Phase 3",
    tagline: "Detect broadcast storms before they take the network down.",
    description: "Monitors broadcast and multicast traffic ratios versus unicast on your network segment. Plugs into a SPAN port to watch an entire VLAN. Alerts before a storm degrades performance.",
    capabilities: [
      { icon: "⚡", title: "Storm Detection", detail: "Identifies broadcast storms, ARP floods, multicast overwhelm, and STP loop indicators in real time." },
      { icon: "◈", title: "SPAN Port Mode", detail: "Mirror an entire VLAN or trunk to the NetRunner Appliance. Watch all traffic without being in the data path." },
      { icon: "⬡", title: "Ratio Monitoring", detail: "Compares broadcast/multicast packet ratio to unicast baseline. Alerts when threshold is exceeded." },
      { icon: "≡", title: "Per-VLAN Breakdown", detail: "In trunk mode, breaks down traffic ratios per VLAN. Enterprise MSP upsell capability." },
    ],
    applianceRequirement: "Promiscuous mode NIC · tcpdump + libpcap · SPAN port",
    accentColor: "#ef4444",
  },
  commandrunner: {
    name: "CommandRunner",
    phase: "3",
    phaseLabel: "Phase 3",
    tagline: "Not raw shell access. Pre-approved playbooks with full audit trails.",
    description: "Managed CLI and playbook orchestration on the NetRunner Appliance. From basic diagnostics to MSP workflow automation — every command is signed, scoped, and logged.",
    capabilities: [
      { icon: "▶", title: "Tier 1 — Diagnostics", detail: "ping, traceroute, DNS lookup, interface stats, service status. One-click from the dashboard." },
      { icon: "◈", title: "Tier 2 — Device Mgmt", detail: "Restart services, OTA agent updates, rotate device key, clear local cache, system health check." },
      { icon: "⬡", title: "Tier 3 — MSP Orchestration", detail: "Run named playbooks, schedule recurring tasks, trigger alert webhooks, multi-device workflows." },
      { icon: "≡", title: "Audit Trail", detail: "Every command signed and logged. Tenant admin controls which tiers are enabled per device." },
    ],
    applianceRequirement: "subprocess + signed playbook engine · audit log",
    accentColor: "#a78bfa",
  },
};

interface ComingSoonPageProps {
  runner: keyof typeof RUNNERS;
}

export default function ComingSoonPage({ runner }: ComingSoonPageProps) {
  const def = RUNNERS[runner];
  if (!def) return null;

  return (
    <>
      <div className="vl-topbar">
        <div>
          <div className="vl-topbar-title">{def.name}</div>
          <div className="vl-topbar-sub">{def.tagline}</div>
        </div>
        <div className="vl-topbar-spacer" />
        <span style={{
          fontSize: 11, fontWeight: 700, letterSpacing: "0.07em",
          padding: "4px 10px", borderRadius: 6,
          background: "rgba(232,160,32,0.12)", color: "#E8A020",
          textTransform: "uppercase", border: "1px solid rgba(232,160,32,0.25)",
        }}>
          {def.phaseLabel}
        </span>
      </div>

      <div className="vl-main" style={{ display: "flex", flexDirection: "column", gap: 24 }}>

        {/* Hero banner */}
        <div style={{
          background: `linear-gradient(135deg, #0f1f3d 0%, ${def.accentColor}22 100%)`,
          border: `1px solid ${def.accentColor}33`,
          borderRadius: 12,
          padding: "32px 36px",
          position: "relative",
          overflow: "hidden",
        }}>
          {/* Background pattern */}
          <div style={{
            position: "absolute", inset: 0, opacity: 0.04,
            backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }} />
          <div style={{ position: "relative", zIndex: 1 }}>
            <div style={{
              fontSize: 11, fontWeight: 700, letterSpacing: "0.1em",
              textTransform: "uppercase", color: def.accentColor, marginBottom: 12,
            }}>
              {def.phaseLabel}
            </div>
            <div style={{
              fontSize: 28, fontWeight: 800, color: "#ffffff",
              letterSpacing: "-0.025em", marginBottom: 12, lineHeight: 1.2,
            }}>
              {def.name}
            </div>
            <div style={{
              fontSize: 15, color: "rgba(255,255,255,0.65)", lineHeight: 1.6,
              maxWidth: 560,
            }}>
              {def.description}
            </div>
          </div>
        </div>

        {/* Capabilities grid */}
        <div>
          <div style={{
            fontSize: 11, fontWeight: 700, letterSpacing: "0.08em",
            textTransform: "uppercase", color: "var(--text-dim)", marginBottom: 14,
          }}>
            Capabilities
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
            {def.capabilities.map((cap) => (
              <div key={cap.title} className="vl-card" style={{ margin: 0 }}>
                <div className="vl-card-body" style={{ padding: "18px 20px" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                      background: `${def.accentColor}18`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 14, color: def.accentColor,
                    }}>
                      {cap.icon}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
                        {cap.title}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                        {cap.detail}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Appliance requirement + notify row */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <div className="vl-card" style={{ margin: 0, flex: "1 1 300px" }}>
            <div className="vl-card-body" style={{ padding: "18px 20px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--text-dim)", marginBottom: 8 }}>
                NetRunner Appliance Requirement
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.7 }}>
                {def.applianceRequirement}
              </div>
            </div>
          </div>

          <div className="vl-card" style={{ margin: 0, flex: "1 1 300px" }}>
            <div className="vl-card-body" style={{
              padding: "18px 20px",
              display: "flex", flexDirection: "column", justifyContent: "center", gap: 10,
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                In development · Phase {def.phase}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                This runner is on the NetRunner roadmap. WebRunner is live and collecting data now.
              </div>
              <a
                href="/webrunner/live"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  fontSize: 12, fontWeight: 600, color: "var(--accent)",
                  textDecoration: "none",
                }}
              >
                ← Go to WebRunner Live Feed
              </a>
            </div>
          </div>
        </div>

      </div>
    </>
  );
}
