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
