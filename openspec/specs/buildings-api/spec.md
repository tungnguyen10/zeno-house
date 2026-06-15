## Purpose
Defines server API behavior for creating, reading, updating, deleting, and enriching building records.
## Requirements
### Requirement: GET /api/buildings trả về danh sách phân trang
`server/api/buildings/index.get.ts` SHALL require auth, support query params `page` (default 1) và `limit` (default 20), trả về `ApiSuccess<Building[]>` với `meta.total`, `meta.page`, `meta.limit`, `meta.totalPages`.

#### Scenario: List buildings thành công
- **WHEN** authenticated user gửi GET /api/buildings
- **THEN** response có shape `{ data: Building[], meta: { total, page, limit, totalPages } }`

#### Scenario: Unauthenticated request bị từ chối
- **WHEN** request không có session
- **THEN** response 401 với `error.code === 'UNAUTHENTICATED'`

#### Scenario: Manager không có permission bị từ chối
- **WHEN** user có role 'manager' và `can(user, 'buildings.read')` là false
- **THEN** response 403 với `error.code === 'FORBIDDEN'`

---

### Requirement: POST /api/buildings tạo building mới
`server/api/buildings/index.post.ts` SHALL require auth, validate body bằng Zod `buildingCreateSchema`, delegate sang service, trả về `ApiSuccess<Building>` với status 201.

#### Scenario: Tạo building thành công
- **WHEN** admin gửi POST /api/buildings với `{ name, address }` hợp lệ
- **THEN** response 201 với `{ data: Building }` chứa building vừa tạo

#### Scenario: Validation error khi thiếu required fields
- **WHEN** request body thiếu `name` hoặc `address`
- **THEN** response 422 với `error.code === 'VALIDATION_ERROR'` và `error.details` chứa Zod errors

#### Scenario: Manager không có quyền tạo
- **WHEN** user có role 'manager' gửi POST
- **THEN** response 403 với `error.code === 'FORBIDDEN'`

---

### Requirement: GET /api/buildings/:id trả về chi tiết một building
`server/api/buildings/[id].get.ts` SHALL require auth, kiểm tra permission, tìm building theo id, trả về `ApiSuccess<Building>` hoặc 404 nếu không tồn tại.

#### Scenario: Lấy building theo id thành công
- **WHEN** authenticated user gửi GET /api/buildings/:id với id hợp lệ
- **THEN** response 200 với `{ data: Building }`

#### Scenario: Building không tồn tại
- **WHEN** id không match bất kỳ building nào
- **THEN** response 404 với `error.code === 'NOT_FOUND'`

---

### Requirement: PATCH /api/buildings/:id cập nhật building
`server/api/buildings/[id].patch.ts` SHALL require auth (admin only), validate body bằng Zod `buildingUpdateSchema` (partial), trả về `ApiSuccess<Building>` sau update.

#### Scenario: Cập nhật building thành công
- **WHEN** admin gửi PATCH /api/buildings/:id với partial data hợp lệ
- **THEN** response 200 với `{ data: Building }` chứa data đã update

#### Scenario: Manager không thể update
- **WHEN** user có role 'manager' gửi PATCH
- **THEN** response 403 với `error.code === 'FORBIDDEN'`

---

### Requirement: DELETE /api/buildings/:id xoá building
`server/api/buildings/[id].delete.ts` SHALL require auth (admin only), xoá building và trả về 204 No Content.

#### Scenario: Xoá building thành công
- **WHEN** admin gửi DELETE /api/buildings/:id
- **THEN** response 204, building bị xoá khỏi database

#### Scenario: Manager không thể xoá
- **WHEN** user có role 'manager' gửi DELETE
- **THEN** response 403 với `error.code === 'FORBIDDEN'`

---

### Requirement: Service layer kiểm tra permission trước khi delegate
`server/services/buildings/index.ts` SHALL dùng `can(user, capability)` để kiểm tra permission, gọi `throwForbidden()` nếu không có quyền, rồi delegate xuống repository.

#### Scenario: Service ném FORBIDDEN khi không có quyền
- **WHEN** service.create được gọi với user không có `buildings.create` permission
- **THEN** throwForbidden() được gọi, không có DB operation nào xảy ra

---

### Requirement: Repository chỉ chứa Supabase queries
`server/repositories/buildings/index.ts` SHALL export `BuildingRepository` với methods: `findAll`, `findById`, `insert`, `update`, `remove`. Không có business logic hay permission check.

#### Scenario: findAll với pagination
- **WHEN** `findAll(event, { page, limit })` được gọi
- **THEN** query Supabase với `.range()` và trả về `{ items: Building[], total: number }`

#### Scenario: findById trả về null nếu không tồn tại
- **WHEN** `findById(event, id)` với id không tồn tại
- **THEN** trả về `null` (không throw)

### Requirement: Building responses include slug and service summary
Building list and detail API responses SHALL include `slug` and building service summary fields needed by the building UI.

#### Scenario: List response includes slug and services
- **WHEN** authenticated user calls GET /api/buildings
- **THEN** each returned building includes `slug` and service summary data

#### Scenario: Detail response includes slug and services
- **WHEN** authenticated user calls GET /api/buildings/:identifier
- **THEN** the returned building includes `slug` and service summary data

### Requirement: GET /api/buildings/:identifier supports id or slug
`server/api/buildings/[id].get.ts` SHALL treat the route parameter as an identifier and find a building by UUID id when it is a UUID, otherwise by slug.

#### Scenario: Lookup building by id
- **WHEN** authenticated user sends GET /api/buildings/<uuid>
- **THEN** response 200 returns the matching building

#### Scenario: Lookup building by slug
- **WHEN** authenticated user sends GET /api/buildings/toa-a
- **THEN** response 200 returns the matching building

#### Scenario: Unknown slug
- **WHEN** authenticated user sends GET /api/buildings/unknown-building
- **THEN** response 404 with `error.code === 'NOT_FOUND'`

