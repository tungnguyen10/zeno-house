## Purpose

HTTP API for managing rooms. All endpoints require authentication. Admin-only endpoints: create, update, delete. Read endpoints available to both admin and manager.
## Requirements
### Requirement: List rooms endpoint
`GET /api/rooms` SHALL return paginated room list. Optional query params: `building_id`, `status`, `floor`. Response: `{ data: RoomDto[], meta: { total } }`. Requires authentication.

#### Scenario: List all rooms
- **WHEN** admin calls GET /api/rooms
- **THEN** returns all rooms with 200

#### Scenario: Filter by building
- **WHEN** GET /api/rooms?building_id=<uuid>
- **THEN** returns only rooms belonging to that building

#### Scenario: Filter by status
- **WHEN** GET /api/rooms?status=available
- **THEN** returns only rooms with status 'available'

#### Scenario: Unauthenticated request
- **WHEN** request has no valid session
- **THEN** returns 401 UNAUTHENTICATED

### Requirement: Get room by ID endpoint
`GET /api/rooms/:id` SHALL return single room DTO. Returns 404 if not found.

#### Scenario: Found
- **WHEN** GET /api/rooms/:id with valid id
- **THEN** returns room DTO with 200

#### Scenario: Not found
- **WHEN** GET /api/rooms/:id with unknown id
- **THEN** returns 404 NOT_FOUND

### Requirement: Create room endpoint
`POST /api/rooms` SHALL create a new room. Requires admin role. Body validated via Zod: `building_id`, `room_number`, `floor`, `status`, `monthly_rent` required; `area`, `description` optional. Returns 201 with created room.

#### Scenario: Admin creates room
- **WHEN** admin POSTs valid room data
- **THEN** room is created and returned with 201

#### Scenario: Duplicate room_number in building
- **WHEN** admin creates room with existing room_number in same building
- **THEN** returns 409 CONFLICT

#### Scenario: Validation error
- **WHEN** body missing required fields
- **THEN** returns 400 VALIDATION_ERROR

#### Scenario: Manager forbidden
- **WHEN** manager POSTs room data
- **THEN** returns 403 FORBIDDEN

### Requirement: Update room endpoint
`PATCH /api/rooms/:id` SHALL update an existing room. Requires admin role. All fields optional. Returns updated room.

#### Scenario: Admin updates room
- **WHEN** admin PATCHes valid fields
- **THEN** room updated, returns 200

#### Scenario: Manager forbidden
- **WHEN** manager PATCHes room
- **THEN** returns 403 FORBIDDEN

### Requirement: Delete room endpoint
`DELETE /api/rooms/:id` SHALL delete a room. Requires admin role. Returns 204.

#### Scenario: Admin deletes room
- **WHEN** admin DELETEs room by id
- **THEN** room deleted, returns 204

#### Scenario: Manager forbidden
- **WHEN** manager tries to delete room
- **THEN** returns 403 FORBIDDEN

### Requirement: Room API supports scoped slug lookup
Room read APIs SHALL support lookup by UUID id and by building identifier plus room slug where scoped room URLs are used.

#### Scenario: Lookup room by id
- **WHEN** authenticated user requests a room by UUID id
- **THEN** the API returns the matching room DTO

#### Scenario: Lookup room by building slug and room slug
- **WHEN** authenticated user requests room `a101` under building slug `toa-a`
- **THEN** the API returns the matching room DTO for that building

#### Scenario: Unknown scoped room slug
- **WHEN** authenticated user requests unknown room slug under a valid building
- **THEN** the API returns 404 NOT_FOUND

### Requirement: GET /api/rooms supports search, filter, and sort
`server/api/rooms/index.get.ts` SHALL accept optional query params `q: string`, `status: ('available' | 'occupied' | 'maintenance' | 'archived')[]`, `sort: 'room_number' | 'floor' | 'monthly_rent' | 'created_at'` (default `floor` ascending then `room_number` ascending), `order: 'asc' | 'desc'` in addition to existing `building_id`, `floor`, `page`, `limit`. The endpoint SHALL validate query with `roomListQuerySchema`, delegate to service, and preserve the `{ data, meta }` envelope. When `status` is omitted, results SHALL exclude `status='archived'`.

#### Scenario: Search by room number / code / description
- **WHEN** authenticated user calls `GET /api/rooms?q=a101`
- **THEN** response includes only rooms whose `room_number`, `code`, or `description` contains "a101" (case-insensitive)

