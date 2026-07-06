## Purpose

Define owner-scoped shared expenses that can be allocated into normal per-building operating expenses.

## Requirements

### Requirement: Shared expense definitions
The system SHALL let an owner define shared expenses that apply across multiple buildings the owner controls.

#### Scenario: Create a shared expense
- **WHEN** an owner creates a shared expense with name, category, amount, and a set of member buildings they control
- **THEN** the system stores the shared expense scoped to that owner with its building membership

#### Scenario: Name can be typed or selected
- **WHEN** an owner creates or updates a shared expense with a typed name or a suggested name
- **THEN** the system stores that value in the existing shared expense name field

#### Scenario: Membership limited to owned buildings
- **WHEN** an owner adds a building they do not control to a shared expense
- **THEN** the system rejects the request with a forbidden error

#### Scenario: Read and write require capability
- **WHEN** a user without `shared-expenses.read` or `shared-expenses.write` attempts the corresponding action
- **THEN** the system responds with a forbidden error

#### Scenario: Managers excluded
- **WHEN** a manager attempts to view or manage shared expenses
- **THEN** the system responds with a forbidden error and the UI does not present shared expenses

### Requirement: Even-split allocation
The system SHALL allocate a shared expense evenly across its member buildings for a chosen period by generating one building expense per building.

#### Scenario: Allocate a period
- **WHEN** an owner with `shared-expenses.allocate` allocates a shared expense for a period year/month
- **THEN** the system creates one building expense per member building for that period, each carrying an equal share of the amount and a shared-origin note

#### Scenario: Split preserves the total
- **WHEN** the amount does not divide evenly across the member buildings
- **THEN** the sum of the generated shares equals the shared expense amount, with the remainder absorbed in the last building

#### Scenario: Allocation re-checks building scope
- **WHEN** an owner allocates a shared expense whose membership includes a building outside their current scope
- **THEN** the system rejects the allocation with a forbidden error and generates no expenses

#### Scenario: Duplicate allocation guarded
- **WHEN** an owner allocates the same shared expense for a period that was already allocated
- **THEN** the system does not generate duplicate expenses and reports the conflict

### Requirement: Generated expenses behave normally
The system SHALL treat allocation-generated building expenses as ordinary expenses.

#### Scenario: Generated expense appears in the building report
- **WHEN** a shared expense is allocated for a period
- **THEN** each member building's operations report for that period includes its allocated share as a building expense

#### Scenario: Generated expense can be voided
- **WHEN** an authorized user voids a generated expense
- **THEN** it follows the standard soft-void behavior and is excluded from report totals
