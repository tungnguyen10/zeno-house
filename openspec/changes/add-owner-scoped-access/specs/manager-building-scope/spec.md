## ADDED Requirements

### Requirement: Owner scope uses user_building_assignments
System SHALL resolve owner building scope from `user_building_assignments` the same way manager scope is resolved. Admin SHALL remain unscoped.

#### Scenario: Owner sees assigned buildings
- **WHEN** owner calls `GET /api/buildings`
- **THEN** response only contains buildings assigned to that owner

#### Scenario: Owner with no assignment sees empty list
- **WHEN** owner has no `user_building_assignments` and calls `GET /api/buildings`
- **THEN** response returns an empty list, not global data

#### Scenario: Admin remains unscoped
- **WHEN** admin scope is resolved
- **THEN** scope result is `null`

---

### Requirement: Owner detail outside scope returns 404
When owner reads detail endpoints for entities outside owner scope, system SHALL return 404 Not Found and SHALL NOT leak existence.

#### Scenario: Owner reads room outside scope
- **WHEN** owner calls `GET /api/rooms/:id` for a room in an unassigned building
- **THEN** response is 404 Not Found

#### Scenario: Owner reads invoice outside scope
- **WHEN** owner calls `GET /api/billing/invoices/:id` for an invoice in an unassigned building
- **THEN** response is 404 Not Found

---

### Requirement: Owner mutation outside scope returns 403
When owner mutates entities outside owner scope, system SHALL return 403 Forbidden.

#### Scenario: Owner updates room outside scope
- **WHEN** owner calls `PATCH /api/rooms/:id` for a room in an unassigned building
- **THEN** response is 403 Forbidden

#### Scenario: Owner closes period outside scope
- **WHEN** owner calls close period endpoint for a period in an unassigned building
- **THEN** response is 403 Forbidden

---

### Requirement: Scope cache includes owner and manager
System SHALL query `user_building_assignments` at most once per HTTP request for scoped roles (`owner` and `manager`) and reuse `event.context.__buildingScope`.

#### Scenario: Owner scope cache hit
- **WHEN** one owner request calls scope resolution multiple times
- **THEN** assignment repository is queried once
