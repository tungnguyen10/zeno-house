-- =============================================================================
-- Migration: Tenant self-service for shared identity-image slots
-- Run in: Supabase Dashboard -> SQL Editor
-- Data impact: additive Storage policies only; existing objects and tenant path
-- columns remain unchanged. tenant_id_images_admin_all remains in place.
-- Rollback: drop the three tenant_id_images_self_* policies.
-- =============================================================================

begin;

update storage.buckets
set
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'tenant-id-images';

drop policy if exists tenant_id_images_self_select on storage.objects;
create policy tenant_id_images_self_select
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'tenant-id-images'
    and (auth.jwt() -> 'app_metadata' ->> 'role') = 'tenant'
    and split_part(storage.objects.name, '/', 2) in ('front', 'back')
    and exists (
      select 1
      from public.tenant_user_links as link
      where link.auth_user_id = (select auth.uid())
        and link.status = 'active'
        and link.tenant_id::text = split_part(storage.objects.name, '/', 1)
    )
  );

drop policy if exists tenant_id_images_self_insert on storage.objects;
create policy tenant_id_images_self_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'tenant-id-images'
    and (auth.jwt() -> 'app_metadata' ->> 'role') = 'tenant'
    and split_part(storage.objects.name, '/', 2) in ('front', 'back')
    and exists (
      select 1
      from public.tenant_user_links as link
      where link.auth_user_id = (select auth.uid())
        and link.status = 'active'
        and link.tenant_id::text = split_part(storage.objects.name, '/', 1)
    )
  );

drop policy if exists tenant_id_images_self_delete on storage.objects;
create policy tenant_id_images_self_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'tenant-id-images'
    and (auth.jwt() -> 'app_metadata' ->> 'role') = 'tenant'
    and split_part(storage.objects.name, '/', 2) in ('front', 'back')
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
