## ADDED Requirements

### Requirement: Held funds and protected allocations
Held deposits SHALL derive only from actual deposit receipts less allocations and refunds. Explicitly approved other source funds SHALL remain distinguishable. Allocated sources SHALL NOT be edited or deleted directly.

#### Scenario: Prepaid rent is not deposit
- **WHEN** a contract has both deposit and prepaid-rent receipts
- **THEN** the displayed held deposit includes only deposit receipts and prepaid funds require explicit source approval before settlement use
