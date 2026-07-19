## Context

Supabase Auth currently issues sessions to Google OAuth users before Zeno House has an application role, while client routing assumes every session maps directly to `/dashboard` or `/portal`. Application authorization already derives exclusively from `app_metadata.role`, internal roles require building assignments, and tenant identity requires `tenant_user_links`. The change must preserve those boundaries, keep existing operator-provisioned accounts working, and add a polished auth experience without creating a second design system.

## Goals / Non-Goals

**Goals:**

- Represent self-registered identities durably without granting an application role.
- Let only admins approve or reject pending identities and attach the required scope atomically enough to remain deny-by-default under partial failure.
- Route missing-role sessions only through authenticated auth endpoints and `/auth/pending`.
- Support email registration, Google OAuth, password recovery, and responsive auth UI using existing primitives/tokens.
- Preserve automatic identity linking for a provisioned account that later uses Google with the same verified email.

**Non-Goals:**

- Owner approval, invitation codes, approval email delivery, rejected-request reopening, or admin self-registration.
- A new role value, permission model, font, token set, or UI primitive library.
- Replacing the existing owner/manager creation or tenant provisioning workflows.

## Decisions

### Pending is an account state, not a role

`access_requests` records the lifecycle while `app_metadata.role` stays absent until approval. This keeps every existing capability and service guard deny-by-default and avoids teaching domain code about a non-domain role. Treating `pending` as a role was rejected because it would widen every role union and make accidental authorization more likely.

### An `auth.users` trigger captures all unprovisioned registrations

An additive trigger inserts one pending request only when the new auth user has no application role. It covers email signup and OAuth consistently and skips admin/owner provisioning that supplies a role. Callback-only insertion was rejected because it leaves a gap when the browser closes or callback handling fails.

The table is service-role-only: RLS is enabled, `anon`/`authenticated` receive no direct table access, and pending users read their state through an authenticated `/api/auth/**` endpoint.

### Approval is an explicit state machine

The repository claims `pending -> processing` with a conditional update and an unguessable claim token so concurrent admins cannot both decide a request. Assignments and tenant links created by the decision carry the same token. The service validates email verification and all target resources before the claim, writes scope, updates Auth `app_metadata.role`, then finalizes `approved` only when the token still owns the request. Because a timed-out Auth write may still commit after an immediate read, Auth errors preserve the fenced processing state and exact grants. Repeating the same decision idempotently fills missing scope, retries the role grant, or finalizes an already-observed role; a different decision conflicts. Role-less processing is not time-reclaimed because an external Auth update cannot participate in the database transaction. Rejection is `pending -> rejected` with a required reason and is terminal in v1.

### Auth APIs form a third namespace

`/api/auth/**` accepts an authenticated JWT regardless of application role, while every endpoint performs its own `requireAuth` check. Internal and tenant API namespaces continue to reject missing/unknown roles. This is more explicit than exempting auth paths from classification and makes namespace tests exhaustive.

### Missing role has one landing route

`getRedirectByRole(null | undefined)` returns `/auth/pending`; known roles retain their current destinations and unknown non-empty roles return `/login`. Global middleware allows the recovery/callback surface, locks missing-role sessions to pending, and redirects known roles away from pending. The pending page polls only while visible, refreshes the Supabase session after approval, and then uses the same redirect helper.

### Auth UI adapts the reference rather than copying it

The auth layout uses a dark split composition: a Zeno-specific operational building illustration and grounded product copy on the left, with a restrained form surface on the right. Mobile collapses the illustration to a short top band. Existing Inter typography, dark surface hierarchy, cyan accent, `Ui*` primitives, icons, focus rules, and spacing remain authoritative.

## Risks / Trade-offs

- **Auth and Postgres cannot share one transaction** → grant the role last, compensate earlier writes, store the decision, and make retry/finalization idempotent.
- **A trigger failure can block signup** → keep the function minimal, fixed-search-path, covered by SQL verification, and restricted to one insert with conflict protection.
- **Rejected auth users remain in Supabase** → no role means no application access; retaining the row preserves the decision and prevents immediate re-registration in v1.
- **Approval does not send custom email** → the pending page polls and later logins refresh status; custom delivery remains a future capability.
- **Email confirmation configuration varies by environment** → registration handles both session-returning and confirmation-required responses, while approval always requires a verified email.

## Migration Plan

1. Deploy the additive table, trigger, indexes, RLS/grants, and SQL verification.
2. Regenerate database types from the configured Supabase project.
3. Deploy repository/service/API and routing changes before exposing registration links.
4. Deploy auth/admin UI and update Supabase redirect allow-list for callback and recovery routes.
5. Verify provisioned-account Google linking, pending isolation, approval for each role, rejection, and recovery in staging.

Rollback removes the trigger first, then the table/policies after application code no longer references them. Removing the feature does not alter already approved users, assignments, tenant links, or role claims.

## Open Questions

None for v1. Owner-scoped approval, invitation codes, approval email delivery, and rejected-request reopening are explicitly deferred.
