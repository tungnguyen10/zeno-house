## Why

Tenants submit maintenance requests via the portal (1.7). Admin/manager need a dedicated module to view, triage, assign, and track resolution of these requests with full status history.

## What Changes

- Add `/admin/maintenance`, `/manager/maintenance` pages: list all requests, detail/action page
- Add `MaintenanceCard.vue`, `MaintenanceStatusBadge.vue`, `MaintenanceTimeline.vue`, `MaintenanceFilters.vue` components
- Add `useMaintenance()` composable with CRUD, status updates, assignment
- Extend server API: GET/PATCH `/api/maintenance/[id]`, GET `/api/maintenance` with filters
- Add `locales/vi/maintenance.json` + `locales/en/maintenance.json`

## Capabilities

### New Capabilities

- `maintenance-management`: Admin/manager view, triage, assign, and resolve maintenance requests submitted by tenants; full status timeline history

### Modified Capabilities

*(none)*

## Impact

- `app/pages/admin/maintenance/` and `app/pages/manager/maintenance/` — new pages
- `app/components/features/maintenance/` — new components
- `app/composables/useMaintenance.ts` — new composable
- `app/types/maintenance.ts` — new types + Zod schemas
- `server/api/maintenance/` — extends routes created in 1.7 tenant portal
- `locales/vi/maintenance.json`, `locales/en/maintenance.json`
- Supabase `maintenance_requests` table (migration in this change)
- Depends on `phase1-tenant-portal` (tenant creates requests there)
