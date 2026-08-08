-- =============================================================================
-- Migration: Storage bucket for self-uploaded internal user avatars
-- Run in: Supabase Dashboard -> SQL Editor
-- Data impact: additive (new private bucket + RLS policies only).
-- Rollback: drop policies user_avatars_self_* and delete the bucket row.
-- =============================================================================

begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'user-avatars',
  'user-avatars',
  false,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Objects are stored under `{auth_user_id}/...`; app writes go through the
-- service-role client (RLS bypassed there), these policies are a deny-by-default
-- safety net for any direct client access.
drop policy if exists user_avatars_self_select on storage.objects;
create policy user_avatars_self_select
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'user-avatars'
    and split_part(storage.objects.name, '/', 1) = (select auth.uid())::text
  );

drop policy if exists user_avatars_self_insert on storage.objects;
create policy user_avatars_self_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'user-avatars'
    and split_part(storage.objects.name, '/', 1) = (select auth.uid())::text
  );

drop policy if exists user_avatars_self_delete on storage.objects;
create policy user_avatars_self_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'user-avatars'
    and split_part(storage.objects.name, '/', 1) = (select auth.uid())::text
  );

commit;
