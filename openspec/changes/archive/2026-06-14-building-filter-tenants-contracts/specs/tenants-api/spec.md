## MODIFIED Requirements

### Requirement: List tenants endpoint
`GET /api/tenants` SHALL return paginated list of tenants. Query params: `q` (search by full_name or phone, ILIKE), `building_id` (optional UUID filter derived from primary contracts and contract occupants), `page` (default 1), `limit` (default 20). Response: `{ data: Tenant[], meta: { total, page, limit, totalPages } }`.

#### Scenario: List all tenants
- **WHEN** admin calls GET /api/tenants
- **THEN** returns array of tenants with pagination meta

#### Scenario: Search by name
- **WHEN** admin calls GET /api/tenants?q=Nguyen
- **THEN** returns only tenants whose full_name contains "Nguyen" (case-insensitive)

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
