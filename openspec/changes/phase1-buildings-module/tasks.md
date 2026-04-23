## 1. Database & Types

- [ ] 1.1 Create Supabase migration: `buildings` table (`id`, `name`, `address`, `owner_id`, `description`, `created_at`)
- [ ] 1.2 Add RLS policies: `buildings_admin_all`, `buildings_manager_select` (own only), `buildings_manager_insert`, `buildings_manager_update`, `buildings_manager_delete`
- [ ] 1.3 Create `app/types/buildings.ts` — `Building` interface, `createBuildingSchema`, `updateBuildingSchema` (Zod)
- [ ] 1.4 Create `locales/vi/buildings.json` + `locales/en/buildings.json`

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
