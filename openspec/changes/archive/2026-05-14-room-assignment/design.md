## Context

Buildings, rooms, và tenants đã có CRUD đầy đủ. Room có `status` field (`available` / `occupied` / `maintenance`) nhưng status này hiện được set thủ công qua form edit. Room Assignment tạo liên kết có cấu trúc giữa tenant ↔ room và sync status tự động.

**Constraint**: Contracts (F0.2.5) sẽ dùng room assignment làm nền tảng — contract sẽ reference một assignment. Vì vậy schema cần đủ thông tin (start_date) để contract build on top.

## Goals / Non-Goals

**Goals:**
- Bảng `room_assignments` với history (end_date = null là active)
- Chỉ 1 active assignment per room tại một thời điểm
- Room status sync tự động qua DB trigger hoặc service layer
- UI embed trong room detail và tenant detail — không cần trang riêng
- API tối giản: assign, unassign, get current

**Non-Goals:**
- Hợp đồng / contract document (F0.2.5)
- Invoice / billing (phase sau)
- Multiple tenants per room (chưa cần)
- Assignment history page (xem sau)

## Decisions

**D1 — Sync room.status qua service layer, không dùng DB trigger**
DB trigger phức tạp hơn để debug. Service layer: khi assign → update room.status = 'occupied'; khi unassign → update room.status = 'available'. Rooms đang `maintenance` không cho assign (service check).

**D2 — `end_date` null = active assignment**
Standard pattern cho time-range records. Query active: `WHERE end_date IS NULL`. DB constraint: unique (room_id) WHERE end_date IS NULL — enforce 1 active per room ở DB level.

**D3 — API endpoint: `/api/room-assignments`**
- `POST /api/room-assignments` — assign (body: room_id, tenant_id, start_date)
- `DELETE /api/room-assignments/:id` — unassign (set end_date = today)
- `GET /api/room-assignments/room/:roomId` — current assignment của room
- `GET /api/room-assignments/tenant/:tenantId` — current assignment của tenant

**D4 — Không tạo trang `/room-assignments` riêng**
Assign/unassign được thực hiện từ room detail page. Tenant detail page chỉ đọc (hiển thị phòng đang ở, không assign từ đây). Giữ UX đơn giản — người dùng quản lý từ góc nhìn phòng.

**D5 — `start_date` do admin chọn, default = today**
Cho phép nhập ngày bắt đầu thực tế (có thể khác ngày nhập liệu).

## Risks / Trade-offs

- **Room maintenance không assign được** → Mitigation: service check, trả về 409 với message rõ ràng
- **Tenant đang ở phòng A, assign vào phòng B** → Mitigation: service check `findActiveByTenant` trước khi assign, trả về 409
- **status sync drift** nếu ai edit room.status thủ công → Mitigation: giữ edit form cho status nhưng note rằng assignment sẽ override

## Migration Plan

1. Migration `room_assignments` table + partial unique index
2. Apply + regen types
3. Server layer (repo → service → API)
4. Client: composable `useRoomAssignment` + update 2 detail pages
5. Lint + typecheck
