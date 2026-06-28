## MODIFIED Requirements

### Requirement: Collect invoice payments
The system SHALL record monthly collection against invoices. New payments SHALL settle the invoice in full (no partial creation from the UI). Existing partial-paid invoices created before this change SHALL continue to render correctly until closed.

#### Scenario: Record invoice payment
- **WHEN** a user records a payment for an issued invoice
- **THEN** the system creates an `invoice_payments` row
- **AND** updates the invoice paid amount, balance amount, and status

#### Scenario: Full payment
- **WHEN** recorded payment equals invoice balance
- **THEN** invoice status becomes `paid`

#### Scenario: Partial payment legacy
- **WHEN** an invoice predating this change has status `partial` and outstanding balance
- **THEN** the workspace still renders its remaining balance correctly and accepts a single follow-up payment that brings it to `paid`

#### Scenario: New payment must clear the balance
- **WHEN** a user submits a payment with amount less than current balance via the simplified UI
- **THEN** the UI rejects the input before submission and shows guidance that partial payments are no longer supported

#### Scenario: Undo payment
- **WHEN** a user with `billing.write` undoes a recorded payment on an issued invoice within an open period
- **THEN** the system soft-deletes the `invoice_payments` row, recomputes invoice paid amount/balance/status, and appends a `payment.undone` audit event with actor, before/after amounts, and reason when provided

#### Scenario: Undo payment blocked on closed period
- **WHEN** the period is `closed`
- **THEN** undo is blocked with a message that the period must be reopened first

### Requirement: Correct billing mistakes
The system SHALL support billing corrections without silently mutating issued financial history. Adjustment-on-paid-invoice is removed from the workspace UI in favor of void+reissue (when invoice is unpaid) or a manual line item on a future invoice (when invoice is paid).

#### Scenario: Correct before issue
- **WHEN** a mistake is found before invoices are issued
- **THEN** the user can correct source data or utility usage override
- **AND** draft charges recalculate from corrected inputs

#### Scenario: Void and reissue unpaid invoice
- **WHEN** a mistake is found after issue and the invoice has no recorded payments
- **THEN** a privileged user can void the invoice with a reason
- **AND** issue a replacement invoice linked to the voided invoice

#### Scenario: Paid invoice correction via undo
- **WHEN** a mistake is found on a paid invoice in an open period
- **THEN** the user MAY undo the payment, void the invoice, correct source data, and reissue + record payment again
- **AND** all four events share a single `correlation_id` in the audit log

#### Scenario: Paid invoice correction in next period
- **WHEN** the user opts not to undo and instead handles the difference in the next period
- **THEN** the user adds a manual line item on a future invoice; the workspace does NOT expose a separate adjustment action

#### Scenario: Closed period correction
- **WHEN** a mistake is found after the period is closed
- **THEN** normal edits are blocked
- **AND** the correction requires explicit reopen with a reason

#### Scenario: Correction audited
- **WHEN** an invoice is voided, reissued, payment is undone, or readings/overrides are changed
- **THEN** the system appends billing audit events with actor, reason, affected invoice/reading, and before/after data when applicable

### Requirement: Close billing period
The system SHALL allow a privileged user to close a billing period after collection completes. Closing a period SHALL be the only lock boundary in the billing workflow; before close, every action is reversible through audit-backed operations.

#### Scenario: Close period when fully collected
- **WHEN** a user with `billing.close` closes a period whose outstanding balance is zero
- **THEN** the period status becomes `closed`
- **AND** normal workspace edits for that period are locked

#### Scenario: Close discouraged when outstanding exists
- **WHEN** outstanding balance is greater than zero
- **THEN** the close action is disabled with tooltip indicating remaining invoices; user must collect, void, or reissue them first

#### Scenario: Insufficient close permission
- **WHEN** a user without `billing.close` attempts to close a period
- **THEN** the system returns 403 FORBIDDEN

#### Scenario: Closed period lock is total
- **WHEN** a period is closed
- **THEN** all edit actions in the workspace are disabled: reading edits, utility override, invoice issue, payment record, payment undo, invoice void, manual line items

#### Scenario: Reopen requires reason
- **WHEN** a user with reopen permission reopens a closed period
- **THEN** the system requires a `reason` of at least 10 characters
- **AND** appends a `period.reopened` audit event with reason and actor

