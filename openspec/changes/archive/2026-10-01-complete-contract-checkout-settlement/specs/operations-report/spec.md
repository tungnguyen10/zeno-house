## ADDED Requirements

### Requirement: Non-cash settlement visibility
Reports SHALL distinguish fresh invoice cash receipts from deposit/credit allocations and actual refunds without treating deposit refunds as operating expense.

#### Scenario: Invoice paid from deposit
- **WHEN** settlement applies 650000 of held deposit to invoice balances
- **THEN** debt decreases by 650000 and collected cash does not increase, while electricity revenue remains in its invoice period
