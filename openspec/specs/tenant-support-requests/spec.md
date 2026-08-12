# Tenant Support Requests

## Purpose

Define the tenant-authored support request model, tenant self-service API, attachment security, and building-scoped operator visibility foundation.

## Requirements

### Requirement: Support request audit excludes signed attachment access
The system SHALL audit support request creation with server-derived building scope and safe request fields.

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
