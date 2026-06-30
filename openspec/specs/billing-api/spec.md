# billing-api Specification

## Purpose
TBD - created by archiving change monthly-operations-workspace. Update Purpose after archive.
## Requirements
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

### Requirement: Billing APIs accept building id or slug
Billing period and workspace APIs SHALL accept a building identifier that can be either UUID id or building slug, resolving it to the building id before querying or mutating billing data.

#### Scenario: Open period by building id
- **WHEN** the API receives building UUID and period `2026-06`
- **THEN** it opens or retrieves the billing period for that building

#### Scenario: Open period by building slug
- **WHEN** the API receives building slug `toa-a` and period `2026-06`
- **THEN** it resolves the slug and opens or retrieves the billing period for that building

#### Scenario: Unknown building slug
- **WHEN** the API receives unknown building slug for a billing period request
- **THEN** it returns 404 NOT_FOUND

### Requirement: Billing APIs share billable period eligibility
Billing APIs SHALL use one shared billable-contract definition when calculating period summaries, workspace overview, draft invoices, and draft-grid rows.

#### Scenario: Non-billable contract is excluded everywhere
- **WHEN** a contract overlaps the selected period but has a non-billable status
- **THEN** period summaries, workspace overview, draft calculation, and draft-grid rows all exclude that contract from invoice-producing counts and totals

#### Scenario: Billable contract is included everywhere
- **WHEN** a contract is billable for the selected building and period
- **THEN** period summaries, workspace overview, draft calculation, and draft-grid rows all include that contract consistently

### Requirement: Billing APIs share pricing-aware reading progress
Billing APIs SHALL calculate required monthly readings from billable contracts and building utility pricing rules, not from occupied room count alone.

#### Scenario: Meter-priced utilities require readings
- **WHEN** a billable contract belongs to a building with electricity `per_kwh` and water `per_m3`
- **THEN** the required reading count includes electricity and water for that contract's room

#### Scenario: Non-meter water does not require water reading
- **WHEN** a billable contract belongs to a building with water `per_person` or `fixed_per_room`
- **THEN** the required reading count does not require a water reading for that contract

#### Scenario: Utility override counts as complete
- **WHEN** a required room meter has a saved billing utility usage override for the period
- **THEN** reading progress treats that meter as complete for period summary and overview purposes

### Requirement: Invoice issue is atomic
The invoice issue API SHALL persist invoice rows, invoice charge snapshots, period status changes, and success audit metadata atomically.

#### Scenario: Issue write succeeds
- **WHEN** eligible drafts are issued successfully
- **THEN** invoices, charges, period status, and success audit metadata are all visible together

#### Scenario: Charge insert fails
- **WHEN** any invoice charge insert fails during issue
- **THEN** no new invoice row, partial charge row, period status change, or success audit event from that issue remains visible

### Requirement: Bulk payment is atomic
The bulk payment API SHALL persist payment rows, invoice totals/status updates, period status changes, and success audit metadata atomically.

#### Scenario: Bulk payment succeeds
- **WHEN** every payment item is valid and all writes succeed
- **THEN** all payment rows, invoice totals/statuses, period status updates, and success audit metadata are visible together

#### Scenario: Bulk payment row fails
- **WHEN** any payment item fails validation or persistence after earlier items were attempted
- **THEN** no payment row, invoice total/status update, period status update, or success audit event from that batch remains visible

### Requirement: Cross-period invoice list API
The API SHALL provide `GET /api/invoices` that returns invoices across periods filtered by query params, with server-side pagination.

Query params (all optional):
- `building_id`: scope to one building
- `period_year`, `period_month`: scope to a specific year/month
- `status`: repeatable param, one of `issued | partial | paid | overdue | void`
- `tenant_search`: free-text, matched against tenant name and phone (case-insensitive, substring)
- `page` (default 1), `page_size` (default 50, max 100)

Response shape:
```ts
{
  data: InvoiceListItem[]
  meta: {
    page: number
    page_size: number
    total: number
    total_pages: number
  }
}
```

