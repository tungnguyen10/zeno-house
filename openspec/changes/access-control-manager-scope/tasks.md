## 1. Database & Migration (Spec 1 foundation)

- [ ] 1.1 Tạo migration `user_building_assignments`: table schema, unique constraint `(user_id, building_id)`, index trên `user_id`
- [ ] 1.2 Thêm backfill SQL trong migration: cross-join tất cả managers × buildings, `can_delete_master_data = false`
- [ ] 1.3 Cập nhật `app/types/database.types.ts` với type mới cho `user_building_assignments`

## 2. Permission Model (Spec 1 + Spec 2 foundation)

- [ ] 2.1 Thêm `billing.corrections` vào `permissions.ts` — admin set và manager set
- [ ] 2.2 Cập nhật `server/services/billing/invoices.ts`: `void`, `reissue`, `adjustment` check `billing.corrections` thay vì `billing.write`
- [ ] 2.3 Thêm type declaration cho `event.context.__buildingScope` trong `H3EventContext` (tại `app/types/auth.ts` hoặc `server/utils/scope.ts`)

## 3. Scope Resolver & Assignment Repository (Spec 1 core)

- [ ] 3.1 Tạo `server/repositories/assignments.ts`:
  - `findBuildingIdsByUser(event, userId): Promise<string[]>`
  - `findByUserAndBuilding(event, userId, buildingId): Promise<Assignment | null>`
  - `findAllWithBuildings(event): Promise<ManagerAssignment[]>` — dùng cho Spec 3
  - `insert(event, input): Promise<Assignment>`
  - `update(event, id, input): Promise<Assignment>`
  - `remove(event, id): Promise<void>`
- [ ] 3.2 Tạo `server/utils/scope.ts`:
  - `getAssignedBuildingIds(event, user): Promise<string[] | null>` — lazy cache
  - `assertBuildingScope(event, user, buildingId, mode: 'read' | 'write'): Promise<void>` — read→404, write→403
  - `canDeleteMasterData(event, user, buildingId): Promise<boolean>`

## 4. Scope — Domain Services (Spec 1, 14 domains)

- [ ] 4.1 `server/services/buildings/index.ts`:
  - `list`: filter `buildingIds` từ scope
  - `get`: `assertBuildingScope(mode: 'read')`
  - `update`, `delete`: `assertBuildingScope(mode: 'write')`
- [ ] 4.2 `server/services/rooms/index.ts`:
  - `list`: filter `buildingIds` từ scope
  - `get`, `getByBuildingAndRoomSlug`: `assertBuildingScope(mode: 'read')`
  - `create`: `assertBuildingScope(mode: 'write')` theo `building_id` của room
  - `update`, `remove`, `bulkAction`: `assertBuildingScope(mode: 'write')`
- [ ] 4.3 `server/services/tenants/index.ts`:
  - `list`: filter qua contract join (`building_id IN assignedIds`)
  - `get`: verify tenant có contract trong assigned buildings → 404 nếu ngoài scope
- [ ] 4.4 `server/services/contracts/index.ts`:
  - `list`: filter `buildingIds` từ scope
  - `get`: `assertBuildingScope(mode: 'read')` theo `room.buildingId`
  - `create`: `assertBuildingScope(mode: 'write')` theo building của room
  - `update`, `remove`, `bulkAction`: `assertBuildingScope(mode: 'write')`
- [ ] 4.5 `server/services/contract-occupants.ts`: `assertBuildingScope` via `contract → room → building`
- [ ] 4.6 `server/services/contract-payments.ts`: `assertBuildingScope` via `contract → room → building`
- [ ] 4.7 `server/services/contract-renewals.ts`: `assertBuildingScope` via `contract → room → building`
- [ ] 4.8 `server/services/contract-services.ts`: `assertBuildingScope` via `contract.building_id` hoặc `building_id` trực tiếp
- [ ] 4.9 `server/services/building-services/`: `assertBuildingScope` theo `building_id`
- [ ] 4.10 `server/services/meter-readings/`: filter list theo `buildingIds`, `assertBuildingScope` cho detail/write
- [ ] 4.11 `server/services/billing/periods.ts`:
  - `list`: filter `buildingIds`
  - `get`, draft, issue, close, unissue, overview: `assertBuildingScope`
- [ ] 4.12 `server/services/billing/invoices.ts`: `assertBuildingScope` via `invoice → billing_period → building_id` (2-hop)
- [ ] 4.13 `server/services/billing/payments.ts`: `assertBuildingScope` via `invoice → period → building`
- [ ] 4.14 `server/services/billing/audit.ts`: `assertBuildingScope` theo `billing_period.building_id`
- [ ] 4.15 `server/repositories/dashboard/index.ts`: accept `buildingIds?: string[]` parameter, inject `.in('building_id', buildingIds)` vào tất cả queries

