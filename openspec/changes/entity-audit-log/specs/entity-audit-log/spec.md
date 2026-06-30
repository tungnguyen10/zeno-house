## ADDED Requirements

### Requirement: audit_events table
An append-only `public.audit_events` table tracks mutations on domain entities.

#### Schema
- `id` uuid PK
- `building_id` uuid NOT NULL FK → buildings (RLS anchor, CASCADE delete)
- `actor_id` uuid FK → auth.users (nullable — system actions have no actor)
- `action` text NOT NULL CHECK length > 0 (e.g. `room.updated`, `contract.terminated`)
- `entity_type` text NOT NULL CHECK IN ('building','room','tenant','contract','contract_renewal','meter_device')
- `entity_id` uuid (nullable for bulk/system events)
- `before_data` jsonb (nullable — null on creates)
- `after_data` jsonb (nullable — null on hard deletes)
- `metadata` jsonb NOT NULL DEFAULT '{}'
- `created_at` timestamptz NOT NULL DEFAULT now()

#### Indexes
- `(building_id, created_at DESC)` — timeline query
- `(entity_type, entity_id, created_at DESC)` — entity detail feed
- `(actor_id, created_at DESC)` — per-actor query

#### Scenario: Append-only RLS
- **WHEN** an authenticated manager tries to UPDATE or DELETE an audit event
- **THEN** the operation is denied by RLS

#### Scenario: Building-scoped manager read
- **WHEN** a manager queries audit_events
- **THEN** only events where `building_id IN (user's assigned buildings)` are returned

### Requirement: AUDIT_ACTIONS constants
A TypeScript `AUDIT_ACTIONS` constant object defines all valid action strings.

Covers: `building.created/updated/removed`, `room.created/updated/archived/removed`, `tenant.created/updated/removed`, `contract.created/updated/terminated/ended/renewed`.

### Requirement: AuditService.append
`AuditService.append(event, user, input)` appends an audit event. `actor_id` is sourced from `user.id`. If append throws, the error is caught, logged, and NOT re-thrown (audit failure must not break main operation).

### Requirement: Domain service audit wiring

#### Scenario: Contract mutation audit
- **WHEN** `ContractService.create/update/remove/bulkAction` completes successfully
- **THEN** `AuditService.append` is called with the appropriate action, before/after snapshot

#### Scenario: Room mutation audit
- **WHEN** `RoomService.create/update/remove/bulkAction` completes successfully
- **THEN** `AuditService.append` is called with the appropriate action

#### Scenario: Tenant mutation audit
- **WHEN** `TenantService.create/update/remove/bulkAction` completes successfully
- **THEN** `AuditService.append` is called with the appropriate action

#### Scenario: Building mutation audit
- **WHEN** `BuildingService.create/update/remove/bulkAction` completes successfully
- **THEN** `AuditService.append` is called with the appropriate action

### Requirement: GET /api/audit endpoint
Returns paginated audit events. Query params: `building_id` (required for manager), `entity_type` (optional filter), `entity_id` (optional filter), `limit` (default 50, max 200).

Response: `{ data: AuditEvent[], meta: { total: number } }`

## MODIFIED Requirements

### Requirement: buildings-api — mutation audit
**Capability**: `buildings-api`

#### Scenario: BuildingService mutations emit audit events
- **WHEN** any mutation method on `BuildingService` is called
- **THEN** an audit event is written to `audit_events` (in addition to existing behavior)

### Requirement: rooms-api — mutation audit
**Capability**: `rooms-api`

#### Scenario: RoomService mutations emit audit events
- **WHEN** any mutation method on `RoomService` is called
- **THEN** an audit event is written to `audit_events`

### Requirement: tenants-api — mutation audit
**Capability**: `tenants-api`

#### Scenario: TenantService mutations emit audit events
- **WHEN** any mutation method on `TenantService` is called
- **THEN** an audit event is written to `audit_events`

### Requirement: contracts-api — mutation audit
**Capability**: `contracts-api`

#### Scenario: ContractService mutations emit audit events
- **WHEN** any mutation method on `ContractService` is called
- **THEN** an audit event is written to `audit_events`
