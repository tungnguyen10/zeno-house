## 1. Database & Types

- [ ] 1.1 Add migration 003: `ALTER TABLE buildings ADD COLUMN total_floors INTEGER NOT NULL DEFAULT 1` (`buildings` table already exists from migration 001 with `id`, `name`, `address`, `manager_id`, `description`, `created_at`, `updated_at`)
- [ ] 1.2 Verify existing RLS policies in migration 001 use `manager_id` (not `owner_id`): `buildings_admin_all`, `buildings_manager_select`, `buildings_manager_insert`, `buildings_manager_update`, `buildings_manager_delete`
- [ ] 1.3 Create `app/types/buildings.ts` — `Building` interface, `createBuildingSchema`, `updateBuildingSchema` (Zod)
- [ ] 1.4 Fill `i18n/locales/vi/buildings.json` + `i18n/locales/en/buildings.json` with required keys (files already exist)

## 2. API Routes

- [ ] 2.1 Create `server/api/buildings/index.get.ts` — list buildings (with room stats join)
- [ ] 2.2 Create `server/api/buildings/index.post.ts` — create building (Zod validate, auth check)
- [ ] 2.3 Create `server/api/buildings/[id].get.ts` — get single building with stats
- [ ] 2.4 Create `server/api/buildings/[id].put.ts` — update building
- [ ] 2.5 Create `server/api/buildings/[id].delete.ts` — delete building (block if has rooms)

## 3. Composable

- [ ] 3.1 Create `app/composables/useBuildings.ts` — `buildings`, `loading`, `error`, `filteredBuildings` (search computed), `fetchBuildings()`, `getBuilding(id)`, `createBuilding()`, `updateBuilding()`, `deleteBuilding()`

## 4. Components

- [ ] 4.1 Create `app/components/features/building/Card.vue` — building name, address, stats, edit/delete actions
- [ ] 4.2 Create `app/components/features/building/Form.vue` — name, address, description fields with validation
- [ ] 4.3 Create `app/components/features/building/Select.vue` — dropdown to pick a building (used by Rooms module)
- [ ] 4.4 Create `app/components/features/building/Stats.vue` — total/available/occupied counters

## 5. Pages (Admin)

- [ ] 5.1 Create `app/pages/admin/buildings/index.vue` — list + search, delete confirm modal
- [ ] 5.2 Create `app/pages/admin/buildings/new.vue` — create form
- [ ] 5.3 Create `app/pages/admin/buildings/[id].vue` — detail with stats
- [ ] 5.4 Create `app/pages/admin/buildings/[id]/edit.vue` — edit form

## 6. Pages (Manager)

- [ ] 6.1 Create `app/pages/manager/buildings/index.vue`
- [ ] 6.2 Create `app/pages/manager/buildings/new.vue`
- [ ] 6.3 Create `app/pages/manager/buildings/[id].vue`
- [ ] 6.4 Create `app/pages/manager/buildings/[id]/edit.vue`
