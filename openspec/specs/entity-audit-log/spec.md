## Purpose

Tracks append-only audit history for master data, permissions, contracts, operations, and tenant portal mutations. Billing audit remains a separate capability.

## Requirements

### Requirement: audit_events table
The system SHALL store mutations on domain entities in an append-only `public.audit_events` table.

#### Schema
- `id` uuid PK
- `building_id` uuid FK -> buildings (nullable - NULL for tenant events without building context; CASCADE delete when set)
- `actor_id` uuid FK -> auth.users (nullable - system actions have no actor)
- `action` text NOT NULL CHECK length > 0 (e.g. `room.updated`, `contract.terminated`)
- `entity_type` text NOT NULL CHECK IN the canonical `AUDIT_ENTITY_TYPES` tuple: `building`, `room`, `tenant`, `contract`, `contract_renewal`, `building_service`, `contract_service`, `meter_device`, `user`, `building_expense`, `building_fixed_cost`, `recurring_expense`, `prepaid_expense`, `support_request`, `contract_occupant`, `contract_payment`, `service_catalog_item`, `shared_expense`, `reserve_fund`, `reserve_fund_rate`, `operations_report_period`, `tenant_document`
- `entity_id` uuid (nullable - null on aggregate bulk events)
- `correlation_id` uuid (nullable - links per-entity child events to their aggregate parent)
- `before_data` jsonb (nullable - null on creates)
- `after_data` jsonb (nullable - null on hard deletes)
- `metadata` jsonb NOT NULL DEFAULT '{}'
- `created_at` timestamptz NOT NULL DEFAULT now()

#### Indexes
- `(building_id, created_at DESC)` WHERE building_id IS NOT NULL - building timeline query
- `(entity_type, entity_id, created_at DESC)` - entity detail feed
- `(actor_id, created_at DESC)` - per-actor query
- `(correlation_id)` WHERE correlation_id IS NOT NULL - fetch all children of a bulk event

#### Scenario: Append-only RLS
- **WHEN** an authenticated manager tries to UPDATE or DELETE an audit event
- **THEN** the operation is denied by RLS

#### Scenario: Building-scoped manager read
- **WHEN** a manager queries audit_events
- **THEN** only events where `building_id IN (user's assigned buildings)` are returned
- **NOTE** tenant events with `building_id = NULL` are NOT visible to managers; only admins can see them

#### Scenario: Tenant audit with no building context
- **WHEN** `TenantService.create/update/remove` is called without a known building_id
- **THEN** the audit event is written with `building_id = NULL`
- **AND** the event is still queryable by admin via entity_type + entity_id filters

### Requirement: AUDIT_ACTIONS constants
The system SHALL define all valid action strings in a TypeScript `AUDIT_ACTIONS` constant object.

Covers:
- `building.created` / `building.updated` / `building.removed`
- `room.created` / `room.updated` / `room.archived` / `room.activated` / `room.maintenance_set` / `room.removed`
- `tenant.created` / `tenant.updated` / `tenant.removed`
- `contract.created` / `contract.updated` / `contract.terminated` / `contract.expired` / `contract.renewed`

**Note**: `contract.terminated` = manual early termination (status -> `terminated`). `contract.expired` = natural expiry (status -> `expired`). `contract.ended` is NOT used.

The constants SHALL also cover assignment updates; building and contract service lifecycle; contract occupants and payments; expense receipts; shared expenses; reserve fund rates and accrual refresh; operations report close/reopen; and tenant profile/document lifecycle.

#### Scenario: Constants expose supported actions
- **WHEN** domain services need to append audit events for buildings, rooms, tenants, or contracts
- **THEN** they use action strings from `AUDIT_ACTIONS`
- **AND** `contract.ended` is not exposed as a valid contract action

### Requirement: AuditService.append
`AuditService.append(event, user, input)` SHALL append an audit event. `actor_id` is sourced from `user.id`, or NULL for a system action. If append throws, the error is caught, logged with action/entity context, and NOT re-thrown (audit failure must not break simple CRUD). Structured error logs SHALL NOT contain snapshots.

Before persistence, audit payloads SHALL recursively remove passwords, access/refresh/storage tokens, sessions, signed URLs, and binary content.

#### Scenario: Append injects actor and fails silent
- **WHEN** a domain service calls `AuditService.append(event, user, input)`
- **THEN** the appended audit event uses `user.id` as `actor_id`
- **AND** an audit append failure is logged without breaking the main operation

### Requirement: AuditService.appendBulk
`AuditService.appendBulk(event, user, bulkInput)` SHALL handle bulk action audit in two steps:
1. Insert one **aggregate parent event** (`entity_id = null`, `metadata = { action, total, succeeded, failed }`) and capture its `id`.
2. For each succeeded entity, insert a **per-entity child event** (`entity_id = <id>`, `correlation_id = parent.id`).

All inserts are best-effort (same silent-fail rule). The `correlation_id` field links child events back to the parent aggregate.

#### Scenario: Bulk action audit linkage
- **WHEN** a bulk action completes (e.g. bulk archive 10 rooms)
- **THEN** one aggregate event is written with `entity_id = null` and summary metadata
- **AND** one child event is written per succeeded entity, each carrying `correlation_id = parent.id`
- **AND** querying by `entity_type + entity_id` returns the per-entity child event with its `correlation_id`

### Requirement: Domain service audit wiring
Domain services SHALL append audit events after successful entity mutations.