#### Scenario: Filter by single status
- **WHEN** authenticated user calls `GET /api/rooms?status=available`
- **THEN** response includes only rooms with `status=available`

#### Scenario: Filter by multiple statuses
- **WHEN** authenticated user calls `GET /api/rooms?status=available&status=occupied`
- **THEN** response includes rooms with either status

#### Scenario: Default excludes archived
- **WHEN** authenticated user calls `GET /api/rooms` with no `status` param
- **THEN** response excludes any room with `status='archived'`

#### Scenario: Explicitly view archived
- **WHEN** authenticated user calls `GET /api/rooms?status=archived`
- **THEN** response includes only archived rooms

#### Scenario: Sort by monthly_rent descending
- **WHEN** authenticated user calls `GET /api/rooms?sort=monthly_rent&order=desc`
- **THEN** response data is ordered by `monthly_rent` descending

#### Scenario: Invalid sort field rejected
- **WHEN** request includes `?sort=secret`
- **THEN** response 422 with `error.code === 'VALIDATION_ERROR'`

#### Scenario: Combined filters and pagination
- **WHEN** request is `GET /api/rooms?building_id=<uuid>&q=a&status=available&sort=floor&order=asc&page=2&limit=10`
- **THEN** response data is the second page of 10 results matching all filters

---

### Requirement: DELETE /api/rooms/:id performs safe-delete with conflict check
`server/api/rooms/[id].delete.ts` SHALL by default check for blocking references before deleting: if the room has any active contracts (status `active`) OR any meter readings, the endpoint SHALL respond `409` with `error.code === 'CONFLICT'` and `error.details === { activeContracts: number, meterReadings: number }`. If no blockers, the room SHALL be hard-deleted and the endpoint responds `204`.

#### Scenario: Conflict response when active contract exists
- **WHEN** admin sends DELETE on a room with 1 active contract
- **THEN** response is 409 with `error.code === 'CONFLICT'` and `error.details.activeContracts === 1`

#### Scenario: Conflict response when meter readings exist
- **WHEN** admin sends DELETE on a room with 0 active contracts but 5 historical meter readings
- **THEN** response is 409 with `error.details.meterReadings === 5`

#### Scenario: Successful hard-delete when no blockers
- **WHEN** admin sends DELETE on a room with 0 active contracts and 0 meter readings
- **THEN** response is 204 and the row is removed from the database

---

### Requirement: DELETE /api/rooms/:id supports force soft-archive
`server/api/rooms/[id].delete.ts` SHALL accept query param `?force=true`. When present and the caller is admin, the endpoint SHALL skip the conflict check and instead set `status='archived'` on the room (soft-archive), returning `200` with `{ data: Room }` (the archived room). The endpoint SHALL NOT hard-delete when `?force=true` is used. Historical references (contracts, meter readings) are preserved.

#### Scenario: Force archives a room with active contract
- **WHEN** admin sends DELETE `/api/rooms/:id?force=true` on a room with active contract
- **THEN** response is 200 with `{ data }` where `data.status === 'archived'`; contract row is untouched

#### Scenario: Force on already-archived room is idempotent
- **WHEN** admin sends DELETE `/api/rooms/:id?force=true` on a room already `status=archived`
- **THEN** response is 200 with the unchanged room DTO

#### Scenario: Manager cannot force
- **WHEN** user with role `manager` sends DELETE with `?force=true`
- **THEN** response is 403 with `error.code === 'FORBIDDEN'`

---

### Requirement: POST /api/rooms/bulk performs bulk action with per-item result
`server/api/rooms/bulk.post.ts` SHALL require admin auth, validate body with `roomBulkActionSchema` (`{ action: 'archive' | 'activate' | 'set_maintenance' | 'delete', ids: string[], reason?: string }`), iterate over the IDs applying the action via the service, and return `{ data: { succeeded: string[], failed: { id: string, reason: string }[] } }` with status 200. The endpoint SHALL NOT short-circuit on first failure. `reason` SHALL be required when `action='delete'`.

#### Scenario: Bulk archive succeeds
- **WHEN** admin posts `{ action: 'archive', ids: ['a','b'] }`
- **THEN** both rooms get `status='archived'` and response is `{ data: { succeeded: ['a','b'], failed: [] } }`

