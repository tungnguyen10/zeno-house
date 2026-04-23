## Why

Tenants need a self-service portal to view their room, contract, submit maintenance requests, and manage their profile. Without this, admin must relay all information manually.

## What Changes

- Implement `/tenant` dashboard, `/tenant/contract`, `/tenant/maintenance`, `/tenant/maintenance/new`, `/tenant/profile`, `/tenant/notifications` (stub) pages
- `/tenant/invoices` as a placeholder (full invoices in Phase 2)
- Add `TenantDashboard.vue`, `TenantRoomInfo.vue`, `TenantContractView.vue`, `TenantMaintenanceForm.vue`, `TenantMaintenanceList.vue` components
- Add server routes for tenant self-service reads: `GET /api/tenant/me/room`, `GET /api/tenant/me/contract`, `POST /api/tenant/me/maintenance`
- Add `locales/vi/tenant-portal.json` + `locales/en/tenant-portal.json`
- Mobile-first design using the `tenant.vue` layout with bottom navigation

## Capabilities

### New Capabilities

- `tenant-portal`: Tenant-facing self-service pages — room info, contract view, maintenance submission, profile management

### Modified Capabilities

*(none)*

## Impact

- `app/pages/tenant/` — implements existing stub pages
- `app/components/features/tenant-portal/` — new components
- `server/api/tenant/` — new tenant self-service API routes
- `locales/vi/tenant-portal.json`, `locales/en/tenant-portal.json`
- Depends on `phase1-contracts-module` (view contract), `phase1-rooms-module` (room info)
- Maintenance form in portal also creates records consumed by `phase1-maintenance-module`
