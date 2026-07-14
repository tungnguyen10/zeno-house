## MODIFIED Requirements

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

## ADDED Requirements

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
