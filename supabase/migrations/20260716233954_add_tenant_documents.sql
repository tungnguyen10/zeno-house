-- =============================================================================
-- Migration: Tenant document storage
-- Run in: Supabase Dashboard -> SQL Editor
-- Data impact: creates one private bucket and additive storage policies.
-- Rollback: drop the four tenant_documents policies, then delete the empty
-- tenant-documents bucket if it is no longer needed.
-- =============================================================================

begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'tenant-documents',
  'tenant-documents',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists tenant_documents_admin_all on storage.objects;
create policy tenant_documents_admin_all
  on storage.objects
  for all
  using (
    bucket_id = 'tenant-documents'
    and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  )
  with check (
    bucket_id = 'tenant-documents'
    and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

drop policy if exists tenant_documents_self_select on storage.objects;
create policy tenant_documents_self_select
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'tenant-documents'
    and exists (
      select 1
      from public.tenant_user_links as link
      where link.auth_user_id = (select auth.uid())
        and link.status = 'active'
        and link.tenant_id::text = split_part(storage.objects.name, '/', 1)
    )
  );

drop policy if exists tenant_documents_self_insert on storage.objects;
create policy tenant_documents_self_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'tenant-documents'
    and exists (
      select 1
      from public.tenant_user_links as link
      where link.auth_user_id = (select auth.uid())
        and link.status = 'active'
        and link.tenant_id::text = split_part(storage.objects.name, '/', 1)
    )
  );

drop policy if exists tenant_documents_self_delete on storage.objects;
create policy tenant_documents_self_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'tenant-documents'
    and exists (
      select 1
      from public.tenant_user_links as link
      where link.auth_user_id = (select auth.uid())
        and link.status = 'active'
        and link.tenant_id::text = split_part(storage.objects.name, '/', 1)
    )
  );

grant select, insert, delete on storage.objects to authenticated;

commit;
