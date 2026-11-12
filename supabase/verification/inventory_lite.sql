-- Verification for inventory lite (V2 PR2). Run as service_role; rolled back.
begin;

do $$
declare
  v_actor uuid := (select id from auth.users order by created_at limit 1);
  v_building uuid;
  v_other_building uuid;
  v_room uuid;
  v_other_room uuid;
  v_tenant uuid := (select id from public.tenants order by created_at limit 1);
  v_res jsonb;
  v_contract public.contracts%rowtype;
  v_failed boolean;
  v_req uuid := gen_random_uuid();
begin
  if v_actor is null or v_tenant is null then raise exception 'VERIFY: need a user and a tenant'; end if;

  select (public.create_building_with_rooms(
    jsonb_build_object('slug', 'pr2-verify-' || substr(gen_random_uuid()::text,1,8), 'code', 'pr2v' || substr(replace(gen_random_uuid()::text,'-',''),1,6),
      'name', 'PR2 verify', 'address', '1 Verify', 'status', 'active', 'electricity_pricing_type', 'per_kwh',
      'water_pricing_type', 'per_m3', 'grace_period_days', 0),
    '[]'::jsonb, null, v_actor, gen_random_uuid())->'building'->>'id')::uuid into v_building;
  select (public.create_building_with_rooms(
    jsonb_build_object('slug', 'pr2-verify-o-' || substr(gen_random_uuid()::text,1,8), 'code', 'pr2o' || substr(replace(gen_random_uuid()::text,'-',''),1,6),
      'name', 'PR2 other', 'address', '2 Verify', 'status', 'active', 'electricity_pricing_type', 'per_kwh',
      'water_pricing_type', 'per_m3', 'grace_period_days', 0),
    jsonb_build_array(jsonb_build_object('room_number','O1','slug','o1','floor',1,'monthly_rent',1,'area',null)),
    null, v_actor, gen_random_uuid())->'building'->>'id')::uuid into v_other_building;
  select id into v_other_room from public.rooms where building_id = v_other_building limit 1;

  insert into public.building_inventory_templates (building_id, name, quantity, unit_value)
  values (v_building, 'Giường', 1, 2000000), (v_building, 'Máy lạnh', 1, 6000000);

  -- 1. Batch with inventory + replay.
  v_res := public.create_rooms_batch_idempotent(v_building, jsonb_build_array(
    jsonb_build_object('room_number','101','slug','101','floor',1,'monthly_rent',3000000,'area',null)), true, v_actor, v_req);
  v_room := (v_res->'rooms'->0->>'id')::uuid;
  if (select count(*) from public.room_inventory_items where room_id = v_room) <> 2 then
    raise exception 'VERIFY 1 failed: template not applied';
  end if;
  v_res := public.create_rooms_batch_idempotent(v_building, '[]'::jsonb, true, v_actor, v_req);
  if not (v_res->>'replayed')::boolean or (v_res->'rooms'->0->>'id')::uuid <> v_room then
    raise exception 'VERIFY 1b failed: replay';
  end if;

  -- 2. merge does not duplicate (case-insensitive).
  insert into public.room_inventory_items (room_id, name) values (v_room, 'tủ');
  perform public.apply_inventory_template(v_building, array[v_room], 'merge');
  if (select count(*) from public.room_inventory_items where room_id = v_room) <> 3 then
    raise exception 'VERIFY 2 failed: merge duplicated or dropped';
  end if;

  -- 3. Cross-building room rejected.
  v_failed := false;
  begin
    perform public.apply_inventory_template(v_building, array[v_other_room], 'merge');
  exception when others then v_failed := sqlerrm = 'INVENTORY_ROOM_SCOPE';
  end;
  if not v_failed then raise exception 'VERIFY 3 failed: cross-building apply accepted'; end if;

  -- 4. Contract wrapper writes inventory atomically.
  select * into v_contract from public.create_contract_with_handover_and_inventory(
    v_room, v_tenant, v_building, current_date, current_date + 365, 3000000, 0, 5::smallint, 1, 0, 0, 'active', null,
    100, 10, current_date, v_actor,
    jsonb_build_array(jsonb_build_object('name','Giường','quantity',1,'condition','good','unit_value',2000000,'note',null)));
  if (select count(*) from public.contract_inventory_items where contract_id = v_contract.id) <> 1 then
    raise exception 'VERIFY 4 failed: handover not written';
  end if;

  -- 6. Handover reading failure rolls back contract + inventory (invalid end_date before start_date).
  v_failed := false;
  begin
    perform public.create_contract_with_handover_and_inventory(
      v_room, v_tenant, v_building, current_date, current_date - 1, 3000000, 0, 5::smallint, 1, 0, 0, 'terminated', null,
      100, 10, current_date, v_actor,
      jsonb_build_array(jsonb_build_object('name','X','quantity',1,'condition','good','unit_value',null,'note',null)));
  exception when others then v_failed := true;
  end;
  if not v_failed or exists (select 1 from public.contract_inventory_items where name = 'X') then
    raise exception 'VERIFY 6 failed: partial write on failure';
  end if;

  raise notice 'inventory lite verification passed';
end $$;

select p.proname,
       has_function_privilege('anon', p.oid, 'execute') as anon_exec,
       has_function_privilege('authenticated', p.oid, 'execute') as auth_exec,
       has_function_privilege('service_role', p.oid, 'execute') as service_exec
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('apply_inventory_template', 'create_rooms_batch_idempotent', 'create_contract_with_handover_and_inventory');
-- Expected: false, false, true for each.

rollback;
