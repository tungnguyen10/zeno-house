# monthly-operations-workspace Specification

## Purpose
TBD - created by archiving change monthly-operations-workspace. Update Purpose after archive.
## Requirements
### Requirement: Monthly operations workspace
The system SHALL provide a Building + Period scoped monthly operations workspace for the primary billing workflow.

#### Scenario: Open workspace from billing entry
- **WHEN** a user selects a building and `YYYY-MM` period from `/billing`
- **THEN** the system opens the monthly operations workspace for that building and period
- **AND** the workspace is not hosted on Room detail

#### Scenario: Workspace shows end-to-end steps
- **WHEN** the user opens the workspace
- **THEN** the user can access overview, readings, review charges, issue invoices, payments/debt, and close period steps

### Requirement: Billing period lifecycle
The system SHALL track a billing period lifecycle for each building/month.

#### Scenario: Open a new period
- **WHEN** no billing period exists for a selected building/month
- **THEN** the system can create one with status `draft`

#### Scenario: Existing period reused
- **WHEN** a billing period already exists for the selected building/month
- **THEN** the workspace loads the existing period instead of creating a duplicate

#### Scenario: Period is unique
- **WHEN** two requests try to create the same building/month period
- **THEN** the database uniqueness constraint prevents duplicate periods

### Requirement: Draft charge review
The system SHALL calculate draft charges from live billing inputs before invoices are issued.

#### Scenario: Draft generated from active contracts
- **WHEN** the user reviews charges for a period
- **THEN** the system creates one draft invoice preview per active contract in the selected building and period

#### Scenario: Draft includes line items
- **WHEN** a draft invoice preview is shown
- **THEN** it includes rent, utilities, enabled services, discount, surcharge, and total

#### Scenario: Draft is recomputable
- **WHEN** source inputs change before issue
- **THEN** the draft review reflects the latest source inputs

#### Scenario: Meter replacement usage override
- **WHEN** a room meter is replaced or reset during the billing period
- **THEN** the user can provide a period-scoped utility usage override
- **AND** draft charge uses the override billable usage instead of raw current minus previous reading

### Requirement: Issue invoices
The system SHALL persist issued invoices as snapshots.

#### Scenario: Issue valid invoices
- **WHEN** all required billing inputs are valid and the user issues invoices
- **THEN** the system creates `invoices` and `invoice_charges` rows for the period
- **AND** those persisted rows become the source of truth for the issued amount

#### Scenario: Snapshot survives source edits
- **WHEN** contract rent, service price, occupant count, or meter readings are edited after invoice issue
- **THEN** the issued invoice totals and invoice charge calculation metadata remain unchanged

#### Scenario: Utility snapshot includes previous and current values
- **WHEN** a utility charge is issued
- **THEN** invoice charge metadata includes previous reading value, current reading value, billable usage, rate, pricing type, and override/replacement details when applicable

#### Scenario: Prevent duplicate invoices
- **WHEN** a non-void invoice already exists for a contract in a billing period
- **THEN** issuing again does not create a duplicate non-void invoice

#### Scenario: Missing input blocks issue
- **WHEN** a required reading, rate, or supported pricing rule is missing
- **THEN** the system blocks issue and shows the blocking reason

### Requirement: Collect invoice payments
The system SHALL record monthly collection against invoices. New payments SHALL settle the invoice in full; existing partial-paid invoices created before this change SHALL continue to render correctly until closed.

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
The system SHALL support billing corrections without silently mutating issued financial history. Adjustment-on-paid-invoice is removed from the workspace UI in favor of void+reissue when the invoice is unpaid, undo+void+reissue when the invoice is paid in an open period, or a manual line item on a future invoice.

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
- **THEN** the user MAY undo the payment, void the invoice, correct source data, and reissue plus record payment again
- **AND** all events share a single `correlation_id` in the audit log

#### Scenario: Paid invoice correction in next period
- **WHEN** the user opts not to undo and instead handles the difference in the next period
- **THEN** the user adds a manual line item on a future invoice; the workspace does not expose a separate adjustment action

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
- **THEN** all edit actions in the workspace are disabled: reading edits, override, issue, pay, undo, void, and manual line items

#### Scenario: Reopen requires reason
- **WHEN** a user with reopen permission reopens a closed period
- **THEN** the system requires a `reason` of at least 10 characters
- **AND** appends a `period.reopened` audit event with reason and actor

### Requirement: Issued invoice printing belongs to collection workflow
The monthly workspace SHALL expose invoice printing in **Thu tiền & công nợ** and SHALL NOT expose printing from the **Soạn kỳ** draft grid.

#### Scenario: Draft composition has no print action
- **WHEN** the operator is entering readings or reviewing draft rows in **Soạn kỳ**
- **THEN** no invoice print action or print-specific selection label is shown

