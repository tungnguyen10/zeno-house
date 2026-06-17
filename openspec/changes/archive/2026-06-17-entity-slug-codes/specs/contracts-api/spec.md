## MODIFIED Requirements

### Requirement: Get contract by id endpoint
`GET /api/contracts/:identifier` SHALL accept either a UUID or a `contract_code` value as the path parameter. When `identifier` is not a UUID, the server SHALL look up by `contract_code` column. Returns a single contract including joined `room` (room_number, floor, building name) and `tenant` (full_name, phone). Returns 404 NOT_FOUND if not found.

#### Scenario: Contract found by UUID
- **WHEN** admin calls GET /api/contracts/:uuid with valid UUID
- **THEN** returns contract with nested room and tenant summary fields

#### Scenario: Contract found by code
- **WHEN** admin calls GET /api/contracts/hd-zhpn-2026-0001
- **THEN** returns contract with nested room and tenant summary fields

#### Scenario: Contract not found
- **WHEN** identifier matches neither UUID nor contract_code
- **THEN** returns 404 NOT_FOUND

## ADDED Requirements

### Requirement: Contract code generation uses building code
The server contract creation logic SHALL generate `contract_code` using the format `hd-{buildingCode}-{year}-{seq}`. The `buildingCode` SHALL be resolved from the contracted room's building. Sequence SHALL be scoped to `{buildingCode}-{year}` prefix.

#### Scenario: Code generated on create
- **WHEN** a contract is created for room in building with code `zhpn` and `start_date = 2026-09-01`
- **THEN** the generated `contract_code` is `hd-zhpn-2026-0001` (or next in sequence)

#### Scenario: Sequence scoped per building per year
- **WHEN** contracts exist for `zhpn` in 2026 up to `hd-zhpn-2026-0003`
- **THEN** the next contract for `zhpn` in 2026 gets `hd-zhpn-2026-0004`

#### Scenario: Different building gets independent sequence
- **WHEN** building `hnt` has no contracts in 2026
- **THEN** first contract for `hnt` in 2026 gets `hd-hnt-2026-0001` regardless of `zhpn` sequence
