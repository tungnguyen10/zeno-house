-- Migration: Create rooms table
-- Apply via Supabase Dashboard > SQL Editor, or: supabase db push

begin;

create table if not exists public.rooms (
  id            uuid          primary key default gen_random_uuid(),
  building_id   uuid          not null references public.buildings(id) on delete cascade,
  room_number   text          not null,
  floor         integer       not null default 1,
  status        text          not null default 'available'
                              check (status in ('available', 'occupied', 'maintenance')),
  monthly_rent  numeric(12,0) not null default 0,
  area          numeric(6,2),
  description   text,
  created_at    timestamptz   not null default now(),
  updated_at    timestamptz   not null default now(),

  constraint rooms_room_number_per_building unique (building_id, room_number)
);

-- Auto-update updated_at on row change (reuse function from buildings migration)
create trigger rooms_set_updated_at
  before update on public.rooms
  for each row execute function public.set_updated_at();

-- Row Level Security
alter table public.rooms enable row level security;

-- Admin: full access
create policy "rooms_admin_all"
  on public.rooms
  for all
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Manager: read only
create policy "rooms_manager_select"
  on public.rooms
  for select
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'manager');

commit;
