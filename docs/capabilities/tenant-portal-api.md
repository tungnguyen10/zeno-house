---
type: Capability Specification
title: "tenant-portal-api"
status: stable
tags: [capability, requirements]
sources:
  - resource: "https://github.com/tungnguyen10/zeno-house/blob/ae95811bbdc1932368b4e6b9ed3e9540399d26e6/openspec/specs/tenant-portal-api/spec.md"
generated:
  by: "process:okf-migration"
  at: "2026-11-06T00:00:00Z"
---

# Tenant Portal API Specification

## Purpose

Define the authenticated, self-scoped API contract for tenant profile access, active contract summaries and documents, and invoice list/detail/financial-summary reads.

The production-completion behavior below is reconciled with locally tested source. Database rollout, cloud type generation, deployed journeys and physical-device checks remain separate gates in the [active change record](../changes/tenant-portal-production/index.md).

## Requirements
### Requirement: Tenant profile updates are audited
The tenant profile update service SHALL append `tenant.profile_updated` with whitelisted before/after snapshots and the resolved tenant ID.

#### Scenario: Self-service profile audit
- **WHEN** a tenant successfully updates an allowed profile field
- **THEN** one audit event identifies the tenant actor and target tenant
- **AND** client-injected tenant IDs, sessions, and credentials are absent from the payload

### Requirement: Tenant self-service API namespace
The system SHALL expose tenant self-service endpoints under `/api/tenant/**`, available only to the `tenant` role. Every endpoint SHALL resolve the caller's tenant via `resolveTenantId(event, user)` and SHALL ignore any client-supplied tenant identifier in body, query, or path. Responses SHALL use the standard `{ data, meta? }` / `{ error }` envelope.

#### Scenario: Only tenant role may call tenant API
- **WHEN** a non-`tenant` role calls any `/api/tenant/**` endpoint
- **THEN** the request is rejected by the namespace guard

#### Scenario: Client-supplied tenant id ignored
- **WHEN** a tenant request includes a `tenant_id` value in its input
- **THEN** the server uses the resolver's tenant id and ignores the supplied value

### Requirement: Tenant profile read and whitelist update
`GET /api/tenant/me` SHALL return the caller's safe tenant profile without internal `notes`. `PATCH /api/tenant/me` SHALL accept a strict nonempty object containing only `phone`, `occupation`, `emergency_contact_name`, and `emergency_contact_phone`. Unknown or mixed forbidden keys SHALL reject the entire request with 422 before conflict lookup, persistence or audit. Full name, gender, date of birth, permanent address, legal identity fields, emails, status/code and account linkage SHALL NOT be self-service profile writes.

#### Scenario: Read own profile
- **WHEN** the tenant reads their profile or portal bootstrap
- **THEN** authorized own identity values are available read-only and `notes` is absent from JSON

#### Scenario: Four-field contact edit
- **WHEN** the tenant submits changed allowed contact fields
- **THEN** only those normalized values are saved; Auth identity and canonical legal profile remain unchanged

#### Scenario: Mixed legal and contact payload
- **WHEN** a request contains both `phone` and `id_number`, or any other forbidden key
- **THEN** the entire operation returns 422 with no partial update or duplicate lookup

### Requirement: Tenant password change is verified and audited
`POST /api/tenant/password` SHALL verify the caller's current password through Supabase Auth before setting a valid new password, SHALL keep the successful current session active, and SHALL append `tenant.account.password_changed` without including any credential values.

#### Scenario: Current password is correct
- **WHEN** a tenant submits the correct current password and matching valid new passwords
- **THEN** Supabase Auth updates the password, the current session remains active, and one credential-free audit event is appended

#### Scenario: Current password is incorrect
- **WHEN** Supabase Auth rejects `current_password`
- **THEN** the endpoint returns a safe field validation error and does not append a password-change audit event

### Requirement: Tenant active contract summary
`GET /api/tenant/contract` SHALL return the active housing contract summary (room number, building name, start/end dates, monthly rent, deposit, status, `assignmentRole`, and `primaryTenantName`). The server SHALL prefer the caller's current primary contract and otherwise use only a current active roommate occupancy. Terminated, expired, future move-in, and moved-out contexts SHALL be excluded.

#### Scenario: Active contract returned
- **WHEN** a tenant with an active contract calls the endpoint
- **THEN** the active contract summary is returned with `assignmentRole = primary`

#### Scenario: Active roommate contract returned
- **WHEN** an active roommate calls the endpoint
- **THEN** the shared contract is returned with `assignmentRole = roommate` and the primary tenant name

