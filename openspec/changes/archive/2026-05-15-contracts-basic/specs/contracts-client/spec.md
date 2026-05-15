## ADDED Requirements

### Requirement: Contract list page
`/contracts` page SHALL display all contracts in a list. Supports filter by status (dropdown: all / active / expired / terminated). Shows loading skeleton and empty state. Admin sees create button. Includes pagination (prev/next) when `totalPages > 1`. Each row/card shows: room number + building name, tenant full_name, start_date, end_date, monthly_rent, status badge.

#### Scenario: List loads
- **WHEN** admin navigates to /contracts
- **THEN** contracts are displayed with room, tenant, dates, rent, and status badge

#### Scenario: Filter by status
- **WHEN** admin selects 'active' from the status filter
- **THEN** list updates to show only active contracts

#### Scenario: Empty state
- **WHEN** no contracts exist or no contracts match filter
- **THEN** empty state message displayed with create button

### Requirement: Contract detail page
`/contracts/:id` page SHALL display all contract fields: room number + building, tenant name + phone, start_date, end_date, monthly_rent, deposit, status badge, notes. Admin sees edit and delete buttons. Delete uses `UiConfirmModal`.

#### Scenario: Detail view
- **WHEN** admin navigates to /contracts/:id
- **THEN** all contract fields displayed with edit/delete actions

#### Scenario: Delete with confirmation
- **WHEN** admin clicks Xoá and confirms in UiConfirmModal
- **THEN** contract deleted, redirected to /contracts

#### Scenario: Not found
- **WHEN** contract id does not exist
- **THEN** redirected to /contracts

### Requirement: Create contract page
`/contracts/create` page SHALL present `ContractForm`. Required fields: room_id (searchable select from existing rooms), tenant_id (searchable select from existing tenants), start_date, end_date, monthly_rent. Optional: deposit, status, notes. On success redirects to `/contracts/:id`. Shows API errors inline, including 409 CONFLICT for active contract on room.

#### Scenario: Create success
- **WHEN** admin fills required fields and submits
- **THEN** contract created, redirected to detail page

#### Scenario: Validation error
- **WHEN** admin submits without required fields
- **THEN** field-level error messages shown, no API call made

#### Scenario: Active contract conflict
- **WHEN** admin submits for a room that already has an active contract
- **THEN** error displayed inline: "Phòng này đã có hợp đồng đang hiệu lực"

### Requirement: Edit contract page
`/contracts/:id/edit` page SHALL pre-fill `ContractForm` with existing data. On success redirects to `/contracts/:id`.

#### Scenario: Edit success
- **WHEN** admin edits and saves
- **THEN** contract updated, redirected to detail page

#### Scenario: Redirect if not found
- **WHEN** contract id does not exist
- **THEN** redirected to /contracts

### Requirement: Contract composables
`useContractList` SHALL expose: `contracts`, `total`, `totalPages`, `page`, `statusFilter`, `isLoading`, `error`, `refresh`. Reset `page` to 1 when `statusFilter` changes. `useContractDetail(id)` SHALL mirror `useBuildingDetail` pattern with reactive id ref. `useContractForm` SHALL handle create/edit with Zod client-side validation matching server rules.

#### Scenario: Status filter resets pagination
- **WHEN** user changes status filter
- **THEN** page resets to 1 automatically

#### Scenario: useContractDetail reactive id
- **WHEN** id ref changes
- **THEN** composable re-fetches contract data

### Requirement: Sidebar navigation
AppSidebar SHALL include a "Hợp đồng" nav item linking to `/contracts`.

#### Scenario: Sidebar shows contracts link
- **WHEN** admin views sidebar
- **THEN** "Hợp đồng" item visible and links to /contracts
