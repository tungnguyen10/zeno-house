## Purpose

Documents the deprecated room assignment database model and explains that active occupancy is now tracked through contracts.

**DEPRECATED** — Removed in change `2026-05-30-contract-as-assignment`.

The `room_assignments` table has been dropped. Room occupancy is now tracked exclusively via `contracts.status = 'active'`. The `rooms.status` field is driven by contract lifecycle in `ContractService`.

## Requirements

### Requirement: Room assignments table schema
For historical reference, the system MUST document that prior to the contract-as-assignment migration it had a `room_assignments` table with columns: `id` (uuid PK), `room_id` (uuid FK → rooms.id ON DELETE CASCADE), `tenant_id` (uuid FK → tenants.id ON DELETE RESTRICT), `start_date` (date NOT NULL), `end_date` (date NULL — null means active), `notes` (text NULL), `created_at` (timestamptz default now()), `updated_at` (timestamptz default now()). A partial unique index enforced at most one active assignment per room: `UNIQUE (room_id) WHERE end_date IS NULL`. The table no longer exists; do not add code that depends on it.

#### Scenario: Table is no longer present
- **WHEN** a developer inspects the live database
- **THEN** `room_assignments` is absent and any read/write against it MUST be removed

#### Scenario: Active occupancy lookup
- **WHEN** a developer needs to know which tenant currently occupies a room
- **THEN** they query `contracts WHERE status = 'active' AND room_id = ?` instead of `room_assignments`

#### Scenario: Tenant delete protection
- **WHEN** a developer needs to prevent deleting a tenant with active occupancy
- **THEN** the guard is implemented against `contracts` FK constraints, not against `room_assignments`

### Requirement: Room assignments RLS policies
For historical reference, the system MUST document that RLS policies (`room_assignments_admin_all`, `room_assignments_manager_select`) existed only for the deprecated `room_assignments` table and were removed with the table.

#### Scenario: Policies removed with table
- **WHEN** the contract-as-assignment migration ran
- **THEN** the RLS policies for `room_assignments` were dropped together with the table

### Requirement: Generated TypeScript types for room_assignments
For historical reference, the system MUST document that `database.types.ts` previously included `room_assignments` Row/Insert/Update types. After the contract-as-assignment migration these types are no longer generated.

#### Scenario: Types absent after regen
- **WHEN** `database.types.ts` is regenerated against the current schema
- **THEN** `Tables<'room_assignments'>` is not present
