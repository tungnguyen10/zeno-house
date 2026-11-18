-- Verification for 20261117090000_contract_inventory_rpcs. Run as service_role in the SQL editor; rolled back.
begin;

do $$
declare
  v_actor uuid := (select id from auth.users order by created_at limit 1);
  v_tenant uuid := (select id from public.tenants order by created_at limit 1);
  v_building uuid;
  v_room uuid;
  v_first public.contracts%rowtype;
  v_second public.contracts%rowtype;
  v_res jsonb;
  v_rows integer;
  v_failed boolean;
  v_item jsonb := jsonb_build_object('name','Giường','quantity',1,'condition','good','unit_value',2000000,'note',null);
begin
  if v_actor is null or v_tenant is null then raise exception 'VERIFY: need a user and a tenant'; end if;

  select (public.create_building_with_rooms(
    jsonb_build_object('slug', 'ci-verify-' || substr(gen_random_uuid()::text,1,8), 'code', 'ci' || substr(replace(gen_random_uuid()::text,'-',''),1,8),
      'name', 'CI verify', 'address', '1 Verify', 'status', 'active', 'electricity_pricing_type', 'per_kwh',
      'water_pricing_type', 'per_m3', 'grace_period_days', 0),
    jsonb_build_array(jsonb_build_object('room_number','101','slug','101','floor',1,'monthly_rent',3000000,'area',null)),
    null, v_actor, gen_random_uuid())->'building'->>'id')::uuid into v_building;
  select id into v_room from public.rooms where building_id = v_building limit 1;

  select * into v_first from public.create_contract_with_handover_and_inventory(
    v_room, v_tenant, v_building, current_date - 400, current_date - 35, 3000000, 0, 5::smallint, 1, 0, 0, 'expired', null,
    100, 10, current_date - 400, v_actor, jsonb_build_array(v_item));

  -- 1. Replace is atomic and returns the new rows in order.
  select count(*) into v_rows from public.replace_contract_inventory(v_first.id,
    jsonb_build_array(v_item, jsonb_build_object('name','Tủ','quantity',2,'condition','used','unit_value',null,'note',null)));
  if v_rows <> 2 or (select count(*) from public.contract_inventory_items where contract_id = v_first.id) <> 2 then
    raise exception 'VERIFY 1 failed: replacement';
  end if;

  -- 2. Invalid payload leaves the existing rows untouched.
  v_failed := false;
  begin
    perform public.replace_contract_inventory(v_first.id, jsonb_build_array(jsonb_build_object('bad', 1)));
  exception when others then v_failed := true;
  end;
  if not v_failed or (select count(*) from public.contract_inventory_items where contract_id = v_first.id) <> 2 then
    raise exception 'VERIFY 2 failed: invalid payload changed data';
  end if;

  -- 3. Unknown contract is rejected.
  v_failed := false;
  begin
    perform public.replace_contract_inventory(gen_random_uuid(), '[]'::jsonb);
  exception when others then v_failed := sqlerrm = 'CONTRACT_NOT_FOUND';
  end;
  if not v_failed then raise exception 'VERIFY 3 failed: unknown contract accepted'; end if;

  -- 4. Empty array clears atomically.
  perform public.replace_contract_inventory(v_first.id, '[]'::jsonb);
  if exists (select 1 from public.contract_inventory_items where contract_id = v_first.id) then
    raise exception 'VERIFY 4 failed: clear';
  end if;

  -- 5. Lookup walks previous_contract_id to the nearest contract that has items.
  perform public.replace_contract_inventory(v_first.id, jsonb_build_array(v_item));
  select * into v_second from public.create_contract_with_handover_and_inventory(
    v_room, v_tenant, v_building, current_date - 30, current_date + 335, 3000000, 0, 5::smallint, 1, 0, 0, 'active', null,
    100, 10, current_date - 30, v_actor, '[]'::jsonb);
  update public.contracts set previous_contract_id = v_first.id where id = v_second.id;
  v_res := public.find_handover_inventory(v_second.id);
  if (v_res->>'source_contract_id')::uuid <> v_first.id or jsonb_array_length(v_res->'items') <> 1 then
    raise exception 'VERIFY 5 failed: chain lookup %', v_res;
  end if;

  -- 6. Lookup for an unknown contract returns the empty shape.
  v_res := public.find_handover_inventory(gen_random_uuid());
  if v_res->'source_contract_id' <> 'null'::jsonb or jsonb_array_length(v_res->'items') <> 0 then
    raise exception 'VERIFY 6 failed: empty shape %', v_res;
  end if;

  -- 7. A previous_contract_id cycle terminates (depth cap).
  update public.contracts set previous_contract_id = v_second.id where id = v_first.id;
  perform public.replace_contract_inventory(v_first.id, '[]'::jsonb);
  perform public.find_handover_inventory(v_second.id);

  raise notice 'contract inventory RPC verification passed';
end $$;

select p.proname,
       p.prosecdef as security_definer,
       has_function_privilege('anon', p.oid, 'execute') as anon_exec,
       has_function_privilege('authenticated', p.oid, 'execute') as auth_exec,
       has_function_privilege('service_role', p.oid, 'execute') as service_exec
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('replace_contract_inventory', 'find_handover_inventory');
-- Expected: false, false, false, true for each.

rollback;
