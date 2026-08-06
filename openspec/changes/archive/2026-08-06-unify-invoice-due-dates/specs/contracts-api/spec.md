## MODIFIED Requirements

### Requirement: Create contract endpoint
`POST /api/contracts` SHALL create a new contract and initial handover readings atomically using the existing validation and occupancy-conflict rules. Its optional due-day field SHALL be `payment_due_day` (smallint 1–31 or null), and responses SHALL expose `paymentDueDay`. Omitting the field SHALL mean inherit from building.

#### Scenario: Create with payment due day
- **WHEN** an admin submits valid contract data with `payment_due_day: 5`
- **THEN** the created contract stores the value and returns `paymentDueDay: 5`

#### Scenario: Create without payment due day
- **WHEN** an admin omits `payment_due_day`
- **THEN** the contract stores null and remains eligible for building inheritance

#### Scenario: Legacy field is rejected
- **WHEN** a caller supplies `payment_day` after the boundary rename
- **THEN** strict request validation rejects the unsupported field

#### Scenario: Existing atomic handover behavior remains
- **WHEN** a valid create request includes required handover readings
- **THEN** the contract and both readings commit together or all roll back on failure
