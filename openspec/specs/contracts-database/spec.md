## Purpose

Database schema for contracts. Enforces one-active-contract-per-room at DB level via partial unique index. FK RESTRICT prevents orphan deletion.
## Requirements
### Requirement: Contracts table schema
The system SHALL have a `contracts` table with columns: `id` (uuid PK default gen_random_uuid()), `room_id` (uuid NOT NULL FK → rooms.id ON DELETE RESTRICT), `tenant_id` (uuid NOT NULL FK → tenants.id ON DELETE RESTRICT), `building_id` (uuid NOT NULL FK → buildings), `start_date` (date NOT NULL), `end_date` (date NOT NULL), `monthly_rent` (numeric(12,0) NOT NULL), `deposit` (numeric(12,0) NOT NULL DEFAULT 0), `payment_due_day` (smallint NULL CHECK BETWEEN 1 AND 31 — NULL means inherit from building), contract commercial terms, status, notes, renewal links, and timestamps. A partial unique index SHALL enforce at most one active contract per room and the existing updated-at trigger SHALL remain.

#### Scenario: Due-day column is renamed without data loss
- **WHEN** the due-policy migration is applied to a contract with `payment_day = 5`
- **THEN** the row has `payment_due_day = 5` and no `payment_day` column

#### Scenario: Payment due day accepts null
- **WHEN** a contract is created without `payment_due_day`
- **THEN** `payment_due_day` is stored as NULL so billing can inherit from the building

#### Scenario: Payment due day rejects invalid values
- **WHEN** an insert or update supplies `payment_due_day` outside 1 through 31
- **THEN** the database rejects the write

#### Scenario: Existing contract integrity remains
- **WHEN** the migration is applied
- **THEN** existing foreign keys, active-room uniqueness, status constraints, and updated-at behavior remain in force

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
`POST /api/contracts` body SHALL accept optional `payment_due_day` (integer 1–31). All other validations unchanged.

#### Scenario: Create with payment_due_day
- **WHEN** admin POSTs contract with payment_due_day: 5
- **THEN** contract created with payment_due_day = 5

#### Scenario: Create without payment_due_day
- **WHEN** admin POSTs contract without payment_due_day field
- **THEN** contract created with payment_due_day = NULL

### Requirement: Create contract page
`/contracts/create` ContractForm SHALL include an optional `payment_due_day` field (number input 1–31, label "Ngày đến hạn riêng (1–31)"). All other create wizard behavior unchanged.

#### Scenario: Payment day field visible
- **WHEN** admin opens /contracts/create
- **THEN** ContractForm shows optional payment_due_day input in commercial terms section

#### Scenario: Payment day omitted
- **WHEN** admin submits form without filling payment_due_day
- **THEN** contract created with payment_due_day = null
