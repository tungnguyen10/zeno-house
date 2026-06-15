# Auth And Permissions

Zeno House uses Supabase Auth for sessions and role claims. Application authorization is capability-based at the service layer.

## Client Auth

Client auth state is centralized in `app/stores/auth.ts`.

The store exposes:

- `user`
- `isAuthenticated`
- `role`
- `isAdmin`

Roles come from `user.app_metadata.role`.

Supported roles:

- `admin`
- `manager`

## Route Guards

Global authenticated route guard:

- `app/middleware/auth.global.ts`

It allows `/login`, checks `useSupabaseUser()`, and falls back to `auth.getSession()` to cover the timing gap after sign-in.

Guest-only login redirect:

- `app/middleware/guest.ts`

It redirects authenticated users away from login to `/`.

## Server Auth

Server middleware:

- `server/middleware/01.auth.ts`

It runs for `/api/**`, reads Supabase JWT claims, normalizes `sub` into `user.id`, and stores the result on `event.context.user`.

API handlers can also call:

- `server/utils/auth.ts` -> `requireAuth(event)`

`requireAuth` throws `UNAUTHENTICATED` when claims are missing.

## Capability Checks

Capabilities live in `server/utils/permissions.ts`.

Admin has full operational access:

- buildings CRUD
- rooms CRUD
- tenants CRUD
- contracts CRUD
- meter readings read/write
- building services read/write
- contract services read/write
- billing read/write/close/unissue

Manager has operational read/write access but no destructive period admin actions:

- read buildings, rooms, tenants, contracts
- update rooms
- read/write meter readings
- read/write building and contract services
- billing read/write

Manager does not have:

- entity create/update/delete across every domain
- `billing.close`
- `billing.unissue`

## Billing Permissions

| Capability | Role | Used for |
| --- | --- | --- |
| `billing.read` | admin, manager | Periods, overview, drafts, grid, invoices, payments, audit, export. |
| `billing.write` | admin, manager | Readings, utility overrides, issue, payments, bulk payments, adjustment, void, reissue. |
| `billing.close` | admin | Close a fully collected issued/collecting period. |
| `billing.unissue` | admin | Reopen issuance by voiding unpaid invoices and retaining paid ones. |

## Security Rules

- Never trust UI visibility for authorization.
- Repeat capability checks in services.
- Keep authorization claims in `app_metadata`, not user-editable metadata.
- Do not expose service-role or secret keys to client runtime config.
- Prefer capability checks over direct role checks in business code.
