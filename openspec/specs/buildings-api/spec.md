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

### Requirement: GET /api/buildings supports search, filter, and sort
`server/api/buildings/index.get.ts` SHALL accept optional query params `q: string`, `status: ('active' | 'inactive')[]`, `sort: 'name' | 'created_at' | 'total_rooms'` (default `created_at`), `order: 'asc' | 'desc'` (default `desc`) in addition to existing `page` and `limit`. The endpoint SHALL validate query with `buildingListQuerySchema`, delegate to service, and preserve the existing `{ data, meta }` envelope.

#### Scenario: Search by name match
- **WHEN** authenticated user calls `GET /api/buildings?q=sunrise`
- **THEN** response includes only buildings whose name, address, or code contains "sunrise" (case-insensitive)

#### Scenario: Filter by single status
- **WHEN** authenticated user calls `GET /api/buildings?status=active`
- **THEN** response includes only buildings with `status=active`

#### Scenario: Filter by multiple statuses
- **WHEN** authenticated user calls `GET /api/buildings?status=active&status=inactive`
- **THEN** response includes buildings with either status

#### Scenario: Sort by name ascending
- **WHEN** authenticated user calls `GET /api/buildings?sort=name&order=asc`
- **THEN** response data is ordered by `name` ascending

#### Scenario: Sort by total_rooms descending
- **WHEN** authenticated user calls `GET /api/buildings?sort=total_rooms&order=desc`
- **THEN** response data is ordered by computed room count descending

#### Scenario: Invalid sort field rejected
- **WHEN** request includes `?sort=secret`
- **THEN** response 422 with `error.code === 'VALIDATION_ERROR'`

#### Scenario: Combined filters and pagination
- **WHEN** request is `GET /api/buildings?q=toa&status=active&sort=name&order=asc&page=2&limit=10`
- **THEN** response data is the second page of 10 results matching all filters, ordered by name asc

### Requirement: DELETE /api/buildings/:id performs safe-delete with conflict check
`server/api/buildings/[id].delete.ts` SHALL by default check for blocking references before deleting: if the building has any rooms OR any active contracts (via rooms), the endpoint SHALL respond `409` with `error.code === 'CONFLICT'` and `error.details === { rooms: number, activeContracts: number }`. If no blockers, the building SHALL be hard-deleted and the endpoint responds `204`.

#### Scenario: Conflict response when rooms exist
- **WHEN** admin sends DELETE on a building with 5 rooms
- **THEN** response is 409 with `error.code === 'CONFLICT'` and `error.details === { rooms: 5, activeContracts: 0 }`

#### Scenario: Conflict response when active contracts exist
- **WHEN** admin sends DELETE on a building whose rooms have 3 active contracts
- **THEN** response is 409 with `error.code === 'CONFLICT'` and `error.details.activeContracts === 3`

#### Scenario: Successful hard-delete when no blockers
- **WHEN** admin sends DELETE on a building with 0 rooms and 0 contracts
- **THEN** response is 204 and the row is removed from the database

### Requirement: DELETE /api/buildings/:id supports force soft-archive
`server/api/buildings/[id].delete.ts` SHALL accept query param `?force=true`. When present and the caller is admin, the endpoint SHALL skip the conflict check and instead set `status='inactive'` on the building (soft-archive), returning `200` with `{ data: Building }` (the archived building). The endpoint SHALL NOT hard-delete when `?force=true` is used.

#### Scenario: Force archives a building with rooms
- **WHEN** admin sends DELETE `/api/buildings/:id?force=true` on a building with rooms
- **THEN** response is 200 with `{ data }` where `data.status === 'inactive'`; the row remains in the database

#### Scenario: Force on already-inactive building is idempotent
- **WHEN** admin sends DELETE `/api/buildings/:id?force=true` on a building already `status=inactive`
- **THEN** response is 200 with the unchanged building DTO

#### Scenario: Manager cannot force
- **WHEN** user with role `manager` sends DELETE with `?force=true`
- **THEN** response is 403 with `error.code === 'FORBIDDEN'`

