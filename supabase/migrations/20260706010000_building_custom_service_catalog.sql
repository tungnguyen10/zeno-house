begin;

alter table public.service_catalog
  add column if not exists building_id uuid references public.buildings(id) on delete cascade;

create index if not exists service_catalog_building_id_idx
  on public.service_catalog(building_id);

create index if not exists service_catalog_building_sort_idx
  on public.service_catalog(building_id, sort_order, name);

drop policy if exists service_catalog_authenticated_select
  on public.service_catalog;

create policy service_catalog_authenticated_select
  on public.service_catalog
  for select
  to authenticated
  using (
    building_id is null
    or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    or public.owner_has_building_scope(building_id)
  );

commit;
