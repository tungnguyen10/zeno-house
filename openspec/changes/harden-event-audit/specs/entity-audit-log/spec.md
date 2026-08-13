## MODIFIED Requirements

### Requirement: audit_events table
The system SHALL store business mutations in an append-only `public.audit_events` table whose historical building scope survives deletion of the live building row. `building_id` SHALL remain the immutable scope UUID without a cascading foreign key, and metadata SHALL retain a safe building name/code snapshot when available. Audit rows SHALL support a unique nullable `operation_id` for idempotent completion.

#### Scenario: Building is hard-deleted
- **WHEN** an authorized hard-delete removes a building
- **THEN** all prior audit events remain and one `building.removed` event retains the deleted building UUID and safe snapshot

#### Scenario: Append-only direct access
- **WHEN** an `anon` or `authenticated` client attempts to select, insert, update, or delete audit rows directly
- **THEN** database privileges deny the operation

### Requirement: AuditService.append
Business mutation services SHALL NOT rely on fail-open post-commit audit append. Database-local mutations SHALL use an audited transaction, while cross-system mutations SHALL persist durable intent before the external call. Sanitization SHALL remove credentials, sessions, signed URLs, binary content, and private Storage paths before persistence.

#### Scenario: Database audit insert fails
- **WHEN** the audit insert for a database-local business mutation fails
- **THEN** the domain mutation rolls back

#### Scenario: Private payload fields are supplied
- **WHEN** an audit payload includes credential material, signed access, binary data, or private object paths
- **THEN** those fields are absent from persisted snapshots and structured telemetry

### Requirement: AuditService.appendBulk
A bulk business mutation SHALL atomically persist one aggregate parent event and exactly one correlated child event per successful entity. Each child SHALL carry its correct action, historical building scope, and projected before/after snapshots. A service SHALL NOT emit an additional standalone event for the same child mutation.

#### Scenario: Bulk delete succeeds partially
- **WHEN** a bulk delete has successful and failed items
- **THEN** one parent records totals and each successful entity has exactly one correctly scoped `*.removed` child

#### Scenario: Bulk child audit fails
- **WHEN** any required child audit insert fails in the database transaction
- **THEN** the corresponding domain mutation does not commit without its event

### Requirement: Domain service audit wiring
Domain services SHALL route every business mutation through either an atomic audited repository operation or a durable cross-system audit operation. Tenant activation SHALL use `tenant.activated`; invoice email settings and invoice profile-snapshot refresh SHALL use their canonical actions. Contract room-status side effects and renewal successors SHALL be correlated into the originating operation.

#### Scenario: Tenant bulk activation
- **WHEN** tenants are activated in bulk
- **THEN** every successful child event uses `tenant.activated` and the correct historical building scope

#### Scenario: Contract changes room occupancy
- **WHEN** contract creation, update, termination, or reassignment changes a room status
- **THEN** the operation includes a correlated `room.updated` event for each changed room

#### Scenario: Renewal creates a successor
- **WHEN** a renewal creates a new contract
- **THEN** the source receives `contract.renewed` and the successor receives a correlated `contract.created` event

### Requirement: GET /api/audit endpoint
The API SHALL return cursor-paginated audit events through server-owned authorization. Scoped roles SHALL require and resolve a live in-scope building. Admin SHALL additionally be able to query a deleted building by its preserved UUID without requiring a live building row.

#### Scenario: Admin queries deleted building UUID
- **WHEN** an admin requests audit with a valid UUID whose building row was deleted
- **THEN** events with that historical `building_id` are returned

#### Scenario: Scoped role queries deleted or unassigned building
- **WHEN** an owner or manager requests a deleted or out-of-scope building UUID
- **THEN** the API returns not found or forbidden and exposes no events

### Requirement: Atomic financial and multi-row audit
All financial, permission, destructive, bulk, and multi-row database mutations SHALL commit their domain rows and semantic audit rows in one transaction. Mutating RPCs SHALL only be executable by `service_role`.

#### Scenario: Billing status mutation audit fails
- **WHEN** close, reopen, unissue, single payment, payment undo, or utility override cannot insert its audit rows
- **THEN** its billing mutation rolls back

#### Scenario: Destructive master-data audit fails
- **WHEN** a hard-delete cannot persist its required audit event
- **THEN** the target entity and its existing history remain unchanged
