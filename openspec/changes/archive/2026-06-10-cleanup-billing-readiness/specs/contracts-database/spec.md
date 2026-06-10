## MODIFIED Requirements

### Requirement: Contracts table schema
The system SHALL have a `contracts` table with columns: `id` (uuid PK default gen_random_uuid()), `room_id` (uuid NOT NULL FK → rooms.id ON DELETE RESTRICT), `tenant_id` (uuid NOT NULL FK → tenants.id ON DELETE RESTRICT), `building_id` (uuid NOT NULL FK → buildings — resolved from the room when omitted by input), `start_date` (date NOT NULL), `end_date` (date NOT NULL), `monthly_rent` (numeric(12,0) NOT NULL), `deposit` (numeric(12,0) NOT NULL DEFAULT 0), `payment_day` (smallint NULL CHECK BETWEEN 1 AND 31 — NULL means inherit from building), `discount_amount` (numeric(12,0) NOT NULL DEFAULT 0), `surcharge_amount` (numeric(12,0) NOT NULL DEFAULT 0), `occupant_count` (int NOT NULL DEFAULT 1), `status` (text NOT NULL DEFAULT 'active' CHECK IN ('active', 'expired', 'terminated', 'renewed')), `notes` (text NULL), `previous_contract_id` (uuid NULL FK → contracts.id), `original_end_date` (date NULL), `renewal_count` (int NOT NULL DEFAULT 0), `created_at` (timestamptz NOT NULL DEFAULT now()), `updated_at` (timestamptz NOT NULL DEFAULT now()). A partial unique index SHALL enforce at most one `active` contract per room: `UNIQUE (room_id) WHERE status = 'active'`.

#### Scenario: payment_day column added
- **WHEN** migration `20260531000001` is applied
- **THEN** contracts table has `payment_day` smallint NULL with CHECK constraint

#### Scenario: payment_day persists on create
- **WHEN** an admin creates a contract with `payment_day = 5`
- **THEN** the contract row stores `payment_day = 5`

#### Scenario: payment_day accepts null
- **WHEN** a contract is created or updated with `payment_day = null`
- **THEN** `payment_day` is stored as NULL and billing will inherit the building due day

#### Scenario: building_id is never written as empty string
- **WHEN** a contract is created without explicit `building_id`
- **THEN** the service resolves `building_id` from the selected room before insert
- **AND** the repository never writes an empty string fallback

