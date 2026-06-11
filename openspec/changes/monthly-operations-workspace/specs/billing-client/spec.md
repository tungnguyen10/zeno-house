## ADDED Requirements

### Requirement: Billing entry page manages period list
The `/billing` page SHALL be the monthly billing period list and work queue.

#### Scenario: Billing list visible
- **WHEN** a user opens `/billing`
- **THEN** the page shows billing periods with building, period, status, reading progress, issued total, paid total, outstanding balance, and open action

#### Scenario: Defaults to current month
- **WHEN** a user opens `/billing`
- **THEN** the list defaults to the current month while allowing previous and next period navigation

#### Scenario: Filters available
- **WHEN** a user needs to narrow the list
- **THEN** they can filter by building, period, status, and debt state

#### Scenario: Create or open period
- **WHEN** a user selects a building and period that has no billing period yet
- **THEN** the page allows opening/creating that period and navigates to its workspace

### Requirement: Billing list routes to workspace
The `/billing` page SHALL route users into a billing workspace scoped by building and period.

#### Scenario: Open existing period
- **WHEN** a user chooses a period row
- **THEN** the system navigates to the Building + Period workspace route

### Requirement: Workspace overview
The billing workspace SHALL show the current operational state of the period.

#### Scenario: Overview visible
- **WHEN** a user enters the workspace
- **THEN** they can see period status, rooms/contracts covered, missing readings, draft total, issued total, paid total, and outstanding balance

### Requirement: Workspace reading entry
The billing workspace SHALL provide monthly meter reading entry for the selected building and period.

#### Scenario: Readings use workspace period
- **WHEN** the user enters readings in the workspace
- **THEN** the readings are saved with the building and period selected for the workspace

#### Scenario: Existing readings loaded
- **WHEN** readings already exist for the workspace period
- **THEN** the reading step preloads them for review or correction

#### Scenario: Meter replacement override
- **WHEN** the current reading cannot be calculated normally from the previous reading because a meter was replaced or reset
- **THEN** the reading step allows the user to enter old meter final value, new meter start value, current value, billable usage, reason, and note

### Requirement: Charge review UI
The billing workspace SHALL show draft charges before issue.

#### Scenario: Review charges
- **WHEN** the user opens the review step
- **THEN** the UI shows each contract/room invoice preview with line items and total

#### Scenario: Blockers visible
- **WHEN** a draft has missing input or unsupported pricing
- **THEN** the UI shows the blocker and disables issue for affected invoices

### Requirement: Invoice issue UI
The billing workspace SHALL let users issue valid invoices.

#### Scenario: Issue enabled
- **WHEN** all draft charges are valid
- **THEN** the issue action is enabled with confirmation

#### Scenario: Issue disabled
- **WHEN** blockers exist
- **THEN** the issue action is disabled

### Requirement: Payment and debt UI
The billing workspace SHALL support monthly collection tracking.

#### Scenario: Record payment
- **WHEN** the user records a payment for an invoice
- **THEN** the invoice paid amount and remaining balance update in the workspace

#### Scenario: Debt list
- **WHEN** invoices have remaining balances
- **THEN** the workspace shows outstanding debt by room/tenant

### Requirement: Correction UI
The billing workspace SHALL expose correction actions according to invoice and period state.

#### Scenario: Pre-issue correction
- **WHEN** invoices have not been issued
- **THEN** the UI lets users correct readings, utility overrides, or billing inputs and return to review

#### Scenario: Void and reissue visible
- **WHEN** an issued invoice has no payments and the period is not closed
- **THEN** the UI offers void/reissue with required reason

#### Scenario: Adjustment visible
- **WHEN** an invoice already has payments or belongs to a closed period
- **THEN** the UI guides the user to create an adjustment in a current or future open period instead of editing the old invoice

### Requirement: Closed period UI
The billing workspace SHALL represent closed periods as locked.

#### Scenario: Period closed
- **WHEN** the workspace period is closed
- **THEN** normal editing actions are disabled and the UI explains the locked state

### Requirement: Billing UI uses operational design system
The billing entry page and workspace SHALL be built from the adopted operational design-system primitives and patterns. Billing pages SHALL NOT introduce raw form controls, raw tables, raw alert blocks, or billing-only duplicate primitives unless the exception is documented.

#### Scenario: Billing entry page composition
- **WHEN** a user opens `/billing`
- **THEN** the page uses `UiPageHeader`, `UiToolbar`, `UiMetric`, `UiTable`, `UiStatusBadge`, `UiAlert`, `UiSkeleton`, and `UiEmptyState` according to the state being rendered

#### Scenario: Workspace composition
- **WHEN** a user opens a billing workspace
- **THEN** the workspace uses `UiPageHeader`, `UiTabs`, `UiSection`, `UiMetric`, `UiTable`, `UiAlert`, and primitive-backed actions for the end-to-end monthly flow

#### Scenario: Dense editable billing rows
- **WHEN** readings, charge review, adjustment, or payment rows require editable fields
- **THEN** they use compact `UiInput`, `UiSelect`, or `UiTextarea` controls rather than raw inline input classes

#### Scenario: Searchable billing selection
- **WHEN** a billing workflow requires selecting a high-cardinality building, room, tenant, contract, invoice, or related subject
- **THEN** it uses the searchable select primitive from the design system rather than a billing-specific custom dropdown

#### Scenario: Billing status badge context
- **WHEN** period, invoice, or correction statuses are displayed
- **THEN** `UiStatusBadge` is rendered with the correct context so overlapping status keys use the correct label and semantic variant

