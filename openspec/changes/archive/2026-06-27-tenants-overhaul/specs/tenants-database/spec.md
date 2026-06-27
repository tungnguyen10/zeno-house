## ADDED Requirements

### Requirement: tenants table has status column
The `tenants` table SHALL include a `status` column of type `text NOT NULL DEFAULT 'active'` with a check constraint `status IN ('active', 'archived')`. Existing rows SHALL receive `'active'` via the DEFAULT during migration; no data backfill is required.

#### Scenario: Insert without status uses default
- **WHEN** an admin creates a new tenant without specifying status
- **THEN** the row is inserted with `status='active'`

#### Scenario: Update to archived succeeds
- **WHEN** an admin updates a tenant to `status='archived'` via the soft-archive endpoint
- **THEN** the update succeeds and the constraint does not reject

#### Scenario: Invalid status rejected
- **WHEN** any process tries to set `status='banned'`
- **THEN** the check constraint rejects the row

#### Scenario: Existing rows after migration
- **WHEN** the migration runs against an existing database with N tenant rows
- **THEN** all N rows have `status='active'` after migration
