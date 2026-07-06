## Purpose

Define per-building reserve funds, their transaction ledger, and the link between reserve withdrawals and building expenses.

## Requirements

### Requirement: Reserve fund balance
The system SHALL maintain a per-building reserve fund whose balance is derived from its transactions.

#### Scenario: Balance derived from transactions
- **WHEN** an authorized in-scope user views a building's reserve fund
- **THEN** the system returns a balance equal to the sum of deposits minus the sum of withdrawals

#### Scenario: Read requires capability
- **WHEN** a user without `reserve-fund.read` requests fund data
- **THEN** the system responds with a forbidden error

#### Scenario: Managers excluded
- **WHEN** a manager attempts to view or move reserve funds
- **THEN** the system responds with a forbidden error and the UI does not present the fund

#### Scenario: Fund limited to assigned buildings
- **WHEN** a non-admin user accesses the reserve fund for a building outside their assignment scope
- **THEN** the system responds with a forbidden error

### Requirement: Reserve fund transactions
The system SHALL record manual deposits and withdrawals and prevent a negative balance.

#### Scenario: Deposit increases balance
- **WHEN** an authorized user with `reserve-fund.deposit` records a deposit with a positive amount and date
- **THEN** the system stores a deposit transaction and the balance increases by that amount

#### Scenario: Withdrawal decreases balance
- **WHEN** an authorized user with `reserve-fund.withdraw` records a withdrawal within the available balance
- **THEN** the system stores a withdrawal transaction and the balance decreases by that amount

#### Scenario: Insufficient balance rejected
- **WHEN** a withdrawal would take the balance below zero
- **THEN** the system rejects it with a validation error and records no transaction

### Requirement: Expense funded from reserve
The system SHALL let an expense be paid from the reserve, linking the expense and the withdrawal.

#### Scenario: Pay an expense from reserve
- **WHEN** an authorized user creates an expense funded from the reserve within the available balance
- **THEN** the system creates the expense with `funded_by` = `reserve_fund` and a linked withdrawal transaction together, and the balance decreases by the expense amount

#### Scenario: Atomicity on failure
- **WHEN** creating a reserve-funded expense fails partway
- **THEN** the system leaves neither an orphan expense nor an orphan withdrawal

#### Scenario: Void restores balance
- **WHEN** an authorized user voids a reserve-funded expense
- **THEN** the system reverses or flags the linked withdrawal so the balance is corrected

#### Scenario: Reserve option only when funded
- **WHEN** the building's reserve balance is zero
- **THEN** the expense form does not offer paying from the reserve
