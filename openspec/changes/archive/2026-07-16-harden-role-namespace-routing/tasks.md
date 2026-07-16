## 1. Redirect Helper

- [x] 1.1 Add `app/utils/auth-redirect.ts` exporting `getRedirectByRole(role)` returning `/portal` for `tenant`, `/dashboard` for `admin`/`owner`/`manager`, and `/login` otherwise.
- [x] 1.2 Add unit tests for every role and for null/unknown roles.

## 2. Global Route Guard

- [x] 2.1 Rewrite `app/middleware/auth.global.ts` to keep the `auth.getSession()` fallback for the post-sign-in timing gap.
- [x] 2.2 Enforce namespace matrix: tenant locked to `/portal`; non-tenant blocked from `/portal` and redirected via `getRedirectByRole`.
- [x] 2.3 Keep public routes (`/login`, `/auth/callback`) open and guarantee no redirect loop.
- [x] 2.4 Do NOT evaluate manager building scope in middleware.
- [x] 2.5 Add route middleware tests covering the full role/namespace matrix and unauthenticated access.

## 3. Login And Callback Wiring

- [x] 3.1 Update `app/composables/auth/useAuth.ts` login to route via `getRedirectByRole(currentRole)` instead of `'/'`.
- [x] 3.2 Update `app/pages/auth/callback.vue` to read `app_metadata.role` and route via `getRedirectByRole`.
- [x] 3.3 Verify guest middleware still redirects authenticated users off `/login` to the correct namespace.

## 4. Namespace Route Refactor

- [x] 4.1 Add `app/pages/index.vue` that redirects by role via `getRedirectByRole`.
- [x] 4.2 Move internal domain pages under `/dashboard/**` (buildings, rooms, tenants, contracts, invoices, billing, operations-report, shared-expenses, settings/managers, settings/history).
- [x] 4.3 Keep admin-only pages under `/dashboard` with their existing capability guards; do not introduce an `/admin` namespace.
- [x] 4.4 Add redirects from old top-level paths to their `/dashboard` equivalents.
- [x] 4.5 Scaffold an empty `/portal` route group placeholder so the namespace exists for guard tests (no tenant content).
- [x] 4.6 Update `app/utils/routes/operational.ts` and `app/utils/constants/navigation.ts` to `/dashboard`-based paths.

## 5. Server Namespace Guard Scaffold

- [x] 5.1 Add a server middleware hook (extend `server/middleware/01.auth.ts` or add `server/middleware/02.namespace.ts`) that classifies the target API namespace.
- [x] 5.2 Wire it as a no-op for now (tenant role does not exist yet) but structured so the next change activates tenant/internal API separation with a minimal edit.

## 6. Verification

- [x] 6.1 Run `npm run typecheck`, `npm test`, `npm run lint`.
- [x] 6.2 Manually verify admin/owner/manager land on `/dashboard`, old links redirect, and `/portal` is blocked for internal roles.
- [x] 6.3 Run `openspec validate --specs`.

## 7. Verification Warning Remediation

- [x] 7.1 Make only the most-specific sidebar item active and point internal sidebar logo links directly to `/dashboard`; add regression tests.
- [x] 7.2 Strengthen the route namespace test so new authenticated pages outside `/dashboard` and `/portal` fail validation.
- [x] 7.3 Document the print-only layout exception in design and admin-shell delta spec.
- [x] 7.4 Add login component tests for failed credentials and in-flight submit state.
- [x] 7.5 Re-run typecheck, tests, lint, OpenSpec validation, and change verification.
