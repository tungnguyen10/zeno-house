## 1. Database & Types

- [x] 1.1 Add migration 003: `ALTER TABLE buildings ADD COLUMN total_floors INTEGER NOT NULL DEFAULT 1` (already in 003_phase1_schema_additions.sql)
- [x] 1.2 Verify existing RLS policies — updated in 004_building_managers.sql to use `manages_building()` helper instead of `manager_id`
- [x] 1.3 Create `app/types/buildings.ts` — `Building` interface, `createBuildingSchema`, `updateBuildingSchema` (Zod)
- [x] 1.4 Fill `i18n/locales/vi/buildings.json` + `i18n/locales/en/buildings.json` with required keys

## 2. API Routes

- [x] 2.1 Create `server/api/buildings/index.get.ts` — list buildings with room stats join
- [x] 2.2 Create `server/api/buildings/index.post.ts` — create building (Zod validate, auth check)
- [x] 2.3 Create `server/api/buildings/[id].get.ts` — get single building with stats
- [x] 2.4 Create `server/api/buildings/[id].put.ts` — update building
- [x] 2.5 Create `server/api/buildings/[id].delete.ts` — delete building (block if has rooms)

## 3. Composable

- [x] 3.1 Create `app/composables/useBuildings.ts` — `buildings`, `loading`, `error`, `filteredBuildings` (search computed), `fetchBuildings()`, `getBuilding(id)`, `createBuilding()`, `updateBuilding()`, `deleteBuilding()`

## 4. Components

- [x] 4.1 Create `app/components/features/building/Card.vue` — building name, address, stats, edit/delete actions
- [x] 4.2 Create `app/components/features/building/Form.vue` — name, address, description fields with validation
- [x] 4.3 Create `app/components/features/building/Select.vue` — dropdown to pick a building (used by Rooms module)
- [x] 4.4 Create `app/components/features/building/Stats.vue` — total/available/occupied counters

## 5. Pages (Admin)

- [x] 5.1 Create `app/pages/app/buildings/index.vue` — list + search, delete confirm modal (unified path replaces admin + manager)
- [x] 5.2 Create `app/pages/app/buildings/new.vue` — create form
- [x] 5.3 Create `app/pages/app/buildings/[id]/index.vue` — detail with stats
- [x] 5.4 Create `app/pages/app/buildings/[id]/edit.vue` — edit form

## 6. Pages (Manager)

- [x] 6.1 Covered by unified `app/pages/app/buildings/index.vue` (path unification from unified-app-path-pbac change)
- [x] 6.2 Covered by `app/pages/app/buildings/new.vue`
- [x] 6.3 Covered by `app/pages/app/buildings/[id]/index.vue`
- [x] 6.4 Covered by `app/pages/app/buildings/[id]/edit.vue`
