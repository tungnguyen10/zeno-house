## Purpose

Atomic close and reopen of billing periods, one reserve-accrual formula shared with the operations report, and immutability of closed periods for payments and money columns.

## Requirements

### Requirement: Atomic billing period close
The system SHALL change the period status to `closed`, write the monthly reserve accrual when allowed, and append the `period.closed` audit event in a single database transaction. A period SHALL only be closed from `issued` or `collecting` and only when no non-void invoice has a balance above zero. The RPC SHALL re-check issued revenue against the value the server computed and reject a stale value.

#### Scenario: Close commits status, accrual and audit together
- **WHEN** an admin closes a collecting period whose invoices are all paid
- **THEN** the period is `closed` with `closed_at` set, one `monthly_accrual` row holds the computed amount, one `period.closed` audit event exists, and the response reports `accrualStatus = recorded`

#### Scenario: Outstanding invoices block the close
- **WHEN** a non-void invoice of the period still has a balance
- **THEN** the request is rejected with CONFLICT carrying the outstanding count and the period is unchanged

#### Scenario: Stale revenue is recomputed once
- **WHEN** invoice totals change between the server computation and the RPC
- **THEN** the RPC rejects with `PERIOD_SNAPSHOT_STALE`, the service recomputes and retries exactly once, and a second stale result is returned as CONFLICT

### Requirement: Close is idempotent and detects inconsistent data
The system SHALL treat a repeated close of a period that has a matching `period.closed` audit event as a replay without writing again, and SHALL reject a closed period without such an event as inconsistent.

#### Scenario: Retry replays
- **WHEN** close is called again for a period already closed by an earlier successful close
- **THEN** no audit event or accrual is added and `accrualStatus` is null

#### Scenario: Legacy audit shape is accepted
- **WHEN** the existing `period.closed` event stores the close timestamp as `closedAt`
- **THEN** it is treated as a matching event

#### Scenario: Closed period without close audit
- **WHEN** a period is `closed` but has no matching `period.closed` event
- **THEN** the request is rejected with CONFLICT (`PERIOD_CLOSED_INCONSISTENT`) and nothing is written

### Requirement: Operations report owns the reserve accrual
The system SHALL use one formula for billing close, operations report close, auto-close and admin refresh: invoice totals of non-void invoices minus applicable fixed costs, direct monthly expenses (excluding reserve-fund-funded expenses) and prepaid allocations; the accrual is `round(max(profit, 0) * rate / 100)` and the rate is 0 when none applies. Billing close SHALL only upsert the accrual while the month's operations report is open or missing.

#### Scenario: Report already closed
- **WHEN** a billing period is closed while the operations report of the same building and month is closed
- **THEN** the accrual row is not changed, the audit metadata records `skipped_report_closed`, and the UI warns that an admin must refresh the reserve fund

#### Scenario: Negative profit
- **WHEN** profit by revenue is below zero
- **THEN** the accrual amount is 0

### Requirement: Atomic billing period reopen
The system SHALL reopen a closed period to `collecting`, clear `closed_at` and append `period.reopened` with the reason in one transaction. The reason SHALL have at least 10 characters. Reopening SHALL NOT edit or delete the period's accrual.

#### Scenario: Reopen then close again
- **WHEN** a period is reopened and closed again with different numbers
- **THEN** exactly one accrual row exists with the new amount and the second `period.closed` event records the accrual before and after

#### Scenario: Invalid reopen
- **WHEN** the period is not closed or the reason is shorter than 10 characters
- **THEN** the request is rejected with CONFLICT or VALIDATION_ERROR and nothing changes

### Requirement: Closed periods are immutable for payments and money
The system SHALL reject payment inserts, updates and deletes, and invoice status or money-column updates, while the invoice's period is `closed`. Billing RPCs SHALL lock `billing_periods` before `invoices` before `invoice_payments`, and bulk payment recording SHALL lock the affected periods before any invoice.

#### Scenario: Payment into a closed period
- **WHEN** a payment is recorded or inserted for an invoice of a closed period
- **THEN** it is rejected (`PERIOD_CLOSED_LOCKED` for direct writes) and no payment exists

#### Scenario: Close racing a bulk payment
- **WHEN** close and bulk payment run concurrently on the same period
- **THEN** either the payment commits first and the close sees it, or the payment is rejected as closed, and neither deadlocks

### Requirement: Billing RPC grants
The billing close, reopen, issue, bulk payment and issue-and-pay RPCs SHALL be executable only by `service_role`.

#### Scenario: Browser roles cannot execute billing RPCs
- **WHEN** `anon` or `authenticated` checks execute privilege on any of those RPCs
- **THEN** the privilege is denied

### Requirement: Month-end automatic close
On the last day of each month at 23:55 Asia/Ho_Chi_Minh the system SHALL, for every active building, close the billing period of that month before closing its operations report. A billing period SHALL be closed automatically only when it is `issued` or `collecting` and has no non-void invoice with a balance. Periods that do not qualify SHALL be left open and reported as skipped, and a failure for one building SHALL NOT stop the other buildings or the operations report close.

#### Scenario: Fully collected period closes with the report
- **WHEN** the month-end job runs and every non-void invoice of the building's period is paid
- **THEN** the billing period closes through the atomic RPC with no actor, the accrual is written once, and the operations report then closes

#### Scenario: Unpaid invoices keep the billing period open
- **WHEN** the month-end job runs and the period still has unpaid invoices
- **THEN** the billing period stays open and is reported as `has_outstanding`, and the operations report still closes

#### Scenario: Not-yet-issued or missing period
- **WHEN** the building's period is `draft`, `readings`, `review` or does not exist
- **THEN** it is skipped and the operations report still closes
