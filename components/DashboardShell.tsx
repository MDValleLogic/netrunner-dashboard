"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

// ─── SVG Icons (inline, zero deps) ────────────────────────────────
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
  signal: () => (
    <svg className="vl-nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M1 12C1 12 3.5 6 8 6s7 6 7 6"/>
      <path d="M3.5 12C3.5 12 5 9 8 9s4.5 3 4.5 3"/>
      <circle cx="8" cy="12" r="1" fill="currentColor"/>
    </svg>
  ),
  chevronRight: () => (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M3 2l4 3-4 3"/>
    </svg>
  ),
};

// ─── Nav config ───────────────────────────────────────────────────
const NAV = [
  {
    section: "Monitor",
    links: [
      { href: "/dashboard",           label: "Overview",       icon: "grid"     },
      { href: "/webrunner/live",      label: "Live Feed",      icon: "activity" },
      { href: "/webrunner/history",   label: "History",        icon: "clock"    },
    ],
  },
  {
    section: "System",
    links: [
      { href: "/netrunner/dashboard", label: "NetRunner",      icon: "signal"   },
      { href: "/webrunner/config",    label: "Config",         icon: "settings" },
      { href: "/setup",               label: "Device Setup",   icon: "cpu"      },
    ],
  },
];

// ─── Component ────────────────────────────────────────────────────
export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="vl-shell">
      {/* Sidebar */}
      <aside className="vl-sidebar">
        {/* Logo */}
        <div className="vl-sidebar-logo">
          <div className="vl-sidebar-logo-mark">ValleLogic</div>
          <div className="vl-sidebar-logo-sub">NetRunner · WebRunner</div>
        </div>

        {/* Nav */}
        <nav className="vl-nav">
          {NAV.map((group) => (
            <div key={group.section}>
              <div className="vl-nav-section">{group.section}</div>
              {group.links.map((link) => {
                const IconComp = Icon[link.icon as keyof typeof Icon];
                const isActive =
                  pathname === link.href ||
                  (link.href !== "/dashboard" && pathname?.startsWith(link.href));
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

        {/* Footer */}
        <div className="vl-sidebar-footer">
          <div style={{ marginBottom: 3 }}>vallelogic.com</div>
          <div style={{ fontSize: 10 }}>v0.1 · MVP</div>
        </div>
      </aside>

      {/* Main content area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {children}
      </div>
    </div>
  );
}
