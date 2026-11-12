-- HUMAN GATE: run in the approved Supabase staging Dashboard SQL Editor after
-- applying 20261112005547_inventory_lite.sql. Static tests do not execute this SQL.
-- Start as postgres for the auth lookup/transactional failure-injection triggers;
-- all behavioral RPC calls/assertions run as service_role. Stop on first error.
-- Existing user/tenant rows are referenced only. All new fixtures, triggers and
-- the verification-only function are rolled back; no cloud execution is claimed here.
begin;

select set_config('zeno.verify_actor', coalesce((select id::text from auth.users order by created_at, id limit 1), ''), true);
create function public.inventory_lite_verify_reject_insert() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.name = 'VERIFY_FORCE_FAILURE' then
    raise exception 'VERIFY_FORCE_FAILURE' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.inventory_lite_verify_reject_insert() from public, anon, authenticated;
grant execute on function public.inventory_lite_verify_reject_insert() to service_role;
create trigger inventory_verify_template_failure before insert on public.building_inventory_templates
  for each row execute function public.inventory_lite_verify_reject_insert();
create trigger inventory_verify_room_failure before insert on public.room_inventory_items
  for each row execute function public.inventory_lite_verify_reject_insert();
set local role service_role;

do $$
declare
  v_actor uuid := nullif(current_setting('zeno.verify_actor'), '')::uuid;
  v_tenant uuid := (select id from public.tenants order by created_at, id limit 1);
  v_building uuid;
  v_other_building uuid;
  v_room uuid;
  v_room2 uuid;
  v_other_room uuid;
  v_request uuid := gen_random_uuid();
  v_failed_request uuid := gen_random_uuid();
  v_result jsonb;
  v_replay jsonb;
  v_before jsonb;
  v_other_before jsonb;
  v_template_before jsonb;
  v_bad jsonb;
  v_item jsonb := '{"name":"Bed","quantity":1,"condition":"good","unit_value":2000000,"note":null}';
  v_fifty jsonb;
  v_failed boolean;
  v_count integer;
  v_contracts bigint;
  v_readings bigint;
  v_inventory bigint;
  v_operations bigint;
  v_rooms bigint;
  v_contract public.contracts%rowtype;
