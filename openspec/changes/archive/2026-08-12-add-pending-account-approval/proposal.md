## Why

Zeno House currently assumes every authenticated Supabase user already has an application role, so a first-time Google OAuth user can receive a session without a safe application landing state or an operator-controlled way to attach building scope or tenant identity. The login surface also lacks self-registration, password recovery, and the operational polish expected by the project design system.

## What Changes

- Add a deny-by-default pending account state for new Google OAuth and email/password registrations.
- Add an admin-only approval queue that assigns `owner`/`manager` building scope or links a `tenant` account to an existing tenant record before granting a role.
- Add terminal rejection with a durable reason and audit history.
- Route authenticated users without a role exclusively to `/auth/pending`; keep internal and tenant namespaces inaccessible until approval.
- Add registration, password recovery, password reset, pending-status polling, and password visibility controls.
- Redesign all auth surfaces as a responsive dark/cyan split layout using existing Zeno House primitives and tokens.
- Add the database trigger, service/API contracts, audit actions, tests, current specs, and developer documentation required by the workflow.

## Capabilities

### New Capabilities

- `pending-account-approval`: Pending identity lifecycle, admin approval/rejection, role/scope attachment, and self-service status behavior.

### Modified Capabilities

- `user-auth`: Registration, recovery, Google identity linking, pending landing, and password visibility behavior.
- `route-guard`: Public auth routes and strict routing for authenticated sessions without an application role.
- `role-namespace-routing`: Missing-role routing and the authenticated auth API namespace.
- `admin-shell`: Admin-only access-request navigation and management surface, plus the shared auth layout redesign.
- `entity-audit-log`: Account-request creation, approval, and rejection audit actions.

## Impact

- Supabase Auth and Postgres gain an `access_requests` table, an `auth.users` trigger, RLS/grants, and generated database types.
- Nuxt auth middleware, callback routing, composables, pages, admin navigation, and settings UI change.
- New authenticated auth APIs and admin review APIs are added; existing internal and tenant APIs remain deny-by-default for missing-role sessions.
- Existing admin/owner provisioning remains authoritative and does not create pending requests when `app_metadata.role` is supplied.
- No new runtime dependency, theme, typography system, or reusable UI primitive is introduced.
