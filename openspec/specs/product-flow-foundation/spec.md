## ADDED Requirements

### Requirement: Product flow foundation before billing workspace
The system SHALL provide a foundation change that aligns Core Data with the future Monthly Billing Workspace before any billing runtime features are introduced. This foundation SHALL cover building operational config, quick room setup, occupant / roommate modeling, contract commercial terms, meter device lifecycle design, and navigation alignment.

#### Scenario: Foundation scope is visible
- **WHEN** a developer reads the change specification
- **THEN** they can see that the change covers core-data alignment only and does not include utility reading entry, service fee CRUD, invoice generation, or payment tracking

#### Scenario: Room-centric billing is excluded
- **WHEN** a developer proposes adding billing actions to Room detail as part of this foundation
- **THEN** the specification states that Room detail remains a master data screen and billing work is deferred to the workspace model

### Requirement: Building operational config
The system SHALL allow a Building to store operational configuration values including owner/contact metadata, electricity pricing type, default electricity rate, water pricing type, default water rate, default service fees, meter reading day, billing generation day, payment due day, and grace period days.

#### Scenario: Building config can be persisted
- **WHEN** an admin creates or updates a building with valid operational config fields
- **THEN** the building retains those values as part of its master configuration

#### Scenario: Invalid schedule values are rejected
- **WHEN** a user submits meter reading day, billing generation day, or payment due day outside 1..31, or a negative grace period
- **THEN** the request is rejected as invalid

### Requirement: Quick room setup workflow
The system SHALL support creating multiple rooms as part of the building creation workflow. The workflow SHALL support room code generation, preview before submit, duplicate room code validation, and batch creation.

#### Scenario: Preview rooms before creation
- **WHEN** an admin enters room count and a room code prefix
- **THEN** the system shows a preview of the room list before the create request is submitted

#### Scenario: Duplicate room code is blocked
- **WHEN** the generated room codes contain a duplicate within the same building
- **THEN** the workflow prevents submission and surfaces a validation error

### Requirement: Occupant and roommate model
The system SHALL support a contract-level occupant model that distinguishes a primary tenant from roommates / occupants. The model SHALL preserve move-in and move-out history and SHALL support a billing-counted flag for occupancy-based charges.

#### Scenario: Primary tenant and roommates are distinct
- **WHEN** a contract has one primary tenant and additional occupants
- **THEN** the system can represent the primary tenant separately from the roommate / occupant list

#### Scenario: Move-out history is preserved
- **WHEN** an occupant leaves the room
- **THEN** the occupant record retains a move-out date rather than being deleted

### Requirement: Contract commercial terms alignment
The system SHALL treat Contract as the source of truth for commercial billing terms. A contract SHALL include primary tenant reference, room reference, building reference, start date, end date, monthly rent, deposit amount, status, occupant count, discount amount, surcharge amount, and notes.

#### Scenario: Contract stores commercial truth
- **WHEN** an admin creates or updates a contract with valid commercial terms
- **THEN** the contract persists those values and they can be used as the billing source of truth later

#### Scenario: Room defaults remain fallback only
- **WHEN** a room has a default rent that differs from the contract rent
- **THEN** the contract rent takes precedence for billing-related decisions

### Requirement: Meter device lifecycle design
The system SHALL define meter device lifecycle metadata for electricity and water meters, including active, replaced, broken, and inactive states, and SHALL preserve old meter history when a meter is replaced.

#### Scenario: Meter replacement preserves history
- **WHEN** a meter is replaced
- **THEN** the old meter remains recorded with an end reading or removed timestamp and the new meter starts a fresh lifecycle

#### Scenario: Old readings are not overwritten
- **WHEN** a new meter is installed in place of an old one
- **THEN** historical readings for the old meter remain queryable

### Requirement: Operations navigation placeholder
The system SHALL expose an Operations navigation group with a Monthly Billing placeholder route. The placeholder route SHALL communicate that billing execution is workspace-scoped and not room-centric.

#### Scenario: Operations nav is visible
- **WHEN** an admin opens the main shell
- **THEN** the navigation includes an Operations section with a Monthly Billing entry

#### Scenario: Monthly Billing is a placeholder only
- **WHEN** a user navigates to the Monthly Billing placeholder route
- **THEN** the page explains that billing work will happen inside a workspace scoped by building and period