## 5. Dashboard Service Scope (Spec 1)

- [ ] 5.1 `server/services/dashboard/index.ts` (hoặc nơi gọi repository): resolve scope → pass `buildingIds` vào `DashboardRepository.getSummary`
- [ ] 5.2 Verify global counts (tenants, contracts) cũng được filter đúng khi manager

## 6. Destructive Override (Spec 2)

- [ ] 6.1 `server/services/rooms/index.ts` — `remove`: thay `can(user, 'rooms.delete')` thành `canDeleteMasterData(event, user, room.buildingId)`; yêu cầu `reason` field; ghi audit
- [ ] 6.2 `server/services/tenants/index.ts` — `remove`: tương tự, dùng `canDeleteMasterData` theo building của contract active gần nhất hoặc require `buildingId` explicit
- [ ] 6.3 `server/services/contracts/index.ts` — `remove`: `canDeleteMasterData(event, user, contract.buildingId)`; yêu cầu `reason`; ghi audit
- [ ] 6.4 `server/services/building-services/` — hard-delete: `canDeleteMasterData` theo `building_id`
- [ ] 6.5 `server/services/contract-services.ts` — hard-delete: `canDeleteMasterData` theo building
- [ ] 6.6 Cập nhật validators: thêm `reason` field (required string) vào delete schemas cho rooms/tenants/contracts
- [ ] 6.7 Cập nhật API handlers delete (rooms, tenants, contracts): pass `reason` từ request body vào service

## 7. Assignment API (Spec 3 backend)

- [ ] 7.1 `server/api/assignments/index.get.ts` — list tất cả managers + assignments (admin-only)
- [ ] 7.2 `server/api/assignments/index.post.ts` — tạo assignment (admin-only)
- [ ] 7.3 `server/api/assignments/[id].patch.ts` — toggle `can_delete_master_data` (admin-only)
- [ ] 7.4 `server/api/assignments/[id].delete.ts` — xoá assignment (admin-only)
- [ ] 7.5 `server/api/assignments/buildings-without-manager.get.ts` — danh sách buildings không có manager (admin-only, dùng cho warning UI)
- [ ] 7.6 Tạo validators `app/utils/validators/assignments.ts`: create schema, update schema

## 8. Settings UI (Spec 3 frontend)

- [ ] 8.1 Thêm "Settings" nav item vào `app/utils/constants/navigation.ts` (chỉ hiển thị với `isAdmin`)
- [ ] 8.2 Cập nhật `app/components/app/AppSidebar.vue`: conditional render Settings nav item khi `isAdmin`
- [ ] 8.3 Tạo `app/pages/settings/managers.vue`:
  - List tất cả managers với số buildings được gán
  - Per-manager: expandable row hiển thị danh sách assigned buildings
  - Action: Assign building (modal/dropdown select), Unassign, Toggle `can_delete_master_data`
  - Warning indicator cho buildings chưa có manager
  - Admin-only page guard (middleware hoặc `definePageMeta`)
- [ ] 8.4 Tạo composable `app/composables/useManagerAssignments.ts`: fetch, assign, unassign, toggle
- [ ] 8.5 Cập nhật `app/pages/buildings/[id]/settings.vue`: thêm section "Managers" — list assigned managers (read-only với manager, với link về `/settings/managers` cho admin)

## 9. Tests (Spec 1 + Spec 2 cross-building isolation)

- [ ] 9.1 Test scope resolver: admin returns null, manager returns string[], cache hit không query lại
- [ ] 9.2 Test buildings: manager thấy assigned, không thấy unassigned
- [ ] 9.3 Test rooms: list filter, detail 404 ngoài scope, mutation 403 ngoài scope
- [ ] 9.4 Test tenants: list qua contract join, không leak tenant của unassigned building
- [ ] 9.5 Test contracts: list filter, detail 404, create 403 (unassigned room)
- [ ] 9.6 Test billing periods: list filter, detail 404, issue 403 ngoài scope
- [ ] 9.7 Test invoices: detail 404 ngoài scope (2-hop: invoice→period→building)
- [ ] 9.8 Test destructive override: manager mặc định 403 delete, manager với flag delete thành công + reason required, flag building A không affect building B
- [ ] 9.9 Test billing.corrections: manager có thể void/reissue/adjustment, billing.write không đủ cho void
- [ ] 9.10 Test dashboard: manager scope chỉ tính assigned buildings
- [ ] 9.11 Test API direct call bypass: scope enforced dù không qua UI
