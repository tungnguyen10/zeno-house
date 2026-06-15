## ADDED Requirements

### Requirement: Tenant list contract-state filter
`/tenants` SHALL include a contract-state filter with options for all tenants, tenants with active contracts, and tenants without active contracts. Changing the filter SHALL reset pagination to page 1 and refresh the list.

#### Scenario: Filter tenants with active contracts
- **WHEN** user selects the active-contract filter
- **THEN** the tenant list shows only tenants with active contract participation

#### Scenario: Filter tenants without active contracts
- **WHEN** user selects the without-contract filter
- **THEN** the tenant list shows only tenants without active contract participation

### Requirement: Tenant list contract badges
Tenant list rows SHALL show a badge indicating whether the tenant currently has an active contract.

#### Scenario: Tenant with active contract badge
- **WHEN** a tenant has active contract participation
- **THEN** the row shows "Co HD"

#### Scenario: Tenant without active contract badge
- **WHEN** a tenant has no active contract participation
- **THEN** the row shows "Chua co HD"

### Requirement: Tenant list active assignment context
Tenant list rows SHALL show current room and building context when a tenant has active contract participation.

#### Scenario: Tenant active room displayed
- **WHEN** a tenant has an active contract in room A101 at building Toa A
- **THEN** the row displays room A101 and building Toa A

#### Scenario: Tenant without active room
- **WHEN** a tenant has no active contract participation
- **THEN** the row does not display stale room/building context
