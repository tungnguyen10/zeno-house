## Purpose

REST API for managing tenants. Full CRUD with pagination, search by name/phone, and id_number conflict detection at service layer. Follows the same auth/permission pattern as buildings and rooms.
## Requirements
### Requirement: List tenants endpoint
`GET /api/tenants` SHALL return paginated list of tenants. Query params: `q` (search by full_name or phone, ILIKE), `building_id` (optional UUID filter derived from primary contracts and contract occupants), `page` (default 1), `limit` (default 20). Response: `{ data: Tenant[], meta: { total, page, limit, totalPages } }`.

#### Scenario: List all tenants
- **WHEN** admin calls GET /api/tenants
- **THEN** returns array of tenants with pagination meta

#### Scenario: Search by name
- **WHEN** admin calls GET /api/tenants?q=Nguyễn
- **THEN** returns only tenants whose full_name contains "Nguyễn" (case-insensitive)

#### Scenario: Search by phone
- **WHEN** admin calls GET /api/tenants?q=0901
- **THEN** returns tenants whose phone contains "0901"

#### Scenario: Filter by building includes primary tenants
- **WHEN** admin calls GET /api/tenants?building_id=<uuid>
- **THEN** returns tenants who are primary tenants on contracts in that building

#### Scenario: Filter by building includes occupants
- **WHEN** admin calls GET /api/tenants?building_id=<uuid>
- **THEN** returns tenants who are occupants on contracts in that building

#### Scenario: Filter by building with search
- **WHEN** admin calls GET /api/tenants?building_id=<uuid>&q=0901
- **THEN** returns only matching tenants within the selected building relationship set

#### Scenario: Unauthenticated request
- **WHEN** request has no valid session
- **THEN** returns 401 UNAUTHENTICATED

### Requirement: Get tenant by id endpoint
`GET /api/tenants/:id` SHALL return single tenant by UUID. Returns 404 NOT_FOUND if not found.

#### Scenario: Tenant found
- **WHEN** admin calls GET /api/tenants/:id with valid id
- **THEN** returns tenant data

#### Scenario: Tenant not found
- **WHEN** id does not match any tenant
- **THEN** returns 404 with error code NOT_FOUND

### Requirement: Create tenant endpoint
`POST /api/tenants` SHALL create a new tenant. Body validated with Zod: `full_name` required, `phone` required, other fields optional. Returns 201 with created tenant. Returns 409 CONFLICT if `id_number` already exists.

#### Scenario: Create success
- **WHEN** admin POSTs valid tenant data
- **THEN** returns 201 with created tenant

#### Scenario: Missing required fields
- **WHEN** admin POSTs without full_name or phone
- **THEN** returns 422 VALIDATION_ERROR with field details

#### Scenario: Duplicate id_number
- **WHEN** admin POSTs with id_number that already exists
- **THEN** returns 409 CONFLICT

### Requirement: Update tenant endpoint
`PATCH /api/tenants/:id` SHALL update an existing tenant. All fields optional (partial update). Returns updated tenant. Returns 404 if not found. Returns 409 if id_number conflicts with another tenant.

#### Scenario: Update success
- **WHEN** admin PATCHes valid partial data
- **THEN** returns updated tenant

#### Scenario: Update non-existent tenant
- **WHEN** id does not exist
- **THEN** returns 404 NOT_FOUND

### Requirement: Delete tenant endpoint
`DELETE /api/tenants/:id` SHALL delete a tenant. Returns 204 on success. Returns 404 if not found. When active-building scope cannot be derived, owner users SHALL still be allowed to delete a tenant if they created that tenant row (`created_by` equals caller id).

#### Scenario: Delete success
- **WHEN** admin DELETEs existing tenant
- **THEN** tenant removed, returns 204

#### Scenario: Delete non-existent
- **WHEN** id does not exist
- **THEN** returns 404 NOT_FOUND

#### Scenario: Owner can delete owner-created orphan tenant
- **WHEN** owner deletes a tenant with no active-building scope and `tenant.created_by` equals the owner id
- **THEN** response is 204 and tenant is deleted

