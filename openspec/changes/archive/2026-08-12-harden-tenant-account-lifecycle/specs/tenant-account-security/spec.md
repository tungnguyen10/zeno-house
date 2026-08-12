## ADDED Requirements

### Requirement: Tenant Auth and link state remains consistent
The system SHALL detect tenant-role Auth identities without `tenant_user_links` as `orphaned` and links without an Auth identity as `missing_auth`. Only admin SHALL list or reconcile orphan identities, and reconciliation SHALL require an explicit request per identity.

#### Scenario: Admin lists orphan identity
- **WHEN** an admin opens tenant account management and a tenant-role Auth identity has no link
- **THEN** the identity is shown as `orphaned` without guessing a tenant assignment

#### Scenario: Owner cannot enumerate orphans
- **WHEN** an owner requests orphan reconciliation data
- **THEN** the request is rejected

#### Scenario: Admin reconciles orphan
- **WHEN** an admin confirms reconciliation for an orphan identity
- **THEN** the Auth identity is hard-deleted or irreversibly soft-deleted and the actual outcome is returned

### Requirement: Historical actor references permit identity deletion
Historical actor foreign keys SHALL use nullable `ON DELETE SET NULL` semantics where the referenced Auth identity does not own the business record. Audit and billing history SHALL remain after identity deletion.

#### Scenario: Auth user has audit history
- **WHEN** an Auth identity referenced by historical audit rows is deleted
- **THEN** the history remains and its actor foreign key becomes null

### Requirement: Manager direct database access is building-scoped
RLS policies for tenants, contracts, contract occupants, and invoices SHALL require a manager assignment to the row's building. Browser roles SHALL receive only the table privileges required by tenant self-access and the supported direct-read safety model.

#### Scenario: Assigned manager reads tenant data
- **WHEN** a manager directly reads a tenant, contract, occupant, or invoice in an assigned building
- **THEN** the matching row is visible

#### Scenario: Manager reads another building
- **WHEN** a manager directly reads tenant data for an unassigned building
- **THEN** no matching row is visible

#### Scenario: Manager attempts direct invoice mutation
- **WHEN** a manager attempts to insert or update an invoice through the Data API
- **THEN** the database denies the mutation

### Requirement: Stale tenant JWT cannot resolve portal data
Tenant API access SHALL verify current Auth account state and an active tenant link. A stale JWT whose Auth identity was deleted, soft-deleted, stripped of tenant role, or unlinked SHALL not resolve tenant business data.

#### Scenario: Revoked account reuses old JWT
- **WHEN** a revoked tenant sends a previously issued JWT to a tenant API
- **THEN** the request is denied before tenant business data is returned
