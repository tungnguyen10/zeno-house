# Authentication And Access Requests

## Entry Paths

Users can sign in with email/password or Google, register with email/password, and request password
recovery. Registration responses are neutral and email confirmation remains controlled by Supabase.
Recovery uses `/auth/reset-password`, updates the password, signs out the recovery session, and
returns to login.
When `NUXT_PUBLIC_TURNSTILE_SITE_KEY` is configured, email registration requires the Turnstile
widget and forwards its token through Supabase Auth signup; otherwise Supabase Auth rate limits
remain the fallback.

## Provisioned Versus Pending Identities

Existing admin/owner provisioning flows create Auth users with `app_metadata.role`; those accounts
retain their user id, role, building assignments, or tenant link and do not create access requests.
Tenant accounts additionally begin with the server-owned `tenant_onboarding` state. They must change
their temporary password, verify the desired Auth email, and link Google before `/portal` or
`/api/tenant/**` becomes available. The linked identity belongs to the existing Auth user, preserving
the tenant link and audit history; a new Google identity without a role still enters pending access.

## Tenant First-login Setup

`/auth/complete-account` is an authenticated lifecycle route for tenant accounts in one of three
states: `password_required`, `email_required`, and `google_required`. Password changes go through
the server lifecycle service; the client requests the Supabase Auth email confirmation link and the
service copies the confirmed Auth email into `tenants.email` only after the Auth account reports the
requested address. Google uses `auth.linkIdentity` so the provider attaches to the existing tenant
Auth user rather than creating a second identity.

Supabase Dashboard requirements: enable Google, enable **Manual Linking**, add
`/auth/complete-account` to Redirect URLs, and configure email changes to require confirmation of
the new email without requiring the potentially incorrect old email. Production must use an SMTP
configuration that can deliver Auth confirmation messages to tenant addresses.

Session policy: keep JWT expiry at Supabase's one-hour default. Configure a 24-hour inactivity
timeout and a seven-day absolute session lifetime in Authentication > Sessions; do not extend JWT
expiry to 24 hours because refreshed claims and session revocation would take longer to take effect.

## Pending Experience

A missing-role session can render `/auth/pending` and call only authenticated auth-lifecycle APIs.
The page shows the current email/status, polls only while visible, refreshes the session after
approval, and redirects to `/dashboard` or `/portal`. Rejection shows the stored reason and logout;
reopen and repeat registration are intentionally unsupported in v1.

## Admin Decision

Only admin can open `/dashboard/settings/access-requests` or call decision APIs. Owner and manager
approval requires at least one building; tenant approval requires an existing tenant without an
account link. Unverified email identities cannot be approved, and this workflow never grants admin.
Approval claims the request before writing scope and writes the Auth role last. Claim tokens fence
finalization and tag the exact assignments or tenant link created by that decision. Auth errors keep
that processing state because a timed-out write can commit late; choosing “Tiếp tục” with the stored
decision fills missing scope and retries or finalizes idempotently. Processing is never time-reclaimed.
Rejection is terminal and keeps both Auth identity and request for audit.
