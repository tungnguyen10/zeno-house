# billing-client Specification

## Purpose
TBD - created by archiving change monthly-operations-workspace. Update Purpose after archive.
## Requirements
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
- **THEN** the workspace uses `UiPageHeader` (with `backTo`/`backLabel` for back navigation), `UiTabs`, `UiSection`, `UiMetric`, `UiTable`, `UiAlert`, and primitive-backed actions for the end-to-end monthly flow

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

### Requirement: Billing period workspace header is minimal
The billing period workspace header SHALL surface only the period title, primary action menu, and back navigation. It SHALL NOT repeat status metadata that is already discoverable on the billing period list, and SHALL NOT carry a description that merely enumerates the tabs.

#### Scenario: No status badge in period header
- **WHEN** a user opens `/billing/[building]/[period]`
- **THEN** the `UiPageHeader` SHALL NOT render a `UiStatusBadge`; the period status is conveyed by the list view and by tab-internal locked-state messaging

#### Scenario: Back-link via UiPageHeader prop
- **WHEN** the period workspace renders
- **THEN** the back-link to `/billing` SHALL be rendered via `UiPageHeader`'s `backTo`/`backLabel` props (rendered above the title with an arrow-left icon), not as a manually-placed button inside the `#actions` slot

#### Scenario: Icon-prefixed action menu
- **WHEN** the period workspace exposes period-level actions (Nhật ký, Xuất Excel, Chốt kỳ, Huỷ phát hành kỳ)
- **THEN** the actions live behind a single "Hành động" menu whose trigger uses a kebab icon and a visible text label, and each menu item is prefixed by an icon
- **AND** destructive items (Chốt kỳ, Huỷ phát hành) are visually separated and tinted to convey caution

### Requirement: Billing sticky KPI strip is compact
The sticky KPI strip on a billing period page SHALL surface no more than 5 tiles and SHALL lay out evenly at all responsive breakpoints used by the admin shell.

#### Scenario: Five-tile strip
- **WHEN** the period overview is loaded
- **THEN** the strip renders exactly: (1) a Quy mô tile combining contract and invoice counts, (2) a Chỉ số tile, (3) an Đã phát hành tile with draft total as caption, (4) an Đã thu tile, (5) a Công nợ tile

#### Scenario: Even responsive grid
- **WHEN** the strip is rendered at small/medium/large viewports
- **THEN** the grid uses `grid-cols-2 md:grid-cols-3 lg:grid-cols-5` so columns divide evenly without an odd trailing row

### Requirement: Billing tab summaries do not duplicate the strip
Billing workspace tab summaries SHALL NOT repeat metrics that are already on the sticky KPI strip. Tab-internal cues that remain SHALL be either drill-down metrics specific to that tab or inline text.

#### Scenario: Payments tab has no duplicate summary grid
- **WHEN** the user opens the Thanh toán & công nợ tab
- **THEN** the tab does not render its own four-tile summary grid; an inline pill next to the section heading shows the overdue count when it is greater than zero

#### Scenario: Issue tab has no duplicate summary grid
- **WHEN** the user opens the Phát hành tab
- **THEN** the tab does not render a multi-tile KPI grid; the issuable count is conveyed by the table and tab badge, the blocker count is surfaced by the existing warning alert when greater than zero, and the skipped count appears as a single inline muted line above the table only when greater than zero

#### Scenario: Grid tab totals are inline
- **WHEN** the user opens the Chỉ số & hoá đơn nháp tab
- **THEN** the tab does not repeat strip metrics (Cần đọc, Tổng nháp) and shows the remaining drill-down counts (Sẵn sàng, Có lỗi) as inline text below the section heading

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
The billing draft grid SHALL save changed readings without reloading the full grid after each successful auto-save, SHALL provide optimistic row-level feedback for local edits, and SHALL still support explicit server recomputation when authoritative data is needed.

#### Scenario: Save changed readings only
- **WHEN** the user saves readings manually, through focused-cell paste, or through bulk-entry apply
- **THEN** the client submits changed meter readings and does not resubmit unchanged rows unnecessarily

#### Scenario: Auto-save success preserves grid session
- **WHEN** saving readings succeeds from auto-save
- **THEN** the grid remains mounted, the active input/focus context is not disrupted by a full grid reload, filters remain selected, expanded rows remain open, and row save state changes to saved

#### Scenario: Save now preserves grid session
- **WHEN** the user clicks `Lưu ngay` for pending reading changes
- **THEN** the client saves changed readings without automatically reloading the full draft grid solely because the save succeeded

#### Scenario: Server recomputation is available on demand
- **WHEN** the user clicks `Tải lại`, changes billing period, saves a utility override, or enters invoice issue/reissue workflows
- **THEN** the grid refreshes from the draft-grid API/read model and displays server-computed utility amounts, line totals, blockers, warnings, and draft totals

#### Scenario: Filter state preserved on explicit refresh
- **WHEN** the grid refreshes after an explicit refresh or workflow transition
- **THEN** the selected filter and expanded rows are preserved when the corresponding rows still exist

#### Scenario: Save failure keeps local draft
- **WHEN** saving readings fails
- **THEN** the grid keeps the user’s local values visible, marks the affected row with an error state, and does not discard unsaved input by reloading the full grid

### Requirement: Issue remains a separate confirmation tab
The workspace SHALL keep invoice issuing as a separate `Phát hành` tab for this change, while using the same draft readiness source as the draft grid.

#### Scenario: Issue tab remains
- **WHEN** all billable rows are ready in `Chỉ số & hoá đơn nháp`
- **THEN** the user still proceeds to `Phát hành` for final confirmation

