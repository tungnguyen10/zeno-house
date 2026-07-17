## Why

Tenant portal login accounts currently have no provisioning path in the app: the `tenant` role and `tenant_user_links` rows must be created by hand via SQL/service-role. Operators need to grant portal access to an existing `tenants` record from the app. This must stay outside the internal user-management API (`/api/users`) — `tenant` remains non-creatable there and `CREATABLE_ROLES` stays `owner | manager` — and go through a dedicated service-role provisioning path, scoped so an owner can only provision tenants within their assigned buildings.

## What Changes

- Add a `tenant.account.provision` capability, granted to `admin` (global) and `owner` (scoped).
- Add a dedicated provisioning service + endpoints under the tenant resource that create the Supabase Auth user with `app_metadata.role = 'tenant'` (service-role only) and insert the `tenant_user_links` row, binding to an existing `tenants` record chosen by the operator.
- Provision returns a one-time email + system-generated temporary password (shown once, never stored). No email delivery in this change.
- Account lifecycle: view link status, disable/enable (`tenant_user_links.status`), reset password (new one-time temp password), and revoke (delete the auth user, cascading the link).
- Owner scope: an owner may only act on tenants that have a contract in an assigned building or that the owner created; admin is unscoped.
- A Settings page (`dashboard/settings/tenant-accounts`) to search/select an existing tenant, provision, and manage provisioned accounts.
- All account mutations emit audit events; no change to `CREATABLE_ROLES` and no route through `/api/users`.

## Capabilities

### New Capabilities
- `tenant-account-provisioning`: Defines operator (admin/owner) provisioning of tenant portal login accounts bound to existing tenant records via `tenant_user_links`, the service-role role assignment, one-time temporary credentials, owner building-scope enforcement, and the disable/enable/reset/revoke lifecycle.

### Modified Capabilities
- `tenant-identity`: Clarify that tenant accounts are provisioned by admin/owner through a dedicated service-role provisioning path (not `/api/users`), leaving `CREATABLE_ROLES` unchanged.

## Impact

- `app/utils/constants/permissions.ts` — add `tenant.account.provision` to owner (admin inherits).
- `app/utils/constants/audit.ts` — add tenant-account lifecycle action codes.
- `server/repositories/tenant-portal/account-links.ts` — new link write/read helpers.
- `server/services/tenant-portal/accounts.ts` — new provisioning service (scope + service-role auth mutations + audit).
- `server/api/tenants/[id]/account*` + `server/api/tenant-accounts/index.get.ts` — new endpoints.
- `app/utils/validators/tenant-accounts.ts`, `app/types/tenant-accounts.ts` — new validators/DTOs.
- `app/composables/tenant-accounts/useTenantAccounts.ts`, `app/pages/dashboard/settings/tenant-accounts.vue` — new UI.
- No new migration (reuses `tenant_user_links`; service-role already has `grant all`).
- Tests for the provisioning service (scope, conflicts, rollback) and validators.
