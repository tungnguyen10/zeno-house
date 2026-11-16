-- V2 Inventory Lite deployment preflight. READ ONLY: safe for an authorized SQL Editor session.
-- No fixture creation, DML, grants, DDL or migration execution.
-- Verify this on the intended Supabase project before enabling inventory write paths.
--
-- Expected:
--  1) migration 20261116100000 exists (PR #26 cloud apply was previously pending).
--  2) each required function exists, SECURITY INVOKER, search_path explicitly empty,
--     anon/authenticated EXECUTE false and service_role EXECUTE true.
--  3) function-body guard markers are present. This is a smoke preflight, NOT
--     byte-for-byte proof of the deployed body nor a concurrency/rollback test.
-- For exact equivalence, compare pg_get_functiondef with the reviewed SQL migration.
-- Do not apply older 20261111110000 after 20261116100000.

begin transaction read only;

select
  'inventory_hardening_migration_recorded' as check_name,
  exists (
    select 1 from supabase_migrations.schema_migrations
    where version = '20261116100000'
  ) as passed;

with expected(name, signature) as (
  values
    ('replace_inventory_template', 'public.replace_inventory_template(uuid,jsonb)'),
    ('replace_room_inventory', 'public.replace_room_inventory(uuid,jsonb)'),
    ('apply_inventory_template', 'public.apply_inventory_template(uuid,uuid[],text)'),
    ('create_rooms_batch_idempotent', 'public.create_rooms_batch_idempotent(uuid,jsonb,boolean,uuid,uuid)'),
    ('create_contract_with_handover_and_inventory',
     'public.create_contract_with_handover_and_inventory(uuid,uuid,uuid,date,date,numeric,numeric,smallint,integer,numeric,numeric,text,text,numeric,numeric,date,uuid,jsonb)')
), funcs as (
  select e.name, e.signature,
         to_regprocedure(e.signature) as oid
  from expected e
)
select f.name,
  f.oid is not null as exists_in_catalog,
  coalesce(not p.prosecdef, false) as security_invoker,
  coalesce('search_path=' = any(p.proconfig), false) as empty_search_path,
  case when f.oid is not null then not has_function_privilege('anon',f.oid,'EXECUTE') else false end as anon_denied,
  case when f.oid is not null then not has_function_privilege('authenticated',f.oid,'EXECUTE') else false end as authenticated_denied,
  case when f.oid is not null then has_function_privilege('service_role',f.oid,'EXECUTE') else false end as service_allowed
from funcs f
left join pg_proc p on p.oid = f.oid
order by f.name;

with checks(name, signature, marker) as (
  values
    ('replace_inventory_template','public.replace_inventory_template(uuid,jsonb)','perform public.validate_inventory_items'),
    ('replace_room_inventory','public.replace_room_inventory(uuid,jsonb)','perform public.validate_inventory_items'),
    ('apply_inventory_template','public.apply_inventory_template(uuid,uuid[],text)','INVENTORY_ROOMS_INVALID'),
    ('create_rooms_batch_idempotent','public.create_rooms_batch_idempotent(uuid,jsonb,boolean,uuid,uuid)','BUILDING_SETUP_REQUEST_CONFLICT'),
    ('create_contract_with_handover_and_inventory',
     'public.create_contract_with_handover_and_inventory(uuid,uuid,uuid,date,date,numeric,numeric,smallint,integer,numeric,numeric,text,text,numeric,numeric,date,uuid,jsonb)',
     'perform public.validate_inventory_items')
)
select c.name,
  p.oid is not null as exists_in_catalog,
  coalesce(position(lower(c.marker) in lower(p.prosrc)) > 0, false) as expected_guard_present
from checks c
left join pg_proc p on p.oid = to_regprocedure(c.signature)
order by c.name;

commit;
