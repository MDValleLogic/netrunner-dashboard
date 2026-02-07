# ValleLogic / NetRunner — Founder Notes (Source of Truth)

## What this is
This file is the living “control panel” for the MVP. It keeps the vision and the next steps stable across days, threads, and helpers.

---

## MVP Identity (locked)
ValleLogic NetRunner is a single SaaS application designed for multiple logical tenants, each with independently onboarded, centrally managed plug-and-play edge appliances, with tenant-scoped visibility.

---

## Core Objects (do not break)
- Tenant: an organization boundary. Tenants do not see each other.
- User: belongs to exactly one tenant.
- Device (NetRunner): may be unassigned at first, then assigned to a tenant.
- Data: always tenant-scoped.

---

## Device Lifecycle (MVP)
1) Device boots (no secrets baked in)
2) Device registers/heartbeats -> appears as UNASSIGNED
3) Admin assigns device to tenant
4) Device pulls config -> begins tests
5) Admin can revoke device -> device becomes UNASSIGNED (or disabled)

---

## Production Entry Points
- Product portal: https://app.vallelogic.com/netrunner
- basePath: /netrunner (virtual mount)

basePath rule:
- Browser shows /netrunner/...
- Code uses internal routes like /login, /dashboard
- Never hardcode /netrunner inside code

---

## Open Items (close in this order)
1) Multi-tenant schema + tenant-scoped queries
2) Device onboarding: unassigned -> assigned
3) Golden image for 10 internal pilot appliances
4) Pilot kit: instructions + onboarding email
5) Dashboard UX polish

---

## Non-goals (for now)
Billing, RBAC, enterprise SSO, HA, full onboarding flows.

