## ADDED Requirements

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
`GET /api/tenant/requests` SHALL return only the caller's requests in timeline order. `POST /api/tenant/requests` SHALL create a request for the caller, deriving `tenant_id` via `resolveTenantId` and building/contract context server-side, gated by the existing `tenant.requests.read`/`tenant.requests.write` capabilities. An optional attachment SHALL be stored in the existing private `tenant-documents` bucket using its `tenant_user_links`-scoped policy, with the path built server-side and reads returned as short-lived signed URLs.

#### Scenario: List own requests
- **WHEN** a tenant calls `GET /api/tenant/requests`
- **THEN** only the caller's requests are returned

#### Scenario: Create derives context server-side
- **WHEN** a tenant creates a request
- **THEN** building/contract context is derived server-side and any client-declared context is ignored

#### Scenario: Optional attachment stored in tenant-documents
- **WHEN** a tenant attaches a file to a request
- **THEN** the file is stored in the private `tenant-documents` bucket under the tenant's server-built path and read back via a signed URL

#### Scenario: Cross-tenant attachment access denied
- **WHEN** a tenant references or requests an attachment outside their linked tenant scope
- **THEN** access is denied by the `tenant_user_links`-scoped storage policy

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
