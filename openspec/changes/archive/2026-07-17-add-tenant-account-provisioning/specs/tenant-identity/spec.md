## MODIFIED Requirements

### Requirement: Auth-user to tenant linkage
The system SHALL persist an explicit link between a Supabase auth user and a `tenants` record in a `tenant_user_links` table with FKs to `auth.users` and `public.tenants`, a `status`, and uniqueness (`unique(auth_user_id)`, `unique(tenant_id)` for MVP). RLS SHALL be enabled. Link rows SHALL be created and mutated only through a service-role provisioning path (operated by `admin`/`owner`), never through `/api/users` and never with a client-supplied tenant identifier.

#### Scenario: One login maps to one tenant
- **WHEN** a link row exists for an auth user
- **THEN** exactly one `tenant_id` resolves for that user

#### Scenario: Links written only via service-role provisioning
- **WHEN** a `tenant_user_links` row is created or changed
- **THEN** the write occurs through the service-role provisioning path, not through internal user-management APIs
