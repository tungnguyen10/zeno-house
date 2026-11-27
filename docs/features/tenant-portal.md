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

This guide describes the production-completion branch and its local regression coverage. Its
[active change record](../changes/tenant-portal-production/index.md) separately tracks database
rollout, cloud-generated types, authenticated deployed journeys and physical-device/PWA checks.

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

Server services own these access decisions and query through the service-role repository. RLS
remains enabled, but legacy row policies do not justify exposing raw business rows. The prepared
`20261127090000_tenant_portal_private_reads.sql` migration revokes browser-role table and column
SELECT on contracts, occupants and invoices, plus direct support-request writes. Earlier profile
and support SELECT revocations remain in place. Run the matching
`supabase/verification/tenant_portal_private_reads.sql` against the target database after applying
the migration; source checks are not proof of deployed privileges.

## Invoice balances and history

`GET /api/tenant/bootstrap` combines the safe profile, active contract, authorized amendments,
first invoice page, exact invoice metadata and a separate `financialSummary`. The summary contains
`outstandingAmount`, `outstandingCount`, `overdueAmount`, `overdueCount` and `nextInvoice` across
the complete authorized invoice scope. It does not sum only the 20 displayed rows. Repository
reads explicitly page the matching debt and fail if a batch is truncated by an upstream row cap.

Only issued/partial/overdue invoices with positive remaining balances and no void marker contribute
to debt. Part-paid invoices can contribute to overdue debt after their immutable `overdueDate`,
using Vietnam's calendar date. The next action prioritizes overdue obligations and then earlier
known due dates; absent legacy due dates remain absent. A settled newest invoice cannot conceal
an older unpaid obligation. Invoice list parameters are `page` and `page_size` (20 by default,
up to 100), and exact metadata enables loading every page.

The home chart is a separate view of **loaded** invoice history and says so in its copy. It excludes
draft/void invoices, combines valid invoices in the same month, shows at most six distinct months,
and divides the monthly average by month count. It appears only with at least two loaded months.
It is not an all-history aggregate or the source for the debt summary.

Invoice detail scopes the invoice before reading charge lines and non-deleted payments. Its safe
payment history contains amount/date/method and `cash`, `deposit` or `credit` funding source, without
staff notes or audit/settlement identifiers. This read-only ledger never lets a tenant confirm a
payment. Electricity/water lines expose available opening/closing readings and billable usage from
the issued charge metadata, with an adjustment indicator. Missing snapshot values stay null;
current readings are never substituted. Transfer instructions continue to use the immutable
invoice payment-profile snapshot and are hidden for void invoices.

## Official contract documents

The room page uses `/api/tenant/contract-documents` for issued/signed document metadata on the
current primary contract. Roommates can read their shared terms but cannot list or download full
agreements containing the contracting parties' legal details. Each download rechecks the active
primary relationship, document contract/building/state and canonical storage path, then returns a
60-second signed URL. Pending/failed/voided or foreign files share the same not-found outcome.
The portal does not issue or regenerate contract documents, and this read path does not introduce
appendix issuance. See [API requirements](../capabilities/tenant-portal-api.md).

## Profile experience

`/portal/profile` is the tenant's complete personal dossier and does not repeat housing or contract
data. It presents every field already exposed by `TenantProfile`, followed by identity data,
read-only identity-image previews, documents, a security action, and logout.

The tenant edits exactly four contact fields on `/portal/profile/edit`: phone, occupation,
emergency contact name and emergency contact phone. Name, birth date, gender, permanent address,
legal identity, email, account status and tenant code remain read-only. Canonical front/back identity
images are read-only previews; their tenant POST/DELETE endpoints return 403. Corrections use
private support evidence and do not replace the original slots. Free-form personal documents remain
uploadable/deletable through their own APIs.

The client normalizes optional blank contact values to `null` and sends only changed allowed fields
through `PATCH /api/tenant/me`. Mixed forbidden keys reject the whole payload. In-app navigation
with dirty values requires discard confirmation, while hard refresh and tab close use the browser
unload guard. Identity-image fetch failures display a retry state rather than an empty-profile claim.

