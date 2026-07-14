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
The bulk endpoint SHALL upsert on `(room_id, meter_type, period_year, period_month, reading_type)` and SHALL persist all reading changes and their audit events in one transaction.

#### Scenario: Bulk upsert idempotent
- **WHEN** POST `/api/meter-readings/bulk` is called twice with the same `room_id + meter_type + period + reading_type` using current resource state
- **THEN** the second call updates the existing row and no duplicate reading is created

#### Scenario: Bulk upsert multiple rooms
- **WHEN** POST `/api/meter-readings/bulk` contains readings for multiple rooms
- **THEN** all rows and their audit events are upserted atomically and the response includes `meta.count`

#### Scenario: One bulk row fails
- **WHEN** any row fails validation, locking, concurrency, or persistence checks
- **THEN** no reading or audit event from the request is committed

### Requirement: Update meter reading
The API SHALL allow correcting an existing reading only when the caller supplies the expected `updated_at` version and the billing input is editable.

#### Scenario: Patch reading value
- **WHEN** PATCH `/api/meter-readings/:id` supplies `{ reading_value: <corrected>, expected_updated_at: <current-version> }`
- **THEN** the system atomically updates only the provided fields and its audit event and returns the updated `MeterReading`

#### Scenario: Patch version is stale
- **WHEN** the stored reading version differs from `expected_updated_at`
- **THEN** the API returns 409 CONFLICT and preserves the newer reading

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

### Requirement: Billing state locks monthly reading writes
All monthly meter-reading create, bulk, and update service paths SHALL reject a write when the matching billing period is closed or the affected room has a non-void invoice for that period, regardless of whether the caller is a direct API or an AI executor.

#### Scenario: Closed period direct write
- **WHEN** a direct API attempts to create or update a monthly reading for a closed period
- **THEN** the service returns 409 CONFLICT and persists no reading or audit event

#### Scenario: Active room invoice direct write
- **WHEN** a direct API attempts to change a monthly reading for a room with a non-void invoice in that period
- **THEN** the service returns 409 CONFLICT and persists no reading or audit event

#### Scenario: Handover reading has no billing-period lock
- **WHEN** a contract workflow saves a handover reading outside the monthly billing input path
- **THEN** monthly period and invoice locks do not incorrectly block that handover operation
