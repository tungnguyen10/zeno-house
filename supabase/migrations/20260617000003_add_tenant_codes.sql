begin;

-- Add code column to tenants
alter table public.tenants
  add column if not exists code text;

-- Backfill code using format {initials}-{year}-{seq}
-- initials = first char per word of slugify(full_name)
-- year = EXTRACT(YEAR FROM created_at)
-- seq = zero-padded 4-digit sequence within same initials+year prefix
with tenant_initials as (
  select
    id,
    created_at,
    (
      select string_agg(left(part, 1), '' order by ordinality)
      from regexp_split_to_table(
        trim(both '-' from regexp_replace(lower(unaccent(full_name)), '[^a-z0-9]+', '-', 'g')),
        '-'
      ) with ordinality as t(part, ordinality)
      where part != ''
    ) as initials,
    extract(year from created_at)::int as year
  from public.tenants
  where code is null or code = ''
),
tenant_codes as (
  select
    id,
    initials || '-' || year::text || '-' || lpad(
      row_number() over (
        partition by initials, year
        order by created_at, id
      )::text,
      4,
      '0'
    ) as code
  from tenant_initials
)
update public.tenants t
set code = tenant_codes.code
from tenant_codes
where t.id = tenant_codes.id;

alter table public.tenants
  alter column code set not null;

create unique index if not exists tenants_code_uq
  on public.tenants (code);

commit;
