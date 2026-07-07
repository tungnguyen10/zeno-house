begin;

create table if not exists public.building_reserve_fund_rates (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id) on delete cascade,
  reserve_rate_percent numeric(5,2) not null check (reserve_rate_percent >= 0 and reserve_rate_percent <= 100),
  effective_from_period_year integer not null check (effective_from_period_year between 2000 and 2100),
  effective_from_period_month integer not null check (effective_from_period_month between 1 and 12),
  effective_to_period_year integer check (effective_to_period_year between 2000 and 2100),
  effective_to_period_month integer check (effective_to_period_month between 1 and 12),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint building_reserve_fund_rates_to_period_pair check (
    (effective_to_period_year is null and effective_to_period_month is null)
    or (effective_to_period_year is not null and effective_to_period_month is not null)
  ),
  constraint building_reserve_fund_rates_valid_period_range check (
    effective_to_period_year is null
    or (effective_to_period_year * 12 + effective_to_period_month)
      >= (effective_from_period_year * 12 + effective_from_period_month)
  )
);

create index if not exists idx_building_reserve_fund_rates_building_period
  on public.building_reserve_fund_rates (
    building_id,
    effective_from_period_year,
    effective_from_period_month,
    effective_to_period_year,
    effective_to_period_month
  );

drop trigger if exists building_reserve_fund_rates_set_updated_at
  on public.building_reserve_fund_rates;
create trigger building_reserve_fund_rates_set_updated_at
  before update on public.building_reserve_fund_rates
  for each row execute function public.set_updated_at();

alter table public.reserve_fund_transactions
  add column if not exists source text not null default 'manual'
    check (source in ('manual', 'monthly_accrual', 'expense_deduction')),
  add column if not exists period_year integer check (period_year between 2000 and 2100),
  add column if not exists period_month integer check (period_month between 1 and 12),
  add column if not exists billing_period_id uuid references public.billing_periods(id) on delete set null,
  add column if not exists reserve_rate_percent numeric(5,2) check (reserve_rate_percent >= 0 and reserve_rate_percent <= 100),
  add column if not exists issued_revenue numeric(12,0) check (issued_revenue >= 0),
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by uuid references auth.users(id),
  add column if not exists void_reason text;

alter table public.reserve_fund_transactions
  drop constraint if exists reserve_fund_transactions_amount_check;

alter table public.reserve_fund_transactions
  drop constraint if exists reserve_fund_transactions_source_shape;

alter table public.reserve_fund_transactions
  add constraint reserve_fund_transactions_source_shape check (
    (
      source = 'manual'
      and billing_period_id is null
      and reserve_rate_percent is null
      and issued_revenue is null
      and amount > 0
    )
    or (
      source = 'monthly_accrual'
      and type = 'deposit'
      and amount >= 0
      and period_year is not null
      and period_month is not null
      and reserve_rate_percent is not null
      and issued_revenue is not null
      and linked_expense_id is null
    )
    or (
      source = 'expense_deduction'
      and type = 'withdrawal'
      and amount > 0
      and period_year is not null
      and period_month is not null
      and linked_expense_id is not null
    )
  ) not valid;

create unique index if not exists idx_reserve_fund_transactions_monthly_accrual_unique
  on public.reserve_fund_transactions (fund_id, period_year, period_month)
  where source = 'monthly_accrual';

create unique index if not exists idx_reserve_fund_transactions_active_expense_deduction_unique
  on public.reserve_fund_transactions (linked_expense_id)
  where source = 'expense_deduction'
    and linked_expense_id is not null
    and voided_at is null;

create index if not exists idx_reserve_fund_transactions_fund_period_source
  on public.reserve_fund_transactions (fund_id, period_year, period_month, source)
  where voided_at is null;

alter table public.building_reserve_fund_rates enable row level security;

drop policy if exists building_reserve_fund_rates_admin_all on public.building_reserve_fund_rates;
create policy building_reserve_fund_rates_admin_all
  on public.building_reserve_fund_rates
  for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists building_reserve_fund_rates_owner_all_assigned on public.building_reserve_fund_rates;
create policy building_reserve_fund_rates_owner_all_assigned
  on public.building_reserve_fund_rates
  for all to authenticated
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'owner'
    and exists (
      select 1
      from public.user_building_assignments assignment
      where assignment.user_id = (select auth.uid())
        and assignment.building_id = building_reserve_fund_rates.building_id
    )
  )
  with check (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'owner'
    and exists (
      select 1
      from public.user_building_assignments assignment
      where assignment.user_id = (select auth.uid())
        and assignment.building_id = building_reserve_fund_rates.building_id
    )
  );

grant select, insert, update, delete on public.building_reserve_fund_rates to authenticated;

commit;
