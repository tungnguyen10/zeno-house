## Purpose

Database schema for the `rooms` table. A room belongs to a building, has a status (available/occupied/maintenance), and tracks rent and area. Room numbers are unique per building.
## Requirements
### Requirement: Rooms table schema
The system SHALL have a `rooms` table with columns: `id` (uuid PK), `building_id` (uuid FK→buildings CASCADE), `room_number` (text NOT NULL), `floor` (integer DEFAULT 1), `status` (text DEFAULT 'available', CHECK IN ('available','occupied','maintenance')), `monthly_rent` (numeric(12,0) DEFAULT 0), `area` (numeric(6,2) nullable), `description` (text nullable), `created_at` (timestamptz), `updated_at` (timestamptz). UNIQUE constraint on `(building_id, room_number)`.

#### Scenario: Room number unique per building
- **WHEN** admin creates two rooms with same `room_number` in same building
- **THEN** database rejects with unique constraint violation

#### Scenario: Cascade delete
- **WHEN** a building is deleted
- **THEN** all its rooms are automatically deleted

### Requirement: Rooms RLS policies
The system SHALL enforce RLS on `rooms` table: admin role has full access (ALL), manager role has SELECT only. Role is read from `(auth.jwt() -> 'app_metadata' ->> 'role')`.

#### Scenario: Admin can insert room
- **WHEN** authenticated user with role 'admin' inserts a room
- **THEN** insert succeeds

#### Scenario: Manager cannot insert room
- **WHEN** authenticated user with role 'manager' inserts a room
- **THEN** insert is rejected by RLS

### Requirement: updated_at auto-trigger
The system SHALL automatically update `updated_at` on every row update via a trigger.

#### Scenario: Auto-update timestamp
- **WHEN** a room row is updated
- **THEN** `updated_at` reflects the current timestamp

### Requirement: rooms.status accepts 'archived'
The `rooms.status` column SHALL accept value `'archived'` in addition to `'available'`, `'occupied'`, and `'maintenance'`. The check constraint SHALL be updated to permit the new value while keeping existing rows valid (no data migration required since default is unchanged).

#### Scenario: Insert with archived status
- **WHEN** an admin updates a room to `status='archived'` via the soft-archive endpoint
- **THEN** the row update succeeds and the constraint does not reject

#### Scenario: Existing rows unaffected
- **WHEN** the migration runs against an existing database
- **THEN** all existing rows remain valid and their status values unchanged

