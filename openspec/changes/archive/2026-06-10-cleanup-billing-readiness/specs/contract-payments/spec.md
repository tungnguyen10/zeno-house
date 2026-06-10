## MODIFIED Requirements

### Requirement: Contract payment recording
The system SHALL allow recording contract-level payments for pre-invoice financial events. Contract-level payments SHALL support deposit and prepaid rent records. Existing `rent` and `other` payment types may remain for backward compatibility until invoice settlement exists, but they SHALL NOT be treated as the future source of truth for monthly invoice settlement.

#### Scenario: Deposit recorded
- **WHEN** admin records a deposit payment
- **THEN** payment is persisted with type `deposit`, amount, and paid_at date

#### Scenario: Prepaid rent recorded with period coverage
- **WHEN** admin records prepaid rent covering multiple months
- **THEN** payment is persisted with type `prepaid_rent`, amount, covered_period_start, covered_period_end

#### Scenario: Monthly settlement boundary is explicit
- **WHEN** a developer implements monthly invoice collection
- **THEN** the implementation uses invoice-level payment allocation instead of relying on contract-level `rent` payments as the financial source of truth

#### Scenario: Legacy rent payment remains readable
- **WHEN** a contract has an existing payment with type `rent`
- **THEN** it remains retrievable in the contract payment list for compatibility

