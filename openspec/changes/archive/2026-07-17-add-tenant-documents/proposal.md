## Why

Tenants need to view and upload personal documents (ID images, and later receipts/attachments) from the portal. The existing `tenant-id-images` direct Storage policy is admin-only, while internal server workflows store objects under a `tenant.id/...` path (the tenant record id, not `auth.uid()`) — see [server/services/tenants/index.ts](../../../server/services/tenants/index.ts). A naive storage policy like `auth.uid() = foldername[1]` would not match those paths and would break tenant access. This change adds a correct, link-based storage policy and self-scoped document APIs so tenants can only ever read and write their own files.

## What Changes

- Add tenant-scoped storage access by joining `tenant_user_links` (`auth.uid()` → `tenant_id`) against the object path's tenant-id segment, instead of the incorrect `auth.uid() = foldername[1]` pattern.
- Keep document buckets private (`public = false`); tenant reads use short-lived signed URLs generated server-side.
- Add self-scoped document endpoints under `/api/tenant/documents`:
  - `GET /api/tenant/documents` — list the caller's documents with signed URLs.
  - `POST /api/tenant/documents` — upload with strict mime/size validation.
  - `DELETE /api/tenant/documents/[id]` — remove the caller's own document.
- Let tenants view, replace, or remove the same front/back identity-image slots used by
  admin/owner workflows. Both actor types persist to `tenant-id-images` under
  `${tenant.id}/${side}/...` and update the existing `id_card_front_path` /
  `id_card_back_path` columns.
- Add a mobile-friendly upload UX contract (type/size limits, progress, retry, clear errors) to be consumed by a later portal UI change; this change implements the server contract, not the portal screen.
- Enforce `resolveTenantId` on every handler; never trust client-supplied tenant/object identifiers.

## Capabilities

### New Capabilities
- `tenant-documents`: Defines tenant document storage layout, link-based storage policy, private-bucket + signed-URL access, the self-scoped document API, and upload validation constraints.

## Impact

- `supabase/migrations/20260716233954_add_tenant_documents.sql` — private free-form document bucket and link-based tenant policies.
- `supabase/migrations/20260717001405_tenant_self_identity_images.sql` — forward-only tenant self-access policies for the shared identity bucket.
- `server/api/tenant/documents/index.get.ts`, `index.post.ts`, `[id].delete.ts` — new routes.
- `server/api/tenant/id-images/index.get.ts`, `[side].post.ts`, `[side].delete.ts` — self-scoped
  identity-image routes sharing the existing admin-managed storage slots.
- `server/services/tenant-portal/documents.ts`, `server/repositories/tenant-portal/documents.ts` — self-scoped free-form document operations and signed URLs.
- `server/services/tenant-portal/identity-images.ts`, `server/repositories/tenant-portal/identity-images.ts` — shared-slot identity reads, replacement, removal, and signed URLs.
- `app/utils/validators/tenant-portal.ts`, `app/types/tenant-portal.ts` — upload validation and tenant-facing document/identity DTOs.
- Tests for policy matching against real paths, mime/size limits, signed-URL scoping, and cross-tenant access denial.
