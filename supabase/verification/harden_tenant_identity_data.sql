-- Also run tenant_identity_normalization.sql for every shared TypeScript/SQL fixture case.
begin;

select
  public.normalize_tenant_phone('0901 234 567') = '0901234567' as phone_spaces,
  public.normalize_tenant_phone('+84 90 123 4567') = '0901234567' as phone_plus84,
  public.normalize_tenant_phone('84901234567') = '0901234567' as phone_84,
  public.normalize_tenant_phone('(090) 123-4567') = '0901234567' as phone_brackets,
  public.normalize_tenant_phone('+44 20 7946 0958') = '+442079460958' as phone_international,
  public.normalize_tenant_id_number('0123 4567 8901') = '012345678901' as id_spaces,
  public.normalize_tenant_id_number('b1234567') = 'B1234567' as id_upper,
  public.normalize_tenant_id_number('   ') is null as id_blank,
  exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'tenants_phone_uq') as phone_index,
  exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'tenants_id_number_uq') as id_index,
  not pg_catalog.has_function_privilege('authenticated', 'public.record_tenant_identity_conflicts(text,integer,integer,timestamptz)', 'EXECUTE') as record_denied_authenticated,
  pg_catalog.has_function_privilege('service_role', 'public.peek_tenant_identity_conflict_limit(text,integer,integer,timestamptz)', 'EXECUTE') as peek_allowed_service_role;

create temporary table identity_fixture on commit drop as
select pg_catalog.gen_random_uuid() as a, pg_catalog.gen_random_uuid() as b;

insert into public.tenants (id, code, full_name, phone, id_number)
select a, 'verify-' || a, 'Identity fixture A', '+999 1234 5678 901', ' zz ' || a::text from identity_fixture;

select
  (select phone from public.tenants where id = (select a from identity_fixture)) = '+99912345678901' as trigger_phone,
  (select id_number from public.tenants where id = (select a from identity_fixture)) = 'ZZ' || upper((select a::text from identity_fixture)) as trigger_id;

do $$
declare
  v_constraint text;
begin
  insert into public.tenants (id, code, full_name, phone)
  select b, 'verify-' || b, 'Identity fixture B', '+99912345678901' from identity_fixture;
  raise exception 'duplicate phone unexpectedly inserted';
exception when unique_violation then
  get stacked diagnostics v_constraint = constraint_name;
  if v_constraint <> 'tenants_phone_uq' then raise; end if;
end;
$$;
select true as phone_unique_enforced;

do $$
declare
  v_constraint text;
begin
  insert into public.tenants (id, code, full_name, phone, id_number)
  select b, 'verify-' || b, 'Identity fixture B', '+99912345678902', 'ZZ ' || a::text from identity_fixture;
  raise exception 'duplicate id number unexpectedly inserted';
exception when unique_violation then
  get stacked diagnostics v_constraint = constraint_name;
  if v_constraint <> 'tenants_id_number_uq' then raise; end if;
end;
$$;
select true as id_unique_enforced;

-- Keeping the same normalized identity must not conflict with the tenant itself.
update public.tenants set phone = '+999 1234 5678 901', id_number = 'zz ' || id::text
where id = (select a from identity_fixture);
select true as self_update_allowed;

-- Separate subject per verification execution; all counter writes roll back.
create temporary table conflict_fixture on commit drop as
select replace(a::text || b::text, '-', '') as subject_hash from identity_fixture;
select allowed as fresh_subject_allowed
from public.peek_tenant_identity_conflict_limit(
  (select subject_hash from conflict_fixture), 10, 900, '2026-11-09 00:00:00+00');
select public.record_tenant_identity_conflicts(
  (select subject_hash from conflict_fixture), 10, 900, '2026-11-09 00:00:00+00');
select not allowed as limit_enforced, retry_after_seconds = 899 as retry_after_correct
from public.peek_tenant_identity_conflict_limit(
  (select subject_hash from conflict_fixture), 10, 900, '2026-11-09 00:00:01+00');
select allowed as next_window_allowed
from public.peek_tenant_identity_conflict_limit(
  (select subject_hash from conflict_fixture), 10, 900, '2026-11-09 00:15:00+00');

rollback;
