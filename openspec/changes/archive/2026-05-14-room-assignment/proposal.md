## Why

Hiện tại buildings, rooms, và tenants tồn tại độc lập — không có liên kết nào giữa khách thuê và phòng. Admin cần biết phòng nào đang có ai ở, và khách thuê nào đang ở phòng nào. Room Assignment là bước nối hai entity này trước khi có hợp đồng chính thức (F0.2.5).

## What Changes

- Tạo bảng `room_assignments` để theo dõi lịch sử thuê phòng (ai ở phòng nào, từ khi nào)
- Một phòng chỉ có tối đa 1 assignment đang active (end_date IS NULL)
- Assign tự động cập nhật room.status → `occupied`; unassign → `available`
- Room detail page: hiển thị khách đang thuê + nút Giao phòng / Thu phòng
- Tenant detail page: hiển thị phòng đang thuê (nếu có)
- API: assign, unassign, get current assignment của room, get current assignment của tenant

## Capabilities

### New Capabilities
- `room-assignments-database`: Schema bảng `room_assignments`, RLS, generated types
- `room-assignments-api`: POST /assign, POST /unassign, GET current assignment

### Modified Capabilities
- `rooms-client`: Room detail page thêm current tenant info + assign/unassign UI
- `tenants-client`: Tenant detail page thêm current room info

## Impact

- **DB**: migration `room_assignments`, trigger cập nhật `rooms.status`, regen types
- **Server**: `server/repositories/room-assignments/`, `server/services/room-assignments/`, `server/api/room-assignments/`
- **Client**: `app/types/room-assignments.ts`, mapper, composable `useRoomAssignment`
- **Modified pages**: `app/pages/rooms/[id]/index.vue`, `app/pages/tenants/[id]/index.vue`
- **Không có breaking change** — rooms và tenants đều hoạt động như cũ nếu chưa có assignment