#### Scenario: Issue tab reflects draft-grid blockers
- **WHEN** draft-grid rows have blockers
- **THEN** the issue tab displays the same blocker state and prevents issuing

### Requirement: Billing workspace route prefers building slug
Billing workspace links SHALL prefer building slug and period routes, for example `/billing/toa-a/2026-06`, while existing building UUID period links remain valid.

#### Scenario: Billing workspace link uses building slug
- **WHEN** a billing period row has building slug `toa-a` and period `2026-06`
- **THEN** the open action links to `/billing/toa-a/2026-06`

#### Scenario: Billing workspace link falls back to id
- **WHEN** building slug is unavailable
- **THEN** the open action can link to `/billing/<buildingId>/2026-06`

### Requirement: Billing workflow links use slug-aware destinations
Dashboard pending-operation links and building detail billing links SHALL use building slug plus period when available.

#### Scenario: Dashboard pending operation link
- **WHEN** a pending operation item references building slug `toa-a` and period `2026-06`
- **THEN** its workflow link targets `/billing/toa-a/2026-06`

### Requirement: Draft grid optimistic reading feedback
The billing draft grid SHALL show immediate optimistic feedback for locally edited meter readings without waiting for a full server grid reload.

#### Scenario: Electricity edit updates usage and amount
- **WHEN** the user enters an editable electricity reading and the row has a previous electricity reading and per-kWh rate
- **THEN** the grid immediately shows the effective current reading, kWh usage, electricity amount, and updated draft row total based on the local value

#### Scenario: Metered water edit updates usage and amount
- **WHEN** the user enters an editable water reading and the row has a previous water reading and per-m3 rate
- **THEN** the grid immediately shows the effective current reading, m3 usage, water amount, and updated draft row total based on the local value

#### Scenario: Non-meter water remains unchanged
- **WHEN** water is billed per person or fixed per room
- **THEN** the grid does not request or calculate a water meter reading and continues to show the configured non-meter water charge behavior

#### Scenario: Empty local value does not corrupt totals
- **WHEN** the user clears a reading cell before entering a replacement value
- **THEN** the grid marks the cell dirty but does not calculate a misleading utility amount or negative draft total from an empty value

#### Scenario: Invalid local value does not calculate amount
- **WHEN** a local reading value is not a valid non-negative number
- **THEN** the grid keeps the local value visible, marks the row as needing correction, and does not calculate a utility amount from that value

#### Scenario: Lower-than-previous local value warns
- **WHEN** a local reading value is lower than the previous reading for that meter
- **THEN** the grid shows a warning and avoids presenting a normal negative-consumption amount

#### Scenario: Unsupported pricing does not invent estimate
- **WHEN** a row uses utility pricing that cannot be estimated safely on the client
- **THEN** the grid shows the local reading value and save state but leaves the amount as requiring server refresh or unsupported review

#### Scenario: Server data remains source of truth after explicit refresh
- **WHEN** the user explicitly refreshes the grid or proceeds to invoice issue
- **THEN** optimistic display values are reconciled with server-computed draft rows

### Requirement: Draft grid bulk reading entry UI
The billing draft grid SHALL expose bulk meter-reading entry as part of the existing reading-entry workflow.

#### Scenario: Bulk entry applies to current draft grid scope
- **WHEN** the user opens bulk entry from the draft grid
- **THEN** ordered input maps against the current visible draft-grid rows and room-number input matches against rooms present in the current grid response

#### Scenario: Bulk entry respects filters visibly
- **WHEN** the grid is filtered before opening bulk entry
- **THEN** the modal makes clear that ordered input follows the currently visible row order

#### Scenario: Bulk entry uses same autosave state
- **WHEN** accepted bulk readings are applied to the grid
- **THEN** affected rows show the same saving, saved, and error indicators as manual edits

#### Scenario: Bulk entry does not bypass issue safeguards
- **WHEN** bulk readings are applied but blockers or warnings remain
- **THEN** the issue tab continues to prevent issuing affected invoices according to the authoritative draft readiness rules

### Requirement: Billing confirmation actions preserve state until mutation completes
Billing confirmation UI SHALL keep modal, loading, selection, and error state accurate until server mutations complete.

#### Scenario: Issue succeeds
- **WHEN** the user confirms invoice issue and the server request succeeds
- **THEN** the issue modal closes, selected draft rows are cleared, and the workspace refreshes from server state

#### Scenario: Issue fails
- **WHEN** the user confirms invoice issue and the server request fails
- **THEN** the issue modal remains open, selected draft rows remain selected, and the error is visible to the user

#### Scenario: Close period fails
- **WHEN** the user confirms close period and the server request fails
- **THEN** the close confirmation remains visible or returns to a recoverable state with the server error visible

### Requirement: Draft grid behavior preserved during maintainability refactor
The billing draft grid SHALL preserve existing user-facing reading entry, auto-save, optimistic display, override, discrepancy, read-only, filter, and mobile workflows while being composed from focused units.

#### Scenario: Manual reading behavior preserved
- **WHEN** a user edits an editable electricity or water reading cell
- **THEN** the row auto-saves through the existing no-refresh path and displays the same save states as before the refactor

#### Scenario: Override behavior preserved
- **WHEN** a user saves a utility override from a draft-grid row
- **THEN** the same utility usage override payload is submitted and the grid refresh behavior remains unchanged

#### Scenario: Discrepancy intent behavior preserved
- **WHEN** a draft row has an issued-invoice discrepancy and the user chooses an adjustment or void/reissue action
- **THEN** the workspace receives the same intent payloads as before the refactor

#### Scenario: Mobile behavior preserved
- **WHEN** the draft grid renders on a mobile viewport
- **THEN** the same stacked row workflow remains available without horizontal table scanning
