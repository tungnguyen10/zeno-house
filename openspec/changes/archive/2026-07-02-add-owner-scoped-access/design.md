## Context

Current access control has two roles: `admin` and `manager`. Roles come from Supabase Auth `app_metadata.role`; server authorization uses static capability sets in `server/utils/permissions.ts`; building visibility is scoped through `user_building_assignments` for managers. Admin is global and unscoped.

The new owner role sits between those two. Owner is powerful like admin, but only inside owned/assigned buildings. Owner can create a building, automatically owns/sees that building, can delete/archive mistaken buildings subject to safety checks, and can manage managers for those buildings. Admin remains the only global role and the only role that can create owners. No app surface creates admins.

Security constraints:
- Authorization claims must stay in `app_metadata`, not `user_metadata`.
- Service-role/Supabase Admin APIs may only be used server-side.
- Server checks are authoritative. Client visibility is not a security boundary.
- Any direct use of `user.role` is unsafe/inconsistent in this codebase; role reads must use `user.app_metadata.role`.

## Goals / Non-Goals

**Goals:**
- Add role `owner`.
- Preserve admin as global superuser with visibility over all buildings and all user-management data.
- Make owner a scoped superuser for owner-owned/assigned buildings.
- Let owner create buildings and automatically get scoped access to buildings they create.
- Let owner create/manage managers only within owner's building scope.
- Block app-level admin creation completely.
- Keep manager behavior compatible with the existing scoped operator model.
- Add testable server rules for scope, no-global-visibility, direct API bypass attempts, and user creation target-role restrictions.

**Non-Goals:**
- Tenant portal roles.
- Fine-grained per-owner billing capabilities beyond "full rights inside scope".
- Owner-to-owner collaboration workflows beyond admin assigning an owner to a building.
- Self-service public signup for owners.
- Creating admins from the app. Admin bootstrap remains seed/Supabase Dashboard/internal script only.

## Decisions

### D1 - Roles stay in `app_metadata.role`

Supported roles become:

```text
admin   -> global superuser
owner   -> scoped superuser
manager -> scoped operator
```

`user_metadata` is not used for authorization because it is user-editable. Role reads should be centralized through helpers (`role`, `isAdmin`, `isOwner`, `isManager`) and server-side permission helpers.

Alternative considered: store owner/manager role in `user_building_assignments`. Rejected because auth role is still needed before resolving building scope and because global capability defaults belong at user level.

### D2 - Building scope is generalized beyond managers

`getAssignedBuildingIds(event, user)` should return:

```text
admin   -> null        // global, no filter
owner   -> string[]    // scoped
manager -> string[]    // scoped
```

The existing lazy per-request cache remains valid. Owner with no assignment sees empty lists, not global data.

Alternative considered: owner scope from `buildings.owner_user_id` only. Rejected because admin may need to assign a second owner, transfer a building, or grant owner access to an existing building. Assignment remains the source of access scope.

### D3 - Buildings store creator/owner provenance, access still uses assignments

Add building ownership metadata:

```text
buildings.created_by uuid references auth.users(id)
buildings.owner_user_id uuid references auth.users(id) nullable
```

Recommended semantics:
- `created_by` records who created the building.
- `owner_user_id` records the primary owner for display/filter defaults.
- `user_building_assignments` remains the access-control source of truth.

When owner creates a building, the service inserts the building and creates an owner assignment in the same server workflow. If assignment creation fails, the building create should be rolled back or the failure must return a conflict/error before exposing a partially inaccessible building.

### D4 - Owner permissions are broad but always scoped

Owner receives operational capabilities similar to admin:
- building read/create/update/delete
- room/tenant/contract CRUD
- meter reading read/write
- service read/write
- billing read/write/corrections/close/unissue
- dashboard read
- scoped user management

Every owner action against an existing entity must still pass `assertBuildingScope(..., mode)`. `buildings.create` is special because the building does not exist yet; the newly created building is auto-assigned to the owner.

