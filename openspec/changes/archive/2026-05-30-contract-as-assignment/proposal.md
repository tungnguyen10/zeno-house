## Why

Hệ thống hiện có hai entity song song để theo dõi cùng một thông tin — "phòng này ai đang ở":

- `contracts` — HĐ pháp lý, có rent, deposit, ngày bắt đầu/kết thúc, status lifecycle
- `room_assignments` — record bàn giao vật lý, gần như trùng lặp hoàn toàn

Vì trong thực tế ký HĐ và bàn giao phòng xảy ra đồng thời, `room_assignments` không thêm giá trị gì mà còn tạo ra 2 sources of truth. Hiện tại:

- `room.status = 'occupied'` được drive bởi `room_assignments`, **không phải** `contracts` — dẫn đến inconsistency khi tạo contract mà quên tạo assignment
- User phải thực hiện 2 API calls để hoàn tất "giao phòng": tạo contract rồi tạo assignment
- Không có enforcement: có thể tạo assignment cho tenant **không có** contract active

## What Changes

- **Xoá khái niệm `room_assignments`** — merge vào contract lifecycle
- `room.status` được drive trực tiếp từ `contracts.status`:
  - contract `active` → room `occupied`
  - contract `terminated` / `expired` / `renewed` (cũ) → room `available`
- `ContractService.create()` thêm: check room không maintenance, update room.status = 'occupied'
- `ContractService.update()` thêm: khi status → terminated/expired, update room.status = 'available'
- Room detail page: "Người đang thuê" đọc từ active contract thay vì assignment; nút "Giao phòng" → mở contract creation; nút "Thu phòng" → terminate contract
- Tenant detail page: "Phòng đang thuê" đọc từ active contract thay vì assignment
- Drop toàn bộ layer room-assignments (API, service, repository, composable, component, types)

## Non-goals

- Không thêm "ngày bàn giao" riêng vào contract trong change này — nếu sau này cần, thêm `handover_date` column riêng
- Không thay đổi contract CRUD logic ngoài room.status side-effect
- Không đụng đến billing, invoices

## Capabilities

### Removed Capabilities
- `room-assignments-api`: Toàn bộ server/api/room-assignments/, server/services/room-assignments/, server/repositories/room-assignments/
- `room-assignments-client`: app/composables/rooms/useRoomAssignment.ts, app/components/rooms/RoomAssignModal.vue, app/types/room-assignments.ts, mapper

### Modified Capabilities
- `contracts-api`: ContractService.create() và update() thêm room.status side-effect + maintenance check
- `rooms-client`: Room detail page đọc active contract thay vì assignment; UI actions thay đổi theo
- `tenants-client`: Tenant detail page đọc active contract thay vì assignment

## Impact

- **DB**: Drop bảng `room_assignments`; migration mới
- **Server**: Sửa `server/services/contracts/index.ts`; xoá toàn bộ thư mục `server/*/room-assignments/`
- **Client**: Sửa `app/pages/rooms/[id]/index.vue`, `app/pages/tenants/[id]/index.vue`; xoá `useRoomAssignment`, `RoomAssignModal`, mapper, types
- **Breaking change**: Endpoint `POST /api/room-assignments` và `DELETE /api/room-assignments/:id` bị xoá — chỉ ảnh hưởng internal UI, không có external consumer
