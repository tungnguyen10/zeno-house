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
