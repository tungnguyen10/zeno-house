## Why

Current stub pages use generic `UCard` + icon + dash — no visual hierarchy, no personality. Before building any Phase 1 module, we need agreed patterns so every page ships consistent from day one instead of refactoring repeatedly after the fact.

Reference bar: Linear (data density, alert-first), Vercel (clean whitespace, typography), Raycast (micro-interactions, active states), Resend (card composition, muted palette).

## What Changes

- Establish admin/manager page shell pattern: `PageHeader` + content zone + action slot
- Establish admin KPI card pattern: large number, label, color accent, optional alert zone
- Establish tenant portal home pattern: hero room card + quick action row
- Establish standard list page pattern: filter bar + table + empty state
- Establish standard form page pattern: card form + validation + sticky footer actions
- Rewrite `app/pages/admin/index.vue` as the reference implementation of the new admin pattern
- Rewrite `app/pages/tenant/index.vue` as the reference implementation of the tenant pattern

## Capabilities

### New Capabilities

- `ui-page-header`: Reusable `PageHeader.vue` — title, subtitle, right-side action slot
- `ui-stat-card`: `StatCard.vue` — KPI number block with label, icon, color variant, alert dot
- `ui-alert-banner`: `AlertBanner.vue` — dismissible top-of-page alert strip (admin only)
- `ui-empty-state`: `EmptyState.vue` — illustration + message + CTA for empty lists
- `ui-tenant-hero`: `TenantRoomHero.vue` — tenant home hero: room number, building, countdown

### Modified Capabilities

- `admin-dashboard`: rewrite with real KPI pattern + alert-first zone + activity feed placeholder
- `tenant-home`: rewrite with hero card + quick action row instead of generic info cards

## Impact

- `app/components/ui/` — new shared components (PageHeader, StatCard, AlertBanner, EmptyState)
- `app/components/features/tenant-portal/RoomHero.vue` — tenant hero card
- `app/pages/admin/index.vue` — rewrite as reference
- `app/pages/tenant/index.vue` — rewrite as reference
- No API routes, no DB changes, no i18n additions (uses existing keys)
- All Phase 1 modules implement against these patterns — no refactor needed later
