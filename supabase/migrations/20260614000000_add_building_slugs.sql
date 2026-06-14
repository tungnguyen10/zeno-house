begin;

create extension if not exists unaccent with schema public;

create or replace function public.slugify_text(input text)
returns text
language sql
immutable
as $$
  select trim(both '-' from regexp_replace(lower(unaccent(coalesce(input, ''))), '[^a-z0-9]+', '-', 'g'))
$$;

alter table public.buildings
  add column if not exists slug text;

with base as (
  select
    id,
    coalesce(nullif(public.slugify_text(name), ''), 'building') as base_slug
  from public.buildings
  where slug is null or slug = ''
),
ranked as (
  select
    id,
    base_slug,
    row_number() over (partition by base_slug order by id) as slug_rank
  from base
)
update public.buildings b
set slug = case
  when ranked.slug_rank = 1 then ranked.base_slug
  else ranked.base_slug || '-' || ranked.slug_rank::text
end
from ranked
where b.id = ranked.id;

alter table public.buildings
  alter column slug set not null;

create unique index if not exists buildings_slug_uq
  on public.buildings (slug);

commit;
