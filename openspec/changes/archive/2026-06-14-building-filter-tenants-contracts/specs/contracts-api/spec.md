## MODIFIED Requirements

### Requirement: List contracts endpoint
`GET /api/contracts` SHALL return a paginated list of contracts. Query params: `room_id` (optional UUID filter), `tenant_id` (optional UUID filter), `building_id` (optional UUID filter), `status` (optional, one of `active` | `expired` | `terminated`), `page` (default 1), `limit` (default 20). Response: `{ data: Contract[], meta: { total, page, limit, totalPages } }`. Requires authenticated session with admin or manager role.

#### Scenario: List all contracts
- **WHEN** admin calls GET /api/contracts
- **THEN** returns array of contracts with pagination meta

#### Scenario: Filter by room
- **WHEN** admin calls GET /api/contracts?room_id=<uuid>
- **THEN** returns only contracts for that room

#### Scenario: Filter by building
- **WHEN** admin calls GET /api/contracts?building_id=<uuid>
- **THEN** returns only contracts for that building

#### Scenario: Filter by status
- **WHEN** admin calls GET /api/contracts?status=active
- **THEN** returns only contracts with status 'active'

#### Scenario: Invalid role forbidden
- **WHEN** user lacks contracts.read permission
- **THEN** returns 403 FORBIDDEN
