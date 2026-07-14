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

### Requirement: Close period creates reserve accrual
The billing close flow SHALL create or refresh the building's monthly reserve accrual from current operations profit and the effective reserve rate.

#### Scenario: Close creates monthly reserve accrual
- **WHEN** an authorized user closes a billing period for a building with an effective reserve rate
- **THEN** the system records a reserve fund monthly accrual transaction for that building, year, and month

#### Scenario: Accrual uses operations profit
- **WHEN** the monthly accrual is recorded during billing close
- **THEN** the accrual amount is calculated from `max(issued revenue - report expenses, 0)` and the effective reserve rate, not from collected cash

#### Scenario: Close without rate records zero accrual
- **WHEN** an authorized user closes a billing period for a building without an effective reserve rate
- **THEN** the system records or preserves a zero-rate monthly accrual for that building/month

#### Scenario: Reclose refreshes accrual
- **WHEN** a closed period is reopened and closed again after billing data changes
- **THEN** the system refreshes the existing reserve accrual transaction for that building/month instead of creating a duplicate

### Requirement: Billing period close remains manual
The billing API SHALL NOT automatically close billing periods from operations-report close or month-end operations-report auto-close flows.

#### Scenario: Operations report auto-close leaves billing unchanged
- **WHEN** the operations-report auto-close task runs at month end
- **THEN** it does not change the status of any billing period

#### Scenario: Operations report manual close leaves billing unchanged
- **WHEN** an admin closes or reopens an operations report period
- **THEN** the corresponding billing period status is unchanged

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
The API SHALL record monthly payments against invoices and SHALL support undoing recorded payments. New payment recording requires full balance settlement; legacy partial-paid invoices retain compatibility.

#### Scenario: Payment recorded
- **WHEN** a valid full-balance payment is submitted to `POST /api/billing/invoices/:id/payments`
- **THEN** the API creates the payment and updates invoice paid amount, balance amount, and status
- **AND** invoice status becomes `paid`

#### Scenario: Overpayment rejected
- **WHEN** a payment would make paid amount greater than invoice total
- **THEN** the API rejects the request with 400 VALIDATION_ERROR

#### Scenario: Underpayment from simplified UI rejected
- **WHEN** a payment less than current balance is submitted with header `X-Billing-Strict-Full: true`
- **THEN** the API rejects with 400 VALIDATION_ERROR code `PARTIAL_PAYMENT_DISABLED` and message instructing to collect full balance

#### Scenario: Legacy partial payment still accepted
- **WHEN** the request omits the strict header and amount is less than balance
- **THEN** the API records the partial payment for backward compatibility with any unmigrated client

#### Scenario: Undo payment
- **WHEN** an authorized user calls `DELETE /api/billing/invoice-payments/:paymentId` with optional body `{ reason }` and the payment belongs to an invoice in a period whose status is not `closed`
- **THEN** the API soft-deletes the payment, recomputes invoice paid_amount/balance/status, appends `payment.undone` audit event with `{ before: {amount, paid_amount, status}, after: {paid_amount, status}, reason }`, and returns the updated invoice

#### Scenario: Undo payment on closed period
- **WHEN** the payment's invoice belongs to a `closed` period
- **THEN** the API returns 409 CONFLICT with code `PERIOD_LOCKED` and message indicating the period must be reopened

#### Scenario: Undo non-existent or already-deleted payment
- **WHEN** the payment ID does not exist or `deleted_at` is already set
- **THEN** the API returns 404 NOT_FOUND

### Requirement: Invoice correction API
The API SHALL support controlled invoice corrections via void+reissue. Direct adjustment of paid invoices via API remains available for backward compatibility but is no longer surfaced in the workspace UI.

#### Scenario: Void unpaid invoice
- **WHEN** a user with sufficient permission voids an issued invoice with no remaining active payments
- **THEN** the API marks it void, stores void reason metadata, and appends an audit event

#### Scenario: Reissue replacement invoice
- **WHEN** a voided invoice needs replacement
- **THEN** the API issues a new invoice linked to the voided invoice, sharing a `correlation_id` with the void event

#### Scenario: Void with active payments rejected
- **WHEN** a void targets an invoice with active payments
- **THEN** the API rejects with 409 CONFLICT and message instructing to undo payments first

#### Scenario: Closed period direct mutation rejected
- **WHEN** a correction targets a closed period without explicit reopen flow
- **THEN** the API rejects normal edit, void, or reissue actions

#### Scenario: Adjustment endpoint remains
- **WHEN** an integration POSTs to the existing adjustment endpoint
- **THEN** the API still accepts it for backward compatibility, but the workspace UI no longer surfaces this path

### Requirement: Draft grid read model API
The API SHALL provide a draft-grid read model for the `Soạn kỳ` workspace tab. The endpoint SHALL compose existing period, room, meter reading, utility override, invoice, and draft calculation data without introducing a new repository layer for this optimization.

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
The billing API SHALL capture meter reading saves as billing audit events. `MeterReadingService.create`, `bulkCreate`, and `update` SHALL each append a `reading.saved` audit event to `billing_audit_events`.

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
The `invoice.reissued` audit event SHALL include full before/after snapshots consistent with other invoice mutation events.

#### Scenario: Invoice reissued event has full snapshot
- **WHEN** an invoice is reissued (void + reissue flow)
- **THEN** the `invoice.reissued` audit event MUST include:
  - `before_data`: the voided invoice snapshot
  - `after_data`: the new invoice snapshot
  - `metadata` retains existing fields (reason, replacement_for_invoice_id, etc.)

