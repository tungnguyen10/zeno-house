## Purpose

Recording and managing contract-level payments (deposit, prepaid rent, rent, other). Payments are nested under a contract and support period coverage for prepaid rent scenarios.

## Requirements

### Requirement: Contract payment recording
The system SHALL allow recording payments against a contract. A payment SHALL include: type (`deposit` | `prepaid_rent` | `rent` | `other`), amount (positive number), paid_at date, optional payment_method, optional note, and optional period coverage (`covered_period_start`, `covered_period_end` in YYYY-MM format) for prepaid rent.

#### Scenario: Deposit recorded
- **WHEN** admin records a deposit payment
- **THEN** payment persisted with type `deposit`, amount, and paid_at date

#### Scenario: Prepaid rent recorded with period coverage
- **WHEN** admin records prepaid rent covering multiple months
- **THEN** payment persisted with type `prepaid_rent`, amount, covered_period_start, covered_period_end

#### Scenario: Payment list retrievable
- **WHEN** admin views a contract
- **THEN** all payments returned in reverse-chronological order (newest first)

#### Scenario: Invalid payment type rejected
- **WHEN** payment submitted with type outside (deposit, prepaid_rent, rent, other)
- **THEN** request rejected with VALIDATION_ERROR

#### Scenario: Non-positive amount rejected
- **WHEN** payment submitted with amount ≤ 0
- **THEN** request rejected with VALIDATION_ERROR
