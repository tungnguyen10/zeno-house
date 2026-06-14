## ADDED Requirements

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
The system SHALL record monthly collection against invoices.

#### Scenario: Record invoice payment
- **WHEN** a user records a payment for an issued invoice
- **THEN** the system creates an `invoice_payments` row
- **AND** updates the invoice paid amount, balance amount, and status

#### Scenario: Partial payment
- **WHEN** recorded payments are less than invoice total
- **THEN** invoice status becomes `partial` and remaining balance remains visible as debt

#### Scenario: Full payment
- **WHEN** recorded payments equal invoice total
- **THEN** invoice status becomes `paid`

### Requirement: Correct billing mistakes
The system SHALL support billing corrections without silently mutating issued financial history.

#### Scenario: Correct before issue
- **WHEN** a mistake is found before invoices are issued
- **THEN** the user can correct source data or utility usage override
- **AND** draft charges recalculate from corrected inputs

#### Scenario: Void and reissue unpaid invoice
- **WHEN** a mistake is found after issue and the invoice has no recorded payments
- **THEN** a privileged user can void the invoice with a reason
- **AND** issue a replacement invoice linked to the voided invoice

#### Scenario: Paid invoice correction becomes adjustment
- **WHEN** a mistake is found after payment has been recorded
- **THEN** the system does not mutate the original invoice totals
- **AND** the correction is represented as an adjustment charge on a current or future invoice

#### Scenario: Closed period correction
- **WHEN** a mistake is found after the period is closed
- **THEN** normal edits are blocked
- **AND** the correction requires explicit reopen permission or an adjustment in a later open period

#### Scenario: Correction audited
- **WHEN** an invoice is voided, reissued, or corrected by adjustment
- **THEN** the system appends billing audit events with actor, reason, affected invoice, and before/after data when applicable

### Requirement: Close billing period
The system SHALL allow a privileged user to close a billing period after review.

#### Scenario: Close period
- **WHEN** a user with `billing.close` closes an issued or collecting period
- **THEN** the period status becomes `closed`
- **AND** normal workspace edits for that period are locked

#### Scenario: Insufficient close permission
- **WHEN** a user without `billing.close` attempts to close a period
- **THEN** the system returns 403 FORBIDDEN

#### Scenario: Closed period lock
- **WHEN** a period is closed
- **THEN** normal invoice regeneration, invoice charge edits, and period reading edits are blocked from the workspace

### Requirement: Billing audit history
The system SHALL append audit events for billing-critical workspace actions.

#### Scenario: Period action audited
- **WHEN** a billing period is opened, status-changed, closed, or reopened
- **THEN** the system appends a billing audit event with actor, action, period, and timestamp

#### Scenario: Reading save audited
- **WHEN** readings are saved from the billing workspace
- **THEN** the system appends billing audit events that identify the affected period and reading entities

#### Scenario: Utility override audited
- **WHEN** a utility usage override is created or updated
- **THEN** the system appends a billing audit event with before/after data when applicable

#### Scenario: Invoice issue audited
- **WHEN** invoices are issued
- **THEN** the system appends billing audit events for the issue action and affected invoices

#### Scenario: Payment action audited
- **WHEN** invoice payment is recorded, corrected, or removed
- **THEN** the system appends billing audit events with before/after data when applicable

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
