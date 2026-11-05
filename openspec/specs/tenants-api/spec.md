## Purpose

REST API for managing tenants. Full CRUD with pagination, search by name/phone, and id_number conflict detection at service layer. Follows the same auth/permission pattern as buildings and rooms.
## Requirements
### Requirement: List tenants endpoint
`GET /api/tenants` SHALL return paginated list of tenants. Query params: `q` (search by full_name or phone, ILIKE), `building_id` (optional UUID filter derived from primary contracts and contract occupants), `page` (default 1), `limit` (default 20). Response: `{ data: Tenant[], meta: { total, page, limit, totalPages } }`.

#### Scenario: List all tenants
- **WHEN** admin calls GET /api/tenants
- **THEN** returns array of tenants with pagination meta

#### Scenario: Admin list includes unassigned tenants when buildings are hidden
- **GIVEN** at least one building is hidden and an active tenant has no contract or occupant relationship
- **WHEN** admin calls GET /api/tenants without a building filter
- **THEN** the unassigned tenant is included while tenants associated only with hidden buildings remain omitted

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
`GET /api/tenants/:id` SHALL resolve a tenant UUID or code and return its authorized full or basic profile. Returns 404 NOT_FOUND if not found.

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
`DELETE /api/tenants/:id` SHALL require full tenant access and the existing delete capability.
The service SHALL derive every relevant building from active or historical relationships and
check `canDeleteMasterData` for all of them. Client `building_id` SHALL NOT establish delete scope.
Never-contracted tenants SHALL use creator custody established by `TENANT_CREATED` audit history,
with the existing role capability still required. Successful hard delete returns 204.

#### Scenario: Creator custody before first contract
- **WHEN** an authorized creator deletes a tenant that has never had a primary or occupant contract relationship
- **THEN** full creator custody permits deletion subject to existing blocker checks

#### Scenario: Creator custody ends after contract history
- **WHEN** the creator targets a tenant that has acquired contract history outside their building scope
- **THEN** creator identity alone does not permit deletion

#### Scenario: Client building cannot broaden scope
- **WHEN** a request supplies an unrelated `building_id`
- **THEN** authorization derives scope solely from server-owned relationships

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
Full-access tenant list responses SHALL include active contract state and current room/building context when available. Basic profiles SHALL omit this context and follow the exact allowlist below.

When a tenant has active assignment context, the API payload SHALL include:
- `assignmentRole: 'primary' | 'roommate'` to distinguish contract holder vs roommate occupant.
- `primaryTenantName: string | null` where roommate records point to the contract holder name.

#### Scenario: Tenant with active assignment returned
- **WHEN** a returned full-access tenant has active contract participation
- **THEN** its DTO includes `hasActiveContract: true` and active room/building summary

#### Scenario: Roommate assignment returned
- **WHEN** a returned full-access tenant is active via `contract_occupants` (not the primary tenant)
- **THEN** its DTO includes `activeAssignment.assignmentRole === 'roommate'` and `activeAssignment.primaryTenantName` with the contract holder's name

#### Scenario: Primary assignment returned
- **WHEN** a returned full-access tenant is the primary tenant of the active contract
- **THEN** its DTO includes `activeAssignment.assignmentRole === 'primary'` and `activeAssignment.primaryTenantName === null`

#### Scenario: Tenant without active assignment returned
- **WHEN** a returned full-access tenant has no active contract participation
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
`server/api/tenants/[id].delete.ts` SHALL check blocking references before hard-delete. If the tenant has any portal account link, active primary contract, or active occupancy, the endpoint SHALL respond `409 CONFLICT` with blocker counts. A linked account SHALL be explicitly revoked before tenant hard-delete so cascade cannot create an orphan Auth identity. If no blockers exist, the tenant SHALL be hard-deleted and the endpoint SHALL respond `204`.

#### Scenario: Conflict response when portal account exists
- **WHEN** an operator deletes a tenant with a `tenant_user_links` row
- **THEN** the response is 409 and identifies the portal account blocker

#### Scenario: Conflict response when active contract exists
- **WHEN** admin deletes a tenant who is primary on one active contract
- **THEN** the response is 409 with the active-contract count

#### Scenario: Conflict response when active occupant exists
- **WHEN** admin deletes a tenant who has one active occupancy
- **THEN** the response is 409 with the active-occupancy count

#### Scenario: Successful hard-delete without blockers
- **WHEN** admin deletes a tenant with no portal account, active contract, or active occupancy
- **THEN** the tenant row is removed and the response is 204

---

### Requirement: DELETE /api/tenants/:id supports force soft-archive
`server/api/tenants/[id].delete.ts` SHALL accept query param `?force=true`. When present and the caller has full tenant access plus the existing delete capability, the endpoint SHALL skip the conflict check and instead set `status='archived'` on the tenant (soft-archive), returning `200` with `{ data: Tenant }`. The endpoint SHALL NOT hard-delete when `?force=true` is used. Historical references (contracts, occupants) are preserved.

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
`server/api/tenants/bulk.post.ts` SHALL require the existing action capability, validate body with `tenantBulkActionSchema` (`{ action: 'archive' | 'activate' | 'delete', ids: string[], reason?: string }`), deduplicate IDs and authorize each through the shared tenant service, and return `{ data: { succeeded: string[], failed: { id: string, reason: string }[] } }` with status 200. The endpoint SHALL NOT short-circuit on first failure. `reason` SHALL be required when `action='delete'`.

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

