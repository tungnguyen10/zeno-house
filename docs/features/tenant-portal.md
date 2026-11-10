---
type: Feature Guide
title: "tenant-portal"
status: stable
tags: [engineering, reference]
---

# Tenant Portal

The tenant portal supports both the person named on a contract and active roommates. Every login
still maps one-to-one to its own `tenants` row through `tenant_user_links`; account provisioning,
temporary-password onboarding, reset, disable, and revoke remain operator-controlled.

## Operator account scope

Internal account status, provisioning, enable/disable, password reset, and revoke require both
`tenant.account.provision` and full tenant access from the shared authorization service. A previous
building relationship grants only basic profile/history lookup and never reveals Portal state or
grants account control. Account lists and provisioning search choices exclude basic tenants.
Active relationships spanning an unassigned building fail closed to basic for scoped operators.
Creator custody applies only to tenants that have never had any primary or occupant contract
history, using the `TENANT_CREATED` audit. Account operations use the resolved canonical tenant ID.
The tenant's self-service `/api/tenant/**` identity and housing rules below remain unchanged.

Tenant authorization rollout uses
`supabase/migrations/20261105032920_tenant_scoped_bulk_status.sql` and
`supabase/verification/tenant_scoped_bulk_status.sql`; Dashboard execution, security advisors,
cloud type regeneration, and live staging checks remain required as detailed in
`docs/architecture/auth-permissions.md`.

## Account lifecycle

- Disabling the link blocks portal resolution immediately.
- Revocation disables the link first, attempts a hard Auth-user delete, then falls back to
  irreversible Supabase soft deletion when historical foreign keys still block physical deletion.
  The API returns the actual `deleted` or `deactivated` outcome.
- A linked tenant whose Auth identity is missing or no longer has the tenant role is reported as
  `missing_auth`. The dangling link can be removed from account settings.
- Admins can list and reconcile `orphaned` tenant-role Auth identities that have no
  `tenant_user_links` row. Owners cannot access this global identity inventory.
- Every tenant API request rechecks the live Auth identity and tenant role, in addition to the
  active link resolver.

## Housing context

The server resolves housing context for every shared read:

1. Prefer the linked tenant's current active primary contract.
2. Otherwise use an active `contract_occupants` row whose move-in date has arrived and whose
   `move_out_date` is null, provided the contract is active and within its date range.
3. Return no shared context for future, moved-out, expired, or terminated assignments.

The contract DTO includes `assignmentRole` (`primary` or `roommate`) and `primaryTenantName`.
Overview and room pages display this role so a roommate is not presented as the contract holder.
The contract summary never exposes internal `contracts.notes`. It resolves the payment due day from
the contract override first and then the building default, and returns `paymentDueDaySource` as
`contract`, `building`, or `unset` so the portal can explain inherited values.

The bootstrap payload also includes `contractAmendments`. A primary tenant receives only
`scheduled` and `applied` amendments with their public content and immutable term diff. A roommate
always receives an empty amendment list and sees only the current terms already applied to the
shared contract.

## Data boundaries

- Profile, CCCD images, and documents always belong to the linked tenant record.
- Self-service edits are limited to contact phone, occupation and emergency contact name/phone. Personal/legal identity and canonical images are read-only; correction evidence uses private support requests. Internal tenant notes are absent from the portal DTO/bootstrap.
- Primary tenants read invoices by `tenant_id`, preserving their invoice history.
- Active roommates read all invoices for the current shared `contract_id`, including invoices
  issued before their move-in date. Invoice detail uses the same server-derived scope.
- Support requests keep the sender's own `tenant_id` and personal timeline, while the active
  housing context supplies `contract_id` and `building_id`.
- `move_out_date`, contract termination, or contract expiry removes shared contract and invoice
  access immediately. The portal account remains available for personal profile access.

RLS mirrors these rules as a direct-access safety net. Apply
`supabase/migrations/20260722085743_tenant_roommate_portal_access.sql` and
`supabase/migrations/20260729120000_harden_tenant_account_lifecycle.sql` manually through the
Supabase Dashboard, then run `supabase/verification/tenant_identity_rls.sql` and
`supabase/verification/tenant_account_lifecycle.sql`.

## Profile experience

`/portal/profile` is the tenant's complete personal dossier and does not repeat housing or contract
data. It presents every field already exposed by `TenantProfile`, followed by identity data,
read-only identity-image previews, documents, a security action, and logout.

The tenant edits twelve self-service fields on `/portal/profile/edit`; email, account status, and
tenant code remain read-only. The same screen owns immediate upload, replacement, and removal of
front/back identity images, independently from text-form dirty state. The client normalizes optional
blank values to `null` and sends only changed text fields through `PATCH /api/tenant/me`. In-app
navigation with dirty values requires explicit discard confirmation, while hard refresh and tab
close use the browser unload guard.

`/portal/profile` exposes a visible `Đổi mật khẩu` action that opens
`/portal/profile/password`. The tenant supplies the current password, a new password, and
confirmation. Supabase Auth verifies the current password, keeps the successful session active, and
the server appends a credential-free `tenant.account.password_changed` audit event.

## Correction intake

The portal correction action pre-fills only a literal intent and neutral title. Private evidence does not replace canonical slots. Authorized staff receive requests in `/dashboard/tenant-support-requests`, verify full tenant/building scope before text or attachment access, manually apply any verified corrections through existing tenant controls, and track handling status atomically. See the [change and verification record](../changes/restrict-tenant-portal-profile-edits/index.md); source, cloud and visual gates are recorded independently.
