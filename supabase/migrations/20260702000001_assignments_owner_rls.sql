-- Extend RLS for the owner role.
-- Admin keeps full access. Owner may read its own assignment rows and the
-- buildings/service summaries reachable through those assignments. Mutations
-- still go through server APIs after service-layer authorization.

begin;

drop policy if exists user_building_assignments_owner_select_own
  on public.user_building_assignments;
create policy user_building_assignments_owner_select_own
  on public.user_building_assignments
  for select
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'owner'
    and user_id = (select auth.uid())
  );

drop policy if exists buildings_owner_select_assigned
  on public.buildings;
create policy buildings_owner_select_assigned
  on public.buildings
  for select
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'owner'
    and exists (
      select 1
      from public.user_building_assignments assignment
      where assignment.user_id = (select auth.uid())
        and assignment.building_id = buildings.id
    )
  );

drop policy if exists building_services_owner_select_assigned
  on public.building_services;
create policy building_services_owner_select_assigned
  on public.building_services
  for select
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'owner'
    and exists (
      select 1
      from public.user_building_assignments assignment
      where assignment.user_id = (select auth.uid())
        and assignment.building_id = building_services.building_id
    )
  );

commit;
