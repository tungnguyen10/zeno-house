## 1. Database — building_managers Schema

- [ ] 1.1 Write migration: create `building_managers` table with columns `id`, `building_id`, `manager_id`, `permissions text[]`, `granted_by`, `granted_at`, `unique(building_id, manager_id)`
- [ ] 1.2 Write migration: enable RLS on `building_managers`; add policies — admin full access, manager reads own rows, tenant no access
- [ ] 1.3 Write migration: backfill `building_managers` from existing `buildings.manager_id` with `permissions = '{rooms,contracts,invoices,tenants,utilities}'`
- [ ] 1.4 Update RLS policies on `buildings`, `rooms`, `contracts`, `invoices`, `tenants`, `utility_readings` to join `building_managers` instead of `buildings.manager_id`
- [ ] 1.5 Write migration: drop `buildings.manager_id` column

## 2. Server — Permission Guard & API

- [ ] 2.1 Create `server/utils/requireBuildingPermission.ts` — utility that takes `(event, buildingId, feature)`, bypasses for admin, checks `building_managers` for manager, throws 401/403
- [ ] 2.2 Create `server/api/me/permissions.get.ts` — returns `{ isAdmin: true }` for admin; returns array of `{ building_id, building_name, permissions }` for manager via `building_managers` join `buildings`
- [ ] 2.3 Update building-scoped API routes (rooms, contracts, invoices, tenants, utility_readings) to call `requireBuildingPermission` instead of `requireRole`

## 3. Client — Permissions Store & Composable

- [ ] 3.1 Create `app/stores/permissions.ts` — `usePermissionsStore` with `grants ref`, `loadPermissions()` action, `hasPermission(buildingId, feature)` method, `hasAnyPermission(feature)` method, `$reset()`
- [ ] 3.2 Admin branch in store: when `GET /api/me/permissions` returns `{ isAdmin: true }`, `hasPermission` and `hasAnyPermission` always return `true`
- [ ] 3.3 Update `useAuthStore.$reset()` and logout flow to call `usePermissionsStore().$reset()`

## 4. Middleware — Replace role.ts with app-guard.ts

- [ ] 4.1 Create `app/middleware/app-guard.ts` — checks `role === 'admin' || role === 'manager'`; also calls `loadPermissions()` if store is empty (hard refresh case)
- [ ] 4.2 Delete `app/middleware/role.ts`, `app/middleware/admin.ts`, `app/middleware/manager.ts`
- [ ] 4.3 Add server-side redirects: `server/routes/redirects.ts` — 301 from `/admin/(.*)` → `/app/$1` and `/manager/(.*)` → `/app/$1`

## 5. Layouts — Merge admin.vue + manager.vue → app.vue

- [ ] 5.1 Create `app/layouts/app.vue` (identical shell to current `admin.vue` — sidebar + header + main)
- [ ] 5.2 Delete `app/layouts/admin.vue` and `app/layouts/manager.vue`

## 6. Sidebar — Permission-Filtered Navigation

- [ ] 6.1 Rewrite `app/components/layout/Sidebar.vue` — remove `base` computed; all links point to `/app/...`
- [ ] 6.2 Import `usePermissionsStore`; filter nav items using `hasAnyPermission(feature)` for manager-gated items (rooms, contracts, invoices, tenants, utilities)
- [ ] 6.3 Show "Quản lý người quản lý" and "Cài đặt" nav items only when `role === 'admin'`

## 7. Pages — Move and Reconcile

- [ ] 7.1 Move all `app/pages/admin/*` → `app/pages/app/*`; update `definePageMeta` to `layout: 'app'`, `middleware: ['auth', 'app-guard']`
- [ ] 7.2 Diff each `app/pages/manager/<feature>` against the moved `app/pages/app/<feature>`; cherry-pick any unique manager-specific content then delete manager pages
- [ ] 7.3 Delete `app/pages/manager/` directory entirely
- [ ] 7.4 Add in-page permission guard to building-scoped pages: use `hasPermission(buildingId, feature)` and show 403 empty state if false

## 8. Admin UI — Manager Assignment

- [ ] 8.1 Create `app/pages/app/managers/index.vue` — table of all manager profiles with building assignment summary; admin-only (redirect if not admin)
- [ ] 8.2 Create `app/components/features/managers/AssignmentForm.vue` — building selector + feature checkbox grid (`rooms`, `contracts`, `invoices`, `tenants`, `utilities`)
- [ ] 8.3 Create `server/api/managers/index.get.ts` — list all profiles with `role = 'manager'` plus their `building_managers` rows
- [ ] 8.4 Create `server/api/managers/[id]/buildings/index.post.ts` — insert or update `building_managers` row (upsert on `unique(building_id, manager_id)`)
- [ ] 8.5 Create `server/api/managers/[id]/buildings/[buildingId].delete.ts` — delete `building_managers` row
- [ ] 8.6 Add "Quản lý người quản lý" link to sidebar (admin only) pointing to `/app/managers`

## 9. i18n — Translation Keys

- [ ] 9.1 Add `navigation.sidebar.managers` key to `locales/vi/navigation.json` and `locales/en/navigation.json`
- [ ] 9.2 Add keys for manager assignment UI strings (page title, form labels, permissions labels) to `locales/vi/` and `locales/en/`

## 10. Verification

- [ ] 10.1 Run `npm run typecheck` — zero new errors
- [ ] 10.2 Run `npm run lint` — zero new errors
- [ ] 10.3 Test: admin logs in → lands on `/app`, sees all sidebar items, can access all features
- [ ] 10.4 Test: manager logs in → lands on `/app`, sees only permitted sidebar items, 403 state on unpermitted building features
- [ ] 10.5 Test: navigate to `/admin/rooms` → 301 redirect to `/app/rooms`
- [ ] 10.6 Test: admin assigns manager to building with `rooms` only → manager can access rooms, blocked on invoices
- [ ] 10.7 Test: admin revokes last building assignment → manager sees empty-state dashboard
- [ ] 10.8 Test: tenant navigates to `/app` → redirected to `/login`
