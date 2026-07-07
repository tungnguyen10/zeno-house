begin;

alter table public.operations_report_periods
  add column if not exists close_source text;

alter table public.operations_report_periods
  add column if not exists closed_at timestamptz,
  add column if not exists closed_by uuid references auth.users(id),
  add column if not exists reopened_at timestamptz,
  add column if not exists reopened_by uuid references auth.users(id),
  add column if not exists reopen_reason text,
  add column if not exists status text not null default 'open',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'operations_report_periods'
      and column_name = 'auto_closed'
  ) then
    update public.operations_report_periods
    set close_source = case
      when status = 'closed' and auto_closed then 'auto'
      when status = 'closed' then 'manual'
      else null
    end
    where close_source is null;
  else
    update public.operations_report_periods
    set close_source = case
      when status = 'closed' then 'manual'
      else null
    end
    where close_source is null;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.operations_report_periods'::regclass
      and conname = 'operations_report_periods_building_period_unique'
  ) then
    alter table public.operations_report_periods
      add constraint operations_report_periods_building_period_unique
      unique (building_id, period_year, period_month);
  end if;
end $$;

alter table public.operations_report_periods
  drop constraint if exists operations_report_periods_status_check,
  add constraint operations_report_periods_status_check
    check (status in ('open', 'closed')) not valid;

alter table public.operations_report_periods
  drop constraint if exists operations_report_periods_close_source_check,
  add constraint operations_report_periods_close_source_check
    check (close_source in ('manual', 'auto')) not valid;

alter table public.operations_report_periods
  drop constraint if exists operations_report_periods_closed_shape,
  add constraint operations_report_periods_closed_shape check (
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
  ) not valid;

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

notify pgrst, 'reload schema';

commit;