#### Scenario: Raw billing UI exception documented
- **WHEN** a raw `input`, `select`, `textarea`, `table`, or `button` remains in billing pages/components
- **THEN** the implementation documents why the design-system primitive cannot cover it yet and what follow-up is needed

### Requirement: Billing draft grid workspace tab
The billing workspace SHALL provide a `Chỉ số & hoá đơn nháp` tab that combines monthly reading entry and draft invoice review into one room-centered grid.

#### Scenario: One room row
- **WHEN** a room has an active billing contract in the selected period
- **THEN** the grid renders one row for that room/contract with electricity input, water input, utility charge preview, rent/service summary, draft total, status, and detail action

#### Scenario: Separate meter rows are not the primary UI
- **WHEN** a room has both electricity and water meters
- **THEN** the primary grid does not render two separate top-level rows for the room

#### Scenario: Batch reading date
- **WHEN** the user opens the draft grid
- **THEN** the toolbar shows one batch reading date that can be applied to empty reading rows

#### Scenario: Past period date default
- **WHEN** an empty reading belongs to a past period
- **THEN** its default batch reading date is the last day of that period

#### Scenario: Current period date default
- **WHEN** an empty reading belongs to the current period
- **THEN** its default batch reading date is today's date

#### Scenario: Existing reading date preserved
- **WHEN** a reading already exists for the period
- **THEN** the grid preserves the stored reading date instead of overwriting it with the batch date

#### Scenario: Utility formula visible
- **WHEN** electricity or water can be calculated
- **THEN** the grid shows previous value, current value, usage, rate, and amount in the utility cell

#### Scenario: Draft detail expands
- **WHEN** the user opens row details
- **THEN** the row shows full draft invoice line items, blockers, warnings, and override actions for that room/contract

### Requirement: Draft grid mobile behavior
The billing draft grid SHALL provide a mobile layout that preserves the same work without requiring horizontal scanning of all desktop columns.

#### Scenario: Mobile row composition
- **WHEN** the grid is viewed on a mobile viewport
- **THEN** each row shows room, tenant, draft total, electricity input/amount, water input/amount, rent/service summary, status, and detail action in a stacked compact layout

#### Scenario: Mobile edit workflow
- **WHEN** the user edits readings on mobile
- **THEN** they can enter new values, see blocker/amount feedback, save, and reopen details without leaving the tab

### Requirement: Vacant room baseline rows
The billing draft grid SHALL include vacant rooms only as optional baseline rows, not as invoice-producing rows.

#### Scenario: Vacant baseline row
- **WHEN** a vacant room is shown in the grid
- **THEN** it can accept electricity/water readings for baseline tracking but shows `Không lập hoá đơn` or equivalent baseline status

#### Scenario: Vacant row does not block issue
- **WHEN** a vacant room lacks readings
- **THEN** invoice issue for active contracts is not blocked by that vacant room

#### Scenario: Default filter hides optional vacant rows
- **WHEN** the grid opens in the default `Cần xử lý` filter
- **THEN** optional vacant baseline rows are hidden unless they contain invalid data or require user attention

### Requirement: Draft grid override modal
The billing draft grid SHALL expose meter replacement/reset/correction through a row-level modal.

#### Scenario: Override modal opens from utility cell
- **WHEN** a reading has negative consumption or the user chooses override for a utility cell
- **THEN** the modal shows room, tenant/contract context, meter type, previous value, current value, old meter final value, new meter start value, billable usage, reason, and note fields

#### Scenario: Override save refreshes grid
- **WHEN** an override is saved
- **THEN** the draft grid refreshes and the affected utility cell uses override usage and warning/status feedback

### Requirement: Draft grid edit gating
The billing draft grid SHALL enforce read-only behavior once billing state makes direct reading edits unsafe.

#### Scenario: Draft period editable
- **WHEN** the period is in draft, readings, or review state and no invoice has been issued for the row
- **THEN** reading inputs and applicable override actions are editable

#### Scenario: Issued invoice row read-only
- **WHEN** an invoice has been issued for a row
- **THEN** reading inputs and draft line edits are read-only and corrections must use void/reissue or adjustment flow

#### Scenario: Closed period read-only
- **WHEN** the period is closed
- **THEN** all normal reading inputs and override actions are disabled

### Requirement: Draft grid recompute workflow
The billing draft grid SHALL save changed readings and recompute draft totals from the server read model.

#### Scenario: Save changed readings only
- **WHEN** the user clicks `Lưu & tính lại`
- **THEN** the client submits changed meter readings and does not resubmit unchanged rows unnecessarily

#### Scenario: Server is source of truth after save
- **WHEN** saving readings succeeds
- **THEN** the grid refreshes from the draft-grid API/read model and displays server-computed utility amounts, line totals, blockers, warnings, and draft totals

#### Scenario: Filter state preserved
- **WHEN** the grid refreshes after save
- **THEN** the selected filter and expanded rows are preserved when the corresponding rows still exist

### Requirement: Issue remains a separate confirmation tab
The workspace SHALL keep invoice issuing as a separate `Phát hành` tab for this change, while using the same draft readiness source as the draft grid.

#### Scenario: Issue tab remains
- **WHEN** all billable rows are ready in `Chỉ số & hoá đơn nháp`
- **THEN** the user still proceeds to `Phát hành` for final confirmation

#### Scenario: Issue tab reflects draft-grid blockers
- **WHEN** draft-grid rows have blockers
- **THEN** the issue tab displays the same blocker state and prevents issuing
