## ADDED Requirements

### Requirement: Maintenance list displays requests with filters
The system SHALL provide a maintenance request list at `/admin/maintenance` and `/manager/maintenance` filterable by status, priority, building/room, and date range.

#### Scenario: Filter by status shows only matching requests
- **WHEN** an admin filters by status `in_progress`
- **THEN** only in-progress requests are shown

#### Scenario: Manager sees only requests from their buildings
- **WHEN** a manager views the maintenance list
- **THEN** only requests from rooms in buildings they own are shown

### Requirement: Status workflow enforces forward-only transitions
The system SHALL enforce the status transitions: `open → in_progress → resolved → closed`. Reverse transitions or skipping states are rejected. Valid enum values (migration 001): `'open'`, `'in_progress'`, `'resolved'`, `'closed'`.

#### Scenario: Invalid transition returns 400
- **WHEN** an admin tries to set a `resolved` request back to `in_progress`
- **THEN** the API returns HTTP 400 with "Invalid status transition"

#### Scenario: Open request can be moved to in_progress
- **WHEN** an admin sets an `open` request to `in_progress`
- **THEN** the transition succeeds

### Requirement: Status changes are recorded in history table
The system SHALL write a row to `maintenance_status_history` for every status change, recording `from_status`, `to_status`, `changed_by`, `notes`, and `timestamp`.

#### Scenario: Status history grows on each change
- **WHEN** an admin changes a request from `open` to `in_progress`
- **THEN** a new row appears in `maintenance_status_history` for that request

### Requirement: MaintenanceTimeline renders full status history
The system SHALL render the status history as a chronological timeline in `MaintenanceTimeline.vue`, showing actor name, notes, and timestamp for each change.

#### Scenario: Timeline shows all history entries
- **WHEN** a request has 3 status changes
- **THEN** the timeline shows 3 entries in chronological order

### Requirement: Admin can assign request to a manager
The system SHALL allow assigning a maintenance request to a user with `role = 'manager'` via the detail page.

#### Scenario: Assigning request sets assigned_to
- **WHEN** an admin selects a manager in the "Giao cho" dropdown and saves
- **THEN** the request's `assigned_to` is updated

### Requirement: Cost fields are optional on request detail
The system SHALL allow setting `estimated_cost` and `actual_cost` on a maintenance request from the admin detail page. Both fields are optional (nullable).

#### Scenario: Actual cost can be saved without estimated cost
- **WHEN** an admin enters only `actual_cost` and saves
- **THEN** the request is updated with `actual_cost` set and `estimated_cost` null
