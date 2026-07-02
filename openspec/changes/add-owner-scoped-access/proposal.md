## Why

Zeno House needs a middle tier between global admin and operational manager: an owner can run their own buildings end-to-end, but must not see or control buildings outside their scope. This lets the app support multiple owners/landlords while keeping admin as the only global superuser.

## What Changes

- Add a new `owner` role stored in Supabase Auth `app_metadata.role`.
- Keep `admin` as the highest global role: admin sees every building, handles every operational action, and manages all owners/managers.
- Make owner a scoped superuser: owner can create buildings, automatically gets access to buildings they create, sees only owned/assigned buildings, and has full operational permissions inside those buildings.
- Allow owner to delete or archive buildings they created or are assigned to, subject to existing safety checks for real operational data.
- Add Settings user management for owners/managers:
  - Admin can create owners and managers, assign them to buildings, and see all Manage data.
  - Owner can create managers and assign/manage them only within owner's scoped buildings.
  - No app UI or API path can create an `admin`; admin bootstrap stays outside the app.
- Generalize manager assignment/scope logic so `user_building_assignments` scopes both owners and managers.
- Enforce all owner restrictions on the server. UI hiding is convenience only.
- Fix role reads that use non-standard `user.role`; authorization must consistently use `user.app_metadata.role`.

## Capabilities

### New Capabilities
- `owner-scoped-access`: Defines owner role semantics, scoped superuser behavior, owner-created building ownership, and no-global-visibility guarantees.
- `scoped-user-management`: Defines Settings behavior and APIs for admin/owner creation and scoped manager management, including the rule that admins cannot be created from the app.

### Modified Capabilities
- `user-auth`: Supported roles and capability mapping change from `admin | manager` to `admin | owner | manager`.
- `server-utils`: `can()` and permission helpers must support owner capabilities and scoped/global manage capabilities.
- `manager-building-scope`: Building scope resolution must apply to owners as well as managers, with admin remaining unscoped.
- `manager-assignment-ui`: Existing manager access UI expands into scoped user management for owners/managers.
- `buildings-api`: Owner can create buildings; owner-created buildings are automatically scoped to that owner; owner delete/archive is scoped.
- `buildings-client`: Building list/create/delete controls must reflect owner scoped permissions.
- `entity-audit-log`: Audit access must use `app_metadata.role` and enforce owner/manager building scope.

## Impact

- `app/utils/constants/roles.ts`, `app/types/auth.ts`, `app/stores/auth.ts` for the new role and client helpers.
- `server/utils/permissions.ts` and `server/utils/scope.ts` for owner permissions, global/scoped manage capabilities, and consistent role reads.
- Supabase migration for building ownership metadata and updated assignment RLS/policies where applicable.
- `server/repositories/assignments.ts`, `server/api/assignments/**`, and new/updated user management APIs that use Supabase Admin/service-role safely on the server only.
- `server/services/buildings/**` and any service that currently treats non-admin users as manager-only.
- `/settings/managers` or its replacement Settings page for owner/manager creation and scoped assignment management.
- Tests for admin global access, owner scoped access, manager scoped access, no-admin-creation, and direct API bypass attempts.
