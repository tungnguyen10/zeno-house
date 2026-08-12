## ADDED Requirements

### Requirement: Incidental charges are scoped to one contract and billing period
The system SHALL store zero or more positive incidental charges for a contract in a billing period and SHALL NOT copy those charges to any other period.

#### Scenario: Multiple charges in one room period
- **WHEN** an authorized operator creates two valid incidental charges for the same contract and period
- **THEN** both rows are stored independently and appear only in that contract's draft for that period

#### Scenario: Invalid charge amount
- **WHEN** an operator submits an amount that is zero, negative, fractional, or outside the supported currency range
- **THEN** the system rejects the write and persists no source row or audit event

### Requirement: Incidental charge writes are controlled financial operations
The system SHALL require `billing.write`, building scope, matching period/contract/room ownership, create idempotency, optimistic update/delete versions, and atomic audit persistence.

#### Scenario: Create retry is idempotent
- **WHEN** the same authorized operator retries an identical create request with the same `operation_id`
- **THEN** the original row is returned and no duplicate source row or audit event is created

#### Scenario: Stale update is rejected
- **WHEN** an update or delete supplies an `expected_updated_at` older than the stored row
- **THEN** the operation returns a conflict and persists no data or audit change

#### Scenario: Out-of-scope contract is hidden
- **WHEN** a scoped operator targets a contract outside their assigned buildings or mismatched with the period building
- **THEN** the operation is rejected without disclosing inaccessible resource details

### Requirement: Incidental charges lock with billing state
The system SHALL allow mutation only while the period is not closed and the target contract has no non-void invoice in that period.

#### Scenario: Effective invoice locks source charge
- **WHEN** the target contract has an issued, partial, paid, or overdue invoice in the period
- **THEN** create, update, and delete are rejected and existing charges remain readable

#### Scenario: Voided invoice permits draft changes
- **WHEN** every invoice for the target contract and period is void
- **THEN** an authorized operator can create, update, or delete incidental charges before reissue

#### Scenario: Closed period locks source charge
- **WHEN** the billing period status is `closed`
- **THEN** create, update, and delete are rejected

### Requirement: Incidental charges become authoritative billing lines
Each incidental source row SHALL become one `incidental` draft line and one immutable invoice charge when issued, without changing the recurring contract surcharge aggregate.

#### Scenario: Draft includes incidental charge
- **WHEN** a draft is calculated for a contract with an incidental charge in that period
- **THEN** the line is included at full value in subtotal and total with no proration

#### Scenario: Contract surcharge remains independent
- **WHEN** a contract has both recurring surcharge and an incidental charge
- **THEN** the draft contains separate `surcharge` and `incidental` lines and `surcharge_amount` contains only the recurring surcharge

#### Scenario: Preview becomes stale after source mutation
- **WHEN** an incidental charge changes after issue preview is generated
- **THEN** issue with the earlier snapshot hash is rejected without creating an invoice
