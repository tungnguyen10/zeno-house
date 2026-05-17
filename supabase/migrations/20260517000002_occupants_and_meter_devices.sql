-- Migration: Create contract_occupants and meter_devices tables
-- v0.2.5 — Occupant / Roommate Model & Meter Device Lifecycle

begin;

-- ─── contract_occupants ─────────────────────────────────────────────────────
-- Tracks primary tenant + roommates per contract, with move-in/out history.
create table if not exists public.contract_occupants (
  id               uuid        primary key default gen_random_uuid(),
  contract_id      uuid        not null references public.contracts(id) on delete cascade,
  tenant_id        uuid        not null references public.tenants(id) on delete restrict,
  role             text        not null default 'roommate'
                               check (role in ('primary', 'roommate')),
  move_in_date     date        not null,
  move_out_date    date,
  billing_counted  boolean     not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create trigger contract_occupants_set_updated_at
  before update on public.contract_occupants
  for each row execute function public.set_updated_at();

alter table public.contract_occupants enable row level security;

create policy "contract_occupants_admin_all"
  on public.contract_occupants
  for all
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "contract_occupants_manager_select"
  on public.contract_occupants
  for select
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'manager');

create index contract_occupants_contract_id_idx
  on public.contract_occupants (contract_id);

-- ─── meter_devices ───────────────────────────────────────────────────────────
-- Tracks electricity/water meter lifecycle per room; preserves history on replacement.
create table if not exists public.meter_devices (
  id             uuid        primary key default gen_random_uuid(),
  building_id    uuid        not null references public.buildings(id) on delete cascade,
  room_id        uuid        not null references public.rooms(id) on delete cascade,
  meter_type     text        not null check (meter_type in ('electricity', 'water')),
  meter_code     text,
  start_reading  numeric(12,3) not null default 0,
  end_reading    numeric(12,3),
  installed_at   date        not null,
  removed_at     date,
  status         text        not null default 'active'
                             check (status in ('active', 'replaced', 'broken', 'inactive')),
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create trigger meter_devices_set_updated_at
  before update on public.meter_devices
  for each row execute function public.set_updated_at();

alter table public.meter_devices enable row level security;

create policy "meter_devices_admin_all"
  on public.meter_devices
  for all
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "meter_devices_manager_select"
  on public.meter_devices
  for select
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'manager');

create index meter_devices_room_id_idx
  on public.meter_devices (room_id);

commit;
