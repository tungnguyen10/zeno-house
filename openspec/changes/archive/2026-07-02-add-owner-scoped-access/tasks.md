## 1. Schema, Types, And Seeds

- [x] 1.1 Add `owner` to role constants and auth/user TypeScript types.
- [x] 1.2 Add a Supabase migration for building ownership metadata (`created_by`, `owner_user_id`) with nullable backfill for existing buildings.
- [x] 1.3 Update generated database types after the migration.
- [x] 1.4 Update assignment table RLS/policies so owner can read own scoped assignments while admin remains full-access.
- [x] 1.5 Update demo auth seed data to include at least one owner account and owner building assignment.

## 2. Permission And Scope Core

- [x] 2.1 Update `server/utils/permissions.ts` with owner capabilities and user-management capabilities (`users.manage.global`, `users.manage.scoped`, `users.create.owner`, `users.create.manager`).
- [x] 2.2 Ensure no role receives `users.create.admin`.
- [x] 2.3 Add shared role helpers or normalize existing role reads so authorization uses `user.app_metadata.role` only.
- [x] 2.4 Generalize `getAssignedBuildingIds` so admin returns `null`, owner/manager return scoped building IDs, and no-assignment users get empty scope.
- [x] 2.5 Update `assertBuildingScope` and related helpers/tests for owner read 404 and owner mutation 403 behavior.
- [x] 2.6 Fix existing direct `user.role` reads, including audit API.

## 3. Building Ownership Workflow

- [x] 3.1 Update building repository mappings/types to include ownership metadata.
- [x] 3.2 Update `BuildingService.create` so admin can create global buildings and owner-created buildings auto-create owner assignment.
- [x] 3.3 Ensure owner create flow rolls back or fails cleanly if assignment creation fails.
- [x] 3.4 Update building update/delete/archive service logic so owner is allowed only inside scope.
- [x] 3.5 Preserve existing building conflict checks for owner delete/archive.
- [x] 3.6 Update building API response shape and mappers for non-sensitive owner provenance fields.

## 4. User And Assignment Management APIs

- [x] 4.1 Decide invite/password behavior for creating owner/manager users before implementing user creation APIs.
- [x] 4.2 Add validators for creating users with target role `owner` or `manager`; reject `admin`.
- [x] 4.3 Add server-side user management service using Supabase Admin/service-role only on the server.
- [x] 4.4 Implement admin create owner and admin create manager flows.
- [x] 4.5 Implement owner create manager flow requiring at least one owner-scoped building assignment.
- [x] 4.6 Update assignment list/create/update/delete APIs to support admin global management and owner scoped management.
- [x] 4.7 Ensure owner cannot assign/unassign/toggle access outside owner building scope.
- [x] 4.8 Ensure manager cannot access user-management APIs.
- [x] 4.9 Add user update/delete validators and APIs for managed owner/manager users.
- [x] 4.10 Implement admin full CRUD for owner/manager users while still rejecting admin user mutation paths.
- [x] 4.11 Implement owner update/delete for managers only inside owner scope, including denial for managers with outside-scope assignments.

## 5. Settings And Building UI

- [x] 5.1 Update auth store/client helpers for `isOwner`, `isManager`, and manage-user visibility.
- [x] 5.2 Update navigation/sidebar so Settings user management is visible to admin and owner, not manager.
- [x] 5.3 Update `/settings/managers` or rename it to a broader users/manage page while preserving route compatibility if needed.
- [x] 5.4 Add admin UI for creating owners and managers and viewing all assignments.
- [x] 5.5 Add owner UI for creating managers and assigning them only to owner-scoped buildings.
- [x] 5.6 Remove any create-admin UI path.
- [x] 5.7 Update building list/detail/create/edit/delete UI so owner sees permitted scoped actions.
- [x] 5.8 Update building settings contextual manager section for admin global view and owner scoped view.
- [x] 5.9 Add Settings UI edit/delete controls for managed owner/manager users according to caller scope.

## 6. Domain Service Audit

- [x] 6.1 Audit all service checks that assume "not admin means manager" and update them for owner.
- [x] 6.2 Ensure owner has full scoped access for rooms, tenants, contracts, services, meter readings, billing periods, invoices, payments, corrections, close, unissue, and dashboard.
- [x] 6.3 Ensure owner list queries are filtered by assigned buildings.
- [x] 6.4 Ensure owner detail reads outside scope return 404.
- [x] 6.5 Ensure owner mutations outside scope return 403.
- [x] 6.6 Update audit log API so admin can query globally and owner/manager must query scoped building audit.

## 7. Tests

- [x] 7.1 Add permission tests for owner capabilities and absence of `users.create.admin`.
- [x] 7.2 Add scope resolver tests for admin, owner, manager, and no-assignment owner.
- [x] 7.3 Add building API/service tests for owner create auto-assignment, scoped update, scoped delete/archive, and outside-scope denial.
- [x] 7.4 Add user management API tests for admin create owner, admin create manager, owner create manager, and all create-admin rejection paths.
- [x] 7.5 Add assignment API tests for admin global visibility and owner scoped visibility/mutations.
- [x] 7.6 Add audit API tests for owner scoped audit and `app_metadata.role` enforcement.
- [x] 7.7 Add UI/component tests for Settings visibility and owner scoped building controls.
- [x] 7.8 Update SQL/RLS assertion tests for owner assignment policies.
- [x] 7.9 Add user-management update/delete tests for admin and owner scoped CRUD.

## 8. Verification

- [x] 8.1 Run targeted server utility, scope, building, user-management, and audit tests.
- [x] 8.2 Run relevant component/composable tests for Settings and building UI.
- [x] 8.3 Run full typecheck.
- [x] 8.4 Run full test suite or document any remaining skipped/blocked verification.
- [x] 8.5 Run Supabase migration verification/advisors when database tooling is available. (Supabase CLI unavailable locally: `supabase` command not found; SQL/RLS assertion tests passed.)
- [x] 8.6 Re-run targeted user-management CRUD tests and OpenSpec validation after added CRUD scope.
