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

### Requirement: Atomic contract renewal
The system SHALL commit a renewal in a single database transaction. Contract dates are inclusive: a successor contract starts the day after the previous contract's `end_date`. Each renewal request carries an `operation_id` so retries are idempotent.

#### Scenario: Successor carries occupants, services, and held money
- **WHEN** admin renews with mode `new_contract`
- **THEN** open occupancies of the old contract are closed at its `end_date`; the successor starts on `end_date + 1` with the same occupants and services; checkout sources with a positive balance move to the successor; scheduled amendments of the old contract are cancelled; all changes are audited under one correlation id

#### Scenario: Failure leaves the contract unchanged
- **WHEN** any step of a renewal fails
- **THEN** the original contract, occupancies, services, and sources are unchanged and no successor exists

#### Scenario: Retry replays the stored result
- **WHEN** a renewal is submitted again with the same `operation_id` and the same terms
- **THEN** the stored result is returned without creating another renewal, contract, or audit event

#### Scenario: Reused operation id with different terms
- **WHEN** a renewal is submitted with an `operation_id` already used for different terms
- **THEN** the request is rejected with CONFLICT

#### Scenario: Concurrent renewals
- **WHEN** two renewals for the same contract run concurrently
- **THEN** exactly one succeeds and the other is rejected with CONFLICT

#### Scenario: Contract with a checkout cannot be renewed
- **WHEN** admin renews a contract that has a checkout record
- **THEN** request rejected with CONFLICT

#### Scenario: Receipts on a renewed contract are locked
- **WHEN** a payment receipt is created, updated, or deleted on a `renewed` contract
- **THEN** the request is rejected with CONFLICT

### Requirement: Contract renewal history
The system SHALL record each renewal event in a `contract_renewals` log with old/new end date, old/new rent, mode, and optional reason.

#### Scenario: Renewal history retrievable
- **WHEN** admin views a contract's renewal history
- **THEN** all renewal log entries returned in reverse-chronological order (newest first)
