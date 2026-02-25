"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const Icon = {
  grid: () => (
    <svg className="vl-nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="1" y="1" width="6" height="6" rx="1.5"/>
      <rect x="9" y="1" width="6" height="6" rx="1.5"/>
      <rect x="1" y="9" width="6" height="6" rx="1.5"/>
      <rect x="9" y="9" width="6" height="6" rx="1.5"/>
    </svg>
  ),
  activity: () => (
    <svg className="vl-nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <polyline points="1,8 4,4 7,10 10,6 13,8 15,7"/>
    </svg>
  ),
  clock: () => (
    <svg className="vl-nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="8" r="6.5"/>
      <polyline points="8,4.5 8,8 10.5,10"/>
    </svg>
  ),
  settings: () => (
    <svg className="vl-nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="8" r="2.5"/>
      <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M2.9 2.9l1.1 1.1M12 12l1.1 1.1M13.1 2.9L12 4M4 12l-1.1 1.1"/>
    </svg>
  ),
  cpu: () => (
    <svg className="vl-nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="4" y="4" width="8" height="8" rx="1"/>
      <path d="M6 4V2M8 4V2M10 4V2M6 14v-2M8 14v-2M10 14v-2M4 6H2M4 8H2M4 10H2M14 6h-2M14 8h-2M14 10h-2"/>
    </svg>
  ),
  users: () => (
    <svg className="vl-nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="6" cy="5" r="2.5"/>
      <path d="M1 13c0-2.5 2-4 5-4s5 1.5 5 4"/>
      <path d="M11 2.5a2.5 2.5 0 0 1 0 5M15 13c0-2-1.5-3.5-4-3.8"/>
    </svg>
  ),
  route: () => (
    <svg className="vl-nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="3" cy="4" r="2"/>
      <circle cx="13" cy="12" r="2"/>
      <path d="M3 6c0 4 10 2 10 6"/>
    </svg>
  ),
  zap: () => (
    <svg className="vl-nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <polyline points="9,1 5,9 8,9 7,15 11,7 8,7 9,1"/>
    </svg>
  ),
  storm: () => (
    <svg className="vl-nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 6.5A4.5 4.5 0 0 1 11.5 5a3 3 0 0 1-.5 6H4a3 3 0 0 1-1-5.8"/>
      <path d="M7 10l-1.5 3M9 10l-1.5 3"/>
    </svg>
  ),
  terminal: () => (
    <svg className="vl-nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="1" y="2" width="14" height="12" rx="2"/>
      <polyline points="4,6 7,8 4,10"/>
      <line x1="8" y1="10" x2="12" y2="10"/>
    </svg>
  ),
};

const NAV: Array<{
  section: string;
  links: Array<{ href: string; label: string; icon: keyof typeof Icon; phase?: string; disabled?: boolean }>;
}> = [
  {
    section: "WebRunner",
    links: [
      { href: "/dashboard",         label: "Overview",      icon: "grid"     },
      { href: "/webrunner/live",    label: "Live Feed",     icon: "activity" },
      { href: "/webrunner/history", label: "History",       icon: "clock"    },
      { href: "/webrunner/config",  label: "Config",        icon: "settings" },
    ],
  },
  {
    section: "Coming Soon",
    links: [
      { href: "/routerunner",   label: "RouteRunner",   icon: "route",    phase: "P2", disabled: true },
      { href: "/speedrunner",   label: "SpeedRunner",   icon: "zap",      phase: "P2", disabled: true },
      { href: "/stormrunner",   label: "StormRunner",   icon: "storm",    phase: "P3", disabled: true },
      { href: "/commandrunner", label: "CommandRunner", icon: "terminal", phase: "P3", disabled: true },
    ],
  },
  {
    section: "System",
    links: [
      { href: "/setup",          label: "Device Setup", icon: "cpu"   },
      { href: "/settings/users", label: "Users",        icon: "users" },
    ],
  },
];

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="vl-shell">
      <aside className="vl-sidebar">
        <div className="vl-sidebar-logo">
          <img
            src="/vallelogic-logo-white.png"
            alt="ValleLogic"
            style={{ width: "85%", maxWidth: 160, margin: "0 auto", display: "block" }}
          />
        </div>

        <nav className="vl-nav">
          {NAV.map((group) => (
            <div key={group.section}>
              <div className="vl-nav-section">{group.section}</div>
              {group.links.map((link) => {
                const IconComp = Icon[link.icon];
                const isActive =
                  !link.disabled &&
                  (pathname === link.href ||
                    (link.href !== "/dashboard" && pathname?.startsWith(link.href)));

                if (link.disabled) {
                  return (
                    <div
                      key={link.href}
                      className="vl-nav-link vl-nav-link-disabled"
                      title={`${link.label} — Phase ${link.phase?.replace("P", "")} · Coming Soon`}
                    >
                      <IconComp />
                      <span style={{ flex: 1 }}>{link.label}</span>
                      {link.phase && (
                        <span style={{
                          fontSize: 9, fontWeight: 700, letterSpacing: "0.06em",
                          padding: "2px 5px", borderRadius: 4,
                          background: "rgba(232,160,32,0.15)",
                          color: "#E8A020", textTransform: "uppercase", lineHeight: 1,
                        }}>
                          {link.phase}
                        </span>
                      )}
                    </div>
                  );
                }

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`vl-nav-link${isActive ? " active" : ""}`}
                  >
                    <IconComp />
                    {link.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="vl-sidebar-footer">
          <div style={{ marginBottom: 3 }}>vallelogic.com</div>
          <div style={{ fontSize: 10 }}>v0.2 · MVP</div>
        </div>
      </aside>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {children}
      </div>
    </div>
  );
}
