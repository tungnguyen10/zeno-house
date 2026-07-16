## Context

Zeno House is a Nuxt 4 (compatibility mode) app using `@nuxtjs/supabase` for auth. Roles come from `app_metadata.role` and today are `admin | owner | manager`. The global middleware ([app/middleware/auth.global.ts](../../../app/middleware/auth.global.ts)) only verifies a session and falls back to `auth.getSession()` to cover the timing gap right after `signInWithPassword`. Redirects after login are hard-coded to `/`. Routes are organized by business domain (`/buildings`, `/rooms`, `/tenants`, `/billing`, ...) with no namespace boundary.

A tenant portal is coming as a separate audience surface. To keep it safe, the routing layer must isolate tenant vs internal experiences before any tenant feature exists. Per project rules, server authorization stays authoritative (service-role bypasses RLS), so this client guard is UX/navigation isolation, not the security boundary.

## Goals / Non-Goals

**Goals:**
- Establish exactly two route namespaces: `/portal` (tenant, reserved) and `/dashboard` (admin/owner/manager).
- Provide one redirect decision function used by both login and callback.
- Enforce namespace-by-role in the global guard while keeping the session fallback and avoiding redirect loops.
- Relocate internal routes under `/dashboard` with backward-compatible redirects.
- Scaffold a server namespace guard that becomes active when the tenant role exists.

**Non-Goals:**
- Adding the `tenant` role, tenant capabilities, or tenant data model (next change).
- Any tenant API, UI page content, or PWA setup.
- Manager building-scope checks in middleware (async; stays in services + RLS).
- Splitting into subdomains or dual builds (explicitly rejected: single app, single deployment).

## Decisions

### D1 — Two namespaces only

`/portal/**` is reserved for the `tenant` role. `/dashboard/**` holds all internal operations for admin, owner, and manager. Admin-only pages (user management, audit history) live under `/dashboard` and keep their existing capability guards (`canManageUsers`, `isAdmin`) rather than a separate `/admin` namespace. This minimizes refactor surface and keeps role separation in the service/capability layer where it already lives.

### D2 — Single redirect source `getRedirectByRole`

```ts
// app/utils/auth-redirect.ts
export function getRedirectByRole(role: string | null | undefined): string {
  if (role === 'tenant') return '/portal'
  if (role === 'admin' || role === 'owner' || role === 'manager') return '/dashboard'
  return '/login'
}
```

Login and callback both call this. No other place decides landing routes.

### D3 — Guard keeps the session fallback

The rewritten middleware must retain the `auth.getSession()` fallback so the post-`signInWithPassword` timing gap does not bounce a freshly authenticated user to `/login`. Only after a user is resolved does the namespace matrix apply.

Matrix:
- Unauthenticated + non-public route → `/login`.
- Public routes (`/login`, `/auth/callback`) → pass.
- `tenant` role outside `/portal` → redirect to `/portal`.
- Non-`tenant` role inside `/portal` → redirect to `getRedirectByRole(role)`.
- Manager building scope is NOT evaluated here.

### D4 — Backward-compatible route move

Internal pages move under `/dashboard`. To avoid breaking bookmarks and internal links, old top-level paths issue a redirect to their `/dashboard` equivalent, and link helpers in `app/utils/routes/operational.ts` are updated. This is a mechanical move plus link update, not a rewrite of page logic.

### D5 — Server namespace guard scaffold

A server hook records/enforces the namespace boundary for `/api/**`. Until the tenant role exists it is a no-op that only wires the seam, so activating it in the next change is a small, low-risk edit rather than new plumbing.
