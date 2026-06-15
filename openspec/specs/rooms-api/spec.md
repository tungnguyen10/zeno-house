## Purpose

HTTP API for managing rooms. All endpoints require authentication. Admin-only endpoints: create, update, delete. Read endpoints available to both admin and manager.
## Requirements
### Requirement: List rooms endpoint
`GET /api/rooms` SHALL return paginated room list. Optional query params: `building_id`, `status`, `floor`. Response: `{ data: RoomDto[], meta: { total } }`. Requires authentication.

#### Scenario: List all rooms
- **WHEN** admin calls GET /api/rooms
- **THEN** returns all rooms with 200

#### Scenario: Filter by building
- **WHEN** GET /api/rooms?building_id=<uuid>
- **THEN** returns only rooms belonging to that building

#### Scenario: Filter by status
- **WHEN** GET /api/rooms?status=available
- **THEN** returns only rooms with status 'available'

#### Scenario: Unauthenticated request
- **WHEN** request has no valid session
- **THEN** returns 401 UNAUTHENTICATED

### Requirement: Get room by ID endpoint
`GET /api/rooms/:id` SHALL return single room DTO. Returns 404 if not found.

#### Scenario: Found
- **WHEN** GET /api/rooms/:id with valid id
- **THEN** returns room DTO with 200

#### Scenario: Not found
- **WHEN** GET /api/rooms/:id with unknown id
- **THEN** returns 404 NOT_FOUND

### Requirement: Create room endpoint
`POST /api/rooms` SHALL create a new room. Requires admin role. Body validated via Zod: `building_id`, `room_number`, `floor`, `status`, `monthly_rent` required; `area`, `description` optional. Returns 201 with created room.

#### Scenario: Admin creates room
- **WHEN** admin POSTs valid room data
- **THEN** room is created and returned with 201

#### Scenario: Duplicate room_number in building
- **WHEN** admin creates room with existing room_number in same building
- **THEN** returns 409 CONFLICT

#### Scenario: Validation error
- **WHEN** body missing required fields
- **THEN** returns 400 VALIDATION_ERROR

#### Scenario: Manager forbidden
- **WHEN** manager POSTs room data
- **THEN** returns 403 FORBIDDEN

### Requirement: Update room endpoint
`PATCH /api/rooms/:id` SHALL update an existing room. Requires admin role. All fields optional. Returns updated room.

#### Scenario: Admin updates room
- **WHEN** admin PATCHes valid fields
- **THEN** room updated, returns 200

#### Scenario: Manager forbidden
- **WHEN** manager PATCHes room
- **THEN** returns 403 FORBIDDEN

### Requirement: Delete room endpoint
`DELETE /api/rooms/:id` SHALL delete a room. Requires admin role. Returns 204.

#### Scenario: Admin deletes room
- **WHEN** admin DELETEs room by id
- **THEN** room deleted, returns 204

#### Scenario: Manager forbidden
- **WHEN** manager tries to delete room
- **THEN** returns 403 FORBIDDEN

### Requirement: Room API supports scoped slug lookup
Room read APIs SHALL support lookup by UUID id and by building identifier plus room slug where scoped room URLs are used.

#### Scenario: Lookup room by id
- **WHEN** authenticated user requests a room by UUID id
- **THEN** the API returns the matching room DTO

#### Scenario: Lookup room by building slug and room slug
- **WHEN** authenticated user requests room `a101` under building slug `toa-a`
- **THEN** the API returns the matching room DTO for that building

#### Scenario: Unknown scoped room slug
- **WHEN** authenticated user requests unknown room slug under a valid building
- **THEN** the API returns 404 NOT_FOUND

