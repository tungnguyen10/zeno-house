## Purpose

Server API for recording and querying meter readings (electricity + water). Readings are identified by `(room_id, meter_type, period_year, period_month, reading_type)` — no meter device abstraction. Supports monthly billing readings and contract handover (in/out) readings.

## Requirements

### Requirement: List meter readings
The API SHALL return meter readings filtered by room or building.

#### Scenario: Get readings for a room
- **WHEN** GET `/api/meter-readings?room_id=<id>` is called by an authenticated admin or manager
- **THEN** system returns `{ data: MeterReading[] }` ordered by period DESC

#### Scenario: Get readings for a building in a period
- **WHEN** GET `/api/meter-readings?building_id=<id>&period_year=<y>&period_month=<m>`
- **THEN** system returns all readings for that building in the given period

#### Scenario: Unauthenticated request
- **WHEN** any meter-readings endpoint is called without a valid session
- **THEN** system returns 401 UNAUTHENTICATED

### Requirement: Create meter reading
The API SHALL accept `room_id` and `meter_type` directly without requiring a `meter_device_id`.

#### Scenario: Create monthly reading
- **WHEN** POST `/api/meter-readings` with `{ room_id, meter_type, reading_type, period_year, period_month, reading_date, reading_value }`
- **THEN** system creates the reading and returns `{ data: MeterReading }`

#### Scenario: `meter_device_id` is not accepted
- **WHEN** POST includes a `meter_device_id` field
- **THEN** system ignores the field (or returns validation error)

### Requirement: Bulk upsert uses room-based conflict key
The bulk endpoint SHALL upsert on `(room_id, meter_type, period_year, period_month, reading_type)`.

#### Scenario: Bulk upsert idempotent
- **WHEN** POST `/api/meter-readings/bulk` is called twice with same `room_id + meter_type + period + reading_type`
- **THEN** second call updates the existing row, no duplicate created

#### Scenario: Bulk upsert multiple rooms
- **WHEN** POST `/api/meter-readings/bulk` with readings for multiple rooms
- **THEN** all rows are upserted atomically; response includes `meta.count`

### Requirement: Update meter reading
The API SHALL allow correcting an existing reading.

#### Scenario: Patch reading value
- **WHEN** PATCH `/api/meter-readings/:id` with `{ reading_value: <corrected> }`
- **THEN** system updates only the provided fields and returns updated `MeterReading`

### Requirement: Building rooms status query needs no devices
The status query SHALL return occupied rooms with their meter types directly, not via device lookup. This query is a billing-readiness input for a Building + Period workflow.

#### Scenario: Get building rooms status
- **WHEN** GET `/api/meter-readings/bulk?building_id=&period_year=&period_month=`
- **THEN** returns array of `{ roomId, roomNumber, floor, devices: [{ meterType, existingReading, previousReading }] }`
- **AND** each room always has exactly 2 meter entries: electricity + water

#### Scenario: Previous reading fallback to handover_in
- **WHEN** a room has no monthly reading from the previous period but has a `handover_in` reading
- **THEN** `previousReading` is populated with the `handover_in` reading (first billing month support)

#### Scenario: Only occupied rooms returned
- **WHEN** building has a mix of occupied and vacant rooms
- **THEN** only rooms with `status = 'occupied'` are included in the response

### Requirement: Monthly reading workflow ownership
Monthly utility readings SHALL be treated as inputs to a Building + Period billing workflow. Room detail MAY read meter history for context, but SHALL NOT be the primary monthly reading entry point.

#### Scenario: Monthly readings entered from workspace
- **WHEN** user needs to enter readings for a billing period
- **THEN** the UI provides a Building + Period scoped workflow

#### Scenario: Room detail can be read-only
- **WHEN** Room detail displays meter information
- **THEN** it is read-only context and does not become the monthly billing workflow

### Requirement: Permission guard
The API SHALL reject insufficient permissions.

#### Scenario: Read requires meter-readings.read
- **WHEN** a role without `meter-readings.read` calls GET
- **THEN** system returns 403 FORBIDDEN

#### Scenario: Write requires meter-readings.write
- **WHEN** a role without `meter-readings.write` calls POST or PATCH
- **THEN** system returns 403 FORBIDDEN

### Requirement: Latest reading by room and meter type
The API SHALL expose, for a given room, the latest meter reading per meter type regardless of `reading_type`, so clients can pre-fill handover inputs when creating a contract.

#### Scenario: Room has prior readings
- **WHEN** GET `/api/meter-readings/latest?room_id=<id>` is called by an authenticated admin or manager and the room has at least one prior reading
- **THEN** the response is `{ data: { electricity: MeterReading | null, water: MeterReading | null } }` where each non-null entry is the row with the most recent `(period_year, period_month, reading_date)` for that `meter_type`

#### Scenario: Room has no prior readings
- **WHEN** GET `/api/meter-readings/latest?room_id=<id>` is called for a brand new room
- **THEN** the response is `{ data: { electricity: null, water: null } }`

#### Scenario: Filter by date upper bound
- **WHEN** GET `/api/meter-readings/latest?room_id=<id>&before_date=<YYYY-MM-DD>` is called
- **THEN** the response returns the latest reading per meter type whose `reading_date` is strictly less than `before_date`
- **AND** the response shape is `{ data: { electricity: MeterReading | null, water: MeterReading | null } }`

#### Scenario: Unauthenticated request
- **WHEN** GET `/api/meter-readings/latest` is called without a valid session
- **THEN** system returns 401 UNAUTHENTICATED

#### Scenario: Permission guard on latest endpoint
- **WHEN** a role without `meter-readings.read` calls the latest endpoint
- **THEN** system returns 403 FORBIDDEN