begin
  if v_actor is null or v_tenant is null then
    raise exception 'VERIFY prerequisites: at least one auth user and tenant are required';
  end if;
  v_result := public.create_building_with_rooms(jsonb_build_object(
    'slug', 'pr2-verify-' || gen_random_uuid()::text,
    'code', 'pr2v' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8),
    'name', 'PR2 inventory verification', 'address', '1 Verify Street', 'status', 'active',
    'electricity_pricing_type', 'per_kwh', 'water_pricing_type', 'per_m3', 'grace_period_days', 0
  ), '[]', null, v_actor, gen_random_uuid());
  v_building := (v_result->'building'->>'id')::uuid;
  v_result := public.create_building_with_rooms(jsonb_build_object(
    'slug', 'pr2-other-' || gen_random_uuid()::text,
    'code', 'pr2o' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8),
    'name', 'PR2 other building', 'address', '2 Verify Street', 'status', 'active',
    'electricity_pricing_type', 'per_kwh', 'water_pricing_type', 'per_m3', 'grace_period_days', 0
  ), '[{"room_number":"O1","slug":"o1","floor":1,"monthly_rent":1,"area":null}]', null, v_actor, gen_random_uuid());
  v_other_building := (v_result->'building'->>'id')::uuid;
  v_other_room := (v_result->'rooms'->0->>'id')::uuid;

  -- Batch creation and replay: inventory copied once; no rooms/markers duplicated.
  perform public.replace_inventory_template(v_building, jsonb_build_array(v_item));
  v_result := public.create_rooms_batch_idempotent(v_building,
    '[{"room_number":"101","slug":"101","floor":1,"monthly_rent":3000000,"area":null},
      {"room_number":"102","slug":"102","floor":1,"monthly_rent":3000000,"area":null}]', true, v_actor, v_request);
  v_room := (v_result->'rooms'->0->>'id')::uuid;
  v_room2 := (v_result->'rooms'->1->>'id')::uuid;
  select count(*) into v_rooms from public.rooms where building_id = v_building;
  select count(*) into v_operations from public.audit_operations where building_id = v_building;
  v_replay := public.create_rooms_batch_idempotent(v_building, '[]', true, v_actor, v_request);
  if coalesce((v_result->>'replayed')::boolean, true)
     or not coalesce((v_replay->>'replayed')::boolean, false)
     or v_replay->'rooms' is distinct from v_result->'rooms'
     or (select count(*) from public.room_inventory_items where room_id in (v_room, v_room2)) <> 2
     or (select count(*) from public.rooms where building_id = v_building) <> v_rooms
     or (select count(*) from public.audit_operations where building_id = v_building) <> v_operations then
    raise exception 'VERIFY batch replay: rooms, inventory or marker duplicated/missing';
  end if;
  for v_count in 1..2 loop
    v_failed := false;
    begin
      perform public.create_rooms_batch_idempotent(
        case when v_count = 1 then v_other_building else v_building end,
        '[]', true, case when v_count = 2 then gen_random_uuid() else v_actor end, v_request);
    exception when unique_violation then v_failed := sqlerrm = 'BUILDING_SETUP_REQUEST_CONFLICT';
    end;
    if not v_failed then raise exception 'VERIFY batch replay: foreign actor/building accepted'; end if;
  end loop;

  -- Full row snapshots prove delete/insert atomicity, including original IDs.
  select jsonb_agg(to_jsonb(i) order by i.id) into v_template_before
    from public.building_inventory_templates i where building_id = v_building;
  v_failed := false;
  begin
    perform public.replace_inventory_template(v_building, jsonb_build_array(
      v_item || '{"name":"Replacement"}', v_item || '{"name":"VERIFY_FORCE_FAILURE"}'));
  exception when check_violation then v_failed := sqlerrm = 'VERIFY_FORCE_FAILURE';
  end;
  if not v_failed or (select jsonb_agg(to_jsonb(i) order by i.id)
      from public.building_inventory_templates i where building_id = v_building) is distinct from v_template_before then
    raise exception 'VERIFY atomic template replace: failed insert did not restore original list';
  end if;
  select jsonb_agg(to_jsonb(i) order by i.id) into v_before from public.room_inventory_items i where room_id = v_room;
  v_failed := false;
  begin
    perform public.replace_room_inventory(v_room, jsonb_build_array(
      v_item || '{"name":"Replacement"}', v_item || '{"name":"VERIFY_FORCE_FAILURE"}'));
  exception when check_violation then v_failed := sqlerrm = 'VERIFY_FORCE_FAILURE';
  end;
  if not v_failed or (select jsonb_agg(to_jsonb(i) order by i.id)
      from public.room_inventory_items i where room_id = v_room) is distinct from v_before then
    raise exception 'VERIFY atomic room replace: failed insert did not restore original list';
  end if;

  -- Mixed-building batch must reject the whole request, including a valid first room.
  perform public.replace_room_inventory(v_other_room, jsonb_build_array(v_item || '{"name":"Other"}'));
  select jsonb_agg(to_jsonb(i) order by i.id) into v_other_before from public.room_inventory_items i where room_id = v_other_room;
  v_failed := false;
  begin
    perform public.apply_inventory_template(v_building, array[v_room, v_other_room], 'replace');
  exception when insufficient_privilege then v_failed := sqlerrm = 'INVENTORY_ROOM_SCOPE';
  end;
  if not v_failed
     or (select jsonb_agg(to_jsonb(i) order by i.id) from public.room_inventory_items i where room_id = v_room) is distinct from v_before
     or (select jsonb_agg(to_jsonb(i) order by i.id) from public.room_inventory_items i where room_id = v_other_room) is distinct from v_other_before then
    raise exception 'VERIFY mixed-building batch: accepted or partially wrote inventory';
  end if;

  -- Merge uses case-insensitive names and preserves the room-specific values.
  perform public.replace_room_inventory(v_room, jsonb_build_array(v_item || '{"name":"BED","quantity":2,"condition":"used"}'));
  v_result := public.apply_inventory_template(v_building, array[v_room], 'merge');
  if v_result is distinct from jsonb_build_object(v_room::text, 0)
     or (select count(*) from public.room_inventory_items where room_id = v_room) <> 1
     or not exists(select 1 from public.room_inventory_items where room_id = v_room and name = 'BED' and quantity = 2 and condition = 'used') then
    raise exception 'VERIFY merge: duplicate or room-specific values lost';
  end if;
  v_result := public.apply_inventory_template(v_building, array[v_room], 'replace');
  if v_result is distinct from jsonb_build_object(v_room::text, 1)
     or not exists(select 1 from public.room_inventory_items where room_id = v_room and name = 'Bed' and quantity = 1) then
    raise exception 'VERIFY replace: template not copied';
  end if;

  -- Boundary 50 succeeds; one extra merged name rejects all rooms with no writes.
  select jsonb_agg(v_item || jsonb_build_object('name', 'Item ' || n) order by n) into v_fifty from generate_series(1, 50) n;
  perform public.replace_room_inventory(v_room, v_fifty);
  perform public.replace_room_inventory(v_room2, '[]');
  select jsonb_agg(to_jsonb(i) order by i.id) into v_before from public.room_inventory_items i where room_id = v_room;
  v_failed := false;
  begin
    perform public.apply_inventory_template(v_building, array[v_room2, v_room], 'merge');
  exception when invalid_parameter_value then v_failed := sqlerrm = 'INVENTORY_ITEMS_LIMIT';
  end;
  if not v_failed
     or (select jsonb_agg(to_jsonb(i) order by i.id) from public.room_inventory_items i where room_id = v_room) is distinct from v_before
     or exists(select 1 from public.room_inventory_items where room_id = v_room2) then
    raise exception 'VERIFY bounded merge: over-limit merge accepted or partially applied';
  end if;
  v_failed := false;
  begin
    perform public.replace_inventory_template(v_building, v_fifty || jsonb_build_array(v_item));
  exception when invalid_parameter_value then v_failed := sqlerrm = 'INVENTORY_ITEMS_LIMIT';
  end;
  if not v_failed or (select jsonb_agg(to_jsonb(i) order by i.id)
      from public.building_inventory_templates i where building_id = v_building) is distinct from v_template_before then
    raise exception 'VERIFY submitted limit: 51 template items accepted or previous list lost';
  end if;

  -- Strict item array/field validation; errors must have stable SQLSTATE/messages.
  for v_bad in select value from jsonb_array_elements(jsonb_build_array(
    'null'::jsonb, '{}'::jsonb, '[null]'::jsonb, '[1]'::jsonb,
    jsonb_build_array(v_item || '{"name":" "}'),
    jsonb_build_array(v_item || jsonb_build_object('name', repeat('x', 101))),
    jsonb_build_array(v_item || '{"quantity":0}'),
    jsonb_build_array(v_item || '{"quantity":1000}'),
    jsonb_build_array(v_item || '{"quantity":1.5}'),
    jsonb_build_array(v_item || '{"quantity":"1"}'),
    jsonb_build_array(v_item || '{"condition":"broken"}'),
    jsonb_build_array(v_item || '{"unit_value":-1}'),
    jsonb_build_array(v_item || '{"unit_value":0.5}'),
    jsonb_build_array(v_item || '{"unit_value":1000000000000}'),
    jsonb_build_array(v_item || '{"unit_value":"1"}'),
    jsonb_build_array(v_item || '{"note":false}'),
    jsonb_build_array(v_item || jsonb_build_object('note', repeat('x', 201)))
  )) loop
    v_failed := false;
    begin
      perform public.replace_room_inventory(v_room, v_bad);
    exception when invalid_parameter_value then v_failed := sqlerrm = 'INVENTORY_ITEMS_INVALID';
    end;
    if not v_failed or (select jsonb_agg(to_jsonb(i) order by i.id)
        from public.room_inventory_items i where room_id = v_room) is distinct from v_before then
      raise exception 'VERIFY malformed items: accepted or modified old inventory: %', v_bad;
    end if;
  end loop;
  v_failed := false;
  begin
    perform public.replace_room_inventory(v_room, null);
  exception when invalid_parameter_value then v_failed := sqlerrm = 'INVENTORY_ITEMS_INVALID';
  end;
  if not v_failed then raise exception 'VERIFY malformed items: SQL NULL accepted'; end if;
  v_failed := false;
  begin
    perform public.replace_inventory_template(v_building, jsonb_build_array(v_item, v_item || '{"name":" bed "}'));
  exception when invalid_parameter_value then v_failed := sqlerrm = 'INVENTORY_ITEMS_DUPLICATE';
  end;
  if not v_failed then raise exception 'VERIFY duplicate names: case/space duplicate accepted'; end if;

  -- Upper accepted scalar boundaries and explicit zero/null monetary values.
  perform public.replace_room_inventory(v_room2,
    '[{"name":"Boundary","quantity":999.0,"condition":"damaged","unit_value":999999999999,"note":null},
      {"name":"Zero","quantity":1,"condition":"good","unit_value":0},
      {"name":"Null","quantity":1,"condition":"used","unit_value":null}]');
  if not exists(select 1 from public.room_inventory_items where room_id = v_room2 and name = 'Boundary' and quantity = 999 and unit_value = 999999999999 and sort_order = 0)
     or not exists(select 1 from public.room_inventory_items where room_id = v_room2 and name = 'Zero' and unit_value = 0 and sort_order = 1)
     or not exists(select 1 from public.room_inventory_items where room_id = v_room2 and name = 'Null' and unit_value is null and sort_order = 2) then
    raise exception 'VERIFY item boundaries: scalar boundary/order mismatch';
  end if;

  -- Reject malformed mode/room arrays (including duplicates, NULL and 201 IDs).
  for v_count in 1..8 loop
    v_failed := false;
    begin
      perform public.apply_inventory_template(v_building,
        case v_count when 1 then null when 2 then array[]::uuid[] when 3 then array[null]::uuid[]
          when 4 then array[v_room,v_room] when 5 then array[[v_room]]
          when 6 then array(select gen_random_uuid() from generate_series(1,201)) else array[v_room] end,
        case when v_count = 7 then null when v_count = 8 then 'bad' else 'merge' end);
    exception when invalid_parameter_value then
      v_failed := sqlerrm = case when v_count >= 7 then 'INVENTORY_MODE_INVALID' else 'INVENTORY_ROOMS_INVALID' end;
    end;
    if not v_failed then raise exception 'VERIFY malformed apply arguments: case % accepted', v_count; end if;
  end loop;

  -- Force failure AFTER the wrapped legacy RPC inserts contract + readings.
  select count(*) into v_contracts from public.contracts where building_id = v_building;
  select count(*) into v_readings from public.meter_readings where building_id = v_building;
  select count(*) into v_inventory from public.contract_inventory_items i join public.contracts c on c.id = i.contract_id where c.building_id = v_building;
  v_failed := false;
  begin
    perform public.create_contract_with_handover_and_inventory(v_room, v_tenant, v_building,
      current_date, current_date + 365, 3000000, 0, 5::smallint, 1, 0, 0, 'active', 'PR2 rollback fixture',
      100, 10, current_date, v_actor, jsonb_build_array(v_item || '{"quantity":0}'));
  exception when invalid_parameter_value then v_failed := sqlerrm = 'INVENTORY_ITEMS_INVALID';
  end;
  if not v_failed or (select count(*) from public.contracts where building_id = v_building) <> v_contracts
     or (select count(*) from public.meter_readings where building_id = v_building) <> v_readings
     or (select count(*) from public.contract_inventory_items i join public.contracts c on c.id = i.contract_id where c.building_id = v_building) <> v_inventory then
    raise exception 'VERIFY contract rollback: contract/readings/inventory survived failed handover';
  end if;
  -- Contract wrapper must reject a crafted cross-building room before any writes.
  v_failed := false;
  begin
    perform public.create_contract_with_handover_and_inventory(v_other_room, v_tenant, v_building,
      current_date, current_date + 365, 3000000, 0, 5::smallint, 1, 0, 0, 'active', null,
      100, 10, current_date, v_actor, '[]');
  exception when insufficient_privilege then v_failed := sqlerrm = 'INVENTORY_ROOM_SCOPE';
  end;
  if not v_failed or (select count(*) from public.contracts where building_id = v_building) <> v_contracts then
    raise exception 'VERIFY contract scope: foreign room accepted';
  end if;
  select * into v_contract from public.create_contract_with_handover_and_inventory(v_room, v_tenant, v_building,
    current_date, current_date + 365, 3000000, 0, 5::smallint, 1, 0, 0, 'active', null,
    100, 10, current_date, v_actor, jsonb_build_array(v_item));
  if (select count(*) from public.contract_inventory_items where contract_id = v_contract.id) <> 1
     or (select count(*) from public.meter_readings where contract_id = v_contract.id and reading_type = 'handover_in') <> 2
     or v_contract.deposit <> 0 then
    raise exception 'VERIFY contract handover: snapshot/readings missing or deposit changed';
  end if;
  select * into v_contract from public.create_contract_with_handover_and_inventory(v_room2, v_tenant, v_building,
    current_date, current_date + 365, 3000000, 0, 5::smallint, 1, 0, 0, 'active', null,
    100, 10, current_date, v_actor, '[]');
  if exists(select 1 from public.contract_inventory_items where contract_id = v_contract.id) then
    raise exception 'VERIFY empty contract inventory: empty list not preserved';
  end if;

  -- Inject failure during template application after batch rooms were inserted.
  -- No marker or created room may survive the failure.
  insert into public.building_inventory_templates (building_id, name, quantity, condition)
  values (v_building, 'VERIFY_BATCH_FAILURE', 1, 'good');
  -- Room trigger only rejects VERIFY_FORCE_FAILURE, so rename the template to it.
  update public.building_inventory_templates set name = 'VERIFY_FORCE_FAILURE'
    where building_id = v_building and name = 'VERIFY_BATCH_FAILURE';
  select count(*) into v_rooms from public.rooms where building_id = v_building;
  select count(*) into v_operations from public.audit_operations where building_id = v_building;
  v_failed := false;
  begin
    perform public.create_rooms_batch_idempotent(v_building,
      '[{"room_number":"FAILED","slug":"failed","floor":1,"monthly_rent":0,"area":null}]', true, v_actor, v_failed_request);
  exception when check_violation then v_failed := sqlerrm = 'VERIFY_FORCE_FAILURE';
  end;
  if not v_failed or (select count(*) from public.rooms where building_id = v_building) <> v_rooms
     or (select count(*) from public.audit_operations where building_id = v_building) <> v_operations
     or exists(select 1 from public.audit_operations where idempotency_key = 'rooms.batch:' || v_failed_request::text) then
    raise exception 'VERIFY batch rollback: failed template application persisted rooms/marker';
  end if;

  perform public.replace_inventory_template(v_building, '[]');
  perform public.replace_room_inventory(v_room, '[]');
  if exists(select 1 from public.building_inventory_templates where building_id = v_building)
     or exists(select 1 from public.room_inventory_items where room_id = v_room) then
    raise exception 'VERIFY empty replacements: clearing inventory failed';
  end if;
  raise notice 'inventory lite behavioral verification passed (transaction will roll back)';
