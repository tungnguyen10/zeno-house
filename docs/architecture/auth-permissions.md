# Auth And Permissions

Zeno House uses Supabase Auth for sessions and role claims. Application authorization is capability-based at the service layer.

## Client Auth

Client auth state is centralized in `app/stores/auth.ts`.

The store exposes:

- `user`
- `isAuthenticated`
- `role`
- `isAdmin`, `isOwner`, `isManager`
- `canManageUsers`, `canCreateOwner`, `canManage`
- `can(capability)` - capability-accurate UI gate backed by the shared capability map

Roles come from `user.app_metadata.role`.

UI action controls (create/edit/delete, bulk selection, billing close/unissue, etc.) are
gated with `authStore.can('<capability>')` rather than a coarse `isAdmin` flag, so owner and
manager see exactly the controls their capabilities allow. `authStore.can` reads the shared
capability map in `app/utils/constants/permissions.ts` (`hasCapability`). This drives
visibility only; the server remains the authoritative gate.

Supported roles:

- `admin` - global, unscoped access to every building.
- `owner` - full operational access, scoped to assigned buildings.
- `manager` - operational read/write, scoped to assigned buildings, no destructive or admin actions.

Scope is resolved from `user_building_assignments`. `admin` is unscoped
(`getAssignedBuildingIds` returns `null`); `owner` and `manager` are limited to their
assigned building ids.

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

Capabilities live in `server/utils/permissions.ts`. `can(user, capability)` is the single
source of truth; prefer it over direct role checks in business code.

The role-to-capability map is defined once in `app/utils/constants/permissions.ts`
(`ROLE_CAPABILITIES`, `OWNER_CAPABILITIES`, `hasCapability`) and shared by both sides: the
server `can()` and the client `authStore.can()` consume the same map, so UI visibility and
server authorization never drift.

Admin has full operational access plus global user management:

- every owner capability (see below)
- `users.manage.global`
- `users.create.owner`

Owner has full operational access, but limited to assigned buildings:

- buildings/rooms/tenants/contracts CRUD
- meter readings read/write
- building services read/write
- contract services read/write
- billing read/write/corrections/close/unissue
- dashboard read
- scoped user management (`users.manage.scoped`, `users.create.manager`)

Owner does not have global user management (`users.manage.global`, `users.create.owner`).

Manager has operational read/write access but no destructive or admin actions:

- read buildings, rooms, tenants, contracts
- update rooms
- read/write meter readings
- read/write building and contract services
- billing read/write/corrections
- dashboard read

Manager does not have:

- entity create/update/delete across domains
- `billing.close`
- `billing.unissue`
- any user management

## Data Access Model

Authorization is authoritative at the service layer, not the database:

- Services own every business rule: they call `can(user, capability)` and, for scoped
  roles, `assertBuildingScope(event, user, buildingId, mode)` /
  `getAssignedBuildingIds(event, user)` before reading or writing.
- Repositories query/persist only. They use the Supabase service-role client via
  `server/utils/db.ts` (`db(event)`), which bypasses RLS. Repositories never decide access.
- RLS stays enabled as a deny-by-default safety net. It is not the primary access-control
  mechanism and is not relied on for per-role scoping.

This is safe because browser code never queries business tables directly; all business data
flows through `server/api/**` -> service -> repository. The client only uses Supabase for
auth. Because RLS is bypassed by the service-role client, every access decision MUST be made
in a service before the repository runs.

## Master-Data Deletes

Deleting master data (rooms, tenants, contracts, contract services) is gated by
`canDeleteMasterData(event, user, buildingId)`:

- `admin` may always delete.
- `owner` may always delete within their assigned building scope. They own the building, so
  the per-assignment `can_delete_master_data` flag does not apply to them.
- `manager` may delete only when their assignment for that building has
  `can_delete_master_data = true` (an explicit per-manager grant from the owner/admin).

## Scoped User Management

Owners manage `manager` users only. A manager is visible to and manageable by an owner when
either condition holds:

- the manager has a building assignment inside the owner's scope, or
- the manager's `app_metadata.created_by` equals the owner's id (the owner created them).

Creator identity is recorded durably in `app_metadata.created_by` at creation, in addition to
`user_building_assignments.created_by` and the `user.created` audit event. Owners may create a
manager without any building assignment; such a manager stays visible via `created_by` and can
be assigned buildings later.

Managers created before creator tracking existed have a null `created_by`. Migration
`supabase/migrations/20260703000000_backfill_user_created_by.sql` backfills it from the earliest
`user.created` audit event. Accounts predating `user` audit support have no trail and remain
visible to their owner only through building assignments.

## Billing Permissions

| Capability | Role | Used for |
| --- | --- | --- |
| `billing.read` | admin, owner, manager | Periods, overview, drafts, grid, invoices, payments, audit, export. |
| `billing.write` | admin, owner, manager | Readings, utility overrides, issue, payments, bulk payments, adjustment, void, reissue. |
| `billing.corrections` | admin, owner, manager | Corrective billing adjustments. |
| `billing.close` | admin, owner | Close a fully collected issued/collecting period. |
| `billing.unissue` | admin, owner | Reopen issuance by voiding unpaid invoices and retaining paid ones. |

For scoped roles (owner, manager) every billing capability is additionally constrained to the
period's building via `assertBuildingScope`.

## Operations Report Permissions

| Capability | Role | Used for |
| --- | --- | --- |
| `operations-report.read` | admin, owner, manager | View the monthly report. |
| `operations-report.export` | admin, owner | Export the monthly report workbook. |
| `building-expenses.read` | admin, owner, manager | View monthly expenses and signed receipt links. |
| `building-expenses.write` | admin, owner, manager | Create/edit expenses and upload/remove receipts in scope. |
| `building-expenses.delete` | admin, owner | Soft-void expenses. |
| `building-fixed-costs.read` | admin, owner | List fixed-cost history in building settings. |
| `building-fixed-costs.write` | admin, owner | Create/end fixed-cost rows in building settings. |

Managers can enter expenses and receipts for assigned buildings, but they cannot export operations workbooks or manage fixed costs.

## Security Rules

- Never trust UI visibility for authorization.
- Repeat capability checks in services; services are the authoritative gate.
- Enforce building scope in services for owner/manager; repositories do not scope.
- Keep authorization claims in `app_metadata`, not user-editable metadata.
- Do not expose service-role or secret keys to client runtime config.
- Never query business tables from browser code; go through `server/api/**`.
- Prefer capability checks over direct role checks in business code.
