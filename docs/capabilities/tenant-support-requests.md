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
`GET /api/tenant/requests` SHALL return only the caller's requests. `POST /api/tenant/requests` SHALL derive the caller's tenant and current primary-or-roommate housing context server-side. Its RLS insert safety net SHALL accept the same current primary or roommate context, enforce active contract dates and occupancy dates, and reject cross-tenant or stale-contract inserts. Optional attachments remain in the private `tenant-documents` bucket under server-built paths.

#### Scenario: List own requests
- **WHEN** a tenant lists requests
- **THEN** only the caller's requests are returned

#### Scenario: Primary tenant creates current-contract request
- **WHEN** a primary tenant creates a request for their current active contract
- **THEN** server validation and direct-access RLS both accept the derived context

#### Scenario: Roommate request preserves personal ownership
- **WHEN** a current roommate creates a support request
- **THEN** the row stores the roommate's tenant id and shared contract/building context

#### Scenario: Stale housing context rejected
- **WHEN** a tenant attempts an insert for a future, expired, terminated, moved-out, or unrelated contract
- **THEN** the database rejects it

#### Scenario: Cross-tenant attachment access denied
- **WHEN** a tenant requests an attachment outside linked tenant scope
- **THEN** access is denied

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

### Requirement: Atomic status handling
Authorized full-access operators with `tenants.update` SHALL use strict status/expected-status input. Legal transitions are new→in_progress, in_progress→resolved and resolved→in_progress. A duplicate delivery already at target is a no-op; stale status returns safe 409. Status and `support_request.status_updated` audit SHALL commit atomically through a service-role-only RPC. Resolved means handled, not automatic approval or identity change.

#### Scenario: Audit failure
- **WHEN** audit persistence fails during a request status transition
- **THEN** the status update rolls back

#### Scenario: Selection during a pending write
- **WHEN** a status write is pending
- **THEN** the queue prevents switching to another request and late results do not overwrite a different/closed selection

Raw authenticated request SELECT SHALL be denied; tenant request reads are API-owned. Direct INSERT safety policies SHALL permit only new requests in current owned primary/roommate housing context, including owned request attachment prefixes. The legacy manager occupancy SELECT policy that creates contracts↔occupants recursion is removed; scoped staff occupancy reads remain server-owned.

Implementation/evidence: [restricted portal edits](../changes/restrict-tenant-portal-profile-edits/index.md).
