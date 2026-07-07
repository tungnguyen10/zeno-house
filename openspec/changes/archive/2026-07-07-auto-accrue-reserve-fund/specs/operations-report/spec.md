## MODIFIED Requirements

### Requirement: Expense funding source
The system SHALL mark whether a building expense was paid directly or deducted from the reserve fund.

#### Scenario: Default funding is direct
- **WHEN** an expense is created without specifying a funding source
- **THEN** the system stores `funded_by` = `direct`

#### Scenario: Reserve-funded expense marked in report
- **WHEN** an expense funded from the reserve appears in the operations report
- **THEN** the report marks it as reserve-funded while still counting it as a building expense

#### Scenario: Reserve-funded expense can make reserve negative
- **WHEN** an authorized user creates a reserve-funded expense whose amount exceeds available reserve
- **THEN** the expense is stored and operations report shows a negative reserve balance when applicable

### Requirement: Reserve fund surfaced with the report
The system SHALL surface reserve fund accrual, deduction, monthly balance, and cumulative balance alongside the operations report for authorized users.

#### Scenario: Fund panel shown to authorized users
- **WHEN** a user with `reserve-fund.read` views the operations report for a building
- **THEN** the page shows the effective reserve rate, issued revenue, monthly accrual, monthly reserve deductions, monthly reserve balance, and cumulative reserve balance

#### Scenario: Fund panel hidden without capability
- **WHEN** a user without `reserve-fund.read` views the operations report
- **THEN** the reserve fund panel is not shown and the client does not request reserve fund details

#### Scenario: Manual movement controls removed
- **WHEN** an authorized user views the reserve fund panel
- **THEN** the panel does not show manual deposit or manual withdrawal controls

#### Scenario: Reserve totals follow active expenses
- **WHEN** a reserve-funded expense is voided
- **THEN** the operations report excludes that expense's deduction from reserve totals
