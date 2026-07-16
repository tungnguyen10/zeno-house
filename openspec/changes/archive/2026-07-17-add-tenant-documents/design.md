## Context

The repo already uses private Supabase Storage buckets with server-generated signed URLs: `tenant-id-images` ([supabase/migrations/20260708020000_tenant_id_images.sql](../../../supabase/migrations/20260708020000_tenant_id_images.sql)) and `expense-receipts`. The tenant-id-images object path is `${tenant.id}/${side}/${uuid}.${ext}` and its policy is admin-only. The `expense-receipts` policy demonstrates the correct pattern of joining a scope table against a path segment via `split_part(storage.objects.name, '/', 1)`.

`add-tenant-identity-foundation` provides `tenant_user_links` and `resolveTenantId`. This change reuses the path-segment + join pattern, but joins `tenant_user_links` so a tenant can access only their own objects.

## Goals / Non-Goals

**Goals:**
- Correct, link-based storage policy that matches the existing `tenant.id`-keyed paths.
- Keep buckets private; expose files only via short-lived signed URLs.
- Self-scoped list/upload/delete document API.
- Self-scoped front/back identity API that reads and updates the same slots as internal actors.
- Separate storage by document type: identity images in `tenant-id-images`, free-form files in
  `tenant-documents`.
- Strict mime/size validation and a mobile-friendly UX contract.

**Non-Goals:**
- Making any bucket public.
- Internal (admin/owner/manager) document workflows — unchanged.
- Portal page/component implementation; this change provides the API contract for that UI.
- Support-request attachments (handled in the support-requests change, reusing this pattern).

## Decisions

### D1 — Link-based storage policy (not `auth.uid() = foldername[1]`)

The existing paths key on `tenant.id`, not `auth.uid()`. The tenant read policy therefore matches when the object's first path segment equals a `tenant_id` linked to the caller:

```sql
create policy tenant_documents_self_select
  on storage.objects for select
  using (
    bucket_id = '<tenant-doc-bucket>'
    and exists (
      select 1 from public.tenant_user_links l
      where l.auth_user_id = auth.uid()
        and l.status = 'active'
        and l.tenant_id::text = split_part(storage.objects.name, '/', 1)
    )
  );
```

Insert uses the same predicate in `with check`; select and delete use it in `using`. Admin retains
full access via the existing admin policy.

### D2 — Private buckets + signed URLs only

Buckets stay `public = false`. The API returns short-lived signed URLs (same 5-minute pattern as `signedTenantIdImageUrl`). No public URL is ever returned.

### D3 — Self-scoped API

`GET/POST /api/tenant/documents` and `DELETE /api/tenant/documents/[id]` resolve `tenant_id` via `resolveTenantId`, and all storage paths are built from the resolved id — never from client input. Upload validates mime (`image/jpeg|png|webp`, plus `application/pdf` if needed) and max size (default 5MB), matching existing limits.

### D4 — Bucket choice

Use buckets by document type, not by uploader:

- `tenant-id-images` remains the canonical store for the two identity slots. Admin, owner, and
  tenant workflows all use `${tenant.id}/${side}/${uuid}.${ext}` and update the same tenant row
  columns. Tenant access is self-scoped through `tenant_user_links`; tenants may read, insert,
  replace, and delete only their linked tenant's identity paths.
- `tenant-documents` stores free-form tenant uploads such as PDFs and later attachments.

This keeps the existing identity paths stable while avoiding duplicate copies based on actor.
Because the first tenant-documents migration has already been applied, identity self-access is
added through a forward migration rather than rewriting migration history.

### D5 — Tenant identity-image API

`GET /api/tenant/id-images`, `POST /api/tenant/id-images/[side]`, and
`DELETE /api/tenant/id-images/[side]` resolve the caller's tenant id server-side. `side` is limited
to `front|back`; the server builds the path, validates image MIME/size, updates the existing path
column, removes a superseded object, appends the tenant audit event, and returns only five-minute
signed URLs.

### D6 — Mobile upload UX contract

The UX (implemented in the portal UI change) must show progress, allow retry on flaky mobile networks, and surface clear type/size errors before upload. This change defines the server contract those UX behaviors rely on.
