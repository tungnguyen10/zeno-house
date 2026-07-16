## Purpose

Defines private tenant document storage, tenant-linked Storage policies, self-scoped document
APIs, and the shared front/back identity-image slots used by internal and Tenant Portal actors.

## Requirements

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

---

### Requirement: Identity-image slots are shared across actors
Admin, owner, and tenant updates to a tenant's front/back identity images SHALL use the same
`tenant-id-images` bucket, `${tenant.id}/${side}/...` path convention, and existing
`id_card_front_path` / `id_card_back_path` columns. The system SHALL NOT create separate identity
copies based on which actor uploaded the image. Tenant Portal SHALL expose self-scoped read,
upload, and delete endpoints for these slots; it SHALL resolve the tenant from the authenticated
user, accept only `front|back`, and accept only JPEG, PNG, or WebP images up to 5 MB.

#### Scenario: Tenant fills an empty identity slot
- **WHEN** admin or owner has not uploaded one side and the linked tenant uploads it
- **THEN** the corresponding existing tenant identity path column points to the tenant upload

#### Scenario: Tenant replaces an admin-uploaded image
- **WHEN** the linked tenant replaces an existing front or back image
- **THEN** the same slot points to the replacement and the superseded object is removed

#### Scenario: Cross-tenant identity mutation is denied
- **WHEN** a tenant attempts to read, replace, or remove another tenant's identity image
- **THEN** the operation is denied without revealing whether that image exists

#### Scenario: Identity image access stays private
- **WHEN** a tenant reads an identity image
- **THEN** the system returns a five-minute signed URL and never a public URL

#### Scenario: Invalid identity upload is rejected
- **WHEN** a tenant submits an unsupported side, MIME type, or image larger than 5 MB
- **THEN** the request is rejected before any identity slot or Storage object is mutated
