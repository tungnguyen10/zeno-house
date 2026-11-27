---
type: Capability Specification
title: "tenant-support-requests"
status: stable
tags: [capability, requirements]
sources:
  - resource: "https://github.com/tungnguyen10/zeno-house/blob/ae95811bbdc1932368b4e6b9ed3e9540399d26e6/openspec/specs/tenant-support-requests/spec.md"
generated:
  by: "process:okf-migration"
  at: "2026-11-06T00:00:00Z"
---

# Tenant Support Requests

## Purpose

Define the tenant-authored support request model, tenant self-service API, attachment security, and building-scoped operator visibility foundation.

Pagination, public replies and closed direct-write access are reconciled with locally tested source. Their migrations, cloud type generation and deployed verification remain tracked in the [active portal change](../changes/tenant-portal-production/index.md).

## Requirements

### Requirement: Support request audit excludes signed attachment access
The system SHALL audit support request creation with server-derived building scope and safe IDs, scope, status, creation time and attachment-presence fields only; title, description, filenames, paths, URLs and bytes SHALL NOT be copied into audit.

#### Scenario: Attached request audit privacy
- **WHEN** a support request includes an attachment
- **THEN** its audit snapshot contains `has_attachment = true`
- **AND** it does not contain a signed URL, storage path, token, or binary content

### Requirement: Support request data model with minimal status
The system SHALL persist tenant-authored support requests in a `support_requests` table with a minimal status lifecycle (`new`, `in_progress`, `resolved`), server-derived `tenant_id`/`building_id`/`contract_id` context, an optional attachment reference, and timestamps. RLS SHALL be enabled.

#### Scenario: Request created with new status
- **WHEN** a tenant creates a support request
- **THEN** it is stored with status `new` and server-derived building/contract context

#### Scenario: Status limited to minimal set
- **WHEN** a support request status is set
- **THEN** it is one of `new`, `in_progress`, `resolved`

---

### Requirement: Tenant self-scoped support request API
`GET /api/tenant/requests` SHALL return only the caller's requests, ordered by creation time and ID descending, with exact `total`, `page`, `limit`, and `totalPages` metadata. It SHALL accept strict `page` and `limit` parameters (default 20, maximum 50). `GET /api/tenant/requests/[id]` SHALL return the caller's complete request or a consistent not-found response. `POST /api/tenant/requests` SHALL derive the caller's tenant and current primary-or-roommate housing context server-side, enforce current contract/occupancy eligibility, and reject unrelated or stale context. Optional attachments remain in the private `tenant-documents` bucket under server-built paths. Tenant reads retain personal request history without requiring current housing; creating a new request requires active housing.

#### Scenario: List own requests
- **WHEN** a tenant lists requests
- **THEN** only the caller's requests are returned

#### Scenario: Primary tenant creates current-contract request
- **WHEN** a primary tenant creates a request for their current active contract
- **THEN** the server validates and writes the derived context through its service-role repository

#### Scenario: Roommate request preserves personal ownership
- **WHEN** a current roommate creates a support request
- **THEN** the row stores the roommate's tenant id and shared contract/building context

#### Scenario: Stale housing context rejected
- **WHEN** a tenant attempts to create a request without current eligible housing
- **THEN** the API rejects it and the portal provides contact-management guidance

#### Scenario: Older requests and full detail remain reachable
- **WHEN** the caller has more requests than one page can hold
- **THEN** the portal appends later pages and opens full descriptions, public replies and current attachment access through the detail endpoint

#### Scenario: Another tenant's request ID is supplied
- **WHEN** a tenant requests an ID outside their personal timeline
- **THEN** the endpoint returns the same not-found response as for an unknown ID and does not sign its attachment

#### Scenario: Cross-tenant attachment access denied
- **WHEN** a tenant requests an attachment outside linked tenant scope
- **THEN** access is denied

#### Scenario: Attachment signing is unavailable
- **WHEN** an owned request's attachment is missing, invalid or cannot be signed
- **THEN** the request remains readable with `attachmentSignedUrl = null` and `attachmentUnavailable = true`
- **AND** refreshing detail can obtain a new short-lived URL without resubmitting the request

### Requirement: Safe tenant submission and payment-check intent
The portal SHALL validate title/description and a single optional JPEG, PNG, WebP or PDF attachment up to 5 MB before sending, show upload progress, preserve drafts after failure, and guard unsaved navigation. Non-idempotent request POSTs SHALL NOT retry automatically. Identity changes SHALL abort submission and discard late responses and progress belonging to the prior account. Draft text and attachment URLs SHALL NOT be persisted in browser storage.

