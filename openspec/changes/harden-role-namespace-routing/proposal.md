## Why

The app is about to gain a tenant-facing portal that must never mix with the internal operations UI. Today the global route guard only checks whether a session exists ([app/middleware/auth.global.ts](../../../app/middleware/auth.global.ts)); it does not enforce role-based namespace isolation, and post-login redirect targets are hard-coded to `/` in two places ([app/composables/auth/useAuth.ts](../../../app/composables/auth/useAuth.ts), [app/pages/auth/callback.vue](../../../app/pages/auth/callback.vue)). Before any tenant feature is built, the routing surface must be split into isolated namespaces with a single, testable redirect decision. This change is the mandatory security/structure gate; nothing tenant-specific ships until it lands.

## What Changes

- Introduce two isolated route namespaces: `/portal/**` (reserved for the future `tenant` role) and `/dashboard/**` (admin, owner, manager). No third `/admin` namespace; admin-only pages stay under `/dashboard` gated by capability.
- Add a single redirect decision helper `getRedirectByRole(role)` as the only source of post-login/callback routing.
- Replace the session-only global middleware with a role/namespace guard that keeps the existing post-sign-in session fallback and blocks cross-namespace access before render.
- Move existing internal domain routes under `/dashboard/**` and add an `/` landing page that redirects by role. Preserve old paths via redirects so existing links do not break.
- Add a server-side namespace guard hook that will reject a `tenant`-role JWT hitting internal `/api/**` (and vice versa) once the tenant role exists; until then it is a no-op scaffold.
- Update navigation so internal nav is `/dashboard`-based and role-safe.
- No tenant business logic, no tenant role yet, no data model, no PWA.

## Capabilities

### New Capabilities
- `role-namespace-routing`: Defines the two-namespace model (`/portal` vs `/dashboard`), the `getRedirectByRole` single-source redirect, the global guard matrix, and the "every route declares its namespace" rule.

### Modified Capabilities
- `route-guard`: Global middleware expands from session-only to role-aware namespace enforcement while preserving the session fallback and no-redirect-loop guarantees.
- `user-auth`: Login and OAuth callback route users through `getRedirectByRole` instead of a hard-coded `/`.
- `admin-shell`: Sidebar/navigation targets move to `/dashboard`-based paths and stay role-safe.

## Impact

- `app/middleware/auth.global.ts` — namespace guard + retained session fallback.
- `app/utils/auth-redirect.ts` — new `getRedirectByRole` single source.
- `app/composables/auth/useAuth.ts`, `app/pages/auth/callback.vue` — use the helper.
- `app/pages/index.vue` — new role-based landing redirect.
- `app/pages/**` — internal routes relocated under `/dashboard/**` with old-path redirects.
- `app/utils/constants/navigation.ts`, `app/utils/routes/operational.ts` — `/dashboard`-based links.
- `server/middleware/01.auth.ts` (or new `server/middleware/02.namespace.ts`) — namespace guard scaffold.
- Tests for the role→namespace matrix, redirect helper, session fallback, and no redirect loops.