#### Scenario: Owner cannot delete orphan tenant created by another user
- **WHEN** owner deletes a tenant with no active-building scope and `tenant.created_by` does not equal the owner id
- **THEN** response is 403 FORBIDDEN

### Requirement: List tenants supports contract-state filter
`GET /api/tenants` SHALL support `contract_state` query param with values `with_contract` and `without_contract`. Contract state SHALL be based on active contracts where the tenant is either the primary tenant or an active occupant.

#### Scenario: Filter with active contract
- **WHEN** admin calls GET /api/tenants?contract_state=with_contract
- **THEN** the response includes only tenants with active contract participation

#### Scenario: Filter without active contract
- **WHEN** admin calls GET /api/tenants?contract_state=without_contract
- **THEN** the response includes only tenants without active contract participation

#### Scenario: Contract-state filter combines with building filter
- **WHEN** admin calls GET /api/tenants?building_id=<uuid>&contract_state=with_contract
- **THEN** the response includes only tenants matching both the building relationship and active-contract filter

### Requirement: Tenant list response includes active assignment summary
Tenant list responses SHALL include active contract state and current room/building context for each tenant when available.

When a tenant has active assignment context, the API payload SHALL include:
- `assignmentRole: 'primary' | 'roommate'` to distinguish contract holder vs roommate occupant.
- `primaryTenantName: string | null` where roommate records point to the contract holder name.

#### Scenario: Tenant with active assignment returned
- **WHEN** a returned tenant has active contract participation
- **THEN** its DTO includes `hasActiveContract: true` and active room/building summary

#### Scenario: Roommate assignment returned
- **WHEN** a returned tenant is active via `contract_occupants` (not the primary tenant)
- **THEN** its DTO includes `activeAssignment.assignmentRole === 'roommate'` and `activeAssignment.primaryTenantName` with the contract holder's name

#### Scenario: Primary assignment returned
- **WHEN** a returned tenant is the primary tenant of the active contract
- **THEN** its DTO includes `activeAssignment.assignmentRole === 'primary'` and `activeAssignment.primaryTenantName === null`

#### Scenario: Tenant without active assignment returned
- **WHEN** a returned tenant has no active contract participation
- **THEN** its DTO includes `hasActiveContract: false` and no active room/building summary

### Requirement: GET /api/tenants validates query with Zod
`server/api/tenants/index.get.ts` SHALL validate the incoming query with `tenantListQuerySchema` (`page`, `limit`, `q?`, `building_id?`, `contract_state?`, `status?: ('active'|'archived')[]`, `sort?: 'full_name'|'created_at'|'code'`, `order?: 'asc'|'desc'`, `available?`, `excludeContractId?`). Invalid query SHALL yield `422 VALIDATION_ERROR`. The endpoint SHALL preserve the existing `{ data, meta }` envelope.

#### Scenario: Valid query passes
- **WHEN** authenticated user calls `GET /api/tenants?q=nguyen&status=active&sort=full_name&order=asc`
- **THEN** the request validates successfully and the service is invoked with parsed options

#### Scenario: Invalid sort field rejected
- **WHEN** request includes `?sort=secret`
- **THEN** response 422 with `error.code === 'VALIDATION_ERROR'`

#### Scenario: Invalid status value rejected
- **WHEN** request includes `?status=banned`
- **THEN** response 422 with `error.code === 'VALIDATION_ERROR'`

---

### Requirement: GET /api/tenants supports search, sort, and status filter
`server/api/tenants/index.get.ts` SHALL accept query params `q`, `sort`, `order`, `status[]` in addition to existing filters. When `status` is omitted, results SHALL exclude `status='archived'`. Search `q` SHALL match `full_name`, `phone`, `email`, `id_number`, or `code` (case-insensitive).

#### Scenario: Search across multiple fields
- **WHEN** authenticated user calls `GET /api/tenants?q=0901`
- **THEN** response includes tenants whose phone, email, or id_number contains "0901"

