-- Manager-to-building scope assignments.
-- Backfills all existing managers to all existing buildings so the deploy keeps
-- current manager visibility until admins narrow assignments in the UI.

begin;

create table if not exists public.user_building_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  building_id uuid not null references public.buildings(id) on delete cascade,
  can_delete_master_data boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_building_assignments_user_building_uq unique (user_id, building_id)
);

create index if not exists idx_user_building_assignments_user_id
  on public.user_building_assignments (user_id);

create index if not exists idx_user_building_assignments_building_id
  on public.user_building_assignments (building_id);

drop trigger if exists user_building_assignments_set_updated_at on public.user_building_assignments;
create trigger user_building_assignments_set_updated_at
  before update on public.user_building_assignments
  for each row execute function public.set_updated_at();

alter table public.user_building_assignments enable row level security;

drop policy if exists user_building_assignments_admin_all
  on public.user_building_assignments;
create policy user_building_assignments_admin_all
  on public.user_building_assignments
  for all
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists user_building_assignments_manager_select_own
  on public.user_building_assignments;
create policy user_building_assignments_manager_select_own
  on public.user_building_assignments
  for select
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'manager'
    and user_id = (select auth.uid())
  );

grant select, insert, update, delete on public.user_building_assignments to authenticated;

insert into public.user_building_assignments (
  user_id,
  building_id,
  can_delete_master_data,
  created_by
)
select
  manager_user.id,
  building.id,
  false,
  (
    select admin_user.id
    from auth.users admin_user
    where admin_user.raw_app_meta_data ->> 'role' = 'admin'
    order by admin_user.created_at asc
    limit 1
  )
from auth.users manager_user
cross join public.buildings building
where manager_user.raw_app_meta_data ->> 'role' = 'manager'
on conflict (user_id, building_id) do nothing;

commit;
