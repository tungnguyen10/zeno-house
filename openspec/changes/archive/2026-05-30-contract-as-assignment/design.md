## Context

Hệ thống hiện có `room_assignments` và `contracts` tồn tại song song — cả hai đều theo dõi "ai đang ở phòng nào". Trong thực tế ký HĐ và bàn giao phòng xảy ra đồng thời, nên `room_assignments` không thêm giá trị gì mà còn tạo inconsistency: `room.status` được drive bởi assignment, không phải contract.

**State hiện tại:**
- `room.status = 'occupied'` ← set bởi `RoomAssignmentService.assign()`
- `room.status = 'available'` ← set bởi `RoomAssignmentService.unassign()`
- `ContractService.create()` không chạm `room.status` ← sai tầng

**Target state:**
- `room.status = 'occupied'` ← set bởi `ContractService.create()` khi status=active
- `room.status = 'available'` ← set bởi `ContractService.update()` khi status→terminated/expired
- Bảng `room_assignments` không còn tồn tại

## Goals / Non-goals

**Goals:**
- Contract active = phòng occupied — 1 source of truth
- Tạo contract = giao phòng (1 action, 1 API call)
- Terminate/expire contract = thu phòng
- Room detail và Tenant detail đọc trạng thái từ active contract
- Xoá toàn bộ layer room-assignments

**Non-goals:**
- Thêm `handover_date` riêng vào contract (nếu cần sau này thì thêm column)
- Thay đổi contract CRUD UI/UX ngoài phần room detail page
- Thay đổi billing, payments, renewals

## Decisions

**D1 — `room.status` driven bởi contract lifecycle, không dùng DB trigger**

Giữ pattern hiện tại (service layer update). Khi `ContractService.create()` với status=active → update `room.status = 'occupied'`. Khi update contract sang `terminated` hoặc `expired` → update `room.status = 'available'`. Edge case: nếu room đang `maintenance` và contract bị terminate → giữ nguyên `maintenance`, không flip về `available`.

**D2 — Check `room.status != 'maintenance'` trong ContractService.create()**

Hiện tại check này chỉ có trong `RoomAssignmentService`. Phải chuyển sang `ContractService.create()`. `ContractRepository.findActiveByRoomId` đã kiểm tra active contract conflict — chỉ cần thêm maintenance check từ `RoomRepository.findById`.

**D3 — Room detail page: "Người đang thuê" đọc từ active contract**

Thay vì gọi `/api/room-assignments/room/:id`, page sẽ dùng contracts data đã có (đang fetch `roomContracts` rồi). Filter `contracts.filter(c => c.status === 'active')[0]` — không cần thêm API call.

**D4 — Nút "Giao phòng" → navigate sang trang tạo contract**

Thay vì modal `RoomAssignModal`, nút "Giao phòng" sẽ navigate tới `/contracts/create?room_id=<id>`. Contract create form đã có sẵn. Giữ UX nhất quán với luồng admin tạo HĐ.

**D5 — Nút "Thu phòng" → terminate active contract**

Xác nhận rồi call `PATCH /api/contracts/:id` với `{ status: 'terminated' }`. Cần thêm terminate endpoint hoặc dùng update endpoint đã có. Confirm modal giữ nguyên pattern `UiConfirmModal`.

**D6 — Tenant detail page: "Phòng đang thuê" đọc từ active contract**

Thay vì gọi `/api/room-assignments/tenant/:id`, dùng `tenantContracts.filter(c => c.status === 'active')[0]` — data đã có sẵn trong page. Contract có `room.roomNumber`, `room.floor`, `room.buildingName` — đủ để hiển thị.

**D7 — Drop `room_assignments` table**

Migration mới: `DROP TABLE room_assignments`. Cần chạy sau khi deploy code mới (đảm bảo không còn code nào gọi bảng này). Trong dev environment không có production data cần migrate.

## Data Flow sau khi thay đổi

```
Tạo HĐ (ContractService.create)
  │
  ├─ check permission
  ├─ check room exists
  ├─ check room.status != 'maintenance'   ← mới
  ├─ check no active contract for room    ← đã có
  ├─ check tenant chưa có HĐ active       ← đã có
  ├─ INSERT contract (status: active)
  └─ UPDATE room.status = 'occupied'      ← mới

Terminate HĐ (ContractService.update → status: terminated/expired)
  │
  ├─ UPDATE contract.status
  └─ UPDATE room.status = 'available'     ← mới
     (trừ khi room.status = 'maintenance')
```

## Files bị xoá

```
server/api/room-assignments/               ← toàn bộ (4 files)
server/services/room-assignments/          ← toàn bộ (1 file)
server/repositories/room-assignments/      ← toàn bộ (1 file)
app/composables/rooms/useRoomAssignment.ts
app/components/rooms/RoomAssignModal.vue
app/types/room-assignments.ts
app/utils/mappers/room-assignments.ts
app/utils/validators/room-assignments.ts
```

## Files bị sửa

```
server/services/contracts/index.ts
  - create(): thêm maintenance check + room.status = 'occupied'
  - update(): thêm room.status = 'available' khi terminated/expired

app/pages/rooms/[id]/index.vue
  - Xoá import useRoomAssignment, AssignInput
  - Xoá fetch assignment, showAssignModal, isAssigning, handleAssign, confirmUnassign
  - "Người đang thuê" đọc từ roomContracts (active)
  - Nút "Giao phòng" → navigate /contracts/create?room_id=<id>
  - Nút "Thu phòng" → terminate active contract

app/pages/tenants/[id]/index.vue
  - Xoá import RoomAssignmentWithRoom
  - Xoá fetch /api/room-assignments/tenant/:id
  - "Phòng đang thuê" đọc từ tenantContracts (active)
```

## Risks

- **Contract UI chưa có `?room_id` pre-fill**: Nếu `/contracts/create` chưa đọc query param, cần thêm. Kiểm tra trước khi implement.
- **`renewed` contracts**: Status `renewed` không nên flip room về available — chỉ terminated/expired mới flip.
- **Lint/type errors**: Nhiều import cần xoá, cần chạy typecheck sau khi xoá files.
