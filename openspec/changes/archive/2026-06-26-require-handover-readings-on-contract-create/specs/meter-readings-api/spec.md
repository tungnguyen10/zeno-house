## ADDED Requirements

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

#### Scenario: Permission guard
- **WHEN** a role without `meter-readings.read` calls the endpoint
- **THEN** system returns 403 FORBIDDEN
