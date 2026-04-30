# buildings-crud

## Purpose

Full CRUD management for buildings. Admins see and manage all buildings; managers see only buildings they are assigned to via `building_managers` (enforced via RLS + `manages_building()` function). All routes live under the unified `/app/buildings` path.

---

## Requirements

### Requirement: Buildings list page displays all accessible buildings

The system SHALL provide a buildings list page at `/app/buildings` that displays all buildings the authenticated user has access to, with search by name or address.

#### Scenario: Admin sees all buildings

- **WHEN** an admin navigates to `/app/buildings`
- **THEN** all buildings in the system are listed

#### Scenario: Manager sees only assigned buildings

- **WHEN** a manager navigates to `/app/buildings`
- **THEN** only buildings where they have a `building_managers` row are listed (RLS enforced)

#### Scenario: Search filters list in real time

- **WHEN** a user types in the search field
- **THEN** the buildings list filters by name or address matching the input

---

### Requirement: Building create page validates and persists a new building

The system SHALL provide a form page at `/app/buildings/new` that creates a building via `POST /api/buildings` after Zod validation.

#### Scenario: Valid form creates building and redirects

- **WHEN** a user submits a valid building form
- **THEN** the building is created and the user is redirected to the buildings list with a success toast

#### Scenario: Invalid form shows inline errors

- **WHEN** a user submits a form with a missing name
- **THEN** a validation error is shown inline, no API call is made

---

### Requirement: Building detail page shows stats and info

The system SHALL provide a building detail page at `/app/buildings/[id]` showing the building's information and room stats (total, available, occupied).

#### Scenario: Detail page shows room counts

- **WHEN** a user views a building detail page
- **THEN** `BuildingStats` component shows total rooms, available, and occupied counts

---

### Requirement: Building edit page updates an existing building

The system SHALL provide an edit page at `/app/buildings/[id]/edit` that pre-fills the current values and submits a `PUT /api/buildings/[id]` request.

#### Scenario: Edit page pre-fills current values

- **WHEN** a user navigates to the edit page
- **THEN** all form fields are pre-filled with the current building data

---

### Requirement: Building delete requires confirmation

The system SHALL show a confirmation modal before deleting a building. Deletion is blocked if the building has associated rooms.

#### Scenario: Delete with rooms shows block message

- **WHEN** a user tries to delete a building that has rooms
- **THEN** the delete is rejected with a message to remove rooms first

#### Scenario: Delete empty building succeeds

- **WHEN** a user confirms deletion of a building with no rooms
- **THEN** the building is deleted and removed from the list with a success toast

---

### Requirement: Buildings API enforces auth and role

The system SHALL have server routes for buildings that require authentication and verify role. Manager access is scoped via `building_managers` RLS — buildings not in the manager's `building_managers` rows are invisible.

#### Scenario: Unauthenticated request returns 401

- **WHEN** an unauthenticated call is made to `GET /api/buildings`
- **THEN** the server returns HTTP 401

#### Scenario: Manager cannot access another manager's building

- **WHEN** a manager calls `GET /api/buildings/[id]` for a building they are not assigned to
- **THEN** the server returns HTTP 404 (RLS makes it invisible, not 403)
