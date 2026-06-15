## Purpose

Contract renewal lifecycle — supporting both in-place extension (extend end date) and full successor contract creation. Renewal history is maintained in a `contract_renewals` log.

## Requirements

### Requirement: Contract renewal via extension
The system SHALL support extending a contract's end date in-place. The original end date is preserved in `original_end_date`. A renewal log entry is created recording old and new end dates.

#### Scenario: Simple renewal extends end date
- **WHEN** admin submits renewal with mode `extend` and a new end date after the current one
- **THEN** contract `end_date` updated, `renewal_count` incremented, `original_end_date` set if not already set, and a `contract_renewals` log entry created

#### Scenario: New end date must be after current end date
- **WHEN** admin submits renewal with new end date ≤ current end date
- **THEN** request rejected with VALIDATION_ERROR

### Requirement: Contract renewal via new contract
The system SHALL support creating a successor contract when terms change significantly. The old contract is marked `renewed`. The new contract references the old via `previous_contract_id`.

#### Scenario: Full renewal creates successor contract
- **WHEN** admin submits renewal with mode `new_contract` and new terms
- **THEN** new contract created with `previous_contract_id` pointing to old contract; old contract status set to `renewed`; `contract_renewals` log entry created

#### Scenario: Renewed contract cannot be renewed again
- **WHEN** admin attempts to renew a contract with status `renewed`
- **THEN** request rejected with CONFLICT

### Requirement: Contract renewal history
The system SHALL record each renewal event in a `contract_renewals` log with old/new end date, old/new rent, mode, and optional reason.

#### Scenario: Renewal history retrievable
- **WHEN** admin views a contract's renewal history
- **THEN** all renewal log entries returned in reverse-chronological order (newest first)
