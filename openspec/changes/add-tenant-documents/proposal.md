## Why

Tenants need to view and upload personal documents (ID images, and later receipts/attachments) from the portal. The existing `tenant-id-images` bucket is admin-only and stores objects under a `tenant.id/...` path (the tenant record id, not `auth.uid()`) — see [server/services/tenants/index.ts](../../../server/services/tenants/index.ts). A naive storage policy like `auth.uid() = foldername[1]` would not match those paths and would break tenant access. This change adds a correct, link-based storage policy and a self-scoped document API/UX so tenants can only ever read and write their own files.

## What Changes

- Add tenant-scoped storage access by joining `tenant_user_links` (`auth.uid()` → `tenant_id`) against the object path's tenant-id segment, instead of the incorrect `auth.uid() = foldername[1]` pattern.
- Keep document buckets private (`public = false`); tenant reads use short-lived signed URLs generated server-side.
- Add self-scoped document endpoints under `/api/tenant/documents`:
  - `GET /api/tenant/documents` — list the caller's documents with signed URLs.
  - `POST /api/tenant/documents` — upload with strict mime/size validation.
  - `DELETE /api/tenant/documents/[id]` — remove the caller's own document.
- Add a mobile-friendly upload UX contract (type/size limits, progress, retry, clear errors) to be consumed by the portal UI change.
- Enforce `resolveTenantId` on every handler; never trust client-supplied tenant/object identifiers.

## Capabilities

### New Capabilities
- `tenant-documents`: Defines tenant document storage layout, link-based storage policy, private-bucket + signed-URL access, the self-scoped document API, and upload validation constraints.

## Impact

- `supabase/migrations/**` — link-based storage policies for document buckets; optionally a new `tenant-documents` bucket keyed by `tenant_id`.
- `server/api/tenant/documents/index.get.ts`, `index.post.ts`, `[id].delete.ts` — new routes.
- `server/services/tenant-portal/documents.ts`, `server/repositories/tenant-portal/documents.ts` — self-scoped storage operations and signed URLs.
- `app/utils/validators/tenant-portal.ts` — document upload validation (mime/size).
- Tests for policy matching against real paths, mime/size limits, signed-URL scoping, and cross-tenant access denial.
