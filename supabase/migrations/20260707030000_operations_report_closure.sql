begin;

create table if not exists public.operations_report_periods (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id) on delete cascade,
  period_year integer not null check (period_year between 2000 and 2100),
  period_month integer not null check (period_month between 1 and 12),
  status text not null default 'open' check (status in ('open', 'closed')),
  close_source text check (close_source in ('manual', 'auto')),
  closed_at timestamptz,
  closed_by uuid references auth.users(id),
  reopened_at timestamptz,
  reopened_by uuid references auth.users(id),
  reopen_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint operations_report_periods_building_period_unique
    unique (building_id, period_year, period_month),
  constraint operations_report_periods_closed_shape check (
    (
      status = 'open'
      and close_source is null
      and closed_at is null
      and closed_by is null
    )
    or (
      status = 'closed'
      and close_source is not null
      and closed_at is not null
    )
  )
);

create index if not exists idx_operations_report_periods_status_period
  on public.operations_report_periods (status, period_year, period_month);

drop trigger if exists operations_report_periods_set_updated_at
  on public.operations_report_periods;
create trigger operations_report_periods_set_updated_at
  before update on public.operations_report_periods
  for each row execute function public.set_updated_at();

alter table public.operations_report_periods enable row level security;

drop policy if exists operations_report_periods_admin_all on public.operations_report_periods;
create policy operations_report_periods_admin_all
  on public.operations_report_periods
  for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists operations_report_periods_owner_manager_select on public.operations_report_periods;
create policy operations_report_periods_owner_manager_select
  on public.operations_report_periods
  for select to authenticated
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') in ('owner', 'manager')
    and exists (
      select 1
      from public.user_building_assignments assignment
      where assignment.user_id = (select auth.uid())
        and assignment.building_id = operations_report_periods.building_id
    )
  );

grant select, insert, update, delete on public.operations_report_periods to authenticated;

commit;
