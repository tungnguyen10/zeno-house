## Why

Hệ thống hiện tại không có building-scope enforcement — admin và manager đều thấy toàn bộ data từ tất cả buildings. Manager không thể bị giới hạn theo building được gán, và không có cơ chế kiểm soát per-building destructive permission. Tenant portal cần tenant identity riêng, nhưng trước hết manager access phải được scope đúng để tránh data leak khi portal mở.

## What Changes

- Thêm bảng `user_building_assignments` — gán manager vào buildings kèm flag `can_delete_master_data`
- Thêm scope resolver `getAssignedBuildingIds(event, user)` với lazy cache trên `event.context`
- Cập nhật toàn bộ list/detail/mutation services: manager chỉ thấy và thao tác trên assigned buildings
- List query: silently filter theo scope. Detail read ngoài scope → 404. Mutation ngoài scope → 403
- Thêm capability `billing.corrections` tách khỏi `billing.write` — covers void, reissue, adjustment
- Manager giữ `billing.corrections` mặc định (không break workflow hiện tại)
- Thêm permission helper `canDeleteMasterData(user, buildingId)` — manager mặc định `false`, admin granted `true`
- Guard hard-delete cho room/tenant/contract/service bằng `canDeleteMasterData` thay vì `rooms.delete` thuần tuý
- Thêm trang admin `/settings/managers` để quản lý assignment và `can_delete_master_data` toggle
- Dashboard aggregate lọc theo assigned buildings khi user là manager
- Backfill migration: tất cả managers hiện có được gán vào tất cả buildings hiện có (not a breaking deploy)

## Capabilities

### New Capabilities

- `manager-building-scope`: Scope enforcement toàn diện — scope resolver, assert helpers, filter/404/403 behavior, tất cả domain services (buildings, rooms, tenants, contracts, contract-occupants, contract-payments, contract-renewals, contract-services, building-services, meter-readings, billing periods, invoices, invoice-payments, billing-audit, dashboard), migration + backfill
- `manager-destructive-override`: Per-building destructive permission — `canDeleteMasterData` helper, `billing.corrections` capability, guard hard-delete cho master data, require reason, audit log, UI disable + tooltip
- `manager-assignment-ui`: Admin-only UI tại `/settings/managers` — list managers, view/assign/unassign buildings, toggle `can_delete_master_data`, assignment history, warning khi building không có manager

### Modified Capabilities

- `user-auth`: `billing.corrections` tách khỏi `billing.write`; manager permission set cập nhật

## Impact

- `server/utils/permissions.ts` — thêm `billing.corrections`, cập nhật manager set
- `server/utils/scope.ts` — file mới: `getAssignedBuildingIds`, `assertBuildingScope`
- `server/repositories/assignments.ts` — file mới: CRUD cho `user_building_assignments`
- `server/services/` — 14 service domains cập nhật scope check
- `server/api/assignments/` — endpoints mới cho Spec 3
- `app/pages/settings/managers.vue` — page mới
- `app/utils/constants/navigation.ts` — thêm nav item Settings (admin-only)
- `app/pages/buildings/[id]/settings.vue` — thêm contextual section cho assigned managers
- `supabase/migrations/` — migration mới: `user_building_assignments` table + backfill
