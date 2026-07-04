## ADDED Requirements

### Requirement: Expense funding source
The system SHALL mark whether a building expense was paid directly or from the reserve fund.

#### Scenario: Default funding is direct
- **WHEN** an expense is created without specifying a funding source
- **THEN** the system stores `funded_by` = `direct`

#### Scenario: Reserve-funded expense marked in report
- **WHEN** an expense funded from the reserve appears in the operations report
- **THEN** the report marks it as reserve-funded while still counting it as a building expense

### Requirement: Reserve fund surfaced with the report
The system SHALL surface reserve fund balance and history alongside the operations report for authorized users.

#### Scenario: Fund panel shown to authorized users
- **WHEN** a user with `reserve-fund.read` views the operations report for a building
- **THEN** the page shows the current reserve balance and recent transactions

#### Scenario: Fund panel hidden without capability
- **WHEN** a user without `reserve-fund.read` views the operations report
- **THEN** the reserve fund panel is not shown
