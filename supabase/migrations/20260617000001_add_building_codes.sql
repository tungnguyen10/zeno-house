begin;

-- Add code column to buildings
alter table public.buildings
  add column if not exists code text;

-- Backfill code from slug (first char per hyphen-separated word)
-- Handle conflicts by appending numeric suffix (rank > 1)
with base_codes as (
  select
    b.id,
    b.created_at,
    string_agg(left(t.part, 1), '' order by t.ordinality) as base_code
  from public.buildings b,
    regexp_split_to_table(b.slug, '-') with ordinality as t(part, ordinality)
  where t.part != ''
  group by b.id, b.created_at
),
ranked as (
  select
    id,
    base_code,
    row_number() over (partition by base_code order by created_at, id) as rank
  from base_codes
)
update public.buildings b
set code = case
  when ranked.rank = 1 then ranked.base_code
  else ranked.base_code || ranked.rank::text
end
from ranked
where b.id = ranked.id;

alter table public.buildings
  alter column code set not null;

create unique index if not exists buildings_code_uq
  on public.buildings (code);

commit;
