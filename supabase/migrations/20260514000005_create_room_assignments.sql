-- Migration: Create room_assignments table
-- Apply via Supabase Dashboard > SQL Editor, or: supabase db push

begin;

create table if not exists public.room_assignments (
  id          uuid        primary key default gen_random_uuid(),
  room_id     uuid        not null references public.rooms(id) on delete cascade,
  tenant_id   uuid        not null references public.tenants(id) on delete restrict,
  start_date  date        not null,
  end_date    date,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Enforce at most 1 active assignment per room (end_date IS NULL = active)
create unique index room_assignments_one_active_per_room
  on public.room_assignments (room_id)
  where end_date is null;

-- Auto-update updated_at on row change (reuse function from buildings migration)
create trigger room_assignments_set_updated_at
  before update on public.room_assignments
  for each row execute function public.set_updated_at();

-- Row Level Security
alter table public.room_assignments enable row level security;

-- Admin: full access
create policy "room_assignments_admin_all"
  on public.room_assignments
  for all
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Manager: read only
create policy "room_assignments_manager_select"
  on public.room_assignments
  for select
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'manager');

commit;
