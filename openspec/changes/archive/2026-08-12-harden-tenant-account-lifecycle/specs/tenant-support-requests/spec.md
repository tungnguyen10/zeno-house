## MODIFIED Requirements

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
