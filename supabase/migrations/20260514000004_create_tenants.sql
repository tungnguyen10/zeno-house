-- Migration: Create tenants table
-- Apply via Supabase Dashboard > SQL Editor, or: supabase db push

begin;

create table if not exists public.tenants (
  id                 uuid        primary key default gen_random_uuid(),
  full_name          text        not null,
  phone              text        not null,
  email              text,
  id_number          text,
  date_of_birth      date,
  permanent_address  text,
  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- Auto-update updated_at on row change (reuse function from buildings migration)
create trigger tenants_set_updated_at
  before update on public.tenants
  for each row execute function public.set_updated_at();

-- Row Level Security
alter table public.tenants enable row level security;

-- Admin: full access
create policy "tenants_admin_all"
  on public.tenants
  for all
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Manager: read only
create policy "tenants_manager_select"
  on public.tenants
  for select
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'manager');

commit;
