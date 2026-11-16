-- Run as postgres in Dashboard SQL Editor after applying the scoped-status migration.
-- Every assertion column must be true. All fixture writes are rolled back.
begin;

select
  not pg_catalog.has_function_privilege('anon', 'public.bulk_tenant_status_action(text,jsonb)', 'EXECUTE') as anon_execute_denied,
  not pg_catalog.has_function_privilege('authenticated', 'public.bulk_tenant_status_action(text,jsonb)', 'EXECUTE') as authenticated_execute_denied,
  pg_catalog.has_function_privilege('service_role', 'public.bulk_tenant_status_action(text,jsonb)', 'EXECUTE') as service_role_execute_allowed;

set local role anon;
do $$
begin
  perform public.bulk_tenant_status_action('archive', '[]'::jsonb);
  raise exception 'anon unexpectedly executed tenant status RPC';
exception when insufficient_privilege then null;
end;
$$;
select true as anon_actual_execution_denied;
reset role;

set local role authenticated;
do $$
begin
  perform public.bulk_tenant_status_action('archive', '[]'::jsonb);
  raise exception 'authenticated unexpectedly executed tenant status RPC';
exception when insufficient_privilege then null;
end;
$$;
select true as authenticated_actual_execution_denied;
reset role;

create temporary table tenant_status_scope_fixture on commit drop as
select pg_catalog.gen_random_uuid() as building_a, pg_catalog.gen_random_uuid() as building_b,
  pg_catalog.gen_random_uuid() as room_a, pg_catalog.gen_random_uuid() as room_b,
  pg_catalog.gen_random_uuid() as contract_a, pg_catalog.gen_random_uuid() as contract_b,
  pg_catalog.gen_random_uuid() as missing_id;
create temporary table tenant_status_people_fixture on commit drop as
select kind, pg_catalog.gen_random_uuid() as id
from (values ('matching'), ('conflict'), ('already_target'), ('union'), ('empty'), ('primary_b')) kinds(kind);
grant select on tenant_status_scope_fixture, tenant_status_people_fixture to service_role;

insert into public.buildings (id, code, slug, name, address)
select building_a, 'scope-a-' || building_a, 'scope-a-' || building_a, 'Scope fixture A', 'Verification only'
from tenant_status_scope_fixture
union all
select building_b, 'scope-b-' || building_b, 'scope-b-' || building_b, 'Scope fixture B', 'Verification only'
from tenant_status_scope_fixture;
insert into public.rooms (id, building_id, code, slug, room_number)
select room_a, building_a, 'scope-room-' || room_a, 'scope-room-' || room_a, 'A'
from tenant_status_scope_fixture
union all
select room_b, building_b, 'scope-room-' || room_b, 'scope-room-' || room_b, 'B'
from tenant_status_scope_fixture;
insert into public.tenants (id, code, full_name, phone, status)
select id, 'scope-tenant-' || id, 'Scope fixture ' || kind, '+999' || lpad((floor(random() * 100000000000))::bigint::text, 11, '0'),
  case when kind = 'already_target' then 'archived' else 'active' end
from tenant_status_people_fixture;

-- Only one active contract per room is allowed.
-- Matching uses an open occupancy in active A; union is primary A plus open occupancy in ended B.
insert into public.contracts
  (id, room_id, building_id, tenant_id, contract_code, start_date, end_date, monthly_rent, status)
select f.contract_a, f.room_a, f.building_a, p.id, 'scope-contract-' || f.contract_a,
  '2020-01-01'::date, '2020-12-31'::date, 1000000, 'active'
from tenant_status_scope_fixture f cross join tenant_status_people_fixture p where p.kind = 'union'
union all
select f.contract_b, f.room_b, f.building_b, p.id, 'scope-contract-' || f.contract_b,
  '2020-01-01'::date, '2020-12-31'::date, 1000000, 'terminated'
from tenant_status_scope_fixture f cross join tenant_status_people_fixture p where p.kind = 'primary_b';
insert into public.contract_occupants (contract_id, tenant_id, move_in_date)
select f.contract_a, p.id, '2020-01-01'::date
from tenant_status_scope_fixture f cross join tenant_status_people_fixture p where p.kind = 'matching'
union all
select f.contract_b, p.id, '2020-01-01'::date
from tenant_status_scope_fixture f cross join tenant_status_people_fixture p where p.kind in ('union', 'conflict');

