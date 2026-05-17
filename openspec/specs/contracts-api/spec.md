## Purpose

Server-side API for contracts. CRUD endpoints with Zod validation, auth guard, and 409 CONFLICT protection when a room already has an active contract.

## Requirements

### Requirement: List contracts endpoint
`GET /api/contracts` SHALL return a paginated list of contracts. Query params: `room_id` (optional UUID filter), `tenant_id` (optional UUID filter), `status` (optional, one of `active` | `expired` | `terminated`), `page` (default 1), `limit` (default 20). Response: `{ data: Contract[], meta: { total, page, limit, totalPages } }`. Requires authenticated session with admin or manager role.

#### Scenario: List all contracts
- **WHEN** admin calls GET /api/contracts
- **THEN** returns array of contracts with pagination meta

#### Scenario: Filter by room
- **WHEN** admin calls GET /api/contracts?room_id=<uuid>
- **THEN** returns only contracts for that room

#### Scenario: Filter by status
- **WHEN** admin calls GET /api/contracts?status=active
- **THEN** returns only contracts with status 'active'

#### Scenario: Unauthenticated request
- **WHEN** request has no valid session
- **THEN** returns 401 UNAUTHENTICATED

### Requirement: Get contract by id endpoint
`GET /api/contracts/:id` SHALL return a single contract by UUID including joined `room` (room_number, floor, building name) and `tenant` (full_name, phone). Returns 404 NOT_FOUND if not found.

#### Scenario: Contract found
- **WHEN** admin calls GET /api/contracts/:id with valid id
- **THEN** returns contract with nested room and tenant summary fields

#### Scenario: Contract not found
- **WHEN** id does not match any contract
- **THEN** returns 404 NOT_FOUND

### Requirement: Create contract endpoint
`POST /api/contracts` SHALL create a new contract. Body validated with Zod: `room_id` (required UUID), `tenant_id` (required UUID), `start_date` (required date string YYYY-MM-DD), `end_date` (required date string YYYY-MM-DD, must be after start_date), `monthly_rent` (required number ≥ 0), `deposit` (optional number ≥ 0, default 0), `status` (optional, default `active`), `notes` (optional string). Returns 201 with created contract.

When status is `active` (or omitted), the API SHALL additionally verify:
1. No other active contract exists for the same room
2. The primary tenant (`tenant_id`) is not already standing as primary on another active contract
3. The primary tenant is not currently an active occupant (no `move_out_date`) in another contract

#### Scenario: Create success
- **WHEN** admin POSTs valid contract data and tenant has no active occupancy elsewhere
- **THEN** returns 201 with created contract

#### Scenario: Missing required fields
- **WHEN** admin POSTs without room_id, tenant_id, start_date, end_date, or monthly_rent
- **THEN** returns 422 VALIDATION_ERROR with field details

#### Scenario: end_date before start_date
- **WHEN** admin POSTs with end_date ≤ start_date
- **THEN** returns 422 VALIDATION_ERROR

#### Scenario: Room already has active contract
- **WHEN** admin POSTs for a room that already has status='active' contract
- **THEN** returns 409 CONFLICT: "Phòng này đã có hợp đồng đang hiệu lực"

#### Scenario: Tenant already primary on another contract
- **WHEN** admin POSTs tenant_id that is already tenant_id of another active contract
- **THEN** returns 409 CONFLICT: "Khách thuê này đang đứng tên hợp đồng tại phòng khác"

#### Scenario: Tenant already active occupant elsewhere
- **WHEN** admin POSTs tenant_id that is currently an active occupant in another contract
- **THEN** returns 409 CONFLICT: "Khách thuê này đang ở theo hợp đồng khác"

### Requirement: Update contract endpoint
`PATCH /api/contracts/:id` SHALL update an existing contract. All fields optional (partial update). Business rule: if status changes to `active` and room already has another active contract, return 409 CONFLICT. Returns updated contract. Returns 404 if not found.

#### Scenario: Update success
- **WHEN** admin PATCHes valid partial data
- **THEN** returns updated contract

#### Scenario: Terminate contract
- **WHEN** admin PATCHes `{ status: 'terminated' }`
- **THEN** contract status updated to 'terminated'; returns updated contract

#### Scenario: Update non-existent contract
- **WHEN** id does not exist
- **THEN** returns 404 NOT_FOUND

### Requirement: Delete contract endpoint
`DELETE /api/contracts/:id` SHALL delete a contract. Returns 204 on success. Returns 404 if not found.

#### Scenario: Delete success
- **WHEN** admin DELETEs existing contract
- **THEN** contract removed, returns 204

#### Scenario: Delete non-existent
- **WHEN** id does not exist
- **THEN** returns 404 NOT_FOUND
