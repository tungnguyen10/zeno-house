## ADDED Requirements

### Requirement: Admin can list all managers and their building assignments
The system SHALL provide a page at `/app/managers` (admin-only) that displays all users with `role = 'manager'` and shows which buildings each manages and with what permissions.

#### Scenario: Manager list renders
- **WHEN** an admin navigates to `/app/managers`
- **THEN** a table shows all manager profiles with columns: Name, Email, Buildings Managed, Actions

#### Scenario: Non-admin cannot access managers page
- **WHEN** a user with `role = 'manager'` navigates to `/app/managers`
- **THEN** they are redirected or shown a 403 error

### Requirement: Admin can assign a manager to a building with selected permissions
The system SHALL allow an admin to assign a manager to a building by selecting the building and toggling individual feature permissions. The assignment is saved to `building_managers`.

#### Scenario: Assign manager to building
- **WHEN** an admin opens the assignment form for a manager, selects a building, checks `rooms` and `invoices`, and submits
- **THEN** a row is inserted in `building_managers` with `permissions = ['rooms','invoices']`

#### Scenario: Duplicate assignment shows existing record
- **WHEN** an admin opens the assignment form for a manager who is already assigned to a building
- **THEN** the form shows the existing permissions pre-checked and saves via update (not insert)

### Requirement: Admin can edit permissions for an existing assignment
The system SHALL allow an admin to change the permission set for an existing `building_managers` row. Changes are saved immediately without requiring a delete+re-insert.

#### Scenario: Toggle a permission off
- **WHEN** an admin unchecks `contracts` for an existing assignment and saves
- **THEN** the `building_managers.permissions` array no longer includes `'contracts'`

#### Scenario: Toggle a permission on
- **WHEN** an admin checks `tenants` for an assignment that currently lacks it and saves
- **THEN** `'tenants'` is appended to `building_managers.permissions`

### Requirement: GET /api/buildings returns list of all buildings for assignment UI

The system SHALL expose a `GET /api/buildings` server route accessible to `admin` and `manager` roles that returns an array of `{ id, name }` objects ordered by name. This endpoint populates the building selector in the manager assignment form.

#### Scenario: Admin fetches buildings list

- **WHEN** an admin calls `GET /api/buildings`
- **THEN** an array of `{ id, name }` objects is returned, ordered alphabetically by name

#### Scenario: Manager fetches buildings list

- **WHEN** a user with `role = 'manager'` calls `GET /api/buildings`
- **THEN** the same array is returned (building visibility is not restricted by building_managers at this endpoint)

#### Scenario: Unauthenticated request is rejected

- **WHEN** an unauthenticated user calls `GET /api/buildings`
- **THEN** the server responds with HTTP 401 Unauthorized

### Requirement: Admin can revoke a manager's assignment from a building
The system SHALL allow an admin to remove a `building_managers` row, immediately removing that manager's access to the building.

#### Scenario: Revoke building assignment
- **WHEN** an admin clicks "Remove" on a building assignment and confirms
- **THEN** the `building_managers` row is deleted and the manager loses access to that building

#### Scenario: Manager with zero assignments sees empty-state dashboard
- **WHEN** a manager whose last building assignment is revoked logs in
- **THEN** the `/app` dashboard shows an empty state: "No buildings assigned — contact your administrator"
