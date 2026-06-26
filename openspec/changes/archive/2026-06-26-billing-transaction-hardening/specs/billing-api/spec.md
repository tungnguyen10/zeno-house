## ADDED Requirements

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
