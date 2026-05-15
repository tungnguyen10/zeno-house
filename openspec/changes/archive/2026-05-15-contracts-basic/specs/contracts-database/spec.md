## ADDED Requirements

### Requirement: Contracts table schema
The system SHALL have a `contracts` table with columns: `id` (uuid PK default gen_random_uuid()), `room_id` (uuid NOT NULL FK → rooms.id ON DELETE RESTRICT), `tenant_id` (uuid NOT NULL FK → tenants.id ON DELETE RESTRICT), `start_date` (date NOT NULL), `end_date` (date NOT NULL), `monthly_rent` (numeric(12,0) NOT NULL), `deposit` (numeric(12,0) NOT NULL DEFAULT 0), `status` (text NOT NULL DEFAULT 'active' CHECK IN ('active', 'expired', 'terminated')), `notes` (text NULL), `created_at` (timestamptz NOT NULL DEFAULT now()), `updated_at` (timestamptz NOT NULL DEFAULT now()). A partial unique index SHALL enforce at most one `active` contract per room: `UNIQUE (room_id) WHERE status = 'active'`. An `updated_at` trigger SHALL reuse the existing `public.set_updated_at()` function.

#### Scenario: Migration creates table
- **WHEN** migration is applied
- **THEN** `contracts` table exists with all columns, FK constraints, partial unique index, and trigger

#### Scenario: One active contract per room enforced at DB level
- **WHEN** an INSERT is attempted for a room that already has an `active` contract
- **THEN** the database rejects the insert with a unique constraint violation

#### Scenario: Room delete blocked if contract exists
- **WHEN** a DELETE is attempted on a room that has any contract record
- **THEN** the database rejects with FK RESTRICT violation

#### Scenario: Tenant delete blocked if contract exists
- **WHEN** a DELETE is attempted on a tenant that has any contract record
- **THEN** the database rejects with FK RESTRICT violation

### Requirement: Contracts RLS policies
RLS SHALL be enabled on `contracts`. Policy `contracts_admin_all`: admin has full access (using and with check on `(auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'`). Policy `contracts_manager_select`: manager has SELECT only.

#### Scenario: Admin full access
- **WHEN** admin inserts, updates, or deletes a contract
- **THEN** operation succeeds

#### Scenario: Manager read-only
- **WHEN** manager attempts to insert or delete a contract
- **THEN** operation rejected by RLS

### Requirement: Generated TypeScript types for contracts
After migration, `database.types.ts` SHALL include `contracts` Row/Insert/Update types with correct column types.

#### Scenario: Types available after regen
- **WHEN** `database.types.ts` is regenerated via `supabase gen types typescript`
- **THEN** `Tables<'contracts'>` is available with all column types matching the schema
