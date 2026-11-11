---
type: Capability Specification
title: "rooms-database"
status: stable
tags: [capability, requirements]
sources:
  - resource: "https://github.com/tungnguyen10/zeno-house/blob/ae95811bbdc1932368b4e6b9ed3e9540399d26e6/openspec/specs/rooms-database/spec.md"
generated:
  by: "process:okf-migration"
  at: "2026-11-06T00:00:00Z"
---

## Purpose

Database schema for the `rooms` table. A room belongs to a building, has a status (available/occupied/maintenance), and tracks rent and area. Room numbers are unique per building.
## Requirements
### Requirement: Rooms table schema
The system SHALL have a `rooms` table with columns: `id` (uuid PK), `building_id` (uuid FK→buildings CASCADE), `room_number` (text NOT NULL), `floor` (integer DEFAULT 1), `status` (text DEFAULT 'available', CHECK IN ('available','occupied','maintenance')), `monthly_rent` (numeric(12,0) DEFAULT 0), `area` (numeric(6,2) nullable), `description` (text nullable), `created_at` (timestamptz), `updated_at` (timestamptz). UNIQUE constraint on `(building_id, room_number)`.

#### Scenario: Room number unique per building
- **WHEN** admin creates two rooms with same `room_number` in same building
- **THEN** database rejects with unique constraint violation

#### Scenario: Cascade delete
- **WHEN** a building is deleted
- **THEN** all its rooms are automatically deleted

### Requirement: Rooms RLS policies
The system SHALL enforce RLS on `rooms` table: admin role has full access (ALL), manager role has SELECT only. Role is read from `(auth.jwt() -> 'app_metadata' ->> 'role')`.

#### Scenario: Admin can insert room
- **WHEN** authenticated user with role 'admin' inserts a room
- **THEN** insert succeeds

#### Scenario: Manager cannot insert room
- **WHEN** authenticated user with role 'manager' inserts a room
- **THEN** insert is rejected by RLS

### Requirement: updated_at auto-trigger
The system SHALL automatically update `updated_at` on every row update via a trigger.

#### Scenario: Auto-update timestamp
- **WHEN** a room row is updated
- **THEN** `updated_at` reflects the current timestamp

### Requirement: rooms.status accepts 'archived'
The `rooms.status` column SHALL accept value `'archived'` in addition to `'available'`, `'occupied'`, and `'maintenance'`. The check constraint SHALL be updated to permit the new value while keeping existing rows valid (no data migration required since default is unchanged).

#### Scenario: Insert with archived status
- **WHEN** an admin updates a room to `status='archived'` via the soft-archive endpoint
- **THEN** the row update succeeds and the constraint does not reject

#### Scenario: Existing rows unaffected
- **WHEN** the migration runs against an existing database
- **THEN** all existing rows remain valid and their status values unchanged

### Requirement: Atomic room batch RPCs
The database SHALL provide `public.create_rooms_batch(p_building_id uuid, p_rooms jsonb)` and `public.create_building_with_rooms(p_building jsonb, p_rooms jsonb, p_assign_owner uuid, p_actor_id uuid, p_request_id uuid)`. Both SHALL be `SECURITY INVOKER` with `search_path = ''`, executable only by `service_role`. `create_rooms_batch` SHALL serialize per building with an advisory lock, validate 1–200 rooms and field bounds (`ROOM_BATCH_INVALID`), reject any room number or slug duplicated within the batch or against existing rooms of the building (`ROOM_BATCH_DUPLICATE`, errcode 23505, `detail` = JSON array of room numbers), and insert all rooms with `status = 'available'` and `code = building.code || '-' || slug`. `create_building_with_rooms` SHALL insert the building, the optional owner assignment, the rooms and a completed `audit_operations` marker keyed `building.create:<request_id>` in one transaction, replay the stored result for the same actor and raise `BUILDING_SETUP_REQUEST_CONFLICT` for another actor.

#### Scenario: Duplicate rolls back everything
- **WHEN** a batch contains a duplicate room
- **THEN** no building, room, assignment or operation row remains

#### Scenario: Concurrent batches on one building
- **WHEN** two sessions call the RPC for the same building or request at the same time
- **THEN** the second waits for the first transaction to finish