#### Scenario: Default excludes archived
- **WHEN** authenticated user calls `GET /api/tenants` with no `status` param
- **THEN** response excludes any tenant with `status='archived'`

#### Scenario: Explicitly view archived
- **WHEN** authenticated user calls `GET /api/tenants?status=archived`
- **THEN** response includes only archived tenants

#### Scenario: Sort by full_name ascending
- **WHEN** authenticated user calls `GET /api/tenants?sort=full_name&order=asc`
- **THEN** response data is ordered by `full_name` ascending

---

### Requirement: DELETE /api/tenants/:id performs safe-delete with conflict check
`server/api/tenants/[id].delete.ts` SHALL by default check for blocking references before deleting: if the tenant has any active contracts (primary) OR any active occupancies (`contract_occupants.move_out_date IS NULL`), the endpoint SHALL respond `409` with `error.code === 'CONFLICT'` and `error.details === { activeContracts: number, activeOccupancies: number }`. If no blockers, the tenant SHALL be hard-deleted and the endpoint responds `204`.

#### Scenario: Conflict response when active contract exists
- **WHEN** admin sends DELETE on a tenant who is primary on 1 active contract
- **THEN** response is 409 with `error.code === 'CONFLICT'` and `error.details.activeContracts === 1`

#### Scenario: Conflict response when active occupant exists
- **WHEN** admin sends DELETE on a tenant who has 1 active occupancy (no move_out_date)
- **THEN** response is 409 with `error.details.activeOccupancies === 1`

#### Scenario: Successful hard-delete when no blockers
- **WHEN** admin sends DELETE on a tenant with 0 active contracts and 0 active occupancies
- **THEN** response is 204 and the row is removed from the database

---

### Requirement: DELETE /api/tenants/:id supports force soft-archive
`server/api/tenants/[id].delete.ts` SHALL accept query param `?force=true`. When present and the caller is admin, the endpoint SHALL skip the conflict check and instead set `status='archived'` on the tenant (soft-archive), returning `200` with `{ data: Tenant }`. The endpoint SHALL NOT hard-delete when `?force=true` is used. Historical references (contracts, occupants) are preserved.

#### Scenario: Force archives a tenant with active contract
- **WHEN** admin sends DELETE `/api/tenants/:id?force=true` on a tenant with active contract
- **THEN** response is 200 with `{ data }` where `data.status === 'archived'`; contract row is untouched

#### Scenario: Force on already-archived tenant is idempotent
- **WHEN** admin sends DELETE `/api/tenants/:id?force=true` on a tenant already `status=archived`
- **THEN** response is 200 with the unchanged tenant DTO

#### Scenario: Manager cannot force
- **WHEN** user with role `manager` sends DELETE with `?force=true`
- **THEN** response is 403 with `error.code === 'FORBIDDEN'`

---

### Requirement: POST /api/tenants/bulk performs bulk action with per-item result
`server/api/tenants/bulk.post.ts` SHALL require admin auth, validate body with `tenantBulkActionSchema` (`{ action: 'archive' | 'activate' | 'delete', ids: string[], reason?: string }`), iterate over the IDs applying the action via the service, and return `{ data: { succeeded: string[], failed: { id: string, reason: string }[] } }` with status 200. The endpoint SHALL NOT short-circuit on first failure. `reason` SHALL be required when `action='delete'`.

#### Scenario: Bulk archive succeeds
- **WHEN** admin posts `{ action: 'archive', ids: ['a','b'] }`
- **THEN** both tenants get `status='archived'` and response is `{ data: { succeeded: ['a','b'], failed: [] } }`

#### Scenario: Bulk activate sets status to active
- **WHEN** admin posts `{ action: 'activate', ids: ['a'] }` and `a` is archived
- **THEN** `a` becomes `status='active'` and response succeeded includes `a`

#### Scenario: Bulk delete with mixed results
- **WHEN** admin posts `{ action: 'delete', ids: ['no-history','active-contract','missing'] }`
- **THEN** response is `{ data: { succeeded: ['no-history'], failed: [{ id:'active-contract', reason:'has_active_contracts' }, { id:'missing', reason:'not_found' }] } }`