The `payment-report` intent MAY prefill a neutral reconciliation request using a length/format-validated invoice code. That code SHALL be treated as untrusted display text, not relational invoice authorization. Submitting evidence or receiving a reply SHALL NOT record payment, mark an invoice paid, or change its balance.

#### Scenario: Tenant supplies transfer evidence
- **WHEN** a tenant opens a payment-check request from an invoice
- **THEN** the portal asks for transfer details or evidence and explains that the balance changes only after management confirms it through the billing workflow

---

### Requirement: Building-scoped operator visibility hook
The system SHALL provide a building-scoped read hook so operators can view support requests only for buildings in their scope. Owner/manager visibility SHALL filter by `getAssignedBuildingIds`; admin is unscoped. Lifecycle changes SHALL emit audit events with building context.

#### Scenario: Operator sees only assigned building requests
- **WHEN** an owner or manager reads support requests via the internal hook
- **THEN** only requests for their assigned buildings are returned

#### Scenario: Admin unscoped visibility
- **WHEN** an admin reads support requests via the internal hook
- **THEN** requests across all buildings are visible

#### Scenario: Audit on create
- **WHEN** a support request is created
- **THEN** an audit event is appended with the building context

### Requirement: Private scoped staff receiving surface
`GET /api/tenant-support-requests` SHALL page/count only requests in server-derived visible buildings whose tenant has full access. Private text and signed evidence SHALL be loaded only after this authorization. Basic/none contexts SHALL not expose a request's text or attachment; tenants cannot call the operator API. `/dashboard/tenant-support-requests` SHALL present the receiving list/detail using existing primitives, with no automatic profile application.

#### Scenario: Mixed-scope page
- **WHEN** the candidate set contains full, basic and foreign tenants
- **THEN** only full-authorized requests affect visible rows, total and attachment signing

### Requirement: Atomic status handling and public replies
Authorized full-access operators with `tenants.update` SHALL use strict `status`, `expected_status`, and `expected_updated_at` input, with an optional trimmed `public_response` of 1–4,000 characters. Legal transitions are new→in_progress, in_progress→resolved and resolved→in_progress; a reply MAY also be updated without changing an in-progress/resolved status. Omitting the response SHALL preserve the existing text. Every changed write SHALL compare both status and the exact version shown to the operator; stale status or timestamp returns safe 409. An identical replay already at the target status and response is a no-op with no duplicate audit event or timestamp change.

Status, response text, `responded_at`, a monotonic `updated_at`, and the `support_request.status_updated` audit SHALL commit atomically through a service-role-only RPC. Audit snapshots SHALL contain status/response-presence metadata, not the public response text. Tenant list/detail DTOs SHALL expose the latest `publicResponse` and `respondedAt`; this is one current reply, not a threaded chat. Resolved means handled, not automatic approval, payment recording or identity change.

#### Scenario: Audit failure
- **WHEN** audit persistence fails during a request status transition
- **THEN** the status update rolls back

#### Scenario: Two operators edit the same reply
- **WHEN** another operator has changed the request after the displayed `updatedAt`
- **THEN** a conflicting reply returns 409 and cannot overwrite the newer response

#### Scenario: Tenant sees management's answer
- **WHEN** an authorized operator saves a public reply
- **THEN** the tenant's refreshed detail shows the reply and response time without exposing internal audit data

#### Scenario: Selection during a pending write
- **WHEN** a status write is pending
- **THEN** the queue prevents switching to another request and late results do not overwrite a different/closed selection

Raw authenticated request SELECT SHALL remain denied; tenant request reads and writes are API-owned. Browser-role INSERT/UPDATE/DELETE and legacy column write grants SHALL be revoked. Retained RLS policies are defense in depth, including a restrictive insert check that prevents tenant-authored public replies if write grants are ever deliberately restored. The legacy manager occupancy SELECT policy that creates contracts↔occupants recursion remains removed; scoped staff occupancy reads remain server-owned.

Implementation/evidence: [restricted portal edits](../history/2026-11-10-restrict-tenant-portal-profile-edits/index.md).

New rollout prerequisites: `20261127090000_tenant_portal_private_reads.sql` and `20261127091000_tenant_support_public_response.sql`, followed by read-only privilege verification, rollback-only support lifecycle verification, and cloud-generated types. The response migration adds the six-argument RPC overload before application deployment and retains the old service-role-only status signature during rollout. Remove the legacy signature only after all instances use the new overload; see the [active change record](../changes/tenant-portal-production/index.md).
