## Purpose

Define per-building reserve funds, their transaction ledger, and the link between reserve withdrawals and building expenses.

## Requirements

### Requirement: Building reserve rate history
The system SHALL let authorized users configure a per-building reserve rate with period-based effective history.

#### Scenario: Create effective reserve rate
- **WHEN** an authorized user creates a reserve rate for a building with an effective-from year/month
- **THEN** the system stores the rate for that building and applies it to matching future reserve accruals

#### Scenario: Reject overlapping reserve rates
- **WHEN** an authorized user creates or updates a reserve rate whose effective period overlaps another rate for the same building
- **THEN** the system rejects the change with a conflict error

#### Scenario: Rate settings require capability and scope
- **WHEN** a user without reserve-fund management capability or building scope attempts to manage reserve rates
- **THEN** the system responds with a forbidden error

### Requirement: Reserve fund balance
The system SHALL maintain a per-building reserve fund whose balance is derived from non-void reserve fund transactions.

#### Scenario: Balance derived from transactions
- **WHEN** an authorized in-scope user views a building's reserve fund
- **THEN** the system returns a balance equal to monthly accrual transactions minus active expense deduction transactions

#### Scenario: Balance may be negative
- **WHEN** active expense deductions exceed monthly accruals
- **THEN** the system returns a negative reserve fund balance instead of rejecting the state

#### Scenario: Read requires capability
- **WHEN** a user without `reserve-fund.read` requests fund data
- **THEN** the system responds with a forbidden error

#### Scenario: Managers excluded
- **WHEN** a manager attempts to view or manage reserve funds
- **THEN** the system responds with a forbidden error and the UI does not present the fund

#### Scenario: Fund limited to assigned buildings
- **WHEN** a non-admin user accesses the reserve fund for a building outside their assignment scope
- **THEN** the system responds with a forbidden error

### Requirement: Reserve fund transactions
The system SHALL record reserve fund changes as automatic monthly accrual transactions and linked expense deduction transactions.

#### Scenario: Monthly accrual increases balance
- **WHEN** a billing period, operations report close, auto-close, or admin refresh records accrual for a building with an effective reserve rate
- **THEN** the system records one monthly accrual transaction for that building/month based on non-negative operations profit and the effective rate

#### Scenario: Monthly accrual is idempotent
- **WHEN** close processing runs more than once for the same building/month
- **THEN** the system updates the existing monthly accrual transaction instead of creating a duplicate

#### Scenario: Expense deduction decreases balance
- **WHEN** an authorized user creates a building expense with `funded_by = reserve_fund`
- **THEN** the system records a linked expense deduction transaction and decreases the derived balance by the expense amount

#### Scenario: Manual movements are not supported
- **WHEN** a user views reserve fund controls
- **THEN** the system does not present manual deposit or manual withdrawal actions

#### Scenario: Admin refreshes monthly accrual
- **WHEN** an admin refreshes reserve accrual for a building/month
- **THEN** the system recalculates and upserts that month’s `monthly_accrual` transaction without creating a manual movement

#### Scenario: Refresh after expense changes
- **WHEN** report-affecting expenses change after billing close for a building/month
- **THEN** an admin refresh recalculates the latest formula-derived monthly accrual for that same building/month

#### Scenario: Refresh does not accept typed amount
- **WHEN** an admin refreshes reserve accrual
- **THEN** the request accepts only the target period and never accepts a user-entered transaction amount

#### Scenario: Non-admin refresh denied
- **WHEN** an owner or manager attempts to refresh reserve accrual
- **THEN** the system responds with a forbidden error

### Requirement: Expense funded from reserve
The system SHALL let an expense be marked as deducted from the reserve fund without requiring available balance.

#### Scenario: Pay an expense from reserve
- **WHEN** an authorized user creates an expense with `funded_by = reserve_fund`
- **THEN** the system creates the expense and a linked reserve deduction transaction together

#### Scenario: Insufficient balance is allowed
- **WHEN** a reserve-funded expense would make the monthly or cumulative reserve balance negative
- **THEN** the system stores the expense and linked deduction successfully

#### Scenario: Update keeps deduction in sync
- **WHEN** an authorized user updates the amount, period, date, or funding source of a reserve-funded expense
- **THEN** the system updates or voids the linked deduction so reserve totals match the active expense state

#### Scenario: Void removes deduction from active balance
- **WHEN** an authorized user voids a reserve-funded expense
- **THEN** the system voids the linked deduction so the voided expense no longer reduces reserve balance

#### Scenario: Reserve option is not balance-gated
- **WHEN** the building's reserve balance is zero or negative
- **THEN** the expense form can still offer marking the expense as deducted from the reserve
