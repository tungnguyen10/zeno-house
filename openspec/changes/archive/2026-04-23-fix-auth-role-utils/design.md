## Context

The project has 3 roles (`admin`, `manager`, `tenant`) stored in the `profiles` Postgres table. Server API routes are expected to verify the caller's role before performing privileged operations. Currently there is no shared utility for this — each route duplicates the same 4-step pattern: get user → get client → query profiles → check role. A dead `requireSuperAdmin` helper exists that reads from JWT `app_metadata` (wrong source) and checks for `super_admin` (non-existent role).

On the client side, `app/pages/index.vue` only redirects unauthenticated users to `/login`. Authenticated users who navigate to `/` get stuck on a blank "loading..." screen.

## Goals / Non-Goals

**Goals:**
- Provide a single, correct server-side role guard utility usable in any `server/api/` route
- Fix the `/` page UX for authenticated users

**Non-Goals:**
- Refactor existing routes to use the new utility (can be done incrementally)
- Change how roles are stored or managed in Supabase
- Add new roles or modify the role matrix

## Decisions

### 1. New utility signature: `requireRole(event, ...roles)`

```ts
// server/utils/requireRole.ts
export async function requireRole(event: H3Event, ...roles: Role[]): Promise<{ user: User; role: Role }>
```

**Why this signature over alternatives:**
- Takes `H3Event` (not `User`) — the utility handles the full auth+role fetch in one call, so callers don't need to fetch the user separately first
- Variadic `roles` — a single route can allow multiple roles (e.g., admin can do everything a manager can)
- Returns `{ user, role }` — callers often need both for subsequent queries; returning them avoids a second fetch

**Alternative considered:** Accept a pre-fetched `User` object. Rejected because it still requires the caller to manage two separate fetches (user + role), defeating the DRY purpose.

### 2. Use `serverSupabaseServiceRole` for the profiles query

Service-role client bypasses RLS, so the role lookup always succeeds regardless of the caller's permissions. This is safe here because we're reading the caller's own profile, and the result is used for access control (not exposed to the client).

**Alternative considered:** `serverSupabaseClient` (user-scoped). Rejected because RLS policies on `profiles` could block the lookup for certain states, making the guard unreliable.

### 3. Fix `index.vue` inline (not via middleware)

The redirect logic for authenticated users already lives in `login.vue` — `fetchRole()` then navigate. The same 3-line pattern added to `index.vue` keeps behavior predictable without touching middleware execution order.

**Alternative considered:** Add a redirect middleware for `/` and `/login`. Rejected — overkill for a one-page fix; middleware runs on every route navigation and adds latency.

## Risks / Trade-offs

- **Double role fetch on login**: `login.vue` calls `fetchRole()`, then `role.ts` middleware calls it again on navigation. The auth store has a cache guard (`if (role.value) return role.value`) so the second fetch is a no-op. No real risk.
- **Service-role client exposure**: `requireRole` uses service-role — callers must trust its output without a second check. This is the intended design; the guard is the single source of truth for role enforcement.
- **`index.vue` flicker**: SSR renders "loading..." then client-side JS redirects. Acceptable for an index/router page; could be improved later with `definePageMeta({ ssr: false })` if needed.

## Migration Plan

1. Delete `requireSuperAdmin` from `server/utils/supabase.ts`
2. Create `server/utils/requireRole.ts`
3. Update `app/pages/index.vue`
4. No DB changes, no migration, no rollback needed — purely additive (new util) + small fix (index page)