#### Scenario: Manager forbidden
- **WHEN** user with role `manager` posts to `/api/tenants/bulk`
- **THEN** response is 403 with `error.code === 'FORBIDDEN'`

#### Scenario: Validation error on empty ids
- **WHEN** body is `{ action: 'archive', ids: [] }`
- **THEN** response is 422 with `error.code === 'VALIDATION_ERROR'`

#### Scenario: Validation error when bulk delete reason is missing
- **WHEN** body is `{ action: 'delete', ids: ['a'] }`
- **THEN** response is 422 with `error.code === 'VALIDATION_ERROR'` and an error on `reason`

---

### Requirement: Tenants service supports filter/sort/bulk/safe-delete
`server/services/tenants/index.ts` SHALL expose:
- `list(event, user, opts)` accepting `{ page, limit, q?, building_id?, contract_state?, status?, sort?, order?, available?, excludeContractId? }`.
- `remove(event, user, id, { force })` performing conflict check when `!force`, soft-archive when `force`.
- `bulkAction(event, user, { action, ids })` iterating per item, catching errors, returning `{ succeeded, failed }`.
Each method SHALL re-check permissions using `can(user, capability)`.

#### Scenario: list forwards filters to repository
- **WHEN** `TenantService.list(event, user, { q:'x', status:['active'], sort:'full_name' })` is called
- **THEN** repository `findAll` receives the same filter options

#### Scenario: remove with force re-checks admin permission
- **WHEN** `TenantService.remove(event, user, id, { force: true })` is called with non-admin user
- **THEN** the service throws FORBIDDEN before any DB write

#### Scenario: remove allows owner-created orphan delete
- **WHEN** `TenantService.remove(event, ownerUser, id, { force: false })` is called and tenant has no derived active-building scope but `tenant.created_by === ownerUser.id`
- **THEN** the service allows delete instead of throwing FORBIDDEN

#### Scenario: bulkAction continues past per-item failures
- **WHEN** `TenantService.bulkAction(event, user, { action:'delete', ids:['a','b'] })` and `a` throws conflict
- **THEN** result includes `a` in failed with reason and `b` is still attempted

---

### Requirement: Tenants repository supports search, sort, status filter, soft-archive, and counts
`server/repositories/tenants/index.ts` SHALL extend:
- `findAll({ page, limit, q?, building_id?, contract_state?, status?, sort?, order?, available?, excludeContractId? })` builds a Supabase query with `ilike` for `q` across `full_name`, `phone`, `email`, `id_number`, `code`; `in` filter for `status` (default excludes `'archived'` when `status` is undefined); `order` clause for the chosen sort field.
- `countActiveContractsForTenant(id)` returns the number of active contracts where the tenant is primary.
- `countActiveOccupanciesForTenant(id)` returns the number of `contract_occupants` rows with `move_out_date IS NULL`.
- `softArchive(id)` sets `status='archived'` and returns the updated tenant.

#### Scenario: findAll applies ilike filter across fields
- **WHEN** `findAll({ q: 'nguy' })` is called
- **THEN** the Supabase query uses an `.or()` clause covering `full_name`, `phone`, `email`, `id_number`, `code`

#### Scenario: findAll default excludes archived
- **WHEN** `findAll({})` is called without `status`
- **THEN** the query adds a `not('status', 'eq', 'archived')` clause

#### Scenario: softArchive sets status archived
- **WHEN** `softArchive('id-1')` is called on an active tenant
- **THEN** the tenant row updates to `status='archived'` and the returned DTO reflects that

#### Scenario: countActiveOccupanciesForTenant handles zero
- **WHEN** tenant has no occupancy rows
- **THEN** the count returns `0`

### Requirement: tenants-api - mutation audit
Tenant service mutation methods SHALL write audit events to `audit_events`.

#### Scenario: TenantService mutations emit audit events
- **WHEN** any mutation method on `TenantService` is called
- **THEN** an audit event is written to `audit_events`
