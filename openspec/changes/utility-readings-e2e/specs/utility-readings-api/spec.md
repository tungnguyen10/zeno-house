## ADDED Requirements

### Requirement: Create utility reading
`POST /api/utility-readings` SHALL accept `{ room_id, utility_type, reading_value, reading_date, notes? }`, validate input with Zod, check that `reading_value ≥` latest existing reading for the same room + type, then insert and return the new reading. Requires auth.

#### Scenario: Valid reading created
- **WHEN** admin POSTs valid reading with value ≥ previous
- **THEN** returns 201 with new reading including computed `consumption`

#### Scenario: Regression rejected
- **WHEN** admin POSTs reading_value < latest reading for same room + utility_type
- **THEN** returns 409 CONFLICT with code `CONFLICT` and message explaining the previous value

#### Scenario: First reading for room/type
- **WHEN** no previous reading exists for this room + utility_type
- **THEN** reading is created, `consumption` returned as null

#### Scenario: Invalid input
- **WHEN** required fields missing or reading_value ≤ 0
- **THEN** returns 422 VALIDATION_ERROR

### Requirement: List utility readings by room
`GET /api/utility-readings?roomId=<id>&type=<electricity|water>&limit=<n>` SHALL return readings for the room ordered by `reading_date DESC`. `type` filter is optional. `limit` defaults to 10. Each item includes `consumption` (diff from previous reading of same type, null for first). Requires auth.

#### Scenario: List returned with consumption
- **WHEN** admin fetches readings for a room
- **THEN** returns ordered list with `consumption` computed per entry

#### Scenario: Empty list
- **WHEN** no readings exist for the room
- **THEN** returns empty array, not 404

### Requirement: Get latest utility reading
`GET /api/utility-readings/latest?roomId=<id>&type=<electricity|water>` SHALL return the most recent reading for the given room + utility_type, or `null` if none exists. Requires auth.

#### Scenario: Latest reading returned
- **WHEN** readings exist for room + type
- **THEN** returns the reading with highest reading_date

#### Scenario: No reading exists
- **WHEN** no reading for the room + type
- **THEN** returns `{ data: null }`
