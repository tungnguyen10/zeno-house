## ADDED Requirements

### Requirement: rooms.status accepts 'archived'
The `rooms.status` column SHALL accept value `'archived'` in addition to `'available'`, `'occupied'`, and `'maintenance'`. The check constraint SHALL be updated to permit the new value while keeping existing rows valid (no data migration required since default is unchanged).

#### Scenario: Insert with archived status
- **WHEN** an admin updates a room to `status='archived'` via the soft-archive endpoint
- **THEN** the row update succeeds and the constraint does not reject

#### Scenario: Existing rows unaffected
- **WHEN** the migration runs against an existing database
- **THEN** all existing rows remain valid and their status values unchanged