`/portal/profile` exposes a visible `Đổi mật khẩu` action that opens
`/portal/profile/password`. The tenant supplies the current password, a new password, and
confirmation. Supabase Auth verifies the current password, keeps the successful session active, and
the server appends a credential-free `tenant.account.password_changed` audit event.

## Correction intake

The portal correction action pre-fills only a literal intent and neutral title. Private evidence does not replace canonical slots. Authorized staff receive requests in `/dashboard/tenant-support-requests`, verify full tenant/building scope before text or attachment access, manually apply any verified corrections through existing tenant controls, and track handling status atomically. See the [change and verification record](../history/2026-11-10-restrict-tenant-portal-profile-edits/index.md); source, cloud and visual gates are recorded independently.

## Request timeline and public replies

`GET /api/tenant/requests` accepts `page`/`limit` (20 by default, at most 50) and returns exact metadata.
The timeline appends older pages; `/api/tenant/requests/[id]` provides full self-scoped description,
status, latest `publicResponse`/`respondedAt` and renewed attachment access. Missing or unsignable
evidence leaves the request readable with `attachmentUnavailable`, rather than encouraging a
duplicate submission. Historical reads remain available without current housing; new submissions
require current primary or roommate housing and derive all context on the server.

Submissions support a single JPEG/PNG/WebP/PDF up to 5 MB, client validation, progress and guarded
in-memory drafts. Their non-idempotent POST is not automatically retried. The invoice action
`/portal/requests?intent=payment-report&invoice=<invoiceCode>` prefills a reconciliation request;
the validated code is display context, not an authorized invoice relationship. The user must supply
transfer information or evidence. A request or reply never changes invoice balance or records payment.

Operator writes include `status`, `expected_status`, `expected_updated_at` and optional
`public_response` (1–4,000 trimmed characters). The service-role-only RPC locks the row and commits
status, reply, timestamps and safe audit metadata together. A stale version returns 409; an identical
replay is a no-op. Reply-only edits advance the version, and omitting a reply preserves existing text.
Tenants see one current public reply, not a conversation history. The
`20261127091000_tenant_support_public_response.sql` migration adds the columns and a six-argument
RPC overload; apply it before the matching application and regenerate cloud types. It retains the
old four-argument service-role-only signature so running instances can finish status updates during
rollout. Legacy-signature cleanup is a later change after all instances have migrated.
The narrow repository type adapter is temporary, not evidence of cloud migration completion.

## Session privacy and PWA behavior

Portal data keys include the Auth account ID. `portal-session.client.ts` clears private async data
on identity changes; successful logout also clears it. Pagination and mutation guards invalidate
old responses, rollbacks and upload progress across account changes, including A→B→A. Profile and
document mutations abort pending requests on invalidation; an aborted response cannot succeed in
the next account's UI. Private draft state stays in memory. HTTP middleware marks portal HTML and
tenant API responses, including failures, `private, no-store, max-age=0`.

The single PWA uses explicit update prompts. The current tab reloads only after its own update
choice and a clean, online state; another tab activating a worker does not consent to reload this
one. Dirty-input checks run before activation and again before reloading. Offline navigation uses
`NetworkOnly` with a non-sensitive offline shell, never cached authenticated pages or APIs. The
mounted portal labels offline information as potentially stale and attempts a guarded current-session
refresh after reconnecting or returning from another app; there is no background queue for payments
or support mutations. See [PWA requirements](../capabilities/pwa-installability.md).

## Verification and release boundaries

Local regression coverage includes repository-to-service finance totals/pagination, payment and
meter DTO privacy, contract-document scope denials, request ownership/public-response concurrency,
deferred account-switch responses, privacy headers, worker cache configuration and update control.
Cloud execution of the two new migrations, read-only privacy catalog verification and rollback-only
support fixture/trigger verification, generated database types, deployed primary/roommate journeys,
and installed iOS/Android update/offline/keyboard
checks remain pending until separately recorded in the [active verification record](../changes/tenant-portal-production/verification.md).