end $$;

-- Privileges/settings are assertions, not a result table requiring interpretation.
do $$
declare
  signature text;
  fn oid;
  tbl text;
  privilege text;
begin
  foreach signature in array array[
    'public.validate_inventory_items(jsonb)',
    'public.replace_inventory_template(uuid,jsonb)',
    'public.replace_room_inventory(uuid,jsonb)',
    'public.apply_inventory_template(uuid,uuid[],text)',
    'public.create_rooms_batch_idempotent(uuid,jsonb,boolean,uuid,uuid)',
    'public.create_contract_with_handover_and_inventory(uuid,uuid,uuid,date,date,numeric,numeric,smallint,integer,numeric,numeric,text,text,numeric,numeric,date,uuid,jsonb)'
  ] loop
    fn := to_regprocedure(signature);
    if fn is null then raise exception 'VERIFY grants/settings: missing %', signature; end if;
    if has_function_privilege('anon', fn, 'execute')
       or has_function_privilege('authenticated', fn, 'execute')
       or not has_function_privilege('service_role', fn, 'execute')
       or exists(select 1 from pg_proc where oid = fn and prosecdef)
       or exists(select 1 from pg_proc p, lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
         where p.oid = fn and a.grantee = 0 and a.privilege_type = 'EXECUTE')
       or not exists(select 1 from pg_proc where oid = fn and proconfig @> array['search_path=""']) then
      raise exception 'VERIFY grants/settings: function %', signature;
    end if;
  end loop;
  foreach tbl in array array['building_inventory_templates', 'room_inventory_items', 'contract_inventory_items'] loop
    if not exists(select 1 from pg_class where oid = ('public.' || tbl)::regclass and relrowsecurity)
       or exists(select 1 from pg_policies where schemaname = 'public' and tablename = tbl)
       or exists(select 1 from pg_class c, lateral aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a
         where c.oid = ('public.' || tbl)::regclass and a.grantee = 0) then
      raise exception 'VERIFY grants/settings: table RLS/policies/public privileges %', tbl;
    end if;
    foreach privilege in array array['SELECT', 'INSERT', 'UPDATE', 'DELETE'] loop
      if has_table_privilege('anon', 'public.' || tbl, privilege)
         or has_table_privilege('authenticated', 'public.' || tbl, privilege)
         or not has_table_privilege('service_role', 'public.' || tbl, privilege) then
        raise exception 'VERIFY grants/settings: table % privilege %', tbl, privilege;
      end if;
    end loop;
  end loop;
end $$;

rollback;

-- Separate human concurrency gate (approved disposable staging fixtures required):
-- Session A: begin; select * from public.replace_inventory_template('<building>',
--   '[{"name":"Bed","quantity":1,"condition":"good"}]'); keep transaction open.
-- Session B: begin; select public.apply_inventory_template('<building>', array['<room>'::uuid], 'replace');
-- B must wait for A. Commit A; B must copy A's complete template. Roll back B.
-- Repeat with replace_room_inventory vs apply_inventory_template on the same building.
-- Repeat create_rooms_batch_idempotent with same request/actor in two sessions:
-- B waits then replays once; changing actor/building must fail with the stable conflict.
-- Clean any explicitly committed disposable fixtures through the approved cleanup plan.
