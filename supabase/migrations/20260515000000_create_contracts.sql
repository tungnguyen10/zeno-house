-- Migration: Create contracts table
-- Apply via Supabase Dashboard > SQL Editor, or: supabase db push

begin;

create table if not exists public.contracts (
  id            uuid          primary key default gen_random_uuid(),
  room_id       uuid          not null references public.rooms(id) on delete restrict,
  tenant_id     uuid          not null references public.tenants(id) on delete restrict,
  start_date    date          not null,
  end_date      date          not null,
  monthly_rent  numeric(12,0) not null,
  deposit       numeric(12,0) not null default 0,
  status        text          not null default 'active'
                              check (status in ('active', 'expired', 'terminated')),
  notes         text,
  created_at    timestamptz   not null default now(),
  updated_at    timestamptz   not null default now()
);

-- Enforce at most 1 active contract per room
create unique index contracts_one_active_per_room
  on public.contracts (room_id)
  where status = 'active';

-- Auto-update updated_at on row change (reuse function from buildings migration)
create trigger contracts_set_updated_at
  before update on public.contracts
  for each row execute function public.set_updated_at();

-- Row Level Security
alter table public.contracts enable row level security;

-- Admin: full access
create policy "contracts_admin_all"
  on public.contracts
  for all
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Manager: read only
create policy "contracts_manager_select"
  on public.contracts
  for select
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'manager');

commit;