### Requirement: Billing audit history
The system SHALL append audit events for billing-critical workspace actions with structured, queryable metadata supporting before/after diffs and correlation grouping.

#### Scenario: Period action audited
- **WHEN** a billing period is opened, status-changed, closed, reopened, or unissued
- **THEN** the system appends a billing audit event with actor, action, period, timestamp, and `metadata.trigger` (one of `manual`, `auto_from_issue`, `auto_from_payment`)

#### Scenario: Reading save audited with diff
- **WHEN** readings are saved from the billing workspace
- **THEN** the system appends `reading.saved` events that include `previous_value` and `new_value` in metadata to support diff rendering

#### Scenario: Utility override audited
- **WHEN** a utility usage override is created, updated, or cleared
- **THEN** the system appends `utility_override.saved` or `utility_override.cleared` with before/after metadata

#### Scenario: Invoice issue audited
- **WHEN** invoices are issued either through bulk issue or auto-issue-on-payment
- **THEN** the system appends `invoices.issued` per invoice, sharing a single `correlation_id` per atomic operation

#### Scenario: Payment action audited
- **WHEN** a payment is recorded, edited, or undone
- **THEN** the system appends `invoice.payment_recorded`, `payment.edited`, or `payment.undone` with actor, invoice ID, amount, method, and before/after when applicable

#### Scenario: Bulk payment audited with children
- **WHEN** a bulk payment is recorded across N invoices
- **THEN** the system appends one parent `payments.bulk_recorded` event AND N child `invoice.payment_recorded` events sharing the parent's `correlation_id`

#### Scenario: Auto-issue + payment shares correlation
- **WHEN** the user triggers auto-issue-on-payment on a draft row
- **THEN** the resulting `invoices.issued` event AND `invoice.payment_recorded` event share one `correlation_id`

#### Scenario: Print audited
- **WHEN** an invoice is printed or exported as a receipt artifact from the workspace
- **THEN** the system appends an `invoice.printed` audit event with actor, invoice ID, timestamp

## ADDED Requirements

### Requirement: Auto-issue on payment
The system SHALL support a single atomic operation that issues a draft invoice and records its full payment in the same transaction.

#### Scenario: Ready draft can be issued and paid in one step
- **WHEN** a user triggers "Đã thu" on a draft row whose status is `ready` (no blockers)
- **THEN** the system creates the invoice, creates the payment for full balance, updates invoice to `paid`, and emits both audit events sharing a `correlation_id`
- **AND** the operation is all-or-nothing (no partial success state)

#### Scenario: Blocker prevents auto-issue
- **WHEN** the row has a blocker (missing reading, missing rate, etc.)
- **THEN** the "Đã thu" action is disabled until the blocker is resolved

#### Scenario: Concurrent auto-issue and bulk issue
- **WHEN** another transaction has already issued an invoice for the same contract+period
- **THEN** the auto-issue+pay operation fails cleanly with a conflict error and the user sees a "đã được phát hành" message; no duplicate invoice is created

#### Scenario: Payment input validation
- **WHEN** the user submits the auto-issue payment modal
- **THEN** the system requires `payment_date` (default today), `payment_method`, and optionally `note`; amount is auto-set to invoice balance and not user-editable

#### Scenario: Failure rolls back atomically
- **WHEN** either the invoice insert or payment insert fails inside the RPC
- **THEN** neither row persists; period status does not change; no audit events are appended

### Requirement: Period-level lock is the only edit boundary
The workspace SHALL enforce a single lock semantics: a period in status `closed` blocks all edit actions; any other status permits all actions subject to per-action permission.

#### Scenario: Status `closed` blocks all edits
- **WHEN** the period status is `closed`
- **THEN** every edit action (readings, override, issue, pay, undo, void) returns a uniform "kỳ đã chốt" error

#### Scenario: Status `issued`/`collecting` permits undo
- **WHEN** the period status is `issued` or `collecting`
- **THEN** payment undo, invoice void, and bulk operations remain available subject to permission

#### Scenario: Lock check centralized
- **WHEN** a service or UI component checks period editability
- **THEN** both call the same helper that returns true only when period.status === 'closed'
