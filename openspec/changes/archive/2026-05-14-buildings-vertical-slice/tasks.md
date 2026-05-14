## 1. Database

- [x] 1.1 Tạo `supabase/migrations/20260514000000_create_buildings.sql` — bảng `buildings` với đúng columns, constraints, và RLS policies
- [x] 1.2 Apply migration lên Supabase (qua Dashboard hoặc CLI) và regenerate `app/types/database.types.ts`

## 2. Shared Types & Validators

- [x] 2.1 Tạo `app/types/buildings.ts` — export `BuildingStatus`, `Building` interface, `BuildingInput`, `BuildingUpdateInput`
- [x] 2.2 Tạo `app/utils/validators/buildings.ts` — export `buildingCreateSchema`, `buildingUpdateSchema` và inferred types
- [x] 2.3 Tạo `app/utils/mappers/buildings.ts` — export `mapBuilding(row)` DB row → Building DTO

## 3. Server Layer

- [x] 3.1 Tạo `server/repositories/buildings/index.ts` — export `BuildingRepository` với `findAll`, `findById`, `insert`, `update`, `remove`
- [x] 3.2 Tạo `server/services/buildings/index.ts` — export `BuildingService` với `list`, `get`, `create`, `update`, `remove` (với permission check)
- [x] 3.3 Tạo `server/api/buildings/index.get.ts` — GET /api/buildings với pagination
- [x] 3.4 Tạo `server/api/buildings/index.post.ts` — POST /api/buildings
- [x] 3.5 Tạo `server/api/buildings/[id].get.ts` — GET /api/buildings/:id
- [x] 3.6 Tạo `server/api/buildings/[id].patch.ts` — PATCH /api/buildings/:id
- [x] 3.7 Tạo `server/api/buildings/[id].delete.ts` — DELETE /api/buildings/:id

## 4. Client Composables

- [x] 4.1 Tạo `app/composables/buildings/useBuildingList.ts` — useFetch list với pagination
- [x] 4.2 Tạo `app/composables/buildings/useBuildingForm.ts` — form state, submitCreate, submitUpdate

## 5. UI Components & Pages

- [x] 5.1 Tạo `app/components/buildings/BuildingCard.vue` — display card với name, address, status badge, totalRooms
- [x] 5.2 Tạo `app/components/buildings/BuildingForm.vue` — shared form với fields name, address, description, status
- [x] 5.3 Tạo `app/pages/buildings/index.vue` — list page với grid, empty state, pagination
- [x] 5.4 Tạo `app/pages/buildings/create.vue` — create page dùng BuildingForm + useBuildingForm
- [x] 5.5 Tạo `app/pages/buildings/[id]/index.vue` — detail page với Edit/Delete actions
- [x] 5.6 Tạo `app/pages/buildings/[id]/edit.vue` — edit page với pre-filled BuildingForm
