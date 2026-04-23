## Why

Two auth defects exist: `server/utils/supabase.ts` contains a `requireSuperAdmin` helper that reads from the wrong data source (`app_metadata` instead of the `profiles` table) and references a non-existent role (`super_admin`). Additionally, `app/pages/index.vue` leaves authenticated users stuck on a "loading..." screen instead of redirecting them to their role dashboard.

## What Changes

- Remove `requireSuperAdmin` from `server/utils/supabase.ts`
- Add `requireRole(event, ...roles: Role[])` to `server/utils/requireRole.ts` — queries `profiles` table via service-role client, throws 401/403, returns `{ user, role }`
- Update `app/pages/index.vue` to redirect authenticated users to their role page (`/admin`, `/manager`, `/tenant`)

## Capabilities

### New Capabilities

- `server-role-guard`: Server-side role enforcement utility for Nuxt API routes — replaces ad-hoc inline role checks

### Modified Capabilities

- (none — `index.vue` redirect is a bug fix, not a spec-level behavior change)

## Impact

- `server/utils/supabase.ts` — remove dead code
- `server/utils/requireRole.ts` — new file
- `app/pages/index.vue` — add authenticated branch
- Any future server routes can use `requireRole` instead of duplicating the 4-line auth+role pattern