### D5 - Manage capabilities are explicit

Introduce capability names:

```text
users.manage.global   -> admin
users.manage.scoped   -> owner
users.create.owner    -> admin
users.create.manager  -> admin, owner
users.create.admin    -> no role in app
```

Server endpoints must check both caller capability and target role. `role=admin` is always rejected from app APIs, even for admin callers.

### D6 - Settings user management is target-role and scope aware

Settings should support:

```text
admin:
  see all owners, managers, assignments, buildings
  create owner
  create manager
  assign owner/manager to any building

owner:
  see only managers assigned to owner's buildings
  create manager assigned immediately to one or more owner-scoped buildings
  assign/unassign/toggle manager access only inside owner-scoped buildings
  cannot create owner/admin

manager:
  no user-management access
```

Owner-created managers must not be created without at least one scoped building assignment.

### D7 - Owner building delete/archive uses existing safety model

Owner can delete/archive a scoped building they created or are assigned to, but only through the same safety checks as admin. Hard delete should remain blocked when rooms, active contracts, invoices, payments, or other operational data would be orphaned. Force/archive behavior can be available to owner only inside scope; global destructive overrides remain admin-only if needed.

### D8 - RLS is defense in depth; service layer remains authoritative

The current assignment table has RLS. This change should update policies for owner reads of their own assignments and for any direct table access the app still uses. However, user creation and assignment mutation should go through server APIs and service-role/Supabase Admin clients only where necessary, after service-layer authorization.

### D9 - Audit API must be fixed while touching roles

`server/api/audit/index.get.ts` currently checks `user.role === 'manager'`. This should be replaced with `user.app_metadata.role` or helper calls and extended so owner is scoped like manager. Admin can query globally; owner/manager must provide and pass scoped `building_id`.

## Risks / Trade-offs

| Risk | Mitigation |
| --- | --- |
| Owner accidentally gets global access because code treats "not manager" as admin | Replace role checks with explicit helpers and add owner negative tests for every global endpoint. |
| Building create succeeds but owner assignment fails | Use a transactional RPC or compensating rollback in the service workflow. |
| Supabase Auth Admin user creation leaks service-role behavior | Keep all Auth Admin calls in server repositories/services; never expose service-role config to client. |
| Existing UI checks use `isAdmin`, hiding owner actions despite server permission | Add capability-derived client helpers for action visibility. |
| RLS and service-layer rules drift | Treat service layer as source of truth, update RLS for defense in depth, and add SQL/RLS assertion tests where current suite already does. |
| Owner-created managers become orphaned with no building scope | Require at least one valid owner-scoped building assignment at creation time. |

## Migration Plan

1. Add `owner` to role constants/types and seed/demo auth data as needed.
2. Add building ownership metadata migration (`created_by`, `owner_user_id`) and update generated database types.
3. Backfill `buildings.created_by`/`owner_user_id` as `null` for existing rows. Existing admins remain global; existing managers keep current assignments.
4. Generalize scope helpers and permission sets.
5. Update building create/delete/update services for owner.
6. Add user-management service/API using Supabase Admin server-side:
   - create owner (admin only)
   - create manager (admin or owner scoped)
   - list/manage scoped assignments
   - reject admin creation
7. Update Settings UI to show global admin view or scoped owner view.
8. Update audit/global endpoints and all direct role reads.
9. Add tests, then run unit/component/server suites and any SQL/RLS assertions.

Rollback:
- Disable Settings user-creation UI first.
- Revert owner role assignment for affected users in Supabase Auth app metadata.
- Remove or ignore owner-specific assignments.
- Building ownership columns can remain nullable without affecting admin/manager behavior.

## Open Questions

- User invite flow: should created owners/managers receive an invite email, a temporary password, or be created as demo/test users only at first?
- Owner transfer: should admin be able to change `owner_user_id` after building creation, or is assignment enough for v1?
- Force archive: should owner be allowed to force-archive a building with rooms but no financial records, or should force remain admin-only?
