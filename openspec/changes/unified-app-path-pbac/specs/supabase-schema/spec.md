## ADDED Requirements

### Requirement: building_managers table exists with correct schema
The system SHALL have a `building_managers` table as defined in the building-managers spec, created via a numbered SQL migration file.

#### Scenario: Migration creates building_managers table
- **WHEN** the migration is applied
- **THEN** `building_managers` exists with columns: `id uuid pk`, `building_id uuid fk→buildings`, `manager_id uuid fk→profiles`, `permissions text[]`, `granted_by uuid fk→profiles`, `granted_at timestamptz`, `unique(building_id, manager_id)`

## MODIFIED Requirements

### Requirement: Manager sees only their assigned buildings
The system SHALL enforce that manager users only see data for buildings listed in `building_managers` where `manager_id = auth.uid()`, replacing the previous `buildings.manager_id = auth.uid()` join.

#### Scenario: Manager accesses rooms via building_managers
- **WHEN** an authenticated user with `role = 'manager'` queries `rooms`
- **THEN** only rooms where `building_id IN (SELECT building_id FROM building_managers WHERE manager_id = auth.uid())` are returned

#### Scenario: Admin has full access
- **WHEN** an authenticated user with role `admin` queries any table
- **THEN** all rows are returned regardless of building_managers entries

#### Scenario: Tenant sees only their own data
- **WHEN** an authenticated user with role `tenant` queries `invoices`
- **THEN** only invoices linked to that tenant's active contract are returned (unchanged from previous behavior)
