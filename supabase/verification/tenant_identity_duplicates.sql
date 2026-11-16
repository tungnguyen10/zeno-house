-- Catalog preflight: confirm bucket scope constraint name and tenant triggers before rollout.
select conname, pg_catalog.pg_get_constraintdef(oid) as definition
from pg_catalog.pg_constraint
where conrelid = 'public.ai_rate_limit_buckets'::regclass and contype = 'c';
select tgname, pg_catalog.pg_get_triggerdef(oid) as definition
from pg_catalog.pg_trigger
where tgrelid = 'public.tenants'::regclass and not tgisinternal;

-- Read-only. Run in Dashboard SQL Editor before the identity migration.
-- Lists duplicate groups by normalized value without exposing names, phones or ID numbers.
with normalized as (
  select
    id,
    code,
    pg_catalog.regexp_replace(pg_catalog.translate(phone, U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF', ''), '[.()-]', '', 'g') as phone_compact,
    nullif(pg_catalog.upper(pg_catalog.translate(id_number, U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF', '') collate pg_catalog."und-x-icu"), '') as id_key
  from public.tenants
),
keys as (
  select id, code, 'phone' as kind,
    case
      when phone_compact ~ '^\+?84[0-9]{9}$' then '0' || pg_catalog.right(phone_compact, 9)
      else phone_compact
    end as key
  from normalized
  union all
  select id, code, 'id_number', id_key from normalized where id_key is not null
),
groups as (
  select kind, key, dense_rank() over (partition by kind order by key) as group_no, count(*) over (partition by kind, key) as group_size, id, code
  from keys
)
select kind, group_no, group_size, id as tenant_id, code
from groups
where group_size > 1
order by kind, group_no, code;
