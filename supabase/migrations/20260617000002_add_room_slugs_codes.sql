begin;

-- Add slug column to rooms
alter table public.rooms
  add column if not exists slug text;

-- Backfill slug from room_number
update public.rooms
set slug = trim(both '-' from lower(regexp_replace(room_number, '[^a-z0-9]+', '-', 'gi')))
where slug is null or slug = '';

alter table public.rooms
  alter column slug set not null;

create unique index if not exists rooms_building_slug_uq
  on public.rooms (building_id, slug);

-- Add code column to rooms
alter table public.rooms
  add column if not exists code text;

-- Backfill code as building.code || '-' || room.slug
update public.rooms r
set code = b.code || '-' || r.slug
from public.buildings b
where r.building_id = b.id
  and (r.code is null or r.code = '');

alter table public.rooms
  alter column code set not null;

create unique index if not exists rooms_code_uq
  on public.rooms (code);

commit;