-- Execute the actual writes as service_role, not just the fixture-owning postgres role.
set local role service_role;
create temporary table tenant_status_results on commit drop as
select p.kind, result.*
from tenant_status_people_fixture p cross join tenant_status_scope_fixture f
cross join lateral public.bulk_tenant_status_action('archive', pg_catalog.jsonb_build_array(
  pg_catalog.jsonb_build_object('id', p.id, 'expected_building_ids',
    case
      when p.kind in ('matching', 'conflict') then pg_catalog.jsonb_build_array(f.building_a)
      -- Reverse/duplicate the set to verify normalization rather than array order equality.
      when p.kind = 'union' then pg_catalog.jsonb_build_array(f.building_b, f.building_a, f.building_a)
      else '[]'::jsonb
    end)
)) result
where p.kind <> 'primary_b';
insert into tenant_status_results
select 'missing', result.* from tenant_status_scope_fixture f
cross join lateral public.bulk_tenant_status_action('archive', pg_catalog.jsonb_build_array(
  pg_catalog.jsonb_build_object('id', f.missing_id, 'expected_building_ids', '[]'::jsonb))) result;

select
  count(*) filter (where kind = 'matching' and succeeded and reason is null) = 1 as matching_a_succeeds,
  count(*) filter (where kind = 'conflict' and not succeeded and reason = 'conflict') = 1 as expected_a_actual_b_conflicts,
  count(*) filter (where kind = 'missing' and not succeeded and reason = 'not_found') = 1 as missing_id_not_found,
  count(*) filter (where kind = 'already_target' and succeeded and reason is null) = 1 as already_target_succeeds,
  count(*) filter (where kind = 'union' and succeeded and reason is null) = 1 as primary_and_open_ended_occupant_union_succeeds,
  count(*) filter (where kind = 'empty' and succeeded and reason is null) = 1 as empty_relationship_snapshot_succeeds,
  count(*) = 6 as one_result_per_case
from tenant_status_results;

select count(*) = 2
  and array_agg(result.id order by result.ordinality) = array(
    select p.id from tenant_status_people_fixture p
    where p.kind in ('empty', 'already_target') order by p.id
  ) as reversed_input_returns_sorted_ids
from public.bulk_tenant_status_action('archive', (
  select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'id', p.id, 'expected_building_ids', '[]'::jsonb) order by p.id desc)
  from tenant_status_people_fixture p where p.kind in ('empty', 'already_target')
)) with ordinality as result(id, succeeded, reason, ordinality);

select count(*) = 1 and bool_and(not result.succeeded and result.reason = 'conflict') as incomplete_union_conflicts
from tenant_status_people_fixture p cross join tenant_status_scope_fixture f
cross join lateral public.bulk_tenant_status_action('activate', pg_catalog.jsonb_build_array(
  pg_catalog.jsonb_build_object('id', p.id, 'expected_building_ids', pg_catalog.jsonb_build_array(f.building_a)))) result
where p.kind = 'union';

select count(*) = 0 as empty_batch_returns_no_rows
from public.bulk_tenant_status_action('activate', '[]'::jsonb);
select count(*) = 1 and bool_and(result.succeeded and result.reason is null) as duplicate_ids_activate_once
from tenant_status_people_fixture p
cross join lateral public.bulk_tenant_status_action('activate', pg_catalog.jsonb_build_array(
  pg_catalog.jsonb_build_object('id', p.id, 'expected_building_ids', '[]'::jsonb),
  pg_catalog.jsonb_build_object('id', p.id, 'expected_building_ids', '[]'::jsonb))) result
where p.kind = 'empty';

do $$
begin
  perform public.bulk_tenant_status_action('delete', '[]'::jsonb);
  raise exception 'invalid action unexpectedly accepted';
exception when invalid_parameter_value then null;
end;
$$;
select true as invalid_action_rejected;
do $$
begin
  perform public.bulk_tenant_status_action('archive', '[{"id":"00000000-0000-0000-0000-000000000001"}]'::jsonb);
  raise exception 'missing snapshot unexpectedly accepted';
exception when invalid_parameter_value then null;
end;
$$;
select true as missing_snapshot_rejected;
reset role;

select
  count(*) filter (where p.kind in ('matching', 'already_target', 'union') and t.status = 'archived') = 3 as successes_persist_archived,
  count(*) filter (where p.kind = 'conflict' and t.status = 'active') = 1 as conflict_preserves_status,
  count(*) filter (where p.kind = 'empty' and t.status = 'active') = 1 as activate_persists_active
from tenant_status_people_fixture p join public.tenants t on t.id = p.id;

rollback;
