## Why

Buildings are the top-level entity in the property hierarchy — rooms, tenants, and contracts all belong to a building. Without a working Buildings CRUD, no subsequent module can be properly scoped or filtered.

## What Changes

- Add `/admin/buildings`, `/manager/buildings` pages: list, create, detail, edit
- Add `BuildingCard.vue`, `BuildingForm.vue`, `BuildingSelect.vue`, `BuildingStats.vue` components
- Add `useBuildings()` composable with full CRUD + search
- Add server API routes: GET/POST `/api/buildings`, GET/PUT/DELETE `/api/buildings/[id]`
- Add Zod schemas: `createBuildingSchema`, `updateBuildingSchema`
- Add `locales/vi/buildings.json` + `locales/en/buildings.json`

## Capabilities

### New Capabilities

- `buildings-crud`: Full create/read/update/delete for buildings with search and stats display

### Modified Capabilities

*(none)*

## Impact

- `app/pages/admin/buildings/` — new pages (index, new, [id], [id]/edit)
- `app/pages/manager/buildings/` — same pages with manager middleware
- `app/components/features/building/` — new components
- `app/composables/useBuildings.ts` — new composable
- `app/types/buildings.ts` — new types + Zod schemas
- `server/api/buildings/` — new API routes
- `locales/vi/buildings.json`, `locales/en/buildings.json`
- Supabase `buildings` table (migration required)
