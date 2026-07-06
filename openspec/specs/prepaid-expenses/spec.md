## Purpose

Define building-scoped prepaid expense records and their monthly allocation behavior.

## Requirements

### Requirement: Prepaid expense records
The system SHALL store building-scoped prepaid expenses that spread a total amount evenly across a number of months.

#### Scenario: Create a prepaid expense
- **WHEN** an authorized in-scope user creates a prepaid expense with name, category, total amount, total months (>= 1), and start date
- **THEN** the system stores it with a computed end date, a computed even monthly amount, and status `active`

#### Scenario: Name can be typed or selected
- **WHEN** an authorized user creates or updates a prepaid expense with a typed name or a suggested name
- **THEN** the system stores that value in the existing prepaid expense name field

#### Scenario: Rounding preserved
- **WHEN** the total amount does not divide evenly across the months
- **THEN** the sum of all monthly allocations equals the total amount, with the remainder absorbed in the final covered month

#### Scenario: Automatic expiry
- **WHEN** the current date is after a prepaid expense's end date
- **THEN** the system treats it as `expired` and it no longer contributes to new periods

#### Scenario: Configuration requires capability
- **WHEN** a user without `prepaid-expenses.write` attempts to create, edit, or delete a prepaid expense
- **THEN** the system responds with a forbidden error

#### Scenario: Prepaid limited to assigned buildings
- **WHEN** a non-admin user manages a prepaid expense for a building outside their assignment scope
- **THEN** the system responds with a forbidden error

### Requirement: Prepaid monthly allocation in reports
The system SHALL contribute active prepaid monthly allocations to the operations report for covered months.

#### Scenario: Allocation contributes to a covered month
- **WHEN** the operations report is generated for a building/month covered by an active prepaid window
- **THEN** the report includes that prepaid's monthly allocation in the total expense and in both profit calculations

#### Scenario: Prepaid shown as its own section
- **WHEN** the report is generated
- **THEN** it returns a prepaid breakdown listing each contributing prepaid item and its monthly amount, separate from one-off expenses and fixed costs

#### Scenario: Out-of-window prepaid excluded
- **WHEN** a prepaid window does not cover the selected month
- **THEN** its allocation is excluded from that month's report