#### Scenario: Collection tab supports single print
- **WHEN** the operator opens the drawer for an active invoice in **Thu tiền & công nợ**
- **THEN** the drawer provides **In phiếu** using the shared invoice print route

#### Scenario: Collection tab supports bulk print
- **WHEN** the operator selects active invoices, including in a closed period
- **THEN** the sticky action bar allows the selected invoices to be printed

#### Scenario: Mixed selection cannot be bulk paid
- **WHEN** the print selection includes a paid invoice or another invoice ineligible for bulk payment
- **THEN** **In phiếu** remains available
- **AND** **Ghi thu hàng loạt** is disabled with eligibility guidance

### Requirement: Billing audit history
The system SHALL append audit events for billing-critical workspace actions with structured, queryable metadata supporting before/after diffs and correlation grouping, including print-dialog intent for issued invoice artifacts initiated from invoice surfaces.

#### Scenario: Period action audited
- **WHEN** a billing period is opened, status-changed, closed, or reopened
- **THEN** the system appends a billing audit event with actor, action, period, timestamp, and `metadata.trigger` of `manual`, `auto_from_issue`, or `auto_from_payment`

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
- **THEN** the system appends one parent `payments.bulk_recorded` event and N child `invoice.payment_recorded` events sharing the parent's `correlation_id`

#### Scenario: Auto-issue + payment shares correlation
- **WHEN** the user triggers auto-issue-on-payment on a draft row
- **THEN** the resulting `invoices.issued` event and `invoice.payment_recorded` event share one `correlation_id`

#### Scenario: Print dialog intent audited
- **WHEN** an operator presses **In ngay** for one or more active invoices from an invoice surface
- **THEN** the system appends one `invoice.printed` event per invoice with actor, invoice ID, corresponding period ID, timestamp, and a shared batch correlation ID

### Requirement: Auto-issue on payment
The system SHALL support a single atomic operation that issues a draft invoice and records its full payment in the same transaction.

#### Scenario: Ready draft can be issued and paid in one step
- **WHEN** a user triggers "Đã thu" on a draft row whose status is `ready`
- **THEN** the system creates the invoice, creates the payment for full balance, updates invoice to `paid`, and emits both audit events sharing a `correlation_id`
- **AND** the operation is all-or-nothing

#### Scenario: Blocker prevents auto-issue
- **WHEN** the row has a blocker such as missing reading or missing rate
- **THEN** the "Đã thu" action is disabled until the blocker is resolved

#### Scenario: Concurrent auto-issue and bulk issue
- **WHEN** another transaction has already issued an invoice for the same contract and period
- **THEN** the auto-issue+pay operation fails cleanly with a conflict error and no duplicate invoice is created

#### Scenario: Payment input validation
- **WHEN** the user submits the auto-issue payment modal
- **THEN** the system requires payment date, payment method, and optional note; amount is auto-set to invoice balance and is not user-editable

#### Scenario: Failure rolls back atomically
- **WHEN** either the invoice insert or payment insert fails inside the RPC
- **THEN** neither row persists, period status does not change, and no audit events are appended

### Requirement: Period-level lock is the only edit boundary
The workspace SHALL enforce a single lock semantics: a period in status `closed` blocks all edit actions; any other status permits actions subject to per-action permission.

#### Scenario: Status closed blocks all edits
- **WHEN** the period status is `closed`
- **THEN** every edit action returns a uniform "kỳ đã chốt" error

#### Scenario: Status issued or collecting permits undo
- **WHEN** the period status is `issued` or `collecting`
- **THEN** payment undo, invoice void, and bulk operations remain available subject to permission

#### Scenario: Lock check centralized
- **WHEN** a service or UI component checks period editability
- **THEN** both call the same helper that returns true only when `period.status === 'closed'`

### Requirement: Design system adoption prerequisite
The monthly operations workspace implementation SHALL depend on the adopted operational design system. Implementation SHALL NOT begin billing UI construction until the design-system adoption change provides the required primitive coverage for compact controls, searchable selection, dense tables, operational sections, alerts, tabs, metrics, and contextual status badges.

#### Scenario: Design system adoption completed first
- **WHEN** implementation work is planned for the monthly operations workspace
- **THEN** `adopt-operational-design-system` is completed or its primitive requirements are otherwise available in the codebase first

#### Scenario: Billing UI does not fork primitives
- **WHEN** a monthly operations screen needs controls, tables, sections, modals, alerts, status badges, tabs, metrics, or searchable selection
- **THEN** it uses `app/components/ui/*` primitives instead of creating billing-only duplicate UI components

#### Scenario: Billing UI verification includes raw control scan
- **WHEN** monthly operations workspace implementation is complete
- **THEN** source scans confirm billing pages/components do not contain unexplained raw controls, raw tables, or raw alert blocks outside primitive internals
