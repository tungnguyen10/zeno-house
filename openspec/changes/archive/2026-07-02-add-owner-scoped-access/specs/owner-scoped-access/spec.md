## ADDED Requirements

### Requirement: Owner là scoped superuser
System SHALL support role `owner` as a scoped superuser. Owner SHALL have broad operational capabilities inside assigned buildings and SHALL NOT have global visibility like admin.

#### Scenario: Owner sees only scoped buildings
- **WHEN** owner calls `GET /api/buildings`
- **THEN** response contains only buildings assigned to that owner

#### Scenario: Admin remains global
- **WHEN** admin calls `GET /api/buildings`
- **THEN** response contains all buildings

#### Scenario: Owner cannot see unassigned building detail
- **WHEN** owner calls a detail endpoint for a building outside owner scope
- **THEN** response is 404 Not Found

---

### Requirement: Owner-created building is automatically scoped
When owner creates a building, system SHALL create the building and assign that owner to the building in the same server workflow.

#### Scenario: Owner creates building
- **WHEN** owner sends valid `POST /api/buildings`
- **THEN** building is created with owner provenance
- **AND** `user_building_assignments` contains an assignment from owner to the new building

#### Scenario: Owner sees created building immediately
- **WHEN** owner creates a building and then calls `GET /api/buildings`
- **THEN** the newly created building appears in the response

---

### Requirement: Owner has full operational rights inside scope
Owner SHALL be allowed to create, update, delete, close, unissue, correct, and manage operational data inside assigned buildings when the same business rules allow admin to do so.

#### Scenario: Owner updates scoped room
- **WHEN** owner updates a room in an assigned building
- **THEN** request succeeds if validation and business rules pass

#### Scenario: Owner closes scoped billing period
- **WHEN** owner closes a billing period in an assigned building that satisfies close rules
- **THEN** request succeeds

#### Scenario: Owner mutation outside scope is forbidden
- **WHEN** owner performs a mutation on an entity outside assigned buildings
- **THEN** response is 403 Forbidden

---

### Requirement: Owner delete building is scoped and safety checked
Owner SHALL be allowed to delete or archive assigned buildings only through the same safety checks used by building deletion workflows. Owner SHALL NOT bypass conflict checks for operational data.

#### Scenario: Owner deletes empty scoped building
- **WHEN** owner deletes an assigned building with no blocking operational data
- **THEN** deletion succeeds

#### Scenario: Owner cannot delete building with blockers
- **WHEN** owner deletes an assigned building with rooms, active contracts, invoices, or payments
- **THEN** response is 409 Conflict or safe archive behavior if explicitly requested and allowed

#### Scenario: Owner cannot delete unassigned building
- **WHEN** owner sends DELETE for a building outside owner scope
- **THEN** response is 403 Forbidden

---

### Requirement: App never creates admin users
No app API or Settings UI SHALL create users with role `admin`. Admin accounts SHALL be bootstrapped outside the application.

#### Scenario: Admin caller tries to create admin from app
- **WHEN** authenticated admin submits user creation with `role = 'admin'`
- **THEN** response is 403 Forbidden

#### Scenario: Owner caller tries to create admin from app
- **WHEN** authenticated owner submits user creation with `role = 'admin'`
- **THEN** response is 403 Forbidden
