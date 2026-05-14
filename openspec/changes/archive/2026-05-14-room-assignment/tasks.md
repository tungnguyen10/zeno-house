## 1. Database

- [x] 1.1 Viết migration `supabase/migrations/20260514000005_create_room_assignments.sql` — bảng `room_assignments` với FK constraints, partial unique index `UNIQUE (room_id) WHERE end_date IS NULL`, trigger `set_updated_at`, RLS policies (admin_all, manager_select)
- [x] 1.2 Apply migration lên Supabase (qua API)
- [x] 1.3 Regen `app/types/database.types.ts`

## 2. Server Layer

- [x] 2.1 Tạo `app/types/room-assignments.ts` — interface `RoomAssignment`, `RoomAssignmentWithTenant`, `RoomAssignmentWithRoom`
- [x] 2.2 Tạo `app/utils/mappers/room-assignments.ts` — `mapRoomAssignment(row)`
- [x] 2.3 Tạo `app/utils/validators/room-assignments.ts` — `assignSchema` (room_id, tenant_id, start_date, notes)
- [x] 2.4 Tạo `server/repositories/room-assignments/index.ts` — `findActiveByRoom`, `findActiveByTenant`, `findById`, `insert`, `end` (set end_date)
- [x] 2.5 Tạo `server/services/room-assignments/index.ts` — assign (check room available + tenant unassigned, create + update room status), unassign (check active, set end_date + update room status)
- [x] 2.6 Tạo `server/api/room-assignments/index.post.ts` — POST /api/room-assignments
- [x] 2.7 Tạo `server/api/room-assignments/[id].delete.ts` — DELETE /api/room-assignments/:id (unassign)
- [x] 2.8 Tạo `server/api/room-assignments/room/[roomId].get.ts` — GET current assignment for room
- [x] 2.9 Tạo `server/api/room-assignments/tenant/[tenantId].get.ts` — GET current assignment for tenant

## 3. Client

- [x] 3.1 Tạo `app/composables/rooms/useRoomAssignment.ts` — fetch current assignment for a room, assign(), unassign(); reactive roomId
- [x] 3.2 Cập nhật `app/pages/rooms/[id]/index.vue` — thêm current tenant section (nếu occupied), Giao phòng button (nếu available + admin), Thu phòng button với UiConfirmModal (nếu occupied + admin)
- [x] 3.3 Tạo `app/components/rooms/RoomAssignModal.vue` — modal chọn tenant từ dropdown + start_date picker; gọi assign()
- [x] 3.4 Cập nhật `app/pages/tenants/[id]/index.vue` — thêm section hiển thị phòng đang thuê (roomNumber, floor, building name, link) hoặc "Chưa có phòng"

## 4. Verify

- [x] 4.1 Chạy `npm run lint && npm run typecheck` — 0 errors
- [x] 4.2 Test thủ công: assign tenant vào phòng → room.status = occupied → tenant detail hiện phòng
- [x] 4.3 Test unassign: Thu phòng → room.status = available → tenant detail hết phòng
- [x] 4.4 Test edge cases: assign phòng đã occupied → lỗi; assign tenant đang ở phòng khác → lỗi
