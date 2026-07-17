## Context

`add-tenant-identity-foundation` (archived) added the `tenant` role, `tenant_user_links` (1:1, service-role writes only), and `resolveTenantId`. The internal user-management flow (`server/services/users`, `POST /api/users`) intentionally creates only `owner | manager` (`CREATABLE_ROLES`), and the `tenant-identity` spec requires the `tenant` role claim be set only via a service-role path. Owner scope is enforced by `getAssignedBuildingIds`/`assertBuildingScope`, and tenant→building linkage is available via `TenantRepository.hasContractInBuildings` and `wasCreatedByActor`. `UserRepository` already wraps `auth.admin.createUser/updateUserById/deleteUser` through the service-role client (`server/utils/db.ts`).

## Goals / Non-Goals

**Goals:**
- Let admin/owner grant portal access to an existing tenant record from the app.
- Assign `app_metadata.role = 'tenant'` only server-side via service-role; keep it off `/api/users` and out of `CREATABLE_ROLES`.
- Enforce owner building scope on every account action.
- Provide provision + status + disable/enable + reset password + revoke, with one-time temporary credentials.

**Non-Goals:**
- Email/invite delivery (Resend) — temp credentials are shown once in the UI.
- Tenant self-registration or password self-service (portal profile already exists).
- Changing `CREATABLE_ROLES` or routing tenant creation through `/api/users`.
- New DB migration (reuse `tenant_user_links`).

## Decisions

### D1 — Dedicated provisioning path, not `/api/users`
A new `TenantAccountService` performs the auth mutations with the service-role client and manages `tenant_user_links`. `CREATABLE_ROLES` stays `owner | manager`; `userCreateSchema` is untouched. This preserves the `tenant-identity` guarantee that the tenant claim is set only via a controlled service-role path.

### D2 — Capability + owner scope
New capability `tenant.account.provision` is granted to admin (global) and owner (in `OWNER_CAPABILITIES`). Every action first checks the capability, then `assertTenantInScope`: admin (`getAssignedBuildingIds === null`) is unscoped; owner must satisfy `hasContractInBuildings(assignedIds)` or `wasCreatedByActor`, else `NOT_FOUND` (mirrors tenant read-scope hiding).

### D3 — One-time temporary credentials
Provision and reset generate a strong random password server-side (`node:crypto`), return `{ email, tempPassword }` exactly once, and never store or re-return it. Provision uses `email_confirm: true` so the tenant can log in immediately at `/login` (role redirect → `/portal`).

### D4 — Compensation on partial failure
Provision creates the auth user, then inserts the link. If the link insert fails (e.g. `unique(tenant_id)` race), the just-created auth user is deleted to avoid an orphaned tenant-role account with no link. `email_exists` and already-linked tenant both surface as `CONFLICT`.

### D5 — Revoke deletes the auth user
Revoke deletes the Supabase Auth user; the `on delete cascade` FK removes the `tenant_user_links` row and invalidates sessions, freeing the email for re-provisioning. Disable/enable only flips `status` without touching the auth user.

### D6 — Endpoints keyed by tenant id + a list endpoint
`GET/POST/PATCH/DELETE /api/tenants/[id]/account` and `POST /api/tenants/[id]/account/reset-password` operate on one tenant; `GET /api/tenant-accounts` lists provisioned accounts (scoped) for the Settings page. The provision picker reuses `GET /api/tenants?q=` and calls the per-tenant status endpoint.
