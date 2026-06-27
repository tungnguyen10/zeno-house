## Purpose

Database schema for the `tenants` table. Stores personal information of tenants (khách thuê) independent of room assignments. Secured with RLS policies matching the buildings/rooms pattern.
## Requirements
### Requirement: Tenants table schema
The system SHALL have a `tenants` table with columns: `id` (uuid PK), `full_name` (text NOT NULL), `phone` (text NOT NULL), `email` (text NULL), `id_number` (text NULL — CMND/CCCD), `date_of_birth` (date NULL), `permanent_address` (text NULL), `notes` (text NULL), `created_at` (timestamptz default now()), `updated_at` (timestamptz default now()). Trigger `set_updated_at` updates `updated_at` on row change.

#### Scenario: Migration creates table
- **WHEN** migration is applied
- **THEN** `tenants` table exists with all columns and correct types

#### Scenario: updated_at auto-updates
- **WHEN** a tenant row is updated
- **THEN** `updated_at` is set to current timestamp automatically

### Requirement: Tenants RLS policies
Row Level Security SHALL be enabled on `tenants`. Policy `tenants_admin_all`: admin role has full access (SELECT/INSERT/UPDATE/DELETE). Policy `tenants_manager_select`: manager role has SELECT only.

#### Scenario: Admin can write
- **WHEN** authenticated user with role `admin` inserts or updates a tenant
- **THEN** operation succeeds

#### Scenario: Manager read-only
- **WHEN** authenticated user with role `manager` attempts DELETE on a tenant
- **THEN** operation is rejected by RLS

### Requirement: Generated TypeScript types
After migration, `database.types.ts` SHALL be regenerated to include `tenants` table Row/Insert/Update types.

#### Scenario: Types available after regen
- **WHEN** `database.types.ts` is regenerated
- **THEN** `Tables<'tenants'>` is available with correct column types

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

