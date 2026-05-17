## ADDED Requirements

### Requirement: Contract payment recording
The system SHALL allow recording contract-level payments against a contract. A payment SHALL include payment type, amount, payment date, optional payment method, optional note, and optional period coverage (covered_period_start, covered_period_end) for prepaid rent.

#### Scenario: Deposit is recorded
- **WHEN** an admin records a deposit payment for a contract
- **THEN** the payment is persisted with type `deposit`, amount, and paid_at date

#### Scenario: Prepaid rent is recorded with period coverage
- **WHEN** an admin records prepaid rent covering multiple months
- **THEN** the payment is persisted with type `prepaid_rent`, amount, covered_period_start, and covered_period_end in YYYY-MM format

#### Scenario: Payment list is retrievable
- **WHEN** an admin views a contract
- **THEN** all payments recorded against that contract are returned in reverse-chronological order (newest first)

#### Scenario: Invalid payment type is rejected
- **WHEN** a payment is submitted with a type not in (deposit, prepaid_rent, rent, other)
- **THEN** the request is rejected with VALIDATION_ERROR

#### Scenario: Negative amount is rejected
- **WHEN** a payment is submitted with amount less than or equal to zero
- **THEN** the request is rejected with VALIDATION_ERROR
