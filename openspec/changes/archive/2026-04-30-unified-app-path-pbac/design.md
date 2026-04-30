## Context

Currently, the app has two path trees (`/admin/*`, `/manager/*`) backed by separate layouts (`admin.vue`, `manager.vue`) and URL-prefix middleware (`role.ts`). Both layouts are byte-for-byte identical. The Sidebar computes a base path (`/admin` or `/manager`) from `role` and filters nav items with an `adminOnly` flag.

The result: every feature page is duplicated or maintained in two places, and manager access is controlled by URL membership — not by data. A manager assigned to Building A cannot access Building B data not because of a permission record, but because there is none at all.

## Goals / Non-Goals

**Goals:**
- Single `/app/*` path tree shared by admin and manager users
- Permission-Based Access Control: manager access is driven by `building_managers` records, not URLs
- Admin always bypasses permission checks (implicit full grant)
- Per-building, per-feature granularity: admin can grant `rooms`, `invoices`, etc. independently per building
- Sidebar shows only items the current user has at least one grant for
- Server API routes enforce permissions server-side via a shared helper

**Non-Goals:**
- Tenant path (`/tenant/*`) — unchanged
- Row-level diff within a feature (e.g., "can edit but not delete") — feature-level boolean is sufficient
- Time-limited or expiring permissions — not in scope
- Manager self-service permission requests — admin-only grant flow

## Decisions

### D1 — Single `/app/*` path; no role-prefix routing

Both admin and manager land at `/app/*`. The `role` middleware is removed. A new `app-guard` middleware runs on every `/app/*` route: it checks the user is authenticated and either `admin` or `manager`. Fine-grained permission checks happen inside pages/API routes via composable + server helper.

**Alternative considered**: Keep separate paths, add permission check inside manager routes. Rejected: still duplicates pages; role-by-URL is a conceptual mismatch.

### D2 — `building_managers` junction table with `permissions` JSONB array

```sql
create table building_managers (
  id          uuid primary key default gen_random_uuid(),
  building_id uuid not null references buildings(id) on delete cascade,
  manager_id  uuid not null references profiles(id) on delete cascade,
  permissions text[] not null default '{}',   -- ['rooms','contracts','invoices','tenants','utilities']
  granted_by  uuid not null references profiles(id),
  granted_at  timestamptz not null default now(),
  unique (building_id, manager_id)
);
```

`permissions` is a `text[]` column. Valid values: `rooms`, `contracts`, `invoices`, `tenants`, `utilities`. Admin UI enforces the enum; DB has no constraint to allow future extension without migration.

**Alternative considered**: Separate boolean columns (`can_rooms`, `can_contracts`, …). Rejected: harder to extend; array is easier to iterate in RLS and TypeScript.

**Alternative considered**: JSONB object `{ rooms: true, contracts: false, … }`. Rejected: array membership check (`= ANY(permissions)`) is simpler in SQL than JSON key lookup.

### D3 — `usePermissionsStore` loads grants on session start

After login (or on app boot when session exists), `usePermissionsStore.loadPermissions()` calls `/api/me/permissions` which returns the current user's building_managers rows. The store exposes:

```ts
hasPermission(buildingId: string, feature: string): boolean
// admin: always true
// manager: checks building_managers record
```

Pages that scope to a single building pass `buildingId` + `feature`. The dashboard and list pages (spanning all buildings) check `hasAnyPermission(feature)`.

**Alternative considered**: Load permissions in middleware on every navigation. Rejected: repeated async DB calls on each route change; store caches and only refetches on login/logout.

### D4 — Server-side: `requireBuildingPermission(event, buildingId, feature)` utility

Every building-scoped API route calls this helper before executing business logic. It:
1. Reads the authenticated user and their profile role
2. If `admin` → returns (bypass)
3. If `manager` → queries `building_managers` where `building_id = $1 AND manager_id = $user AND $feature = ANY(permissions)`; throws 403 if not found

This ensures API security is not dependent on client-side permission store.

### D5 — Layouts: `admin.vue` + `manager.vue` → `app.vue`

Single layout. Sidebar receives permissions from `usePermissionsStore` and shows nav items where `hasAnyPermission(feature)` is true. Settings item shown only to admins (`role === 'admin'`).

### D6 — Path migration strategy: move files, update `definePageMeta`

- `/app/pages/admin/*` → `/app/pages/app/*`
- `/app/pages/manager/*` — merge; duplicates (rooms, contracts, invoices, tenants) take the admin version (more complete) after reviewing diffs
- Each page's `definePageMeta` updated: `layout: 'app'`, `middleware: ['auth', 'app-guard']`
- Old paths redirect via `server/routes/redirects.ts` (301) for any bookmarked links

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| Duplicate pages (admin vs manager) have diverged — merge loses features | Diff each pair before choosing winner; cherry-pick unique parts |
| RLS policies need rewrite; missed policy = data leak | Write policies first; test with service-role bypass disabled in staging |
| Middleware change breaks existing sessions mid-deploy | Deploy DB migration + middleware atomically; old `/admin` → redirect catches stale bookmarks |
| Manager with zero building grants sees empty app | Show explicit "No buildings assigned" empty state on dashboard; do not redirect to login |
| `buildings.manager_id` dropped — FK references in other tables | Audit FK usage before migration; `building_managers` replaces all such joins |

## Migration Plan

1. **DB migration** (non-breaking first): Add `building_managers` table; keep `buildings.manager_id` temporarily
2. **Backfill**: Insert existing `(building_id, manager_id)` pairs from `buildings` into `building_managers` with `permissions = '{rooms,contracts,invoices,tenants,utilities}'` (full grant = preserve existing access)
3. **API + RLS**: Update server routes and RLS policies to read from `building_managers`; test thoroughly
4. **Client**: Add `usePermissionsStore`, new middleware, new layout, migrate pages
5. **Drop column**: Remove `buildings.manager_id` in a follow-up migration after smoke testing
6. **Rollback**: If critical bug post-deploy, re-add `buildings.manager_id` from backfill data (kept in migration audit table)

## Open Questions

- Should managers be able to see building names/thumbnails for buildings they _don't_ manage? (useful for handoff context) → default: no, but easy to add a read-only buildings list later
- Utilities permission: is it one feature or split by utility type (electricity vs water)? → treat as one `utilities` feature for now; can be split later
