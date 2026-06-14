## MODIFIED Requirements

### Requirement: Contracts list page
`/contracts` page SHALL display all contracts in a list. Supports filter by building and status (dropdown: all / active / expired / terminated). When no building is selected, the page SHALL list contracts from all buildings. Shows loading skeleton and empty state. Admin sees create button. Includes pagination (prev/next) when `totalPages > 1`. Each row/card shows: room number + building name, tenant full_name, start_date, end_date, monthly_rent, status badge.

#### Scenario: List loads
- **WHEN** admin navigates to /contracts
- **THEN** contracts are displayed with room, tenant, dates, rent, and status badge

#### Scenario: Filter by status
- **WHEN** admin selects status = active
- **THEN** list updates to show only active contracts

#### Scenario: Filter by building
- **WHEN** admin selects a building in the contracts toolbar
- **THEN** list updates to show only contracts for that building

#### Scenario: Clear building filter
- **WHEN** admin clears the selected building
- **THEN** list updates to show contracts from all buildings

#### Scenario: Empty state
- **WHEN** no contracts exist or no contracts match filter
- **THEN** empty state message displayed with create button

### Requirement: Contract composables
`useContractList` SHALL expose: `contracts`, `total`, `totalPages`, `page`, `statusFilter`, `buildingFilter`, `isLoading`, `error`, `refresh`. Reset `page` to 1 when `statusFilter` or `buildingFilter` changes. `useContractDetail(id)` SHALL mirror `useBuildingDetail` pattern with reactive id ref. `useContractForm` SHALL handle create/edit with Zod client-side validation matching server rules.

#### Scenario: Filters reset pagination
- **WHEN** user changes status or building filter
- **THEN** page resets to 1 automatically

#### Scenario: useContractDetail reactive id
- **WHEN** id ref changes
- **THEN** composable re-fetches contract data
