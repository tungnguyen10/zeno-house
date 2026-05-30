## ADDED Requirements

### Requirement: List meter devices by room
The API SHALL return all meter devices for a given room, ordered by meter_type.

#### Scenario: Get devices for a room
- **WHEN** GET `/api/meter-devices?room_id=<id>` is called by an authenticated admin or manager
- **THEN** system returns `{ data: MeterDevice[] }` with devices belonging to that room

#### Scenario: Missing room_id
- **WHEN** GET `/api/meter-devices` is called without `room_id`
- **THEN** system returns 400 VALIDATION_ERROR

### Requirement: Create meter device
The API SHALL allow creating a new meter device for a room.

#### Scenario: Create electricity device
- **WHEN** POST `/api/meter-devices` with `{ room_id, meter_type: 'electricity', meter_code?, start_reading, installed_at }`
- **THEN** system creates the device with `status = 'active'` and returns `{ data: MeterDevice }`

#### Scenario: Duplicate active device same type
- **WHEN** POST `/api/meter-devices` for a room that already has an active device of the same type
- **THEN** system returns 409 CONFLICT

### Requirement: Update meter device
The API SHALL allow updating metadata and status of a device.

#### Scenario: Deactivate device
- **WHEN** PATCH `/api/meter-devices/:id` with `{ status: 'inactive', removed_at: '<date>' }`
- **THEN** system updates the device and returns `{ data: MeterDevice }`

#### Scenario: Update meter code
- **WHEN** PATCH `/api/meter-devices/:id` with `{ meter_code: '<code>' }`
- **THEN** system updates only the provided fields

### Requirement: Permission guard
The API SHALL reject unauthorized access.

#### Scenario: Unauthenticated request
- **WHEN** any meter-devices endpoint is called without a valid session
- **THEN** system returns 401 UNAUTHENTICATED

#### Scenario: Insufficient permission
- **WHEN** a role without `meter-devices.read` calls GET
- **THEN** system returns 403 FORBIDDEN
