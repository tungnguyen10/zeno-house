begin;

alter table public.tenants
  add column if not exists id_card_front_path text,
  add column if not exists id_card_back_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'tenant-id-images',
  'tenant-id-images',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists tenant_id_images_admin_all on storage.objects;
create policy tenant_id_images_admin_all
  on storage.objects
  for all
  using (
    bucket_id = 'tenant-id-images'
    and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  )
  with check (
    bucket_id = 'tenant-id-images'
    and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

grant select, insert, update, delete on storage.objects to authenticated;

commit;
