## 1. Server — Contract side-effects

- [x] 1.1 Sửa `server/services/contracts/index.ts` — `create()`:
  - Import `RoomRepository`
  - Fetch room bằng `RoomRepository.findById(event, input.room_id)` — throwNotFound nếu không có
  - Check `room.status === 'maintenance'` → throwConflict('Phòng đang bảo trì, không thể tạo hợp đồng')
  - Sau INSERT contract: gọi `RoomRepository.update(event, input.room_id, { status: 'occupied' })` khi `input.status === 'active'` hoặc `!input.status`

- [x] 1.2 Sửa `server/services/contracts/index.ts` — `update()`:
  - Sau UPDATE contract: nếu `input.status` là `'terminated'` hoặc `'expired'`
    - Fetch `existing.roomId` → check room.status
    - Nếu `room.status !== 'maintenance'`: gọi `RoomRepository.update(event, existing.roomId, { status: 'available' })`

## 2. Database

- [x] 2.1 Viết migration `supabase/migrations/20260530000000_drop_room_assignments.sql` — `DROP TABLE IF EXISTS public.room_assignments CASCADE`
- [x] 2.2 Apply migration lên Supabase
- [x] 2.3 Regen `app/types/database.types.ts`
## 3. Xoá layer room-assignments

- [x] 3.1 Xoá `server/api/room-assignments/` (toàn bộ thư mục: index.post.ts, [id].delete.ts, room/[roomId].get.ts, tenant/[tenantId].get.ts)
- [x] 3.2 Xoá `server/services/room-assignments/` (index.ts)
- [x] 3.3 Xoá `server/repositories/room-assignments/` (index.ts)
- [x] 3.4 Xoá `app/composables/rooms/useRoomAssignment.ts`
- [x] 3.5 Xoá `app/components/rooms/RoomAssignModal.vue`
- [x] 3.6 Xoá `app/types/room-assignments.ts`
- [x] 3.7 Xoá `app/utils/mappers/room-assignments.ts`
- [x] 3.8 Xoá `app/utils/validators/room-assignments.ts`

## 4. Client — Room detail page

- [x] 4.1 Sửa `app/pages/rooms/[id]/index.vue`:
  - Xoá import `useRoomAssignment`, `AssignInput`
  - Xoá `const { assignment, assign, unassign } = useRoomAssignment(id)`
  - Xoá `showAssignModal`, `isAssigning`, `handleAssign`, `showUnassignModal`, `isUnassigning`, `confirmUnassign`
  - Thêm computed: `const activeContract = computed(() => roomContracts.value.find(c => c.status === 'active') ?? null)`
  - Thêm `isTerminating = ref(false)`, `showTerminateModal = ref(false)`
  - Thêm function `confirmTerminate()`: gọi `PATCH /api/contracts/${activeContract.value.id}` với `{ status: 'terminated' }` → refresh contracts + room

- [x] 4.2 Sửa template room detail — section "Người đang thuê":
  - Đọc từ `activeContract` thay vì `assignment`
  - Hiển thị: tên tenant (`activeContract.tenant.fullName`), phone, link tới `/tenants/:id`
  - Nút "Giao phòng": chỉ hiện khi `!activeContract && room.status !== 'maintenance' && authStore.isAdmin` → `navigateTo('/contracts/create?room_id=' + id)`
  - Nút "Thu phòng": chỉ hiện khi `activeContract && authStore.isAdmin` → `showTerminateModal = true`
  - Xoá `<RoomAssignModal>` khỏi template

- [x] 4.3 Thêm `<UiConfirmModal>` terminate trong template với message xác nhận tên tenant + phòng

## 5. Client — Contract create page pre-fill

- [x] 5.1 Sửa `app/pages/contracts/create.vue` — đọc `route.query.room_id` và pre-fill vào `formData.value.room_id`

## 6. Client — Tenant detail page

- [x] 6.1 Sửa `app/pages/tenants/[id]/index.vue`:
  - Xoá import `RoomAssignmentWithRoom`
  - Xoá `useFetch('/api/room-assignments/tenant/:id')` và `currentAssignment`
  - Thêm computed: `const activeContract = computed(() => tenantContracts.value.find(c => c.status === 'active') ?? null)`
  - Đổi section "Phòng đang thuê" đọc từ `activeContract.room` thay vì `currentAssignment.room`

## 7. Verify

- [x] 7.1 Chạy `npm run typecheck` — 0 errors
- [x] 7.2 Chạy `npm run lint` — 0 errors
- [x] 7.3 Test thủ công: tạo contract active → room.status = occupied → room detail hiện tên tenant
- [x] 7.4 Test: terminate contract → room.status = available → room detail không còn tenant
- [x] 7.5 Test: tạo contract cho phòng maintenance → lỗi 409
- [x] 7.6 Test: room detail "Giao phòng" button → navigate tới `/contracts/create?room_id=<id>` với room pre-filled
- [x] 7.7 Test: tenant detail hiển thị phòng đang thuê từ active contract
