-- =============================================================================
-- Migration: Admin-controlled building visibility
-- Run in: Supabase Dashboard -> SQL Editor, or: supabase db push
-- Data impact: additive (one nullable-free boolean column defaulting to false).
-- Rollback: alter table public.buildings drop column is_hidden;
-- =============================================================================

begin;

-- Independent of `status`: archiving a building does not hide it, and hiding a
-- building does not archive it. Visibility only narrows list/aggregate reads.
alter table public.buildings
  add column if not exists is_hidden boolean not null default false;

comment on column public.buildings.is_hidden is
  'Admin-only switch. Hidden buildings are excluded from list and aggregate reads; direct detail access still resolves.';

-- Scope resolution reads only the hidden set, which stays small.
create index if not exists idx_buildings_hidden
  on public.buildings (id)
  where is_hidden;

commit;