#### Scenario: remove with force requires full access and capability
- **WHEN** `TenantService.remove(event, user, id, { force: true })` is called without full access or the action capability
- **THEN** the service denies before any DB write

#### Scenario: remove permits never-contracted creator custody
- **WHEN** a capable creator has full custody of a tenant that has never had any contract history
- **THEN** the service permits delete subject to the existing blockers

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

### Requirement: Export selected current tenants
`GET /api/tenants/export-candidates?building_id=<uuid>` SHALL return only current primary tenants and roommates in that building, with lean selection fields. `POST /api/tenants/export` SHALL accept `{ building_id, tenant_ids }` and return an XLSX containing one full text-profile row per selected tenant. Both routes SHALL require `tenants.export`, available only to admin and owner, and SHALL enforce visible building scope. The candidate endpoint SHALL exclude tenants without full tenant access. The export SHALL recheck every selected tenant's full access and current assignment before reading sensitive profile rows or constructing the workbook, reject an empty or stale selection, exclude identity images and URLs, and audit the building and selected count/IDs.

#### Scenario: Current occupants only
- **WHEN** a building has a current primary tenant, a current roommate, a moved-out roommate, and a future occupant
- **THEN** only the current primary tenant and roommate are export candidates

#### Scenario: Stale or unauthorized export
- **WHEN** a manager calls either route, an owner names an out-of-scope building, or a selected tenant is no longer current in that building
- **THEN** no XLSX is returned; the manager is forbidden, the building is hidden, or the stale selection is rejected as appropriate

#### Scenario: Tenant workbook uses shared styling
- **WHEN** selected current tenants are exported
- **THEN** title, building summary, column headers, and profile rows use the shared Excel styling while filters, frozen headers, one row per tenant, and text formats for phone and identity number remain intact

### Requirement: Shared tenant authorization and redaction
All internal profile, document, mutation, and account services SHALL use the shared tenant
authorization service. Capability denial SHALL return 403 before tenant lookup, including for
admin. Missing or `none` targets SHALL return 404. A `basic` write/document/account action SHALL
return 403 before storage, Auth, duplicate checks, or persistence side effects. Request codes
SHALL resolve to canonical tenant IDs before side effects and audits.

Active relationships SHALL be active primary contracts or occupant rows whose `move_out_date`
is null, without adding date rules. History SHALL include all primary and occupant contracts.
Admin SHALL have full scope subject to capabilities. A scoped actor SHALL have full access only
when every active building is assigned; any outside active building reduces access to basic if
any current or historical building is assigned. Without active relationships, historical scope
SHALL grant basic access. Only before any contract history SHALL `TENANT_CREATED` audit custody
grant the creator full access. All other targets SHALL be none.

Get/list responses SHALL explicitly emit `accessLevel: 'full' | 'basic'`. Basic DTOs SHALL contain
exactly `id`, `code`, `fullName`, `phone`, `status`, and `accessLevel`, with no extra identity,
contact, timestamps, assignment, storage path/URL, or Portal fields. Basic search SHALL only
match name, phone, or code; email and identity-number matches SHALL require full access.
Default owner lists SHALL exclude historical-only tenants while scoped building-history lookup
remains possible. Contract creation tenant-picker behavior SHALL remain unchanged.

#### Scenario: Previous owner reads transferred tenant
- **WHEN** a capable owner has historical scope but a tenant's active relationship is outside that scope
- **THEN** get returns only the exact basic allowlist and performs no identity-image signing
- **AND** the default list excludes the historical-only tenant while a scoped building-history lookup can return basic data

#### Scenario: Multi-building relationship fails closed
- **WHEN** a tenant has active relationships in buildings A and B and the owner is assigned only A
- **THEN** the owner receives basic access and no sensitive mutation, account control, or full-profile export

#### Scenario: Basic search cannot disclose private fields
- **WHEN** a basic-only tenant matches a search solely by email or identity number
- **THEN** the tenant is omitted; matching name, phone, or code can return the basic allowlist

### Requirement: Scoped tenant bulk status transaction
Bulk SHALL classify each unique missing/none ID as `not_found` and basic ID as `forbidden`.
Only full contexts SHALL reach `bulk_tenant_status_action` for archive/activate, carrying sorted
exact active-building snapshots. The service-role-only security-invoker RPC SHALL lock tenants
in sorted ID order and recompute active buildings before mutation; changed snapshots SHALL
return `conflict`. Delete SHALL use server-derived building checks without client fallback.
Failure codes SHALL be `not_found`, `forbidden`, `conflict`, `has_active_contracts`,
`has_active_occupancies`, or `unexpected_error`. Only successful IDs SHALL produce mutation audits
with server-owned building context. The generic master-data bulk RPC SHALL remain unchanged.

#### Scenario: Mixed and duplicate bulk IDs
- **WHEN** capable operator submits full, basic, missing, and duplicate IDs
- **THEN** each unique ID has one outcome and only full authorized status items reach the RPC
- **AND** basic/missing outcomes are forbidden/not_found and only successes are audited

#### Scenario: Relationship changes after authorization
- **WHEN** active building relationships differ from the authorized snapshot under the RPC lock
- **THEN** that item returns conflict without changing its status
