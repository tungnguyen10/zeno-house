## MODIFIED Requirements

### Requirement: Issue invoices
The system SHALL review server-rendered draft documents before persisting issued invoice snapshots. Automatic mode SHALL display the resolved schedule on each document, and an explicit batch-override control SHALL allow one shared due date.

#### Scenario: Automatic preview
- **WHEN** the operator previews selected eligible rows without enabling a shared override
- **THEN** pending readings save first and the modal shows each server-calculated due date while keeping confirmation disabled until preview succeeds

#### Scenario: Shared override enabled
- **WHEN** the operator enables “Áp một hạn chung” and selects a valid date
- **THEN** the workspace reloads preview with `due_date_override` and identifies the override in the batch summary

#### Scenario: Shared override disabled
- **WHEN** the operator turns off the override
- **THEN** the workspace reloads automatic per-invoice schedules and removes the override from confirm payload

#### Scenario: Stale confirmation remains reviewable
- **WHEN** confirmation returns `409 CONFLICT`
- **THEN** the modal remains open, confirmation is disabled, and the operator is prompted to load and review current schedules

#### Scenario: Successful issue refreshes workspace
- **WHEN** the validated issue transaction succeeds
- **THEN** the modal closes, selection clears, and draft, overview, and invoice state refresh

#### Scenario: Existing issue protections remain
- **WHEN** a row is blocked or already has a non-void invoice
- **THEN** it remains excluded from issuance and no duplicate invoice is created
