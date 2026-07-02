-- Follow-up fix for owner create-building flow.
-- The prior owner self-assignment policy checked building ownership via a
-- direct subquery on public.buildings, which can be blocked by buildings RLS
-- before the first assignment exists.

begin;

create or replace function public.owner_has_building_scope(p_building_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    exists (
      select 1
      from public.user_building_assignments assignment
      where assignment.user_id = (select auth.uid())
        and assignment.building_id = p_building_id
    )
    or exists (
      select 1
      from public.buildings building
      where building.id = p_building_id
        and building.owner_user_id = (select auth.uid())
    );
$$;

revoke all on function public.owner_has_building_scope(uuid) from public;
grant execute on function public.owner_has_building_scope(uuid) to authenticated;

drop policy if exists user_building_assignments_owner_insert_self
  on public.user_building_assignments;
create policy user_building_assignments_owner_insert_self
  on public.user_building_assignments
  for insert
  with check (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'owner'
    and user_id = (select auth.uid())
    and public.owner_has_building_scope(building_id)
  );

commit;
