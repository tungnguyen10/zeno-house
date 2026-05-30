## MODIFIED Requirements

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

### Requirement: Building rooms status query needs no devices
The status query SHALL return rooms with their meter types directly, not via device lookup.

#### Scenario: Get building rooms status
- **WHEN** GET `/api/meter-readings/bulk?building_id=&period_year=&period_month=`
- **THEN** returns array of `{ roomId, roomNumber, floor, meters: [{ meterType, existingReading, previousReading }] }`
- **AND** each room always has exactly 2 meter entries: electricity + water

## REMOVED Requirements

### Requirement: Meter device management endpoints
**Reason**: `meter_devices` concept removed — readings identified by room+type directly
**Migration**: Use `POST /api/meter-readings` with `room_id + meter_type` instead
