-- Building ownership provenance for owner-scoped access.
-- `created_by` records who created the building; `owner_user_id` records the
-- primary owner used for display/filter defaults. Access control still comes
-- from `user_building_assignments`. Both columns are nullable so existing
-- buildings (admin/manager era) keep working without backfill.

begin;

alter table public.buildings
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists owner_user_id uuid references auth.users(id) on delete set null;

create index if not exists idx_buildings_owner_user_id
  on public.buildings (owner_user_id);

create index if not exists idx_buildings_created_by
  on public.buildings (created_by);

commit;
