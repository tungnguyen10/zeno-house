## MODIFIED Requirements

### Requirement: Product flow foundation before billing workspace
The system SHALL provide a foundation change that aligns Core Data with the future Monthly Billing Workspace before any billing runtime features are introduced. This foundation SHALL cover building operational config, quick room setup, occupant / roommate modeling, contract commercial terms, simplified meter reading inputs, and navigation alignment.

#### Scenario: Foundation scope is visible
- **WHEN** a developer reads the change specification
- **THEN** they can see that the change covers core-data alignment only and does not include invoice generation, payment allocation, debt tracking, tenant portal, or automation

#### Scenario: Room-centric billing is excluded
- **WHEN** a developer proposes adding billing actions to Room detail as part of this foundation
- **THEN** the specification states that Room detail remains a master data / occupancy screen and billing work is deferred to the workspace model

### Requirement: Simplified meter reading foundation
The system SHALL treat electricity and water readings as room-scoped readings identified by `(room_id, meter_type, period_year, period_month, reading_type)`. The foundation SHALL NOT require a `meter_devices` lifecycle abstraction.

#### Scenario: Meter device lifecycle is not required
- **WHEN** a developer implements monthly or handover readings
- **THEN** the implementation uses `room_id + meter_type` directly and does not require creating or querying meter devices

#### Scenario: Handover reading supports first billing month
- **WHEN** a room has no monthly reading from the previous period but has a `handover_in` reading
- **THEN** the monthly reading workflow can use `handover_in` as the previous reading fallback

