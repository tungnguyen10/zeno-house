## ADDED Requirements

### Requirement: Issued invoice print eligibility
The system SHALL print only active issued invoices in status `issued`, `partial`, `paid`, or derived `overdue`, and SHALL reject invoices stored as `void`.

#### Scenario: Active invoice can be printed
- **WHEN** an authorized user requests an issued, partial, paid, or overdue invoice
- **THEN** the invoice is included in the print preview

#### Scenario: Void invoice is rejected
- **WHEN** a print request contains a void invoice
- **THEN** the whole request fails with a conflict and no partial preview is rendered

### Requirement: Invoice snapshot print data
The system SHALL build printable invoices from persisted invoice and charge snapshots while using the invoice's current paid and balance totals.

#### Scenario: Source configuration changed after issue
- **WHEN** pricing, service configuration, or readings change after an invoice was issued
- **THEN** the printed charge lines and charge total remain those persisted at issue time

#### Scenario: Payment state changed after issue
- **WHEN** payments change the invoice paid and balance totals
- **THEN** a newly loaded print preview shows the current paid and balance totals

### Requirement: Shared single and bulk print flow
The system SHALL provide one invoice-centric print route for single and bulk selections of 1 to 100 invoice UUIDs.

#### Scenario: Single invoice print
- **WHEN** the user chooses **In phiếu** from an active invoice drawer
- **THEN** the shared print route opens with that invoice selected

#### Scenario: Bulk invoice print
- **WHEN** the user selects up to 100 active invoices and chooses **In phiếu**
- **THEN** the shared print route renders every unique selected invoice in selection order

#### Scenario: Batch exceeds limit
- **WHEN** a selection contains more than 100 invoices
- **THEN** the UI rejects the action with guidance and the API rejects an equivalent request

### Requirement: Printable invoice artifact
The print route SHALL render a neutral monthly invoice document with invoice identity, period, building, room, tenant, issue and due dates, charge snapshot, total, paid amount, balance, and status.

#### Scenario: Print A4 output
- **WHEN** the user opens the native print dialog
- **THEN** application chrome is hidden, each invoice stays unbroken, and at most two invoice cards are placed on each A4 portrait page

#### Scenario: Print data cannot load
- **WHEN** permission, scope, status, or data validation fails
- **THEN** the print page shows the server error and disables **In ngay**

### Requirement: Print intent audit
The system SHALL append one `invoice.printed` audit event per selected invoice when the operator presses **In ngay**, using one shared correlation ID for the batch.

#### Scenario: Cross-period batch audited
- **WHEN** selected invoices belong to different billing periods
- **THEN** each event references its invoice and corresponding billing period while all events share one correlation ID

#### Scenario: Audit request fails
- **WHEN** the audit request fails after the user presses **In ngay**
- **THEN** the native print dialog still opens
- **AND** the audit action is documented as print-dialog intent rather than proof of completed output
