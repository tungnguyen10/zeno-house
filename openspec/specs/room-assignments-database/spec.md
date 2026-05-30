## Status

**DEPRECATED** — Removed in change `2026-05-30-contract-as-assignment`.

The `room_assignments` table has been dropped. Room occupancy is now tracked exclusively via `contracts.status = 'active'`. The `rooms.status` field is driven by contract lifecycle in `ContractService`.

## Requirements

### Requirement: Room assignments table schema
The system SHALL have a `room_assignments` table with columns: `id` (uuid PK), `room_id` (uuid FK → rooms.id ON DELETE CASCADE), `tenant_id` (uuid FK → tenants.id ON DELETE RESTRICT), `start_date` (date NOT NULL), `end_date` (date NULL — null means active), `notes` (text NULL), `created_at` (timestamptz default now()), `updated_at` (timestamptz default now()). A partial unique index SHALL enforce at most one active assignment per room: `UNIQUE (room_id) WHERE end_date IS NULL`.

#### Scenario: Migration creates table
- **WHEN** migration is applied
- **THEN** `room_assignments` table exists with all columns, FK constraints, and partial unique index

#### Scenario: One active assignment per room enforced
- **WHEN** an INSERT is attempted for a room that already has an active assignment (end_date IS NULL)
- **THEN** the database rejects the insert with a unique constraint violation

#### Scenario: Tenant delete blocked if assigned
- **WHEN** a DELETE is attempted on a tenant with active or historical assignments
- **THEN** the database rejects with FK RESTRICT violation

### Requirement: Room assignments RLS policies
RLS SHALL be enabled on `room_assignments`. Policy `room_assignments_admin_all`: admin full access. Policy `room_assignments_manager_select`: manager SELECT only.

#### Scenario: Admin can assign
- **WHEN** admin inserts a room assignment
- **THEN** operation succeeds

#### Scenario: Manager read-only
- **WHEN** manager attempts to insert or delete a room assignment
- **THEN** operation rejected by RLS

### Requirement: Generated TypeScript types for room_assignments
After migration, `database.types.ts` SHALL include `room_assignments` Row/Insert/Update types.

#### Scenario: Types available after regen
- **WHEN** `database.types.ts` is regenerated
- **THEN** `Tables<'room_assignments'>` is available with correct FK column types
