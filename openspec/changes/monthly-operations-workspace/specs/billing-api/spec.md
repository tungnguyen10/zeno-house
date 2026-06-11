## ADDED Requirements

### Requirement: Billing API permission guard
Billing API endpoints SHALL require authenticated users and explicit billing capabilities.

#### Scenario: Read requires billing read
- **WHEN** a user without `billing.read` calls a billing read endpoint
- **THEN** the system returns 403 FORBIDDEN

#### Scenario: Write requires billing write
- **WHEN** a user without `billing.write` opens a period, issues invoices, or records payments
- **THEN** the system returns 403 FORBIDDEN

#### Scenario: Close requires billing close
- **WHEN** a user without `billing.close` closes a period
- **THEN** the system returns 403 FORBIDDEN

### Requirement: Open or get billing period
The API SHALL open or retrieve a billing period by building and `YYYY-MM`.

#### Scenario: Period exists
- **WHEN** the API receives building_id and period for an existing period
- **THEN** it returns the existing billing period

#### Scenario: Period does not exist
- **WHEN** the API receives building_id and period for a new period
- **THEN** it creates and returns a billing period with status `draft`

### Requirement: List billing periods
The API SHALL list billing periods for the `/billing` management page.

#### Scenario: List periods by month
- **WHEN** the API receives year and month filters
- **THEN** it returns billing period summaries for that month

#### Scenario: List periods by building
- **WHEN** the API receives a building filter
- **THEN** it returns only billing period summaries for that building

#### Scenario: List periods by status
- **WHEN** the API receives a status filter
- **THEN** it returns only periods matching that status

#### Scenario: Period summary includes operational totals
- **WHEN** period summaries are returned
- **THEN** each summary includes status, reading progress, invoice count, issued total, paid total, and outstanding balance

#### Scenario: Debt filter
- **WHEN** the API receives a debt filter
- **THEN** it can return periods with outstanding invoice balance

### Requirement: Workspace overview API
The API SHALL provide summary data for the monthly operations workspace.

#### Scenario: Overview requested
- **WHEN** the workspace requests overview for a building period
- **THEN** the API returns period status, contract count, reading completion, draft total, issued total, paid total, and outstanding balance

### Requirement: Draft charges API
The API SHALL provide draft invoice previews before issue.

#### Scenario: Draft charges requested
- **WHEN** the workspace requests draft charges
- **THEN** the API returns per-contract draft invoices with line items, totals, warnings, and blockers

#### Scenario: Utility override used
- **WHEN** a period-scoped utility usage override exists for a room and meter type
- **THEN** the draft charge uses the override billable usage and includes override metadata

#### Scenario: Unsupported tiered electricity
- **WHEN** a building uses tiered electricity pricing
- **THEN** the API returns a blocker instead of silently calculating electricity charges

### Requirement: Issue invoices API
The API SHALL issue invoice snapshots transactionally.

#### Scenario: Issue succeeds
- **WHEN** draft charges have no blockers
- **THEN** the API creates invoices and invoice charges in a single logical operation

#### Scenario: Issue fails
- **WHEN** any invoice or charge insert fails
- **THEN** no partial invoice issue state is left visible as successful

### Requirement: Invoice payment API
The API SHALL record monthly payments against invoices.

#### Scenario: Payment recorded
- **WHEN** a valid payment is submitted
- **THEN** the API creates the payment and updates invoice paid amount, balance amount, and status

#### Scenario: Overpayment rejected
- **WHEN** a payment would make paid amount greater than invoice total
- **THEN** the API rejects the request with validation error

### Requirement: Invoice correction API
The API SHALL support controlled invoice corrections.

#### Scenario: Void unpaid invoice
- **WHEN** a user with sufficient permission voids an issued invoice with no payments
- **THEN** the API marks it void, stores void reason metadata, and appends an audit event

#### Scenario: Reissue replacement invoice
- **WHEN** a voided invoice needs replacement
- **THEN** the API issues a new invoice linked to the voided invoice

#### Scenario: Paid invoice adjustment
- **WHEN** a correction targets an invoice with recorded payments
- **THEN** the API rejects direct mutation and requires an adjustment charge on a current or future invoice

#### Scenario: Closed period direct mutation rejected
- **WHEN** a correction targets a closed period without explicit reopen flow
- **THEN** the API rejects normal edit, void, or reissue actions

### Requirement: Draft grid read model API
The API SHALL provide a draft-grid read model for the `Chỉ số & hoá đơn nháp` workspace tab. The endpoint SHALL compose existing period, room, meter reading, utility override, invoice, and draft calculation data without introducing a new repository layer for this optimization.

#### Scenario: Draft grid requested
- **WHEN** the workspace requests the draft grid for a billing period
- **THEN** the API returns period context, batch reading date, room-centered rows, utility cells, line totals, blockers, warnings, and aggregate totals

#### Scenario: Billable contract row
- **WHEN** a room has an active billing contract in the selected period
- **THEN** the read model returns a `billable_contract` row with contract, tenant, utility, draft lines, draft total, and editability state

#### Scenario: Vacant baseline row
- **WHEN** a room has no active billing contract and is eligible for baseline reading entry
- **THEN** the read model may return a `vacant_baseline` row that has utility cells but no invoice-producing draft total

#### Scenario: Required readings follow billing logic
- **WHEN** reading progress is computed for the draft grid
- **THEN** required readings are derived from active billing contracts and pricing rules that require meter readings, not from room status alone

#### Scenario: Read-only state included
- **WHEN** a row has an issued invoice or belongs to a closed period
- **THEN** the read model marks the row and utility cells as non-editable

#### Scenario: Override metadata included
- **WHEN** a utility usage override exists for a room meter in the period
- **THEN** the read model includes override id, source, billable usage, amount, and warning context for that utility cell
