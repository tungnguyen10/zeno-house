## MODIFIED Requirements

### Requirement: Invoice payment API
The API SHALL record monthly payments against invoices and SHALL support undoing recorded payments. New payment recording requires full balance settlement; legacy partial-paid invoices retain compatibility.

#### Scenario: Payment recorded
- **WHEN** a valid full-balance payment is submitted to `POST /api/billing/invoices/:id/payments`
- **THEN** the API creates the payment and updates invoice paid amount, balance amount, and status to `paid`

#### Scenario: Overpayment rejected
- **WHEN** a payment would make paid amount greater than invoice total
- **THEN** the API rejects the request with 400 VALIDATION_ERROR

#### Scenario: Underpayment from simplified UI rejected
- **WHEN** a payment less than current balance is submitted with header `X-Billing-Strict-Full: true`
- **THEN** the API rejects with 400 VALIDATION_ERROR code `PARTIAL_PAYMENT_DISABLED` and message instructing to collect full balance

#### Scenario: Legacy partial payment still accepted
- **WHEN** the request omits the strict header (legacy compatibility) and amount is less than balance
- **THEN** the API records the partial payment as before for backward compatibility with any unmigrated client

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
- **WHEN** a user with sufficient permission voids an issued invoice with no remaining (non-deleted) payments
- **THEN** the API marks it void, stores void reason metadata, and appends an audit event

#### Scenario: Reissue replacement invoice
- **WHEN** a voided invoice needs replacement
- **THEN** the API issues a new invoice linked to the voided invoice, sharing a `correlation_id` with the void event

#### Scenario: Void with active payments rejected
- **WHEN** a void targets an invoice with active (non-deleted) payments
- **THEN** the API rejects with 409 CONFLICT and message instructing to undo payments first

#### Scenario: Closed period direct mutation rejected
- **WHEN** a correction targets a closed period without explicit reopen flow
- **THEN** the API rejects normal edit, void, or reissue actions

#### Scenario: Adjustment endpoint remains
- **WHEN** an integration POSTs to the existing adjustment endpoint
- **THEN** the API still accepts it for backward compatibility, but the workspace UI no longer surfaces this path

## ADDED Requirements

### Requirement: Issue-and-pay combined API
The API SHALL provide a single endpoint that issues one draft invoice and records its full payment atomically.

#### Scenario: Endpoint shape
- **WHEN** an authorized user POSTs to `/api/billing/periods/:periodId/contracts/:contractId/issue-and-pay` with body `{ payment_date, payment_method, note? }`
- **THEN** the API invokes the `issue_and_pay` PL/pgSQL function which: validates the draft is `ready`, creates the invoice with snapshot lines, creates `invoice_payments` row for the full balance, sets invoice status to `paid`, and emits `invoices.issued` + `invoice.payment_recorded` audit events sharing one `correlation_id` (UUID v7)

#### Scenario: Atomic on failure
- **WHEN** any of the steps inside the PL/pgSQL function fails
- **THEN** the entire transaction rolls back; no invoice row, no payment row, no audit events persist; the response is a single 409 CONFLICT or 422 with the failure cause

#### Scenario: Blocker rejection
- **WHEN** the contract's draft has blockers (missing reading, missing rate)
- **THEN** the API returns 422 with code `DRAFT_NOT_READY` and lists the blockers; nothing is mutated

#### Scenario: Already-issued contract rejection
- **WHEN** the contract already has an issued invoice for the period
- **THEN** the API returns 409 with code `ALREADY_ISSUED`

#### Scenario: Concurrency safe
- **WHEN** two requests for the same contract+period arrive simultaneously
- **THEN** the function uses `pg_advisory_xact_lock` (consistent with existing `issue_period_invoices`) so only one transaction completes; the other receives `ALREADY_ISSUED` cleanly

#### Scenario: Closed period rejection
- **WHEN** the period is `closed`
- **THEN** the API returns 409 with code `PERIOD_LOCKED`

#### Scenario: Permission check
- **WHEN** the caller lacks both `billing.issue` and `billing.payment.write`
- **THEN** the API returns 403 FORBIDDEN

### Requirement: Audit list API supports filter, search, pagination
The audit list endpoint SHALL support server-side filtering, full-text search across metadata, and pagination to power the rework drawer.

#### Scenario: Endpoint shape
- **WHEN** the client calls `GET /api/billing/periods/:periodId/audit?actor=&category=&from=&to=&q=&correlation_id=&cursor=&limit=`
- **THEN** the API returns `{ data: AuditEvent[], meta: { nextCursor?: string, total?: number } }`

#### Scenario: Filter by category
- **WHEN** the `category` query parameter is provided (one of `create`, `edit`, `destructive`, `status`, `other`, or comma-separated combo)
- **THEN** the API maps each action code to a category per the documented mapping and returns only matching events

#### Scenario: Filter by actor
- **WHEN** `actor` is a profile UUID (comma-separated allowed)
- **THEN** only events authored by those actors are returned

#### Scenario: Filter by date range
- **WHEN** `from` and/or `to` are ISO timestamps
- **THEN** events with `created_at` outside the inclusive range are excluded

#### Scenario: Filter by correlation
- **WHEN** `correlation_id` is provided
- **THEN** only events with matching correlation are returned (used by drawer "Xem cùng correlation")

#### Scenario: Full-text search
- **WHEN** `q` is provided
- **THEN** the API performs case-insensitive substring search across: tenant name, invoice code, summary text, and key metadata string fields (note, reason)

#### Scenario: Pagination
- **WHEN** `limit` is unset or > 100
- **THEN** the API caps page size to 100 and returns `meta.nextCursor` when more results exist

#### Scenario: Permission check
- **WHEN** the caller lacks `billing.read`
- **THEN** the API returns 403 FORBIDDEN

### Requirement: Audit events carry correlation and structured diffs
Audit event rows SHALL include a `correlation_id` column and structured metadata supporting before/after diff rendering.

#### Scenario: Schema
- **WHEN** an audit event is inserted
- **THEN** the row has columns: `id`, `period_id`, `actor_id`, `action`, `entity_type`, `entity_id`, `summary`, `metadata jsonb`, `correlation_id uuid null`, `created_at`
- **AND** `correlation_id` is filled when the event is part of a multi-event atomic operation, NULL otherwise

#### Scenario: Reading saved includes diff
- **WHEN** a `reading.saved` event is appended
- **THEN** metadata includes `previous_value`, `new_value`, `unit`, `reading_date`

#### Scenario: Payment undone includes diff
- **WHEN** a `payment.undone` event is appended
- **THEN** metadata includes `before: { amount, paid_amount, status, payment_date, method }`, `after: { paid_amount, status }`, `reason?`

#### Scenario: Bulk operations emit parent + children
- **WHEN** a bulk operation completes (`payments.bulk_recorded`, `invoices.issued` from bulk issue)
- **THEN** one parent event is appended with summary metadata AND one child event per affected entity; all share the same `correlation_id`

#### Scenario: New action codes available
- **WHEN** the corresponding domain action occurs
- **THEN** the API and service layer emit one of the new codes: `payment.undone`, `payment.edited`, `invoice.printed` in addition to the existing 14 codes
