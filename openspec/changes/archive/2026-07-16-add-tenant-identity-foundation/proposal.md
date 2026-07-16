## Why

The tenant portal needs a first-class identity that is completely isolated from the internal `admin | owner | manager` roles. Today there is no `tenant` role, no capability set for tenant self-service, and no link between a Supabase auth user and the `tenants` business record. Without an explicit auth-user↔tenant link, no server code can safely resolve "the tenant record for the logged-in user", which is the foundation every tenant API depends on. This change adds the role, the isolated capability set, the linkage table, the self-scope resolver, and a deny-by-default RLS baseline — behind the namespace gate delivered by `harden-role-namespace-routing`.

## What Changes

- Add a `tenant` role to the role constants and types. `tenant` is NOT creatable through the existing internal user-management flows; `CREATABLE_ROLES` stays `owner | manager`.
- Add an isolated `TENANT_CAPABILITIES` set (e.g. `tenant.profile.read`, `tenant.profile.update`, `tenant.contract.read`, `tenant.invoices.read`, `tenant.documents.read`, `tenant.documents.write`, `tenant.requests.read`, `tenant.requests.write`) that shares nothing with internal capabilities.
- Add server + client role helpers (`isTenant`) and auth-store exposure; extend `getRedirectByRole` coverage is already present from the prior change.
- Add a `tenant_user_links` table linking `auth.users.id` ↔ `tenants.id` with status and uniqueness (default 1:1), plus RLS.
- Add a `resolveTenantId(event, user)` self-scope helper that reads the link and throws when missing — separate from building-assignment scope.
- Add a tenant-readable RLS baseline (deny-by-default) so any direct authenticated tenant read is safe even though the server remains the primary gate.
- Activate the server namespace guard scaffold so `tenant`-role JWTs cannot reach internal `/api/**` and internal roles cannot reach `/api/tenant/**`.
- Regenerate `app/types/database.types.ts` after the migration.

## Capabilities

### New Capabilities
- `tenant-identity`: Defines the `tenant` role, the isolated tenant capability set, the auth-user↔tenant linkage model, the self-scope resolver contract, provisioning constraints (role written only via service role), and the tenant-readable RLS baseline.

### Modified Capabilities
- `user-auth`: Supported roles expand to include `tenant`; `tenant` is not app-creatable via internal user management; client helpers expose `isTenant`.
- `role-namespace-routing`: The server namespace guard becomes active for the `tenant` role (tenant JWT blocked from internal `/api/**`, internal roles blocked from `/api/tenant/**`).

## Impact

- `app/utils/constants/roles.ts`, `app/types/auth.ts` — add `tenant` role/type.
- `app/utils/constants/permissions.ts` — add `TENANT_CAPABILITIES`, wire into `ROLE_CAPABILITIES` and `CAPABILITY_SETS`.
- `app/stores/auth.ts`, `server/utils/roles.ts`, `server/utils/permissions.ts` — `isTenant` + tenant capability checks.
- `server/utils/scope.ts` — `resolveTenantId` self-scope helper.
- `server/repositories/tenant-portal/**` — link lookup repository.
- `server/middleware/01.auth.ts` (or `02.namespace.ts`) — activate tenant/internal API separation.
- `supabase/migrations/**` — `tenant_user_links` table, RLS, tenant-readable baseline policies.
- `app/types/database.types.ts` — regenerate.
- Tests for role/capability isolation, link resolution, missing-link failure, and API namespace separation.
