## ADDED Requirements

### Requirement: All domain tables are created via migration script
The system SHALL have a single SQL migration file that creates all domain tables: `profiles`, `buildings`, `rooms`, `tenants`, `room_tenants`, `contracts`, `contract_templates`, `invoices`, `invoice_service_fees`, `invoice_discounts`, `utility_readings`, `meter_changes`, `service_fee_types`, `room_service_fees`, `expenses`, `expense_categories`, `maintenance_requests`, `notifications`, `notification_settings`, `payments`, `promotions`, `applied_promotions`, `room_transfers`.

#### Scenario: Migration runs cleanly
- **WHEN** migration script is applied to a fresh Supabase project
- **THEN** all tables are created with correct columns, types, and constraints without errors

#### Scenario: Foreign key constraints are enforced
- **WHEN** a record referencing a non-existent parent is inserted
- **THEN** the database rejects the insert with a foreign key violation error

### Requirement: Row Level Security is enabled on all tables
Every table SHALL have RLS enabled with policies for all 3 roles. RLS MUST NOT be disabled on any table.

#### Scenario: RLS blocks unauthenticated access
- **WHEN** an unauthenticated request attempts to SELECT from any table
- **THEN** the query returns zero rows (not an error, per Supabase RLS default-deny)

#### Scenario: Admin has full access
- **WHEN** an authenticated user with role `admin` queries any table
- **THEN** all rows are returned regardless of ownership

#### Scenario: Manager sees only their assigned buildings
- **WHEN** an authenticated user with role `manager` queries `rooms`
- **THEN** only rooms belonging to buildings assigned to that manager are returned

#### Scenario: Tenant sees only their own data
- **WHEN** an authenticated user with role `tenant` queries `invoices`
- **THEN** only invoices linked to that tenant's active contract are returned

### Requirement: Storage buckets are created with correct access policies
The system SHALL create 4 storage buckets: `avatars` (public read), `documents` (private), `meters` (private), `contracts` (private).

#### Scenario: Avatar bucket is publicly readable
- **WHEN** any user (including unauthenticated) requests a file from the `avatars` bucket
- **THEN** the file is served without requiring authentication

#### Scenario: Private buckets require authentication
- **WHEN** an unauthenticated request attempts to download from `documents`, `meters`, or `contracts`
- **THEN** the request is rejected with a 403 error

#### Scenario: Users can only access their own private files
- **WHEN** an authenticated tenant requests a file from `contracts` that belongs to another tenant
- **THEN** the request is rejected with a 403 error

### Requirement: profiles table stores role and is linked to Supabase Auth
The `profiles` table SHALL have a `role` column (enum: `admin | manager | tenant`) and a foreign key to `auth.users`. A trigger SHALL create a profile row when a new auth user is created.

#### Scenario: Profile is auto-created on signup
- **WHEN** a new user signs up via Supabase Auth
- **THEN** a corresponding row is inserted in `profiles` with a default role

#### Scenario: Role enum is enforced
- **WHEN** an insert or update sets `role` to an invalid value
- **THEN** the database rejects it with a constraint violation
