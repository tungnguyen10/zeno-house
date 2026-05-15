## ADDED Requirements

### Requirement: Service fee definitions CRUD
`GET /api/service-fees` SHALL return all fee definitions. `POST /api/service-fees` creates a new definition. `PATCH /api/service-fees/:id` updates name/amount/active. `DELETE /api/service-fees/:id` soft-deletes (sets active=false) if in use, hard-deletes if unused. Requires auth + admin permission.

#### Scenario: List returns all definitions
- **WHEN** admin calls GET /api/service-fees
- **THEN** returns array of fee definitions ordered by name

#### Scenario: Create fee definition
- **WHEN** admin POSTs valid fee definition
- **THEN** returns 201 with new definition

### Requirement: Room service fee assignments
`GET /api/room-service-fees?roomId=<id>` returns active fees for a room (with effective_amount = override ?? default). `POST /api/room-service-fees` assigns a fee to a room. `DELETE /api/room-service-fees/:id` removes assignment. Requires auth.

#### Scenario: List room fees with effective amount
- **WHEN** admin fetches fees for a room
- **THEN** returns assignments with `effective_amount` computed (override ?? default)

#### Scenario: Assign fee to room
- **WHEN** admin POSTs valid assignment
- **THEN** returns 201 with new assignment