### Requirement: Issue-and-pay combined API
The API SHALL provide a single endpoint that issues one draft invoice and records its full payment atomically.

#### Scenario: Endpoint shape
- **WHEN** an authorized user POSTs to `/api/billing/periods/:periodId/issue-and-pay` with body `{ contract_id, payment_date, payment_method, note? }`
- **THEN** the API invokes the `issue_and_pay` PL/pgSQL function which validates the draft is `ready`, creates the invoice with snapshot lines, creates an `invoice_payments` row for the full balance, sets invoice status to `paid`, and emits `invoices.issued` plus `invoice.payment_recorded` audit events sharing one UUID v7 `correlation_id`

#### Scenario: Atomic on failure
- **WHEN** any step inside the PL/pgSQL function fails
- **THEN** the entire transaction rolls back and no invoice row, payment row, or audit event persists

#### Scenario: Blocker rejection
- **WHEN** the contract's draft has blockers such as missing reading or missing rate
- **THEN** the API returns 422 with code `DRAFT_NOT_READY` and lists the blockers; nothing is mutated

#### Scenario: Already-issued contract rejection
- **WHEN** the contract already has an issued invoice for the period
- **THEN** the API returns 409 with code `ALREADY_ISSUED`

#### Scenario: Concurrency safe
- **WHEN** two requests for the same contract and period arrive simultaneously
- **THEN** the function uses an advisory transaction lock so only one transaction completes and the other receives `ALREADY_ISSUED`

#### Scenario: Closed period rejection
- **WHEN** the period is `closed`
- **THEN** the API returns 409 with code `PERIOD_LOCKED`

#### Scenario: Permission check
- **WHEN** the caller lacks both invoice issue and payment write permission
- **THEN** the API returns 403 FORBIDDEN

### Requirement: Audit list API supports filter, search, pagination
The audit list endpoint SHALL support server-side filtering, full-text search across metadata, and pagination to power the reworked drawer.

#### Scenario: Endpoint shape
- **WHEN** the client calls `GET /api/billing/periods/:periodId/audit?actor=&category=&from=&to=&q=&correlation_id=&cursor=&limit=`
- **THEN** the API returns `{ data: AuditEvent[], meta: { nextCursor?: string, total?: number } }`

#### Scenario: Filter by category
- **WHEN** the `category` query parameter is provided as one category or a comma-separated combination
- **THEN** the API maps each category to billing audit action codes and returns only matching events

#### Scenario: Filter by actor
- **WHEN** `actor` is a profile UUID or comma-separated list of UUIDs
- **THEN** only events authored by those actors are returned

#### Scenario: Filter by date range
- **WHEN** `from` and/or `to` are ISO timestamps
- **THEN** events with `created_at` outside the inclusive range are excluded

#### Scenario: Filter by correlation
- **WHEN** `correlation_id` is provided
- **THEN** only events with matching correlation are returned

#### Scenario: Full-text search
- **WHEN** `q` is provided
- **THEN** the API performs case-insensitive substring search across tenant name, invoice code, summary text, and key metadata string fields

#### Scenario: Pagination
- **WHEN** `limit` is unset or greater than 100
- **THEN** the API caps page size to 100 and returns `meta.nextCursor` when more results exist

#### Scenario: Permission check
- **WHEN** the caller lacks `billing.read`
- **THEN** the API returns 403 FORBIDDEN

### Requirement: Audit events carry correlation and structured diffs
Audit event rows SHALL include a `correlation_id` column and structured metadata supporting before/after diff rendering.

#### Scenario: Schema
- **WHEN** an audit event is inserted
- **THEN** the row has columns for id, period id, actor id, action, entity type, entity id, summary, metadata, nullable `correlation_id`, and creation timestamp
- **AND** `correlation_id` is filled when the event is part of a multi-event atomic operation and NULL otherwise

#### Scenario: Reading saved includes diff
- **WHEN** a `reading.saved` event is appended
- **THEN** metadata includes `previous_value`, `new_value`, `unit`, and `reading_date`

#### Scenario: Payment undone includes diff
- **WHEN** a `payment.undone` event is appended
- **THEN** metadata includes `before: { amount, paid_amount, status, payment_date, method }`, `after: { paid_amount, status }`, and optional `reason`

#### Scenario: Bulk operations emit parent and children
- **WHEN** a bulk operation completes, such as `payments.bulk_recorded` or `invoices.issued`
- **THEN** one parent event is appended with summary metadata and one child event per affected entity, all sharing the same `correlation_id`

#### Scenario: New action codes available
- **WHEN** the corresponding domain action occurs
- **THEN** the API and service layer emit one of `payment.undone`, `payment.edited`, or `invoice.printed` in addition to existing billing audit codes

### Requirement: Billing grid reuses a consistent input snapshot
The billing draft-grid API SHALL calculate its rows and overview from one consistent set of period, pricing, room, reading, contract, service, override, invoice, and audit inputs without reloading equivalent inputs through nested services.

#### Scenario: Load draft grid
- **WHEN** an authorized user loads a billing draft grid
- **THEN** grid rows and overview describe the same period snapshot and database round trips remain bounded independently of room count

### Requirement: Billing audit filters before enrichment
The billing audit API SHALL apply indexed filters, cursor ordering, and page limits before resolving display labels and SHALL return a stable continuation cursor.

#### Scenario: Search a large audit period
- **WHEN** a period contains more events than the requested page limit and the user supplies filters or search text
- **THEN** only the matching page is enriched and the next cursor continues without duplicate or missing events

