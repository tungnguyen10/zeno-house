## 1. Role And Capabilities

- [x] 1.1 Add `ROLES.TENANT = 'tenant'` to `app/utils/constants/roles.ts` and extend `UserRole`; keep `CREATABLE_ROLES` as `owner | manager`.
- [x] 1.2 Add `TENANT_CAPABILITIES` in `app/utils/constants/permissions.ts` (profile read/update, contract read, invoices read, documents read/write, requests read/write) and wire into `ROLE_CAPABILITIES` + `CAPABILITY_SETS`.
- [x] 1.3 Ensure tenant capabilities share nothing with internal capability strings.
- [x] 1.4 Add `isTenant` to `server/utils/roles.ts`; keep `isScopedRole` for owner/manager only.
- [x] 1.5 Add `isTenant` + tenant helpers to `app/stores/auth.ts`.

## 2. Linkage Migration

- [x] 2.1 Add a migration creating `tenant_user_links` with FKs to `auth.users` and `public.tenants`, `status`, timestamps, `unique(auth_user_id)`, `unique(tenant_id)`.
- [x] 2.2 Enable RLS on `tenant_user_links`; add a tenant self-select-own policy and keep writes to the service-role path.
- [x] 2.3 Regenerate `app/types/database.types.ts`.

## 3. Self-Scope Resolver

- [x] 3.1 Add `server/repositories/tenant-portal/links.ts` with `getTenantIdForAuthUser(event, authUserId)` via service-role.
- [x] 3.2 Add `resolveTenantId(event, user)` to `server/utils/scope.ts` that throws a consistent forbidden/not-found when the link is missing or disabled.
- [x] 3.3 Add unit tests for present, missing, and disabled links.

## 4. RLS Baseline

- [x] 4.1 Add deny-by-default posture for the tenant role on `tenants`, `contracts`, `invoices`.
- [x] 4.2 Add tenant self-select policies scoped through `tenant_user_links` only where a direct read path is intended.
- [x] 4.3 Add SQL-level tests asserting the tenant policies reference `tenant_user_links` and `auth.uid()`.

## 5. API Namespace Guard Activation

- [x] 5.1 Activate the server namespace guard so a `tenant` JWT is rejected on internal `/api/**`.
- [x] 5.2 Reject internal roles on `/api/tenant/**` (namespace reserved for tenant).
- [x] 5.3 Ensure unknown/out-of-scope requests share a consistent not-found/forbidden response.
- [x] 5.4 Add tests for both rejection directions.

## 6. Verification

- [x] 6.1 Run `npm run typecheck`, `npm test`, `npm run lint`.
- [x] 6.2 Run `openspec validate --specs`.
- [x] 6.3 Confirm no internal role/capability behavior changed (regression on existing permission tests).
