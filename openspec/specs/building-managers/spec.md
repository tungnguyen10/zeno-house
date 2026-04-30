# Spec: Building Managers

## Purpose

Defines the `building_managers` junction table that replaces the `buildings.manager_id` column. Enables multiple managers per building with per-feature permission grants (`rooms`, `contracts`, `invoices`, `tenants`, `utilities`).

## Requirements

### Requirement: building_managers table stores per-building per-feature grants
The system SHALL have a `building_managers` table that records which manager has been granted access to a building, and which feature subset they may access. Valid feature keys are: `rooms`, `contracts`, `invoices`, `tenants`, `utilities`.

#### Scenario: Manager assigned to a building with partial permissions
- **WHEN** an admin inserts a row `(building_id=A, manager_id=M, permissions=['rooms','invoices'])`
- **THEN** manager M can access rooms and invoices for building A but not contracts, tenants, or utilities

#### Scenario: Same manager can manage multiple buildings
- **WHEN** two rows exist for the same `manager_id` with different `building_id` values
- **THEN** the manager sees both buildings in their dashboard with their respective permission sets

#### Scenario: Unique constraint prevents duplicate assignments
- **WHEN** an admin attempts to insert a second row for the same `(building_id, manager_id)` pair
- **THEN** the database rejects it with a unique constraint violation

### Requirement: RLS policy restricts building_managers reads to admin and assigned manager
The `building_managers` table SHALL have RLS enabled. Admins can read all rows. A manager can only read their own rows.

#### Scenario: Admin reads all building_managers rows
- **WHEN** a user with `role = 'admin'` queries `building_managers`
- **THEN** all rows are returned

#### Scenario: Manager reads only their own rows
- **WHEN** a user with `role = 'manager'` queries `building_managers`
- **THEN** only rows where `manager_id = auth.uid()` are returned

#### Scenario: Tenant cannot read building_managers
- **WHEN** a user with `role = 'tenant'` queries `building_managers`
- **THEN** zero rows are returned

### Requirement: buildings.manager_id column is dropped after backfill
The `buildings.manager_id` column SHALL be removed once `building_managers` is populated via backfill migration. All queries previously using `buildings.manager_id` SHALL be updated to join `building_managers`.

#### Scenario: No manager_id column on buildings
- **WHEN** a developer queries `information_schema.columns` for `buildings.manager_id`
- **THEN** no such column exists

### Requirement: Existing building-manager relationships are preserved during migration
A backfill migration SHALL insert one row into `building_managers` per existing `(building_id, manager_id)` pair in `buildings`, with `permissions = '{rooms,contracts,invoices,tenants,utilities}'` (full grant).

#### Scenario: Backfill preserves all existing assignments
- **WHEN** the backfill migration runs on a database with 5 buildings each having a manager_id
- **THEN** 5 rows exist in `building_managers` with full permissions for each pair
