## ADDED Requirements

### Requirement: Tenant document buckets stay private
Tenant document buckets SHALL be private (`public = false`). Tenant access to document objects SHALL be provided only through short-lived server-generated signed URLs. The system SHALL never return a public URL for tenant documents.

#### Scenario: No public URL returned
- **WHEN** a tenant lists or uploads a document
- **THEN** the response contains only a short-lived signed URL, never a public URL

#### Scenario: Bucket remains private
- **WHEN** a document bucket is created or updated
- **THEN** its `public` flag is false

---

### Requirement: Link-based storage policy matches tenant-id paths
Tenant document storage policies SHALL grant access by joining `tenant_user_links` (`auth.uid()` → `tenant_id`, `status = 'active'`) against the object path's tenant-id segment (`split_part(name, '/', 1)`). Policies SHALL NOT rely on `auth.uid() = foldername[1]`, because document paths are keyed by the tenant record id, not the auth user id.

#### Scenario: Linked tenant can access own objects
- **WHEN** a tenant whose `tenant_user_links` maps to `T` accesses an object under path `T/...`
- **THEN** the storage policy allows it

#### Scenario: Other tenants denied
- **WHEN** a tenant accesses an object under a path segment not linked to them
- **THEN** the storage policy denies it

#### Scenario: Admin retains access
- **WHEN** an admin accesses tenant documents
- **THEN** the existing admin-all policy allows it

---

### Requirement: Self-scoped tenant document API
The system SHALL expose `GET /api/tenant/documents`, `POST /api/tenant/documents`, and `DELETE /api/tenant/documents/[id]` under the tenant namespace. Every handler SHALL resolve `tenant_id` via `resolveTenantId`, build storage paths from the resolved id only, and validate uploads for mime type and maximum size.

#### Scenario: List own documents
- **WHEN** a tenant calls `GET /api/tenant/documents`
- **THEN** only the caller's documents are returned with signed URLs

#### Scenario: Upload validated
- **WHEN** a tenant uploads a file with an unsupported mime type or above the size limit
- **THEN** the upload is rejected with a clear error

#### Scenario: Delete own document only
- **WHEN** a tenant deletes a document id that belongs to another tenant
- **THEN** the request is denied with a consistent not-found/forbidden response
