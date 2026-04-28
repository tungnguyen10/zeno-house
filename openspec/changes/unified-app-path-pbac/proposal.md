## Why

`/admin/*` and `/manager/*` exist as two separate path trees, but admin is just manager with full permissions — the split is artificial and forces duplicated pages, components, and routing logic. Access should be controlled by _data_ (what buildings/features a manager has been granted), not by URL prefix.

## What Changes

- **BREAKING** — Merge `/admin/*` and `/manager/*` into a single `/app/*` path tree
- **BREAKING** — Replace `buildings.manager_id` (one manager per building) with a `building_managers` junction table (many managers, granular permissions per building per feature)
- Remove URL-prefix-based `role` middleware; replace with permission-based middleware
- Add Pinia store (`usePermissionsStore`) that loads the current user's building permissions on session start
- Add composable `useBuildingPermission(buildingId, feature)` to check access within pages
- Add admin UI at `/app/managers` to assign managers to buildings and set per-feature permissions
- Tenant path (`/tenant/*`) stays unchanged
- Server API routes gain `requiresBuildingPermission(event, buildingId, feature)` guard helper

## Capabilities

### New Capabilities

- `building-managers`: Junction table + RLS policies allowing admin to assign managers to multiple buildings with per-feature permission sets
- `permission-store`: Client-side Pinia store that caches the current user's building permissions; composable for checking access in page/component code
- `manager-assignment-ui`: Admin UI to list managers, assign them to buildings, and toggle per-feature permissions (rooms, contracts, invoices, tenants, utilities)

### Modified Capabilities

- `app-navigation`: Sidebar must now render one path tree (`/app/*`) and conditionally show nav items based on the user's permission set rather than hardcoded role
- `server-role-guard`: Extend server guard utility to check `building_managers` permissions for manager-role users in addition to admin bypass
- `supabase-schema`: Add `building_managers` table + RLS policies; deprecate `buildings.manager_id`
- `auth-infrastructure`: Role middleware replaces with permission middleware; auth flow must load permissions after login

## Impact

- **Pages**: All `/app/admin/*` → `/app/*`, all `/app/manager/*` → `/app/*` (with duplicates resolved)
- **Layouts**: `admin.vue` and `manager.vue` layouts merge into a single `app.vue` layout
- **Middleware**: `app/middleware/role.ts` removed; `app/middleware/permission.ts` added
- **DB migration**: New `building_managers` table; `buildings.manager_id` dropped
- **Supabase RLS**: New policies on `building_managers`; existing building/room/contract/invoice/tenant policies updated to join `building_managers`
- **Server API**: `server/utils/permission-guard.ts` new utility; all building-scoped handlers updated
- **Pinia**: New `usePermissionsStore` — loaded at app start, cleared on logout
- **Navigation**: `Sidebar.vue` receives permissions from store; nav items shown/hidden per user's grants
