## Purpose

Define monthly operations report expense-category and fixed-cost management behavior.

## Requirements

### Requirement: Extended expense categories
The system SHALL support the expense categories `insurance`, `bank_fee`, and `fire_safety` in addition to the existing categories.

#### Scenario: Create expense with a new category
- **WHEN** an authorized user creates a building expense with category `insurance`, `bank_fee`, or `fire_safety`
- **THEN** the system accepts and stores it and the report groups it under that category with a Vietnamese label

#### Scenario: Category enum shared across boundaries
- **WHEN** an expense is validated on the client and the server
- **THEN** both use the same category enum including the new values, and the database CHECK constraint accepts them

### Requirement: Fixed-cost management in building settings
The system SHALL manage building fixed costs from building settings rather than the operations report page.

#### Scenario: Manage fixed costs in settings
- **WHEN** a user with `building-fixed-costs.write` opens `/buildings/[id]/settings`
- **THEN** they can create a fixed cost, end an existing fixed cost with an effective-to period, and view fixed-cost history for that building

#### Scenario: Settings management requires capability
- **WHEN** a user without `building-fixed-costs.write` opens building settings
- **THEN** the fixed-cost management controls are not available to them

#### Scenario: Fixed-cost label can be typed or selected
- **WHEN** an authorized user configures a fixed cost with a typed label or a suggested label
- **THEN** the system stores that label in the existing fixed-cost note field without requiring a schema migration

### Requirement: Read-only fixed costs in operations report
The system SHALL show applicable fixed costs on the operations report without inline management controls.

#### Scenario: Report shows fixed costs read-only
- **WHEN** a user views the operations report for a building/month
- **THEN** the report displays the fixed costs applicable to that period without create or edit controls

### Requirement: Prepaid contribution to report totals
The system SHALL include active prepaid monthly allocation in operations report totals and expose it as a distinct breakdown.

#### Scenario: Total expense includes prepaid
- **WHEN** the operations report is generated for a month with an active prepaid window
- **THEN** the report's total expense and profit figures include the prepaid monthly allocation alongside fixed costs and one-off expenses

#### Scenario: Prepaid breakdown returned
- **WHEN** the report DTO is produced
- **THEN** it includes a prepaid section listing contributing prepaid items and their monthly amounts

#### Scenario: Export includes prepaid
- **WHEN** the operations report is exported to Excel for a month with active prepaid allocation
- **THEN** the workbook includes the prepaid section consistent with the on-screen report

### Requirement: One-off expense label entry
The system SHALL let authorized users choose a suggested label or type a custom label for one-off building expenses while keeping category as the controlled reporting dimension.

#### Scenario: Expense label stored in note
- **WHEN** an authorized user creates or updates a one-off building expense with a typed or selected label
- **THEN** the system stores the label in the existing expense note field and preserves the selected category for report grouping

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

### Requirement: Operations report period closure
The system SHALL maintain a close state for each building/month operations report independent of billing period status.

#### Scenario: Report returns closure state
- **WHEN** the monthly operations report is fetched for a building/month
- **THEN** the response includes the report closure status, and missing closure rows are treated as open

#### Scenario: Admin closes report
- **WHEN** an admin closes a building/month operations report
- **THEN** the system marks that report period closed and refreshes the monthly reserve accrual from latest operations profit

#### Scenario: Admin reopens report
- **WHEN** an admin reopens a closed operations report with a reason
- **THEN** the system marks the report period open and allows normal authorized expense edits again

#### Scenario: Non-admin cannot close report
- **WHEN** an owner or manager attempts to close, reopen, or refresh the report accrual
- **THEN** the system rejects the action with a forbidden error

#### Scenario: Closed report locks report inputs
- **WHEN** a report period is closed
- **THEN** expense mutations and configuration changes that affect that building/month are blocked until admin reopens the report

#### Scenario: Auto-close report at month end
- **WHEN** the internal auto-close task runs on the last day of a month in `Asia/Ho_Chi_Minh`
- **THEN** active building reports for that month are closed and reserve accruals are refreshed

#### Scenario: Auto-close skips non-month-end days
- **WHEN** the internal auto-close task runs on any day that is not the last day of the month in `Asia/Ho_Chi_Minh`
- **THEN** it does not close any operations report period

#### Scenario: Report close does not close billing
- **WHEN** an operations report is manually closed, manually reopened, or auto-closed
- **THEN** no billing period is automatically closed or reopened
