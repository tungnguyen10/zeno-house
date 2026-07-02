-- Allow owners to create buildings and immediately self-assign scope.
-- This supports the owner workflow in BuildingService.create where:
-- 1) a building row is inserted with owner provenance, then
-- 2) a user_building_assignments row is created for the same owner.

begin;

drop policy if exists buildings_owner_insert_own
  on public.buildings;
create policy buildings_owner_insert_own
  on public.buildings
  for insert
  with check (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'owner'
    and owner_user_id = (select auth.uid())
    and created_by = (select auth.uid())
  );

drop policy if exists user_building_assignments_owner_insert_self
  on public.user_building_assignments;
create policy user_building_assignments_owner_insert_self
  on public.user_building_assignments
  for insert
  with check (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'owner'
    and user_id = (select auth.uid())
    and exists (
      select 1
      from public.buildings building
      where building.id = user_building_assignments.building_id
        and building.owner_user_id = (select auth.uid())
    )
  );

commit;