#### Scenario: No active contract
- **WHEN** the tenant has no active contract
- **THEN** the endpoint returns an empty/absent result, not another tenant's data

### Requirement: Tenant invoice list and detail
`GET /api/tenant/invoices` SHALL accept `page` and `page_size` (default 20, maximum 100) and return an exact scoped count with `total`, `page`, `limit`, and `totalPages`, plus immutable `dueDate`, `gracePeriodDays`, and `overdueDate` schedule fields. Derived overdue status SHALL use `overdueDate`, not `dueDate`. Primary tenant scope SHALL remain `tenant_id` so historical invoices are retained. Active roommate scope SHALL be the server-resolved current `contract_id`, including invoices issued before move-in. The portal SHALL be able to request subsequent pages without replacing already loaded rows. `GET /api/tenant/invoices/[id]` SHALL enforce the same scope before returning charge lines or recorded payments; otherwise it SHALL return a consistent not-found response.

#### Scenario: List own invoices
- **WHEN** a tenant calls `GET /api/tenant/invoices`
- **THEN** only invoices whose `tenant_id` equals the resolved tenant are returned with pagination metadata

#### Scenario: Load subsequent invoice page
- **WHEN** the portal requests a page after page one
- **THEN** the API returns that page and stable total/page/limit/totalPages metadata

#### Scenario: History exceeds the first page
- **WHEN** more than 20 invoices are in the caller's scope
- **THEN** page-one metadata counts the full matching history and allows every subsequent page to be requested

#### Scenario: Roommate lists shared-contract invoices
- **WHEN** an active roommate calls `GET /api/tenant/invoices`
- **THEN** only invoices for the resolved shared contract are returned

#### Scenario: Roommate cannot read another contract invoice
- **WHEN** a roommate requests an invoice outside the resolved shared contract
- **THEN** the response is the same consistent not-found response

#### Scenario: Grace interval is not overdue
- **WHEN** an unpaid issued invoice is past `dueDate` but not past `overdueDate`
- **THEN** the API keeps its derived status issued and returns both dates

#### Scenario: Invoice is overdue after grace
- **WHEN** an unpaid issued invoice is past `overdueDate`
- **THEN** the API marks it overdue

#### Scenario: Legacy invoice has no due date
- **WHEN** an owned legacy invoice has null due and overdue dates
- **THEN** the API returns both as null without inventing a fallback

#### Scenario: Detail ownership enforced
- **WHEN** a tenant requests an invoice id that belongs to another tenant
- **THEN** the response is a consistent not-found with no existence leak

#### Scenario: Voided invoice detail
- **WHEN** a tenant requests one of their own voided invoices
- **THEN** the detail returns with void metadata

#### Scenario: Existing scope and immutable payment instructions remain
- **WHEN** a tenant or active roommate requests an invoice within their resolved scope
- **THEN** the API returns only authorized invoice data and the stored payment-profile snapshot without substituting current building data

### Requirement: Complete-scope bootstrap financial summary
`GET /api/tenant/bootstrap` SHALL include `financialSummary` with `outstandingAmount`, `outstandingCount`, `overdueAmount`, `overdueCount`, and `nextInvoice` (a tenant invoice list DTO or null), independently of its first invoice page. The summary SHALL use the same primary/historical or active-roommate invoice scope as list/detail. It SHALL include only issued, partial, or overdue invoices with a positive remaining balance and no void marker; draft, paid, zero-balance and void invoices SHALL be excluded. Part-paid debt SHALL count as overdue after its stored `overdueDate`, using the Vietnam calendar date. `nextInvoice` SHALL prioritize overdue obligations, then the earliest known due date, with unscheduled legacy debt after dated obligations within the same priority group. An incomplete repository batch SHALL fail the read instead of returning a partial sum as a complete balance.

#### Scenario: An older page contains unpaid debt
- **WHEN** the newest invoice is paid but an older authorized invoice remains payable beyond page one
- **THEN** the bootstrap includes that balance and can select the older invoice as `nextInvoice`

#### Scenario: Part-paid invoice passes grace
- **WHEN** an invoice has status partial and its positive balance remains after `overdueDate`
- **THEN** that balance contributes to both outstanding and overdue totals without changing the stored invoice status

#### Scenario: All authorized invoices are settled or void
- **WHEN** no payable invoice remains in scope
- **THEN** both amounts and both counts are zero and `nextInvoice` is null

