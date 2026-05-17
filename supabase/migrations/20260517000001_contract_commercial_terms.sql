-- Migration: Add commercial terms and occupant count to contracts
-- v0.2.5 — Contract Commercial Terms Alignment

begin;

alter table public.contracts
  add column if not exists building_id      uuid references public.buildings(id) on delete restrict,
  add column if not exists occupant_count   integer not null default 1 check (occupant_count >= 1),
  add column if not exists discount_amount  numeric(12,0) not null default 0,
  add column if not exists surcharge_amount numeric(12,0) not null default 0;

commit;
