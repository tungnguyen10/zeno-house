## ADDED Requirements

### Requirement: Manager chỉ thấy buildings được gán

System SHALL resolve danh sách `building_id` được gán cho manager từ bảng `user_building_assignments`. Admin SHALL có quyền truy cập toàn bộ buildings (no filter). Manager không có assignment nào SHALL thấy empty list, không lỗi.

#### Scenario: Manager thấy assigned buildings
- **WHEN** manager gọi `GET /api/buildings`
- **THEN** response chỉ chứa buildings thuộc `user_building_assignments` của manager đó

#### Scenario: Admin thấy toàn bộ buildings
- **WHEN** admin gọi `GET /api/buildings`
- **THEN** response chứa tất cả buildings, không bị filter

#### Scenario: Manager không có assignment nào
- **WHEN** manager chưa được gán building nào gọi `GET /api/buildings`
- **THEN** response trả về `{ items: [], total: 0 }`, không lỗi

---

### Requirement: Detail read ngoài scope trả 404

Khi manager gọi detail endpoint cho entity thuộc building không được gán, system SHALL trả 404 Not Found. System SHALL NOT tiết lộ sự tồn tại của entity.

#### Scenario: Manager đọc room ngoài scope
- **WHEN** manager gọi `GET /api/rooms/:id` cho room thuộc unassigned building
- **THEN** response là 404 Not Found

#### Scenario: Manager đọc contract ngoài scope
- **WHEN** manager gọi `GET /api/contracts/:code` cho contract thuộc unassigned building
- **THEN** response là 404 Not Found

#### Scenario: Manager đọc billing period ngoài scope
- **WHEN** manager gọi `GET /api/billing/periods/:id` cho period thuộc unassigned building
- **THEN** response là 404 Not Found

#### Scenario: Manager đọc invoice ngoài scope
- **WHEN** manager gọi `GET /api/billing/invoices/:id` cho invoice thuộc unassigned building
- **THEN** response là 404 Not Found

---

### Requirement: Mutation ngoài scope trả 403

Khi manager thực hiện mutation (POST/PATCH/DELETE/action) trên entity thuộc building không được gán, system SHALL trả 403 Forbidden.

#### Scenario: Manager update room ngoài scope
- **WHEN** manager gọi `PATCH /api/rooms/:id` cho room thuộc unassigned building
- **THEN** response là 403 Forbidden

#### Scenario: Manager tạo contract cho room ngoài scope
- **WHEN** manager gọi `POST /api/contracts` với `room_id` thuộc unassigned building
- **THEN** response là 403 Forbidden

#### Scenario: Manager issue billing period ngoài scope
- **WHEN** manager gọi `POST /api/billing/periods/:id/issue` cho period thuộc unassigned building
- **THEN** response là 403 Forbidden

#### Scenario: Manager ghi nhận payment ngoài scope
- **WHEN** manager gọi `POST /api/billing/invoices/:id/payments` cho invoice thuộc unassigned building
- **THEN** response là 403 Forbidden

---

### Requirement: Tenant list filter theo contract trong assigned buildings

Manager SHALL chỉ thấy tenant có ít nhất 1 contract trong assigned buildings. System SHALL filter qua `contracts.building_id IN (assigned_building_ids)`.

#### Scenario: Manager thấy tenant có contract trong assigned building
- **WHEN** manager gọi `GET /api/tenants` hoặc `GET /api/tenants?building_id=<assigned>`
- **THEN** response chỉ chứa tenants có contract thuộc assigned buildings

#### Scenario: Manager không thấy tenant chỉ liên quan unassigned building
- **WHEN** tenant chỉ có contract trong building không được gán cho manager
- **THEN** tenant đó không xuất hiện trong list result của manager

#### Scenario: Admin thấy toàn bộ tenants
- **WHEN** admin gọi `GET /api/tenants`
- **THEN** response chứa tất cả tenants

---

### Requirement: Contract detail chỉ hiển thị history thuộc assigned buildings

Khi manager xem tenant detail, contract/payment/invoice history SHALL chỉ gồm những gì thuộc assigned buildings của manager.

#### Scenario: Manager xem tenant detail
- **WHEN** manager gọi `GET /api/tenants/:code` cho tenant có contract ở cả assigned và unassigned buildings
- **THEN** response chỉ chứa contracts thuộc assigned buildings trong history

---

### Requirement: Scope resolver lazy cache per request

System SHALL query `user_building_assignments` tối đa 1 lần per HTTP request bằng cách cache kết quả vào `event.context`. Gọi lại `getAssignedBuildingIds` trong cùng request SHALL dùng cached value.

#### Scenario: Nhiều service calls trong cùng request
- **WHEN** 1 request trigger nhiều service calls cùng cần scope
- **THEN** DB chỉ được query đúng 1 lần cho `user_building_assignments`

---

### Requirement: Dashboard aggregate chỉ tính assigned buildings

Manager dashboard SHALL chỉ tổng hợp số liệu từ buildings được gán. Room stats, revenue trend, invoice summary, pending operations SHALL được filter theo `building_id IN (assignedIds)`.

#### Scenario: Manager xem dashboard
- **WHEN** manager gọi dashboard API
- **THEN** room stats, billing trend, invoice metrics chỉ gồm data từ assigned buildings

#### Scenario: Admin xem dashboard
- **WHEN** admin gọi dashboard API
- **THEN** dashboard tổng hợp toàn bộ buildings

---

### Requirement: Backfill tất cả managers hiện có vào tất cả buildings

Migration SHALL insert `user_building_assignments` cho tất cả manager accounts hiện có cross-joined với tất cả buildings, `can_delete_master_data = false`. Deploy không thay đổi hành vi của managers hiện tại.

#### Scenario: Manager sau deploy thấy đúng số buildings như trước
- **WHEN** migration chạy xong và app deploy
- **THEN** manager hiện có vẫn thấy tất cả buildings (vì đã được gán tất cả)

---

### Requirement: Direct API call bypass bị block

Scope enforcement SHALL xảy ra ở service layer, không chỉ ở UI. Gọi API trực tiếp không qua UI SHALL bị enforce bởi cùng scope logic.

#### Scenario: Direct API call với valid token nhưng ngoài scope
- **WHEN** manager gọi trực tiếp `GET /api/rooms/:id` (unassigned building) với Bearer token hợp lệ
- **THEN** response là 404 Not Found (detail read)

#### Scenario: Direct API mutation với valid token nhưng ngoài scope
- **WHEN** manager gọi trực tiếp `POST /api/billing/periods/:id/issue` (unassigned building) với Bearer token hợp lệ
- **THEN** response là 403 Forbidden
