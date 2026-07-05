begin;

alter table public.building_expenses
  add column if not exists funded_by text not null default 'direct'
    check (funded_by in ('direct', 'reserve_fund'));

create index if not exists idx_building_expenses_funded_by
  on public.building_expenses (building_id, funded_by)
  where voided_at is null;

create table if not exists public.shared_expenses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
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
  amount numeric(12,0) not null check (amount >= 0),
  note text,
  is_active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_shared_expenses_owner_active
  on public.shared_expenses (owner_id, is_active, created_at desc);

drop trigger if exists shared_expenses_set_updated_at on public.shared_expenses;
create trigger shared_expenses_set_updated_at
  before update on public.shared_expenses
  for each row execute function public.set_updated_at();

create table if not exists public.shared_expense_buildings (
  id uuid primary key default gen_random_uuid(),
  shared_expense_id uuid not null references public.shared_expenses(id) on delete cascade,
  building_id uuid not null references public.buildings(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (shared_expense_id, building_id)
);

create index if not exists idx_shared_expense_buildings_building
  on public.shared_expense_buildings (building_id);

create table if not exists public.reserve_funds (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id) on delete cascade unique,
  created_at timestamptz not null default now()
);

create table if not exists public.reserve_fund_transactions (
  id uuid primary key default gen_random_uuid(),
  fund_id uuid not null references public.reserve_funds(id) on delete cascade,
  type text not null check (type in ('deposit', 'withdrawal')),
  amount numeric(12,0) not null check (amount > 0),
  date date not null,
  linked_expense_id uuid references public.building_expenses(id) on delete set null,
  note text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_reserve_fund_transactions_fund_date
  on public.reserve_fund_transactions (fund_id, date desc, created_at desc);

create index if not exists idx_reserve_fund_transactions_linked_expense
  on public.reserve_fund_transactions (linked_expense_id)
  where linked_expense_id is not null;

alter table public.shared_expenses enable row level security;
alter table public.shared_expense_buildings enable row level security;
alter table public.reserve_funds enable row level security;
alter table public.reserve_fund_transactions enable row level security;

drop policy if exists shared_expenses_admin_all on public.shared_expenses;
create policy shared_expenses_admin_all
  on public.shared_expenses
  for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists shared_expenses_owner_all_own on public.shared_expenses;
create policy shared_expenses_owner_all_own
  on public.shared_expenses
  for all to authenticated
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'owner'
    and owner_id = (select auth.uid())
  )
  with check (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'owner'
    and owner_id = (select auth.uid())
  );

drop policy if exists shared_expense_buildings_admin_all on public.shared_expense_buildings;
create policy shared_expense_buildings_admin_all
  on public.shared_expense_buildings
  for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists shared_expense_buildings_owner_all_own on public.shared_expense_buildings;
create policy shared_expense_buildings_owner_all_own
  on public.shared_expense_buildings
  for all to authenticated
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'owner'
    and exists (
      select 1
      from public.shared_expenses shared
      where shared.id = shared_expense_buildings.shared_expense_id
        and shared.owner_id = (select auth.uid())
    )
  )
  with check (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'owner'
    and exists (
      select 1
      from public.shared_expenses shared
      where shared.id = shared_expense_buildings.shared_expense_id
        and shared.owner_id = (select auth.uid())
    )
  );

drop policy if exists reserve_funds_admin_all on public.reserve_funds;
create policy reserve_funds_admin_all
  on public.reserve_funds
  for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists reserve_funds_owner_all_assigned on public.reserve_funds;
create policy reserve_funds_owner_all_assigned
  on public.reserve_funds
  for all to authenticated
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'owner'
    and exists (
      select 1
      from public.user_building_assignments assignment
      where assignment.user_id = (select auth.uid())
        and assignment.building_id = reserve_funds.building_id
    )
  )
  with check (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'owner'
    and exists (
      select 1
      from public.user_building_assignments assignment
      where assignment.user_id = (select auth.uid())
        and assignment.building_id = reserve_funds.building_id
    )
  );

drop policy if exists reserve_fund_transactions_admin_all on public.reserve_fund_transactions;
create policy reserve_fund_transactions_admin_all
  on public.reserve_fund_transactions
  for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists reserve_fund_transactions_owner_all_assigned on public.reserve_fund_transactions;
create policy reserve_fund_transactions_owner_all_assigned
  on public.reserve_fund_transactions
  for all to authenticated
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'owner'
    and exists (
      select 1
      from public.reserve_funds fund
      join public.user_building_assignments assignment on assignment.building_id = fund.building_id
      where fund.id = reserve_fund_transactions.fund_id
        and assignment.user_id = (select auth.uid())
    )
  )
  with check (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'owner'
    and exists (
      select 1
      from public.reserve_funds fund
      join public.user_building_assignments assignment on assignment.building_id = fund.building_id
      where fund.id = reserve_fund_transactions.fund_id
        and assignment.user_id = (select auth.uid())
    )
  );

grant select, insert, update, delete on public.shared_expenses to authenticated;
grant select, insert, update, delete on public.shared_expense_buildings to authenticated;
grant select, insert, update, delete on public.reserve_funds to authenticated;
grant select, insert, update, delete on public.reserve_fund_transactions to authenticated;

commit;
