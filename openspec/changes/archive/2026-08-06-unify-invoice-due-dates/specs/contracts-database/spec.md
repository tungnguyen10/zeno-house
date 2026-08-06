## MODIFIED Requirements

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