#### Scenario: Bulk activate sets status to available
- **WHEN** admin posts `{ action: 'activate', ids: ['a'] }` and `a` is archived
- **THEN** `a` becomes `status='available'` and response succeeded includes `a`

#### Scenario: Bulk set_maintenance
- **WHEN** admin posts `{ action: 'set_maintenance', ids: ['a','b'] }`
- **THEN** both rooms become `status='maintenance'` and response succeeded includes both

#### Scenario: Bulk delete with mixed results
- **WHEN** admin posts `{ action: 'delete', ids: ['empty-1','with-contract','missing'] }`
- **THEN** response is `{ data: { succeeded: ['empty-1'], failed: [{ id:'with-contract', reason:'has_active_contracts' }, { id:'missing', reason:'not_found' }] } }`

#### Scenario: Manager forbidden
- **WHEN** user with role `manager` posts to `/api/rooms/bulk`
- **THEN** response is 403 with `error.code === 'FORBIDDEN'`

#### Scenario: Validation error on empty ids
- **WHEN** body is `{ action: 'archive', ids: [] }`
- **THEN** response is 422 with `error.code === 'VALIDATION_ERROR'`

#### Scenario: Validation error when bulk delete reason is missing
- **WHEN** body is `{ action: 'delete', ids: ['a'] }`
- **THEN** response is 422 with `error.code === 'VALIDATION_ERROR'` and an error on `reason`

---

### Requirement: Rooms service supports filter/sort/bulk/safe-delete
`server/services/rooms/index.ts` SHALL expose:
- `list(event, user, opts)` accepting `{ buildingId?, floor?, page, limit, q?, status?, sort?, order? }` and forwarding to repository.
- `remove(event, user, id, { force })` performing conflict check when `!force`, soft-archive when `force`.
- `bulkAction(event, user, { action, ids })` iterating per item, catching errors, returning `{ succeeded, failed }`.
Each method SHALL re-check permissions using `can(user, capability)` and throw FORBIDDEN on failure.

#### Scenario: list forwards filters to repository
- **WHEN** `RoomService.list(event, user, { q:'x', status:['available'], sort:'room_number' })` is called
- **THEN** repository `findAll` receives the same filter options

#### Scenario: remove with force re-checks admin permission
- **WHEN** `RoomService.remove(event, user, id, { force: true })` is called with non-admin user
- **THEN** the service throws FORBIDDEN before any DB write

#### Scenario: bulkAction continues past per-item failures
- **WHEN** `RoomService.bulkAction(event, user, { action:'delete', ids:['a','b'] })` and `a` throws conflict
- **THEN** result includes `a` in failed with reason and `b` is still attempted

---

### Requirement: Rooms repository supports search, sort, soft-archive, and counts
`server/repositories/rooms/index.ts` SHALL extend:
- `findAll({ buildingId?, floor?, page, limit, q?, status?, sort?, order? })` builds Supabase query with `ilike` for `q` across `room_number`, `code`, `description`, `in` filter for `status` (default excludes `'archived'` when `status` is undefined), `order` clause for the chosen sort field.
- `countActiveContractsForRoom(id)` returns the number of contracts with `status='active'` on that room.
- `countMeterReadingsForRoom(id)` returns the number of meter readings of any type for that room.
- `softArchive(id)` sets `status='archived'` and returns the updated room.

#### Scenario: findAll applies ilike filter
- **WHEN** `findAll({ q: 'a10' })` is called
- **THEN** the Supabase query uses an `.or()` clause matching `room_number.ilike.%a10%,code.ilike.%a10%,description.ilike.%a10%`

#### Scenario: findAll default excludes archived
- **WHEN** `findAll({})` is called without `status`
- **THEN** the query adds a `not('status', 'eq', 'archived')` clause

#### Scenario: softArchive sets status archived
- **WHEN** `softArchive('id-1')` is called on an available room
- **THEN** the room row updates to `status='archived'` and the returned DTO reflects that

#### Scenario: countActiveContractsForRoom handles zero
- **WHEN** room has no contracts
- **THEN** the count returns `0`

### Requirement: rooms-api - mutation audit
Room service mutation methods SHALL write audit events to `audit_events`.

#### Scenario: RoomService mutations emit audit events
- **WHEN** any mutation method on `RoomService` is called
- **THEN** an audit event is written to `audit_events`
