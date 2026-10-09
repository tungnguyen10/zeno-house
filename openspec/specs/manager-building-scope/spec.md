# manager-building-scope Specification

## Purpose
TBD - created by archiving change access-control-manager-scope. Update Purpose after archive.
## Requirements
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

System SHALL query `user_building_assignments` tối đa 1 lần per HTTP request bằng cách cache kết quả vào `event.context`. Gọi lại `getAssignedBuildingIds` trong cùng request SHALL dùng cached value. This cache SHALL apply to scoped roles (`owner` and `manager`).

#### Scenario: Nhiều service calls trong cùng request
- **WHEN** 1 request trigger nhiều service calls cùng cần scope
- **THEN** DB chỉ được query đúng 1 lần cho `user_building_assignments`

#### Scenario: Owner scope cache hit
- **WHEN** one owner request calls scope resolution multiple times
- **THEN** assignment repository is queried once

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

### Requirement: Owner scope uses user_building_assignments
System SHALL resolve owner building scope from `user_building_assignments` the same way manager scope is resolved. Admin SHALL remain unscoped.

#### Scenario: Owner sees assigned buildings
- **WHEN** owner calls `GET /api/buildings`
- **THEN** response only contains buildings assigned to that owner

#### Scenario: Owner with no assignment sees empty list
- **WHEN** owner has no `user_building_assignments` and calls `GET /api/buildings`
- **THEN** response returns an empty list, not global data

#### Scenario: Admin remains unscoped
- **WHEN** admin scope is resolved
- **THEN** scope result is `null`

### Requirement: Owner detail outside scope returns 404
When owner reads detail endpoints for entities outside owner scope, system SHALL return 404 Not Found and SHALL NOT leak existence.

#### Scenario: Owner reads room outside scope
- **WHEN** owner calls `GET /api/rooms/:id` for a room in an unassigned building
- **THEN** response is 404 Not Found

#### Scenario: Owner reads invoice outside scope
- **WHEN** owner calls `GET /api/billing/invoices/:id` for an invoice in an unassigned building
- **THEN** response is 404 Not Found

### Requirement: Owner mutation outside scope returns 403
When owner mutates entities outside owner scope, system SHALL return 403 Forbidden.

#### Scenario: Owner updates room outside scope
- **WHEN** owner calls `PATCH /api/rooms/:id` for a room in an unassigned building
- **THEN** response is 403 Forbidden

#### Scenario: Owner closes period outside scope
- **WHEN** owner calls close period endpoint for a period in an unassigned building
- **THEN** response is 403 Forbidden

### Requirement: Scope resolution separates permission from visibility
`server/utils/scope.ts` SHALL expose a visibility-aware building scope alongside the existing assignment scope. The assignment scope SHALL keep its current semantics, returning `null` for admin and the assigned identifiers for owner and manager. The visibility-aware scope SHALL return the assignment scope minus hidden buildings, and SHALL return `null` for an admin only when no building is hidden. Both SHALL resolve at most once per request.

#### Scenario: Admin with no hidden buildings stays unscoped
- **WHEN** an admin resolves the visibility-aware scope and no building is hidden
- **THEN** the result is `null`

#### Scenario: Admin with hidden buildings receives an explicit list
- **WHEN** an admin resolves the visibility-aware scope and at least one building is hidden
- **THEN** the result lists every non-hidden building identifier

#### Scenario: Manager loses hidden assignments
- **WHEN** a manager assigned to two buildings resolves the visibility-aware scope and one of them is hidden
- **THEN** the result contains only the visible assigned building

#### Scenario: Assignment scope ignores visibility
- **WHEN** any user resolves the assignment scope
- **THEN** hidden buildings are still present in the result

### Requirement: List and aggregate reads exclude hidden buildings
Services returning browsable collections or aggregated figures SHALL scope by the visibility-aware building scope. This SHALL cover building, room, contract, tenant, and meter-reading listings, invoice, billing-period and billing queries, the operator support-request queue, the dashboard summary, and AI building listing and resolution.

Administrative surfaces that manage accounts and permissions SHALL keep the assignment scope, because hiding is a presentation choice and must not remove an operator's ability to administer an account. This SHALL cover manager assignment management, internal user management, and the tenant-account list.

#### Scenario: Rooms of a hidden building disappear from the list
- **WHEN** a user lists rooms and one building is hidden
- **THEN** no room belonging to that building is returned

#### Scenario: Billing periods of a hidden building disappear from the queue
- **WHEN** a user lists billing periods and one building is hidden
- **THEN** no period belonging to that building is returned

#### Scenario: Account administration still reaches a hidden building
- **WHEN** an administrator opens manager assignments or the tenant-account list
- **THEN** records belonging to a hidden building are still listed

#### Scenario: Dashboard totals drop a hidden building
- **WHEN** a building is hidden
- **THEN** the dashboard summary no longer counts its rooms, contracts, or revenue

#### Scenario: Cached dashboard reflects a visibility change
- **WHEN** a building's visibility changes while a cached dashboard summary is still within its time-to-live
- **THEN** the next summary request reflects the new visibility rather than the cached value

### Requirement: Detail and write authorization ignores visibility
Building-scoped authorization checks for a single record SHALL NOT consider visibility. A hidden building SHALL behave exactly as a visible one for authorization, returning not-found only when the caller lacks assignment scope and forbidden only when the caller lacks the capability.

#### Scenario: Write to a hidden building in scope
- **WHEN** a user with the capability and assignment scope writes to a record in a hidden building
- **THEN** the write succeeds

#### Scenario: Tenant portal is unaffected
- **WHEN** a tenant whose contract belongs to a hidden building loads the portal
- **THEN** their contract, room, and invoices resolve normally

