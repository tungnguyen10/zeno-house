## 1. Database

- [x] 1.1 Tạo migration `supabase/migrations/20260514000002_create_rooms.sql` — rooms table, unique constraint, trigger updated_at, RLS policies
- [x] 1.2 Apply migration lên Supabase (curl management API hoặc dashboard SQL editor)
- [x] 1.3 Regenerate `app/types/database.types.ts` sau khi migration apply xong

## 2. Server Layer

- [x] 2.1 Tạo `app/utils/validators/rooms.ts` — Zod schema cho CreateRoomInput, UpdateRoomInput
- [x] 2.2 Tạo `app/utils/mappers/rooms.ts` — map `Tables<'rooms'>` → `RoomDto`
- [x] 2.3 Tạo `app/types/rooms.ts` (hoặc thêm vào types chung) — `RoomDto`, `RoomStatus`
- [x] 2.4 Tạo `server/repositories/rooms/index.ts` — Supabase queries: findAll (với filter), findById, create, update, delete
- [x] 2.5 Tạo `server/services/rooms/index.ts` — business logic: list, get, create (check conflict), update, delete + permission check
- [x] 2.6 Tạo `server/api/rooms/index.get.ts` — GET /api/rooms với query params building_id, status, floor
- [x] 2.7 Tạo `server/api/rooms/index.post.ts` — POST /api/rooms, admin only
- [x] 2.8 Tạo `server/api/rooms/[id].get.ts` — GET /api/rooms/:id
- [x] 2.9 Tạo `server/api/rooms/[id].patch.ts` — PATCH /api/rooms/:id, admin only
- [x] 2.10 Tạo `server/api/rooms/[id].delete.ts` — DELETE /api/rooms/:id, admin only

## 3. Client Composables

- [x] 3.1 Tạo `app/composables/rooms/useRoomList.ts` — useFetch list với filters (building_id, status, floor)
- [x] 3.2 Tạo `app/composables/rooms/useRoomDetail.ts` — useFetch single room by id
- [x] 3.3 Tạo `app/composables/rooms/useRoomForm.ts` — form state, validation, submitCreate, submitUpdate

## 4. Client Components

- [x] 4.1 Thêm status available/occupied/maintenance vào `app/components/ui/UiStatusBadge.vue` (tái sử dụng thay vì tạo RoomStatusBadge riêng)
- [x] 4.2 Tạo `app/components/rooms/RoomCard.vue` — card hiển thị room_number, floor, status badge, monthly_rent
- [x] 4.3 Tạo `app/components/rooms/RoomForm.vue` — form tạo/sửa phòng: building selector, room_number, floor, status, monthly_rent, area, description

## 5. Pages

- [x] 5.1 Tạo `app/pages/rooms/index.vue` — list với filter bar (building dropdown + status dropdown), grid cards, empty state, loading skeleton
- [x] 5.2 Tạo `app/pages/rooms/create.vue` — trang tạo phòng mới
- [x] 5.3 Tạo `app/pages/rooms/[id]/index.vue` — detail page: hiển thị thông tin đầy đủ + edit/delete actions
- [x] 5.4 Tạo `app/pages/rooms/[id]/edit.vue` — trang sửa phòng

## 6. Polish & Verify

- [x] 6.1 Chạy `npm run lint && npm run typecheck` — fix mọi errors
- [x] 6.2 Test thủ công: tạo phòng → xem list → xem detail → sửa → xóa
- [x] 6.3 Test filter: filter theo building, theo status
- [x] 6.4 Test error cases: duplicate room_number, missing fields

## 7. Post-verify improvements

- [x] 7.1 Tạo `app/composables/buildings/useBuildingDetail.ts` — chuẩn hóa pattern list/detail/form cho buildings
- [x] 7.2 Refactor `app/pages/buildings/[id]/index.vue` dùng `useBuildingDetail` thay vì inline `await useFetch`
- [x] 7.3 Refactor `app/pages/buildings/[id]/edit.vue` dùng `useBuildingDetail`
- [x] 7.4 Tạo migration `20260514000003_buildings_drop_total_rooms.sql` — drop cột `total_rooms` static
- [x] 7.5 Cập nhật `server/repositories/buildings/index.ts` — dùng `select('*, rooms(count)')` để tính phòng theo thời gian thực
- [x] 7.6 Cập nhật `app/utils/mappers/buildings.ts` — `BuildingRow` type, tính `totalRooms` từ JOIN count
