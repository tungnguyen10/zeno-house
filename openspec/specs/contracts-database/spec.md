## Purpose

Database schema for contracts. Enforces one-active-contract-per-room at DB level via partial unique index. FK RESTRICT prevents orphan deletion.

## Requirements

### Requirement: Contracts table schema
The system SHALL have a `contracts` table with columns: `id` (uuid PK default gen_random_uuid()), `room_id` (uuid NOT NULL FK → rooms.id ON DELETE RESTRICT), `tenant_id` (uuid NOT NULL FK → tenants.id ON DELETE RESTRICT), `building_id` (uuid NOT NULL FK → buildings — backfilled from rooms.building_id), `start_date` (date NOT NULL), `end_date` (date NOT NULL), `monthly_rent` (numeric(12,0) NOT NULL), `deposit` (numeric(12,0) NOT NULL DEFAULT 0), `payment_day` (smallint NULL CHECK BETWEEN 1 AND 31 — NULL means inherit from building), `discount_amount` (numeric(12,0) NOT NULL DEFAULT 0), `surcharge_amount` (numeric(12,0) NOT NULL DEFAULT 0), `occupant_count` (int NOT NULL DEFAULT 1), `status` (text NOT NULL DEFAULT 'active' CHECK IN ('active', 'expired', 'terminated', 'renewed')), `notes` (text NULL), `previous_contract_id` (uuid NULL FK → contracts.id — renewal back-link), `original_end_date` (date NULL — set on first renewal), `renewal_count` (int NOT NULL DEFAULT 0), `created_at` (timestamptz NOT NULL DEFAULT now()), `updated_at` (timestamptz NOT NULL DEFAULT now()). A partial unique index SHALL enforce at most one `active` contract per room: `UNIQUE (room_id) WHERE status = 'active'`. An `updated_at` trigger SHALL reuse the existing `public.set_updated_at()` function.

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

#### Scenario: building_id is NOT NULL after migration
- **WHEN** migration `20260531000000` is applied
- **THEN** all existing contracts have building_id populated from rooms.building_id and the column is NOT NULL

#### Scenario: payment_day column added
- **WHEN** migration `20260531000001` is applied
- **THEN** contracts table has payment_day smallint NULL with CHECK constraint

#### Scenario: payment_day accepts null (inherit building)
- **WHEN** a contract is created without payment_day
- **THEN** payment_day is stored as NULL

#### Scenario: payment_day rejects invalid value
- **WHEN** a contract is created with payment_day = 0 or 32
- **THEN** database rejects with CHECK constraint violation

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

### Requirement: Get contract by id endpoint
`GET /api/contracts/:id` SHALL return a single contract including joined `room` (id, room_number, floor, **building_id**, building_name) and `tenant` (id, full_name, phone). Returns 404 if not found.

#### Scenario: Room buildingId exposed in response
- **WHEN** admin calls GET /api/contracts/:id
- **THEN** response includes `room.buildingId` as non-null string

#### Scenario: Contract not found
- **WHEN** id does not match any contract
- **THEN** returns 404 NOT_FOUND

### Requirement: Create contract endpoint
`POST /api/contracts` body SHALL accept optional `payment_day` (integer 1–31). All other validations unchanged.

#### Scenario: Create with payment_day
- **WHEN** admin POSTs contract with payment_day: 5
- **THEN** contract created with payment_day = 5

#### Scenario: Create without payment_day
- **WHEN** admin POSTs contract without payment_day field
- **THEN** contract created with payment_day = NULL

### Requirement: Create contract page
`/contracts/create` ContractForm SHALL include an optional `payment_day` field (number input 1–31, label "Ngày thanh toán (ghi đè tòa nhà)"). All other create wizard behavior unchanged.

#### Scenario: Payment day field visible
- **WHEN** admin opens /contracts/create
- **THEN** ContractForm shows optional payment_day input in commercial terms section

#### Scenario: Payment day omitted
- **WHEN** admin submits form without filling payment_day
- **THEN** contract created with payment_day = null
