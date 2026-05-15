## ADDED Requirements

### Requirement: service_fee_definitions table
`service_fee_definitions` SHALL have: `id` (uuid PK), `name` (text NOT NULL), `default_amount` (NUMERIC(12,2) NOT NULL), `description` (text nullable), `active` (boolean DEFAULT true), `created_at`, `updated_at`. RLS: admin all, manager select.

### Requirement: room_service_fees table
`room_service_fees` SHALL have: `id` (uuid PK), `room_id` (uuid FK → rooms CASCADE), `fee_definition_id` (uuid FK → service_fee_definitions RESTRICT), `amount_override` (NUMERIC(12,2) nullable — if null use default_amount), `active` (boolean DEFAULT true), `start_date` (date NOT NULL), `created_at`, `updated_at`. RLS: admin all, manager select.

#### Scenario: Tables created with correct schema
- **WHEN** migration runs
- **THEN** both tables exist with correct columns, FK constraints, and RLS policies
