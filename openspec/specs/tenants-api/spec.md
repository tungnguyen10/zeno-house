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
`DELETE /api/tenants/:id` SHALL delete a tenant. Returns 204 on success. Returns 404 if not found.

#### Scenario: Delete success
- **WHEN** admin DELETEs existing tenant
- **THEN** tenant removed, returns 204

#### Scenario: Delete non-existent
- **WHEN** id does not exist
- **THEN** returns 404 NOT_FOUND

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

#### Scenario: Tenant with active assignment returned
- **WHEN** a returned tenant has active contract participation
- **THEN** its DTO includes `hasActiveContract: true` and active room/building summary

#### Scenario: Tenant without active assignment returned
- **WHEN** a returned tenant has no active contract participation
- **THEN** its DTO includes `hasActiveContract: false` and no active room/building summary