`InvoiceListItem` SHALL include: `id`, `invoice_code`, `period_year`, `period_month`, `building_id`, `building_name`, `room_id`, `room_number`, `contract_id`, `contract_code`, `tenant_id`, `tenant_name`, `total_amount`, `paid_amount`, `balance_amount`, `due_date`, `status`, `issued_at`, `voided_at?`, `void_reason?`.

#### Scenario: Authenticated user sees scoped invoices
- **WHEN** a manager with assigned buildings `[B1, B2]` calls `GET /api/invoices` without `building_id`
- **THEN** response data only includes invoices where `building_id IN (B1, B2)`

#### Scenario: Admin sees all
- **WHEN** an admin calls `GET /api/invoices` without `building_id`
- **THEN** response data includes invoices from all buildings

#### Scenario: Unauthenticated request rejected
- **WHEN** an unauthenticated client calls `GET /api/invoices`
- **THEN** API returns 401 with `{ error: { code: "UNAUTHENTICATED", ... } }`

#### Scenario: Building filter outside user scope returns 403
- **WHEN** a manager requests `building_id=B3` where B3 is not assigned
- **THEN** API returns 403 with `{ error: { code: "FORBIDDEN", ... } }`

#### Scenario: Multi-status filter is OR
- **WHEN** client sends `?status=issued&status=overdue`
- **THEN** response includes invoices in EITHER status (union, not intersection)

#### Scenario: Pagination metadata accurate
- **WHEN** total 137 invoices match filter with `page_size=50`
- **THEN** response meta is `{ page: 1, page_size: 50, total: 137, total_pages: 3 }`

#### Scenario: Page size capped at 100
- **WHEN** client sends `page_size=500`
- **THEN** API validates and returns 422 with `{ error: { code: "VALIDATION_ERROR" } }`

#### Scenario: Tenant search matches name and phone
- **WHEN** client sends `tenant_search=Tung`
- **THEN** response includes invoices where tenant name contains "Tung" (case-insensitive)
- **WHEN** client sends `tenant_search=0912`
- **THEN** response includes invoices where tenant phone contains "0912"

#### Scenario: Default sort by issued date desc
- **WHEN** client calls without explicit sort
- **THEN** results ordered by `issued_at DESC, id DESC` (deterministic tiebreaker)

#### Scenario: Status `overdue` is derived not stored
- **WHEN** invoice has status `issued` and `due_date < today` and `balance_amount > 0`
- **THEN** API returns it as `status: "overdue"`
- **WHEN** filter `status=overdue` is applied
- **THEN** API computes overdue using same rule (status=issued AND due_date < today AND balance > 0)

### Requirement: Billing audit — meter readings coverage
**Context**: `billing-api` spec defines audit requirements for billing operations. Meter reading saves MUST be captured.

`MeterReadingService.create`, `bulkCreate`, and `update` SHALL each append a `reading.saved` audit event to `billing_audit_events`.

#### Scenario: Save meter reading emits audit event
- **WHEN** a meter reading is saved (create or update) via `MeterReadingService`
- **THEN** a `reading.saved` audit event is appended to `billing_audit_events` with:
  - `entity_type: 'meter_reading'`
  - `entity_id: <reading_id>`
  - `billing_period_id: <period_id>` (nullable if no billing period exists for that month)
  - `before_data: null` (new reading) or previous reading snapshot (update)
  - `after_data`: saved reading snapshot
  - `metadata.count: 1`

### Requirement: Billing audit — invoice reissue snapshot
**Context**: `billing-api` spec requires consistent before/after snapshots on all mutating events.

The `invoice.reissued` audit event SHALL include full before/after snapshots consistent with other invoice mutation events.

#### Scenario: Invoice reissued event has full snapshot
- **WHEN** an invoice is reissued (void + reissue flow)
- **THEN** the `invoice.reissued` audit event MUST include:
  - `before_data`: the voided invoice snapshot
  - `after_data`: the new invoice snapshot
  - `metadata` retains existing fields (reason, replacement_for_invoice_id, etc.)

