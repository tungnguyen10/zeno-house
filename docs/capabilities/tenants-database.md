---
type: Capability Specification
title: "tenants-database"
status: stable
tags: [capability, requirements]
sources:
  - resource: "https://github.com/tungnguyen10/zeno-house/blob/ae95811bbdc1932368b4e6b9ed3e9540399d26e6/openspec/specs/tenants-database/spec.md"
generated:
  by: "process:okf-migration"
  at: "2026-11-06T00:00:00Z"
---

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


### Requirement: Canonical identity uniqueness
Tenant phones SHALL be unique globally in `tenants_phone_uq`. Non-null ID numbers SHALL be unique globally in the partial `tenants_id_number_uq`. A before-insert/update trigger SHALL normalize identity fields for all writers. SQL and TypeScript SHALL share the normalization fixture, including Unicode whitespace/case. Invalid legacy phones SHALL retain their compact values rather than becoming null; API validators SHALL reject new invalid phones.

The identity migration SHALL lock tenant writes, abort if canonical duplicate groups remain, normalize changed rows and create indexes in one transaction. Preflight SHALL expose only group membership IDs/codes and counts, without phone/ID/name values. Existing duplicates require manual administrative correction; automatic merging is excluded. Normalization may update `updated_at` through the existing trigger.

#### Scenario: Existing normalized duplicates
- **WHEN** migration preflight finds multiple rows with the same canonical identity
- **THEN** migration aborts with group counts and no identifying values

#### Scenario: Direct SQL duplicate
- **WHEN** a writer inserts a separator/country-prefix variant of an existing phone
- **THEN** the trigger canonicalizes it and the phone unique index rejects it

#### Scenario: Multiple absent ID numbers
- **WHEN** tenants have null or blank ID numbers
- **THEN** blank IDs become null and do not conflict through the partial index

Implementation and production rollout evidence: [tenant identity hardening](../history/2026-11-09-harden-tenant-identity-data/index.md). Production database rollout and SQL verification passed on 2026-11-09; application branch deployment is separate.
