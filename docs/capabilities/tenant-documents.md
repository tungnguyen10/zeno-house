---
type: Capability Specification
title: "tenant-documents"
status: stable
tags: [capability, requirements]
sources:
  - resource: "https://github.com/tungnguyen10/zeno-house/blob/ae95811bbdc1932368b4e6b9ed3e9540399d26e6/openspec/specs/tenant-documents/spec.md"
generated:
  by: "process:okf-migration"
  at: "2026-11-06T00:00:00Z"
---

## Purpose

Defines private tenant document storage, tenant-linked Storage policies, self-scoped document
APIs, and the shared front/back identity-image slots used by internal and Tenant Portal actors.

## Requirements

### Requirement: Tenant document lifecycle audit is safe
The system SHALL append `tenant_document.uploaded` and `tenant_document.removed` events after successful storage mutations.

#### Scenario: Document payload privacy
- **WHEN** a tenant uploads or removes a document
- **THEN** audit data contains document name, MIME type, size, and stable object ID
- **AND** it does not contain file bytes, signed URLs, or storage paths

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

### Requirement: Canonical identity images are operator-managed
Authorized internal operators SHALL use the existing private `tenant-id-images` bucket and tenant front/back path columns after full-access/capability checks. Tenant Portal SHALL expose self-scoped read-only previews. Its POST/DELETE endpoints and direct Storage INSERT/UPDATE/upsert/DELETE SHALL not modify canonical identity objects. Generic personal documents remain separate and tenant-uploadable through their existing APIs.

#### Scenario: Tenant attempts canonical replacement
- **WHEN** a tenant calls an old image mutation endpoint or writes the canonical Storage bucket directly
- **THEN** the mutation is denied and existing objects/path columns remain unchanged

#### Scenario: Proposed correction evidence
- **WHEN** the tenant submits an image/PDF with a support request
- **THEN** it remains under the private tenant/request evidence path and does not overwrite a canonical slot

#### Scenario: Existing own preview
- **WHEN** the tenant reads their canonical image
- **THEN** the API returns only a short-lived signed URL within own scope

#### Scenario: Staff updates a canonical image
- **WHEN** an authorized full-access operator verifies and updates an image through internal tenant controls
- **THEN** the existing canonical mutation/audit path remains available

Implementation/evidence: [restricted portal edits](../changes/restrict-tenant-portal-profile-edits/index.md).