### Requirement: POST /api/buildings/bulk performs bulk action with per-item result
`server/api/buildings/bulk.post.ts` SHALL require auth (admin only), validate body with `buildingBulkActionSchema` (`{ action: 'archive' | 'activate' | 'delete', ids: string[] }`), iterate over the IDs applying the action via the service, and return `{ data: { succeeded: string[], failed: { id: string, reason: string }[] } }` with status 200. The endpoint SHALL NOT short-circuit on first failure.

#### Scenario: Bulk archive succeeds
- **WHEN** admin posts `{ action: 'archive', ids: ['a','b'] }`
- **THEN** both buildings get `status='inactive'` and response is `{ data: { succeeded: ['a','b'], failed: [] } }`

#### Scenario: Bulk delete with mixed results
- **WHEN** admin posts `{ action: 'delete', ids: ['empty-1','with-rooms','missing'] }`
- **THEN** response is `{ data: { succeeded: ['empty-1'], failed: [{ id:'with-rooms', reason:'has_rooms' }, { id:'missing', reason:'not_found' }] } }`

#### Scenario: Bulk activate sets status to active
- **WHEN** admin posts `{ action: 'activate', ids: ['a'] }` and `a` is inactive
- **THEN** `a` becomes `status='active'` and response succeeded includes `a`

#### Scenario: Manager forbidden
- **WHEN** user with role `manager` posts to `/api/buildings/bulk`
- **THEN** response is 403 with `error.code === 'FORBIDDEN'`

#### Scenario: Validation error on empty ids
- **WHEN** body is `{ action: 'archive', ids: [] }`
- **THEN** response is 422 with `error.code === 'VALIDATION_ERROR'`

### Requirement: Buildings service supports filter/sort/bulk/safe-delete
`server/services/buildings/index.ts` SHALL expose methods aligned with the API surface:
- `list(event, user, opts)` accepts `{ page, limit, q?, status?, sort?, order? }` and forwards to repository.
- `remove(event, user, id, { force })` performs conflict check when `!force`, soft-archive when `force`.
- `bulkAction(event, user, { action, ids })` iterates per item, catches errors, returns `{ succeeded, failed }`.
Each method SHALL re-check permissions using `can(user, capability)` and `throwForbidden` on failure.

#### Scenario: list forwards filters to repository
- **WHEN** `BuildingService.list(event, user, { q:'x', status:['active'], sort:'name' })` is called
- **THEN** repository `findAll` receives the same filter options

#### Scenario: remove with force re-checks admin permission
- **WHEN** `BuildingService.remove(event, user, id, { force: true })` is called with non-admin user
- **THEN** `throwForbidden` is invoked before any DB write

#### Scenario: bulkAction continues past per-item failures
- **WHEN** `BuildingService.bulkAction(event, user, { action:'delete', ids:['a','b'] })` and `a` throws conflict
- **THEN** result includes `a` in failed with reason and `b` is still attempted

### Requirement: Buildings repository supports search, sort, soft-archive, and counts
`server/repositories/buildings/index.ts` SHALL extend:
- `findAll({ page, limit, q?, status?, sort?, order? })` builds Supabase query with `ilike` for `q` across `name`, `address`, `code`, `in` filter for `status`, `order` clause for the chosen sort field.
- `countRoomsForBuilding(id)` returns the number of rooms.
- `countActiveContractsForBuilding(id)` returns the number of contracts with `status='active'` whose room belongs to the building.
- `softArchive(id)` sets `status='inactive'` and returns the updated building.

#### Scenario: findAll applies ilike filter
- **WHEN** `findAll({ q: 'sun' })` is called
- **THEN** the Supabase query uses an `.or()` clause containing `name.ilike.%sun%,address.ilike.%sun%,code.ilike.%sun%`

#### Scenario: findAll sorts by total_rooms
- **WHEN** `findAll({ sort: 'total_rooms', order: 'desc' })` is called
- **THEN** the result data is ordered by the building's computed total_rooms descending

#### Scenario: softArchive sets status inactive
- **WHEN** `softArchive('id-1')` is called on an active building
- **THEN** the building row updates to `status='inactive'` and the returned DTO reflects that

#### Scenario: countActiveContractsForBuilding handles zero
- **WHEN** building has no rooms or contracts
- **THEN** the count returns `0`

