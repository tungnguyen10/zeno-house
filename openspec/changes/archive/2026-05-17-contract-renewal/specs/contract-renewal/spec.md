## ADDED Requirements

### Requirement: Contract renewal via extension
The system SHALL support extending a contract's end date in-place (simple renewal). The original end date SHALL be preserved in `original_end_date`. A renewal log entry SHALL be created recording the old and new end dates.

#### Scenario: Simple renewal extends end date
- **WHEN** an admin submits a renewal with mode `extend` and a new end date
- **THEN** the contract's `end_date` is updated, `renewal_count` is incremented, `original_end_date` is set if not already set, and a `contract_renewals` log entry is created

#### Scenario: New end date must be after current end date
- **WHEN** an admin submits a renewal with a new end date earlier than or equal to the current end date
- **THEN** the request is rejected with VALIDATION_ERROR

### Requirement: Contract renewal via new contract
The system SHALL support creating a successor contract when terms change significantly. The old contract SHALL be marked `renewed`. The new contract SHALL reference the old contract via `previous_contract_id`.

#### Scenario: Full renewal creates successor contract
- **WHEN** an admin submits a renewal with mode `new_contract` and new terms
- **THEN** a new contract is created with `previous_contract_id` pointing to the old contract, the old contract status becomes `renewed`, and a `contract_renewals` log entry is created

#### Scenario: Renewed contract cannot be renewed again
- **WHEN** an admin attempts to renew a contract with status `renewed`
- **THEN** the request is rejected with CONFLICT

### Requirement: Contract renewal history
The system SHALL maintain a `contract_renewals` log that records each renewal event with old end date, new end date, old rent, new rent, mode, and optional reason.

#### Scenario: Renewal history is retrievable
- **WHEN** an admin views a contract's renewal history
- **THEN** all renewal log entries for that contract are returned in reverse-chronological order (newest first)
