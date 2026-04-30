## Context

Supabase PostgreSQL is the data store. The `buildings` table already exists (migration 001). RLS is already enabled. Admin and manager both manage buildings, but managers can only see their own (enforced via RLS `manager_id` column). All API calls go through `server/api/` — the composable never touches Supabase directly.

## Goals / Non-Goals

**Goals:**
- Full CRUD pages for admin and manager roles
- Search by name/address (client-side filter on loaded list)
- Stats card: total rooms, available, occupied per building (joined from rooms)
- Confirm-before-delete modal
- Toast notifications on success/error

**Non-Goals:**
- Building image upload (Phase 2)
- Bulk import/export (Phase 2)
- Map view of building locations (Phase 2)

## Decisions

### 1. Same pages duplicated under `/admin/buildings` and `/manager/buildings`

Both role trees get their own page files. They use the same components but different middleware.

**Why**: Nuxt file-based routing requires the files to exist under each role prefix. Sharing logic happens via composable, not page files.

### 2. `useBuildings` composable owns client-side search filtering

The API returns all buildings the user has access to (RLS handles manager scoping). Client-side `filteredBuildings` computed applies the search string.

**Why**: Buildings list is small (< 50 items typical); no need for server-side search pagination at this stage.

### 3. `BuildingSelect` as a standalone component for use in other modules

Rooms and Tenants modules need a building picker. `BuildingSelect.vue` fetches and caches the list internally using `useBuildings()`.

**Why**: Avoids prop drilling a buildings list across parent pages.

### 4. Stats computed via JOIN in API

`GET /api/buildings` returns buildings with an inline `_count` object `{ total_rooms, available_rooms, occupied_rooms }` via a Supabase join.

**Why**: Avoids a separate stats API call per building card.

## Risks / Trade-offs

- **RLS for manager scope** → Manager should only see buildings they manage. The `manager_id` FK on `buildings` already exists in migration 001. RLS policy `buildings_manager_select` already exists and uses `manager_id`. Verify these are correct before implementing.
- **Migration dependency** → Migration 001 already created the `buildings` table and RLS. Migration 003 adds `total_floors INTEGER NOT NULL DEFAULT 1`. Migration 003 must be applied before this module runs.

## Open Questions

- Does a building have a manager FK or is access managed differently? → Resolved: the schema uses `manager_id uuid references profiles(id)` (NOT `owner_id`) — already in migration 001.
