## ADDED Requirements

### Requirement: utility_readings table
`utility_readings` table SHALL exist with columns: `id` (uuid PK), `room_id` (uuid FK → rooms CASCADE), `utility_type` (enum: `electricity` | `water`), `reading_value` (NUMERIC(10,2) NOT NULL), `reading_date` (DATE NOT NULL), `notes` (TEXT nullable), `created_at`, `updated_at`. Index on `(room_id, utility_type, reading_date DESC)` for efficient latest-reading lookup.

#### Scenario: Table created with correct schema
- **WHEN** migration runs
- **THEN** `utility_readings` exists with all required columns and FK constraint

#### Scenario: RLS policies
- **WHEN** admin accesses utility_readings
- **THEN** full CRUD allowed; manager can SELECT only
