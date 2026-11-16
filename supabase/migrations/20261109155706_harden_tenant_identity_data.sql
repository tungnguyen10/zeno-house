begin;

-- Strip the exact ECMAScript whitespace repertoire used by TypeScript /\s/.
-- Unicode root ICU casing matches JavaScript toUpperCase independently of DB locale.
create or replace function public.normalize_tenant_phone(p_value text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_compact text;
begin
  if p_value is null then
    return null;
  end if;
  v_compact := pg_catalog.regexp_replace(pg_catalog.translate(p_value, U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF', ''), '[.()-]', '', 'g');
  if v_compact ~ '^0[0-9]{9}$' then
    return v_compact;
  end if;
  if v_compact ~ '^\+?84[0-9]{9}$' then
    return '0' || pg_catalog.right(v_compact, 9);
  end if;
  -- International and legacy invalid values keep their compact form; validators reject new invalid input.
  return v_compact;
end;
$$;

create or replace function public.normalize_tenant_id_number(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(pg_catalog.upper(pg_catalog.translate(p_value, U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF', '') collate pg_catalog."und-x-icu"), '');
$$;

-- Prevent concurrent writes between the duplicate guard, backfill and indexes.
lock table public.tenants in share row exclusive mode;

do $$
declare
  v_phone_groups integer;
  v_id_groups    integer;
begin
  select count(*) into v_phone_groups
  from (
    select public.normalize_tenant_phone(phone)
    from public.tenants
    group by 1
    having count(*) > 1
  ) groups;
  select count(*) into v_id_groups
  from (
    select public.normalize_tenant_id_number(id_number)
    from public.tenants
    where public.normalize_tenant_id_number(id_number) is not null
    group by 1
    having count(*) > 1
  ) groups;
  if v_phone_groups > 0 or v_id_groups > 0 then
    raise exception 'TENANT_IDENTITY_DUPLICATES phone_groups=% id_number_groups=%', v_phone_groups, v_id_groups
      using hint = 'Run supabase/verification/tenant_identity_duplicates.sql and resolve every group first.';
  end if;
end;
$$;

-- Existing tenants_set_updated_at fires once per changed row.
-- No audit triggers are present in the source baseline; inspect cloud preflight output.
update public.tenants
set phone = public.normalize_tenant_phone(phone),
    id_number = public.normalize_tenant_id_number(id_number)
where phone is distinct from public.normalize_tenant_phone(phone)
   or id_number is distinct from public.normalize_tenant_id_number(id_number);

create unique index tenants_phone_uq on public.tenants (phone);
create unique index tenants_id_number_uq on public.tenants (id_number) where id_number is not null;

create or replace function public.tenants_normalize_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.phone := public.normalize_tenant_phone(new.phone);
  new.id_number := public.normalize_tenant_id_number(new.id_number);
  return new;
end;
$$;

create trigger tenants_normalize_identity
  before insert or update of phone, id_number on public.tenants
  for each row execute function public.tenants_normalize_identity();

commit;

-- Rollback (normalized values are kept):
-- drop trigger if exists tenants_normalize_identity on public.tenants;
-- drop function if exists public.tenants_normalize_identity();
-- drop index if exists public.tenants_id_number_uq;
-- drop index if exists public.tenants_phone_uq;
-- drop function if exists public.normalize_tenant_id_number(text);
-- drop function if exists public.normalize_tenant_phone(text);
