## ADDED Requirements

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