### Requirement: Safe payment and meter history
Invoice detail SHALL return recorded, non-deleted payment rows only after invoice scope succeeds. Payment DTOs SHALL expose only `id`, `amount`, `paidAt`, `method`, and `fundingSource` (`cash`, `deposit`, `credit`, or null); staff notes, actor IDs and internal settlement identifiers SHALL be absent. These are read-only records and SHALL NOT authorize tenant payment confirmation or balance changes.

Electricity/water charge DTOs MAY include `meterReading` with `previousValue`, `currentValue`, `billableUsage`, `unit`, and `adjusted` from immutable charge metadata. Missing or invalid values SHALL remain null, and a charge with no usable snapshot SHALL have no reading summary. Current room readings SHALL NOT replace missing historical readings. Raw charge metadata SHALL remain private.

#### Scenario: A payment came from a deposit allocation
- **WHEN** an authorized invoice has a non-deleted payment with `funding_source = deposit`
- **THEN** the tenant sees its recorded amount/date and deposit source without being told it was a new bank transfer

#### Scenario: Meter readings were adjusted or not stored
- **WHEN** the issued charge records an adjusted usage or lacks historical readings
- **THEN** the API marks the stored adjustment or leaves missing values absent instead of reconstructing evidence

### Requirement: Current-primary official contract documents
`GET /api/tenant/contract-documents` SHALL list only safe metadata for issued/signed documents of the caller's current active primary contract. A roommate or tenant without that primary context SHALL receive an empty list. `GET /api/tenant/contract-documents/[id]/download` SHALL recheck live identity, current primary context, contract/building ownership, document state and canonical private storage path before returning a 60-second signed URL. Missing, foreign, pending, failed, voided or inaccessible documents SHALL share the same not-found outcome. Raw document snapshots, paths and staff identity SHALL NOT appear in the list DTO.

#### Scenario: Roommate can read terms but not the full agreement
- **WHEN** an active roommate lists official contract documents or requests a download
- **THEN** the list is empty and a direct download returns not-found, while authorized shared contract summaries remain available

#### Scenario: A primary contract ends or changes
- **WHEN** a formerly accessible document no longer belongs to the caller's current active primary contract
- **THEN** a new download request is denied without relying on a previously loaded list

### Requirement: Private HTTP and direct-table boundaries
Portal HTML and `/api/tenant/**` responses, including failures, SHALL carry `Cache-Control: private, no-store, max-age=0`. Browser-role SELECT on raw `contracts`, `contract_occupants`, and `invoices`, including legacy column grants, SHALL be revoked; service-role access remains available to scoped server services. Direct browser-role support-request writes SHALL also be revoked. RLS SHALL remain enabled as defense in depth and SHALL NOT substitute for service authorization.

#### Scenario: A client bypasses a tenant DTO
- **WHEN** a browser role tries to select a protected raw contract, occupancy or invoice table after the privacy migration
- **THEN** database privileges deny the read even if an old row policy would otherwise allow it

The privilege change is defined in `supabase/migrations/20261127090000_tenant_portal_private_reads.sql`; its read-only catalog verification and rollout are tracked in the [active change record](../changes/tenant-portal-production/index.md). Local checks do not establish applied cloud grants.


### Requirement: Private tenant contact-phone conflicts
Portal contact-phone updates SHALL use shared normalization and uniqueness checks, excluding the current tenant. Legal ID fields SHALL be rejected before any lookup. All duplicate phone matches and unique-index races SHALL return generic 409 `TENANT_IDENTITY_CONFLICT` without field or tenant details, regardless of the caller's access to any matching tenant. The shared persistent conflict budget SHALL apply, including 429 retry metadata.

#### Scenario: Portal updates to another tenant's phone
- **WHEN** a tenant submits a phone already assigned to another profile
- **THEN** no update occurs and a generic identity conflict is returned

#### Scenario: Portal race after precheck
- **WHEN** a concurrent writer claims the submitted identity before the update
- **THEN** the unique violation is converted to a generic 409

Implementation and production rollout evidence: [tenant identity hardening](../history/2026-11-09-harden-tenant-identity-data/index.md). Production database rollout and SQL verification passed on 2026-11-09; application branch deployment is separate.

### Requirement: Correction requests never mutate canonical identity
Tenant correction requests SHALL use the existing self-scoped request API/private attachments. Tenant canonical image POST/DELETE SHALL return 403 before multipart parsing or Storage/path/audit side effects; own image GET remains available. Submitting evidence or changing a request status SHALL never update canonical tenant values or image slots.

Implementation/evidence: [restricted portal edits](../history/2026-11-10-restrict-tenant-portal-profile-edits/index.md). Cloud functional/visual verification gates are recorded separately from source tests.
