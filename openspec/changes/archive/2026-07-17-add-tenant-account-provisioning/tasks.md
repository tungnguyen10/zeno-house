## 1. Capability + Audit

- [x] 1.1 Add `tenant.account.provision` to `OWNER_CAPABILITIES` (admin inherits) and to the `Capability` union in `app/utils/constants/permissions.ts`.
- [x] 1.2 Add tenant-account action codes to `AUDIT_ACTIONS` in `app/utils/constants/audit.ts` (provisioned/disabled/enabled/password_reset/revoked).

## 2. Repository

- [x] 2.1 Add `server/repositories/tenant-portal/account-links.ts`: `getByTenantId`, `listByTenantIds`, `listAll`, `create`, `updateStatus`, `deleteByTenantId`.
- [x] 2.2 Reuse `UserRepository` (service-role admin API) to create the tenant auth user (role `tenant`) and for password reset/delete.

## 3. Service

- [x] 3.1 Add `server/services/tenant-portal/accounts.ts` with `assertTenantInScope` (admin unscoped; owner via `hasContractInBuildings`/`wasCreatedByActor`).
- [x] 3.2 Implement `getStatus`, `provision` (temp password, `email_confirm`, rollback auth user on link failure), `setStatus` (disable/enable), `resetPassword`, `revoke` — capability-gated + audited.

## 4. Validators + Types

- [x] 4.1 Add `app/utils/validators/tenant-accounts.ts` (`provision {email}`, `statusUpdate {status}`).
- [x] 4.2 Add `app/types/tenant-accounts.ts` (status, credentials, list-item DTOs).

## 5. API

- [x] 5.1 `GET/POST/PATCH/DELETE /api/tenants/[id]/account` + `POST /api/tenants/[id]/account/reset-password`.
- [x] 5.2 `GET /api/tenant-accounts` — list provisioned accounts, owner-scoped.

## 6. UI

- [x] 6.1 Composable `app/composables/tenant-accounts/useTenantAccounts.ts` (list/provision/status/reset/revoke + toasts).
- [x] 6.2 Page `app/pages/dashboard/settings/tenant-accounts.vue` (capability-gated) with tenant picker, provision modal showing one-time credentials, and lifecycle actions; add Settings nav entry.

## 7. Tests / Verification

- [x] 7.1 Service unit tests: provision happy path, already-linked conflict, email-exists conflict, owner out-of-scope not-found, disable/enable, reset, revoke, rollback on link failure.
- [x] 7.2 Validator tests.
- [x] 7.3 Run `npm run typecheck`, `npm test`, `npm run lint`.
- [x] 7.4 Run `openspec validate --specs`.
