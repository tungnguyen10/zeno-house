## Purpose

Defines the isolated tenant authentication role, tenant-only capabilities, auth-user linkage,
server-side tenant scope resolution, and direct-read RLS baseline.
## Requirements
### Requirement: Tenant role exists and is isolated
System SHALL support `tenant` as a Supabase Auth `app_metadata.role` value, isolated from internal roles. The `tenant` role SHALL NOT be creatable through internal user-management APIs (`CREATABLE_ROLES` remains `owner | manager`). Tenant role claims SHALL be written only via a service-role/Edge path, never from client or user-editable metadata.

#### Scenario: Tenant login recognized
- **WHEN** a user with `app_metadata.role = 'tenant'` logs in
- **THEN** the session is accepted and `isTenant` is true while `isAdmin`/`isOwner`/`isManager` are false

#### Scenario: Tenant not creatable via internal user management
- **WHEN** an internal user-management create request targets role `tenant`
- **THEN** the request is rejected

---

### Requirement: Isolated tenant capability set
The system SHALL define a `TENANT_CAPABILITIES` set (profile read/update, contract read, invoices read, documents read/write, requests read/write) that shares no capability string with internal roles. `hasCapability('tenant', <internal capability>)` SHALL be false.

#### Scenario: Tenant has only tenant capabilities
- **WHEN** capability checks run for a `tenant` user
- **THEN** only tenant capabilities return true and every internal capability returns false

#### Scenario: Internal role has no tenant capabilities
- **WHEN** capability checks run for `admin`/`owner`/`manager`
- **THEN** every `tenant.*` capability returns false

---

### Requirement: Auth-user to tenant linkage
The system SHALL persist an explicit link between a Supabase auth user and a `tenants` record in a `tenant_user_links` table with FKs to `auth.users` and `public.tenants`, a `status`, and uniqueness (`unique(auth_user_id)`, `unique(tenant_id)` for MVP). RLS SHALL be enabled. Link rows SHALL be created and mutated only through a service-role provisioning path (operated by `admin`/`owner`), never through `/api/users` and never with a client-supplied tenant identifier.

#### Scenario: One login maps to one tenant
- **WHEN** a link row exists for an auth user
- **THEN** exactly one `tenant_id` resolves for that user

#### Scenario: Links written only via service-role provisioning
- **WHEN** a `tenant_user_links` row is created or changed
- **THEN** the write occurs through the service-role provisioning path, not through internal user-management APIs

### Requirement: Tenant self-scope resolver
The system SHALL provide `resolveTenantId(event, user)` that returns the tenant id from `tenant_user_links` for the authenticated user and throws a consistent forbidden/not-found when the link is missing or disabled. Tenant server code SHALL derive `tenant_id` only from this resolver and SHALL ignore any client-supplied tenant identifier.

#### Scenario: Resolver returns linked tenant
- **WHEN** `resolveTenantId` runs for a user with an active link
- **THEN** it returns that user's `tenant_id`

#### Scenario: Missing link is rejected consistently
- **WHEN** `resolveTenantId` runs for a user with no active link
- **THEN** it throws a consistent not-found/forbidden error

#### Scenario: Client-supplied tenant id ignored
- **WHEN** a request includes a `tenant_id` in body/query
- **THEN** the resolver value is used and the client value is ignored

### Requirement: Active housing context resolver
The system SHALL resolve tenant housing context server-side after identity resolution. It SHALL
prefer a current active contract whose `tenant_id` is the linked tenant; otherwise it SHALL use a
`contract_occupants` row for that tenant only when move-in has been reached, `move_out_date` is
null, and the related contract is active and within its date range. The result SHALL include the
contract, building, primary tenant, assignment role, and primary tenant name.

#### Scenario: Primary contract wins
- **WHEN** a tenant has both a current primary contract and an occupancy record
- **THEN** housing context uses the primary contract with `assignmentRole = primary`

#### Scenario: Active roommate resolves shared housing
- **WHEN** the linked tenant has no current primary contract but is an active occupant
- **THEN** housing context uses that occupant's contract with `assignmentRole = roommate`

#### Scenario: Inactive occupancy grants no shared context
- **WHEN** move-in is in the future, move-out is recorded, or the contract is expired or terminated
- **THEN** no roommate housing context is returned

---

### Requirement: Tenant-readable RLS baseline
Tenant-readable tables (`tenants`, `contract_occupants`, `contracts`, `invoices`) SHALL be deny-by-default for the `tenant` role, granting direct authenticated read only through an active `tenant_user_links` row. A tenant SHALL read only their own profile and occupancy rows. Primary tenants SHALL retain direct contract/invoice history; active roommates SHALL additionally read only the current shared contract and invoices for that contract. The server remains the primary gate; RLS is the non-bypassable safety net.

#### Scenario: Tenant cannot read other tenants' rows directly
- **WHEN** a `tenant` user attempts a direct authenticated read of a row not linked to them
- **THEN** RLS denies the row

#### Scenario: Tenant self-read scoped by link
- **WHEN** a tenant self-select policy evaluates
- **THEN** it matches rows only through the caller's `tenant_user_links` mapping

#### Scenario: Roommate profile isolation
- **WHEN** an active roommate can read a shared contract and its invoices
- **THEN** the primary tenant's profile remains hidden

#### Scenario: Move-out revokes shared direct reads
- **WHEN** an occupant receives a `move_out_date`
- **THEN** RLS stops returning the shared contract and invoices immediately