#### Scenario: Contract mutation audit
- **WHEN** `ContractService.create/update/remove/bulkAction` completes successfully
- **THEN** `AuditService.append` is called with the appropriate action, before/after snapshot
- **AND** for `update`, the action is derived from the resulting status: `terminated` -> `contract.terminated`, `expired` -> `contract.expired`, otherwise `contract.updated`

#### Scenario: Contract renewal audit
- **WHEN** `ContractRenewalService.renew` completes successfully
- **THEN** `AuditService.append` is called with action `contract.renewed` on the source contract entity

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
The API SHALL return paginated audit events from `GET /api/audit`.

Query params:
- `building_id` - required for scoped roles (`owner`, `manager`); optional for admin (omit to query all buildings including tenant events with NULL building_id)
- `entity_type` - optional filter
- `entity_id` - optional filter
- `correlation_id` - optional filter (fetch all children of a bulk event)
- `limit` - default 50, max 200
- `cursor` - stable opaque position composed from `(created_at, id)`

Response: `{ data: AuditEvent[], meta: { total: number, nextCursor: string | null } }`

#### Scenario: Stable cursor pagination
- **WHEN** multiple events share the same `created_at`
- **THEN** pages are ordered by `created_at DESC, id DESC`
- **AND** following `nextCursor` neither duplicates nor skips an event

### Requirement: Atomic financial and multi-row audit
Reserve-funded expense creation, shared-expense allocation, building-to-contract service sync, operations report close, reserve accrual refresh, and report reopen SHALL persist their domain mutation and audit rows in one database transaction. Their RPCs SHALL only be executable by `service_role`.

#### Scenario: Reserve-funded expense creation rolls back as a unit
- **WHEN** the expense, linked reserve deduction, or audit insert fails
- **THEN** none of those three rows is committed

#### Scenario: Shared allocation correlation
- **WHEN** a shared expense is allocated
- **THEN** one `shared_expense.allocated` parent event and one `building_expense.created` child per generated expense are committed with a shared correlation ID
- **AND** any failure rolls back both expenses and audit events

#### Scenario: Operations report lifecycle atomicity
- **WHEN** a report is closed, auto-closed, refreshed, or reopened
- **THEN** closure/accrual state and its audit event commit together
- **AND** close metadata contains the accrual snapshot representing the user-level operation
- **AND** reopening retains the inactive-while-open accrual row and records its snapshot in metadata
- **AND** retrying an auto-close for an already closed period is a no-op without a duplicate event
- **AND** manually closing an already closed period is rejected without changing its provenance

#### Scenario: Admin queries without building_id
- **WHEN** an admin calls GET /api/audit without `building_id`
- **THEN** all audit events are returned (including tenant events with NULL building_id)

#### Scenario: Manager requires building_id
- **WHEN** a manager calls GET /api/audit without `building_id`
- **THEN** the API returns VALIDATION_ERROR

#### Scenario: Owner requires building_id
- **WHEN** an owner calls GET /api/audit without `building_id`
- **THEN** the API returns VALIDATION_ERROR

#### Scenario: Owner queries scoped building audit
- **WHEN** owner calls audit API with `building_id` in owner scope
- **THEN** response includes audit events for that building

#### Scenario: Owner cannot query unscoped building audit
- **WHEN** owner calls audit API with `building_id` outside owner scope
- **THEN** response is 404 Not Found or 403 Forbidden according to read/mutation semantics

### Requirement: Audit access is scoped for owner and manager
Audit log APIs SHALL allow admin global queries. Owner and manager SHALL be restricted to building-scoped audit queries and SHALL pass building scope checks.

#### Scenario: Admin queries global audit
- **WHEN** admin calls audit API without `building_id`
- **THEN** response includes global audit events according to filters

#### Scenario: Owner must provide building_id
- **WHEN** owner calls audit API without `building_id`
- **THEN** response is 422 Validation Error

#### Scenario: Owner queries scoped building audit access
- **WHEN** owner calls audit API with `building_id` in owner scope
- **THEN** response includes audit events for that building

#### Scenario: Owner cannot query unscoped building audit access
- **WHEN** owner calls audit API with `building_id` outside owner scope
- **THEN** response is 404 Not Found or 403 Forbidden according to read/mutation semantics

### Requirement: Audit authorization uses app_metadata role
Audit authorization SHALL use `user.app_metadata.role` or shared role helpers and SHALL NOT use top-level `user.role`.

#### Scenario: Top-level role mismatch
- **WHEN** request user has top-level `role = 'admin'` but `app_metadata.role = 'owner'`
- **THEN** audit access is evaluated as owner scoped access

### Requirement: Pending account decisions are audited
The system SHALL define and append audit actions for access-request creation, approval, and rejection. Approval metadata SHALL include the granted role and selected scope identifiers; rejection metadata SHALL include the reason. Audit payloads SHALL NOT contain passwords, OAuth tokens, recovery tokens, or session data.

#### Scenario: Approval audit
- **WHEN** admin successfully approves a request
- **THEN** one `user.access_request.approved` event identifies the target user, granted role, and scope without secrets

#### Scenario: Rejection audit
- **WHEN** admin rejects a request
- **THEN** one `user.access_request.rejected` event identifies the target user and reason without secrets

#### Scenario: Pending creation audit is service-owned
- **WHEN** the application first observes a trigger-created pending request
- **THEN** it records `user.access_request.created` at most once for that request
