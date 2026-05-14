-- Migration: Create buildings table
-- Apply via Supabase Dashboard > SQL Editor, or: supabase db push

begin;

create table if not exists public.buildings (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null,
  address     text        not null,
  description text,
  status      text        not null default 'active' check (status in ('active', 'inactive')),
  total_rooms integer     not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Auto-update updated_at on row change
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger buildings_set_updated_at
  before update on public.buildings
  for each row execute function public.set_updated_at();

-- Row Level Security
alter table public.buildings enable row level security;

-- Admin: full access (read custom role from app_metadata in JWT)
create policy "buildings_admin_all"
  on public.buildings
  for all
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Manager: read only
create policy "buildings_manager_select"
  on public.buildings
  for select
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'manager');

commit;
