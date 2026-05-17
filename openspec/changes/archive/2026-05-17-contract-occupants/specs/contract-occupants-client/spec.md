## ADDED Requirements

### Requirement: Occupant list composable
`useContractOccupants(contractId)` SHALL fetch and expose the list of occupants for a contract. SHALL expose `addOccupant`, `moveOut`, and `removeOccupant` mutation functions. State SHALL be updated immediately after each mutation using the API response (no optimistic update — response includes joined tenant name).

#### Scenario: Fetch occupants
- **WHEN** composable is initialized with a contractId
- **THEN** occupants list is populated from API with tenantName and tenantPhone on each record

#### Scenario: Add occupant
- **WHEN** addOccupant(input) called with valid data
- **THEN** new occupant with tenantName appears in list immediately (from API response)

#### Scenario: Move-out
- **WHEN** moveOut(occupantId, { move_out_date }) called
- **THEN** occupant record in local state updated with move_out_date

#### Scenario: Remove occupant
- **WHEN** removeOccupant(occupantId) called
- **THEN** occupant removed from list

### Requirement: Occupant form component
`ContractOccupantForm` SHALL provide a form to add a new roommate. Role is always `roommate` — no role selector is shown. Fields: tenant (searchable select, excludes ids via `excludeTenantIds: string[]` prop), move_in_date (date input, defaults today), billing_counted (checkbox, defaults true). Form SHALL show validation errors inline. Emits `submit` and `cancel`.

Props:
- `excludeTenantIds?: string[]` — tenant IDs to hide from picker (primary tenant + already-added occupants)
- `available?: boolean` — when true, server query filters to only tenants not in any active contract or occupancy
- `loading?: boolean`, `apiError?: string | null`

#### Scenario: Excluded tenants not in picker
- **WHEN** form rendered with excludeTenantIds
- **THEN** those tenants do not appear in the picker regardless of search

#### Scenario: Available-only filter
- **WHEN** available=true
- **THEN** server query includes available=true, tenants in active contracts or active occupancies are excluded

#### Scenario: Valid submit
- **WHEN** all required fields are filled and form submitted
- **THEN** submit event emitted with role='roommate' hardcoded

#### Scenario: Validation error
- **WHEN** tenant not selected and form submitted
- **THEN** field-level error shown, no submit event emitted

