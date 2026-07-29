## MODIFIED Requirements

### Requirement: Touch-first interactions
The portal SHALL use touch-first interaction patterns: modals SHALL be bottom sheets; lists SHALL use skeleton loaders; invoices and requests SHALL support pull-to-refresh; lightweight mutations SHALL use optimistic UI with rollback on error; and no action SHALL depend on hover. Portal feedback SHALL use the portal-scoped toast surface, and every failed mutation SHALL surface an actionable error.

#### Scenario: Bottom-sheet modal
- **WHEN** a modal is opened in the portal
- **THEN** it presents as a bottom sheet

#### Scenario: Pull-to-refresh
- **WHEN** a tenant pulls down on the invoices or requests list
- **THEN** the list refreshes from its first page

#### Scenario: Profile mutation fails
- **WHEN** saving the tenant profile fails
- **THEN** the form remains open and displays the server error through the portal feedback surface

#### Scenario: Optimistic update rolls back on error
- **WHEN** a lightweight mutation fails
- **THEN** the optimistic UI change is rolled back and an error is surfaced

### Requirement: Portal pages consume tenant APIs
The portal SHALL provide overview, paginated invoice list, invoice detail, room/contract, requests, and profile pages consuming only `/api/tenant/**` endpoints. The invoice list SHALL allow loading all available pages without silently truncating history. The profile edit form SHALL submit only the accepted self-service whitelist and display legal identity as read-only operator-managed data.

#### Scenario: Invoice pages use tenant API
- **WHEN** invoice list or detail loads
- **THEN** it fetches from `/api/tenant/invoices**` and shows only the caller's data

#### Scenario: More invoice history exists
- **WHEN** invoice metadata reports another page
- **THEN** the page shows an accessible load-more action and appends the next page

#### Scenario: Profile edit uses whitelist
- **WHEN** a tenant edits their profile
- **THEN** only whitelisted non-identity fields are submitted and legal identity controls are read-only

#### Scenario: Roommate role is explicit
- **WHEN** active housing context has `assignmentRole = roommate`
- **THEN** overview and room pages identify the caller as “Người ở cùng” and show the primary tenant name
