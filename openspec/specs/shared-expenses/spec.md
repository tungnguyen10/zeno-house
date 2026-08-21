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

#### Scenario: List includes allocation status for the selected period
- **WHEN** an authorized user lists shared expenses with a valid `period_year` and `period_month`
- **THEN** the response includes the requested period metadata and an `isAllocatedForPeriod` flag for every definition

#### Scenario: List period is required
- **WHEN** an authorized user lists shared expenses without a valid year or month
- **THEN** the system rejects the request with a validation error

#### Scenario: Inactive definitions remain visible
- **WHEN** a shared expense has been deactivated
- **THEN** it remains in the list with inactive lifecycle status and can be reactivated by an authorized user

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

#### Scenario: Allocation is previewed before confirmation
- **WHEN** an authorized user starts allocation for an active, unallocated shared expense
- **THEN** the UI shows the selected period, total amount, every member building's share, and any rounding remainder before submission

#### Scenario: Allocation result remains visible
- **WHEN** allocation succeeds
- **THEN** the confirmation workflow shows the generated expense count and per-building results returned by the API

#### Scenario: Allocation conflict stays in context
- **WHEN** allocation fails because the period is closed or already allocated
- **THEN** the modal remains open, shows the server error, and refreshes the period allocation status

### Requirement: Operational shared-expense workspace
The system SHALL present shared expenses as a period-aware, list-first workspace on desktop and mobile.

#### Scenario: Desktop list exposes primary and secondary actions
- **WHEN** an authorized user views the workspace on a desktop viewport
- **THEN** each row shows definition details, lifecycle status, selected-period allocation status, a primary allocation action, and secondary actions in an overflow menu

#### Scenario: Mobile list does not require horizontal scrolling
- **WHEN** an authorized user views the workspace below the medium breakpoint
- **THEN** the table is replaced by two-line mobile rows whose allocation and overflow actions remain visible without horizontal scrolling

#### Scenario: Definition workflows use focused modals
- **WHEN** an authorized user creates, edits, or deactivates a shared expense
- **THEN** the UI uses a focused modal workflow with inline form validation and explicit deactivate confirmation

### Requirement: Generated expenses behave normally
The system SHALL treat allocation-generated building expenses as ordinary expenses.

#### Scenario: Generated expense appears in the building report
- **WHEN** a shared expense is allocated for a period
- **THEN** each member building's operations report for that period includes its allocated share as a building expense

#### Scenario: Generated expense can be voided
- **WHEN** an authorized user voids a generated expense
- **THEN** it follows the standard soft-void behavior and is excluded from report totals
