## Context

The repo already uses private Supabase Storage buckets with server-generated signed URLs: `tenant-id-images` ([supabase/migrations/20260708020000_tenant_id_images.sql](../../../supabase/migrations/20260708020000_tenant_id_images.sql)) and `expense-receipts`. The tenant-id-images object path is `${tenant.id}/${side}/${uuid}.${ext}` and its policy is admin-only. The `expense-receipts` policy demonstrates the correct pattern of joining a scope table against a path segment via `split_part(storage.objects.name, '/', 1)`.

`add-tenant-identity-foundation` provides `tenant_user_links` and `resolveTenantId`. This change reuses the path-segment + join pattern, but joins `tenant_user_links` so a tenant can access only their own objects.

## Goals / Non-Goals

**Goals:**
- Correct, link-based storage policy that matches the existing `tenant.id`-keyed paths.
- Keep buckets private; expose files only via short-lived signed URLs.
- Self-scoped list/upload/delete document API.
- Strict mime/size validation and a mobile-friendly UX contract.

**Non-Goals:**
- Making any bucket public.
- Internal (admin/owner/manager) document workflows — unchanged.
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

Insert/delete policies use the same predicate with `with check`. Admin retains full access via the existing admin policy.

### D2 — Private buckets + signed URLs only

Buckets stay `public = false`. The API returns short-lived signed URLs (same 5-minute pattern as `signedTenantIdImageUrl`). No public URL is ever returned.

### D3 — Self-scoped API

`GET/POST /api/tenant/documents` and `DELETE /api/tenant/documents/[id]` resolve `tenant_id` via `resolveTenantId`, and all storage paths are built from the resolved id — never from client input. Upload validates mime (`image/jpeg|png|webp`, plus `application/pdf` if needed) and max size (default 5MB), matching existing limits.

### D4 — Bucket choice

Reuse `tenant-id-images` for ID documents and, if additional document types are needed, add a dedicated `tenant-documents` bucket keyed by `tenant_id`. Both use the link-based policy. Decision recorded here so the migration is explicit.

### D5 — Mobile upload UX contract

The UX (implemented in the portal UI change) must show progress, allow retry on flaky mobile networks, and surface clear type/size errors before upload. This change defines the server contract those UX behaviors rely on.
