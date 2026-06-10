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

### Requirement: Issue invoices
The system SHALL persist issued invoices as snapshots.

#### Scenario: Issue valid invoices
- **WHEN** all required billing inputs are valid and the user issues invoices
- **THEN** the system creates `invoices` and `invoice_charges` rows for the period
- **AND** those persisted rows become the source of truth for the issued amount

#### Scenario: Prevent duplicate invoices
- **WHEN** an invoice already exists for a contract in a billing period
- **THEN** issuing again does not create a duplicate invoice

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

