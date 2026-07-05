begin;

create table if not exists public.recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  category text not null check (category in (
    'electricity_input',
    'water_input',
    'internet',
    'cleaning',
    'repair',
    'admin_fee',
    'supplies',
    'staff',
    'rent_adjustment',
    'insurance',
    'bank_fee',
    'fire_safety',
    'other'
  )),
  frequency text not null check (frequency in ('monthly', 'quarterly', 'biannual', 'yearly')),
  anchor_day integer not null check (anchor_day between 1 and 28),
  estimated_amount numeric(12,0) not null check (estimated_amount >= 0),
  is_active boolean not null default true,
  next_reminder_at date not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_recurring_expenses_building_active
  on public.recurring_expenses (building_id, is_active, next_reminder_at);

create index if not exists idx_recurring_expenses_upcoming
  on public.recurring_expenses (next_reminder_at, building_id)
  where is_active = true;

drop trigger if exists recurring_expenses_set_updated_at on public.recurring_expenses;
create trigger recurring_expenses_set_updated_at
  before update on public.recurring_expenses
  for each row execute function public.set_updated_at();

alter table public.recurring_expenses enable row level security;

drop policy if exists recurring_expenses_admin_all on public.recurring_expenses;
create policy recurring_expenses_admin_all
  on public.recurring_expenses
  for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists recurring_expenses_owner_all_assigned on public.recurring_expenses;
create policy recurring_expenses_owner_all_assigned
  on public.recurring_expenses
  for all to authenticated
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'owner'
    and exists (
      select 1
      from public.user_building_assignments assignment
      where assignment.user_id = (select auth.uid())
        and assignment.building_id = recurring_expenses.building_id
    )
  )
  with check (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'owner'
    and exists (
      select 1
      from public.user_building_assignments assignment
      where assignment.user_id = (select auth.uid())
        and assignment.building_id = recurring_expenses.building_id
    )
  );

drop policy if exists recurring_expenses_manager_select_assigned on public.recurring_expenses;
create policy recurring_expenses_manager_select_assigned
  on public.recurring_expenses
  for select to authenticated
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'manager'
    and exists (
      select 1
      from public.user_building_assignments assignment
      where assignment.user_id = (select auth.uid())
        and assignment.building_id = recurring_expenses.building_id
    )
  );

create table if not exists public.prepaid_expenses (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  category text not null check (category in (
    'electricity_input',
    'water_input',
    'internet',
    'cleaning',
    'repair',
    'admin_fee',
    'supplies',
    'staff',
    'rent_adjustment',
    'insurance',
    'bank_fee',
    'fire_safety',
    'other'
  )),
  total_amount numeric(12,0) not null check (total_amount >= 0),
  total_months integer not null check (total_months >= 1),
  start_date date not null,
  end_date date not null,
  monthly_amount numeric(12,0) not null check (monthly_amount >= 0),
  status text not null default 'active' check (status in ('active', 'expired', 'cancelled')),
  receipt_url text,
  note text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint prepaid_expenses_date_order check (end_date > start_date)
);

create index if not exists idx_prepaid_expenses_building_status
  on public.prepaid_expenses (building_id, status, start_date, end_date);

create index if not exists idx_prepaid_expenses_active_window
  on public.prepaid_expenses (building_id, start_date, end_date)
  where status = 'active';

drop trigger if exists prepaid_expenses_set_updated_at on public.prepaid_expenses;
create trigger prepaid_expenses_set_updated_at
  before update on public.prepaid_expenses
  for each row execute function public.set_updated_at();

alter table public.prepaid_expenses enable row level security;

drop policy if exists prepaid_expenses_admin_all on public.prepaid_expenses;
create policy prepaid_expenses_admin_all
  on public.prepaid_expenses
  for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists prepaid_expenses_owner_all_assigned on public.prepaid_expenses;
create policy prepaid_expenses_owner_all_assigned
  on public.prepaid_expenses
  for all to authenticated
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'owner'
    and exists (
      select 1
      from public.user_building_assignments assignment
      where assignment.user_id = (select auth.uid())
        and assignment.building_id = prepaid_expenses.building_id
    )
  )
  with check (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'owner'
    and exists (
      select 1
      from public.user_building_assignments assignment
      where assignment.user_id = (select auth.uid())
        and assignment.building_id = prepaid_expenses.building_id
    )
  );

grant select, insert, update, delete on public.recurring_expenses to authenticated;
grant select, insert, update, delete on public.prepaid_expenses to authenticated;

commit;
