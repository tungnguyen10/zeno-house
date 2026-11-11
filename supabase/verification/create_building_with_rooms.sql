-- Human-run staging verification after applying the migration.
-- Start as postgres in Dashboard SQL Editor: only the actor lookup needs auth.users.
-- Function calls and assertions below run with SET LOCAL ROLE service_role.
-- Everything is rolled back. Configure clients to stop on first error.
-- This file has NOT been executed by local/static verification.
begin;

select set_config('zeno.verify_actor', coalesce((select id::text from auth.users order by created_at, id limit 1), ''), true);
set local role service_role;

do $$
declare
  v_actor uuid := nullif(current_setting('zeno.verify_actor'), '')::uuid;
  v_req uuid := gen_random_uuid();
  v_res jsonb;
  v_res2 jsonb;
  v_building_id uuid;
  v_count_before integer;
  v_failed boolean;
  v_detail text;
  v_request_dup uuid := gen_random_uuid();
  v_before_rooms bigint;
  v_before_assignments bigint;
  v_before_operations bigint;
  v_bad jsonb;
  v_bad_room jsonb;
  v_constraint text;
  v_row_count integer;
  v_building jsonb := jsonb_build_object(
    'slug', 'pr0-verify-' || substr(gen_random_uuid()::text, 1, 8),
    'code', 'pr0v' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6),
    'name', 'PR0 verify', 'address', '123 Verify Street', 'status', 'active',
    'electricity_pricing_type', 'per_kwh', 'water_pricing_type', 'per_m3', 'grace_period_days', 0,
    'created_by', null, 'owner_user_id', null
  );
begin
  if v_actor is null then raise exception 'VERIFY: need at least one auth.users row'; end if;

  v_building := v_building || jsonb_build_object('created_by', v_actor, 'owner_user_id', v_actor);

  -- 1. Happy path with 2 rooms on 2 floors.
  v_res := public.create_building_with_rooms(v_building, jsonb_build_array(
    jsonb_build_object('room_number', 'P101', 'slug', 'p101', 'floor', 1, 'monthly_rent', 3000000, 'area', null),
    jsonb_build_object('room_number', 'P201', 'slug', 'p201', 'floor', 2, 'monthly_rent', 3500000, 'area', 22)
  ), v_actor, v_actor, v_req);
  v_building_id := (v_res->'building'->>'id')::uuid;
  if jsonb_array_length(v_res->'rooms') is distinct from 2 or coalesce((v_res->>'replayed')::boolean, true) then
    raise exception 'VERIFY 1 failed: %', v_res;
  end if;
  if (select code from public.rooms where building_id = v_building_id and room_number = 'P101')
     is distinct from (v_building->>'code') || '-p101' then
    raise exception 'VERIFY 1 failed: room code composition';
  end if;

  if not exists(select 1 from public.user_building_assignments
      where building_id = v_building_id and user_id = v_actor
        and not can_delete_master_data and created_by = v_actor)
     or not exists(select 1 from public.audit_operations
      where idempotency_key = 'building.create:' || v_req::text and actor_id = v_actor
        and entity_id = v_building_id and status = 'completed' and completed_at is not null
        and intent_data->>'room_count' = '2') then
    raise exception 'VERIFY 1 failed: owner assignment/completed marker';
  end if;

  -- 2. Replay with same actor returns same building, no new rows.
  select count(*) into v_count_before from public.buildings;
  v_res2 := public.create_building_with_rooms(v_building, '[]'::jsonb, null, v_actor, v_req);
  if (v_res2->'building'->>'id')::uuid is distinct from v_building_id
     or not coalesce((v_res2->>'replayed')::boolean, false)
     or (select count(*) from public.buildings) <> v_count_before then
    raise exception 'VERIFY 2 failed: %', v_res2;
  end if;

  -- 3. Same request id, different actor -> conflict, no data.
  v_failed := false;
  begin
    perform public.create_building_with_rooms(v_building, '[]'::jsonb, null, gen_random_uuid(), v_req);
  exception when others then
    v_failed := sqlerrm = 'BUILDING_SETUP_REQUEST_CONFLICT';
  end;
  if not v_failed then raise exception 'VERIFY 3 failed: foreign actor replay not rejected'; end if;

  -- 4. Duplicate room rolls back the whole call (no orphan building).
  select count(*) into v_count_before from public.buildings;
  select count(*) into v_before_rooms from public.rooms;
  select count(*) into v_before_assignments from public.user_building_assignments;
  select count(*) into v_before_operations from public.audit_operations;
  v_failed := false;
  begin
    perform public.create_building_with_rooms(
      v_building || jsonb_build_object('slug', 'pr0-dup-' || v_request_dup::text, 'code', 'pr0d-' || v_request_dup::text),
      jsonb_build_array(
        jsonb_build_object('room_number', 'A1', 'slug', 'a1', 'floor', 1, 'monthly_rent', 1, 'area', null),
        jsonb_build_object('room_number', 'a1', 'slug', 'a1', 'floor', 1, 'monthly_rent', 1, 'area', null)
      ), v_actor, v_actor, v_request_dup);
  exception when unique_violation then
    get stacked diagnostics v_detail = pg_exception_detail;
    v_failed := coalesce(sqlerrm = 'ROOM_BATCH_DUPLICATE' and v_detail::jsonb = '["A1", "a1"]'::jsonb, false);
  end;
  if not v_failed or (select count(*) from public.buildings) <> v_count_before
     or (select count(*) from public.rooms) <> v_before_rooms
     or (select count(*) from public.user_building_assignments) <> v_before_assignments
     or (select count(*) from public.audit_operations) <> v_before_operations then
    raise exception 'VERIFY 4 failed: duplicate batch not rolled back';
  end if;

  -- 5. Batch into existing building rejects existing room number.
  v_failed := false;
  begin
    perform public.create_rooms_batch(v_building_id, jsonb_build_array(
      jsonb_build_object('room_number', 'P101', 'slug', 'p101', 'floor', 1, 'monthly_rent', 1, 'area', null)));
  exception when others then
    v_failed := sqlerrm = 'ROOM_BATCH_DUPLICATE';
  end;
  if not v_failed then raise exception 'VERIFY 5 failed: existing room not detected'; end if;

  -- 6. Duplicate detection uses the supplied slug, even with a new room number.
  v_failed := false;
  begin
    perform public.create_rooms_batch(v_building_id,
      '[{"room_number":"DIFFERENT","slug":"p101","floor":1,"monthly_rent":0,"area":null}]');
  exception when unique_violation then
    get stacked diagnostics v_detail = pg_exception_detail;
    v_failed := coalesce(sqlerrm = 'ROOM_BATCH_DUPLICATE' and v_detail::jsonb = '["DIFFERENT"]'::jsonb, false);
  end;
  if not v_failed then raise exception 'VERIFY 6 failed: supplied slug collision'; end if;

  -- 7. Shared core bounds, types, missing building; exceptions must be exact.
  v_bad_room := '{"room_number":"VALID","slug":"valid","floor":1,"monthly_rent":0,"area":null}';
  for v_bad in select value from jsonb_array_elements(jsonb_build_array(
      'null'::jsonb, '{}'::jsonb, '[]'::jsonb,
      (select jsonb_agg(v_bad_room) from generate_series(1, 201)),
      jsonb_build_array(v_bad_room || '{"floor":0}'),
      jsonb_build_array(v_bad_room || '{"floor":101}'),
      jsonb_build_array(v_bad_room || '{"floor":1.5}'),
      jsonb_build_array(v_bad_room || '{"room_number":""}'),
      jsonb_build_array(v_bad_room || jsonb_build_object('room_number', repeat('x',21))),
      jsonb_build_array(v_bad_room || '{"monthly_rent":-1}'),
      jsonb_build_array(v_bad_room || '{"area":0}'),
      jsonb_build_array(v_bad_room || '{"floor":"bad"}'),
      '[null]'::jsonb)) loop
    v_failed := false;
    begin
      perform public.create_rooms_batch(v_building_id, v_bad);
    exception when invalid_parameter_value then
      v_failed := sqlerrm = 'ROOM_BATCH_INVALID';
    end;
    if not v_failed then raise exception 'VERIFY 7 failed: invalid input %', v_bad; end if;
  end loop;
  v_failed := false;
  begin
    perform public.create_rooms_batch(gen_random_uuid(), jsonb_build_array(v_bad_room));
  exception when no_data_found then v_failed := sqlerrm = 'BUILDING_NOT_FOUND';
  end;
  if not v_failed then raise exception 'VERIFY 7 failed: missing building'; end if;

  -- 8. Malformed wrapper payload and missing request/actor roll back all effects.
  for v_bad in select value from jsonb_array_elements('[{}, null, 1]') loop
    v_failed := false;
    begin
      perform public.create_building_with_rooms(v_building || jsonb_build_object(
        'slug', 'pr0-invalid-' || gen_random_uuid()::text,
        'code', 'pr0-invalid-' || gen_random_uuid()::text), v_bad, v_actor, v_actor, gen_random_uuid());
    exception when invalid_parameter_value then v_failed := sqlerrm = 'ROOM_BATCH_INVALID';
    end;
    if not v_failed or (select count(*) from public.buildings) <> v_count_before
       or (select count(*) from public.user_building_assignments) <> v_before_assignments
       or (select count(*) from public.audit_operations) <> v_before_operations then
      raise exception 'VERIFY 8 failed: malformed wrapper rollback';
    end if;
  end loop;
  for v_count_before in 1..2 loop
    v_failed := false;
    begin
      perform public.create_building_with_rooms(v_building, '[]', null,
        case when v_count_before = 1 then null else v_actor end,
        case when v_count_before = 2 then null else gen_random_uuid() end);
    exception when invalid_parameter_value then v_failed := sqlerrm = 'BUILDING_SETUP_REQUEST_REQUIRED';
    end;
    if not v_failed then raise exception 'VERIFY 8 failed: request/actor required'; end if;
  end loop;

  -- 9. Building-only calls support both SQL NULL and [] (JSON null is invalid).
  for v_count_before in 1..2 loop
    v_res2 := public.create_building_with_rooms(v_building || jsonb_build_object(
      'slug', 'pr0-only-' || gen_random_uuid()::text, 'code', 'pr0-only-' || gen_random_uuid()::text),
      case when v_count_before = 1 then null else '[]'::jsonb end, null, v_actor, gen_random_uuid());
    if v_res2->'rooms' is distinct from '[]'::jsonb or coalesce((v_res2->>'replayed')::boolean, true) then
      raise exception 'VERIFY 9 failed: building-only';
    end if;
  end loop;

  -- 10. Building slug/code collisions retain native constraint diagnostics.
  for v_count_before in 1..2 loop
    v_failed := false;
    begin
      perform public.create_building_with_rooms(v_building || case
        when v_count_before = 1 then jsonb_build_object('code', 'pr0-unique-' || gen_random_uuid()::text)
        else jsonb_build_object('slug', 'pr0-unique-' || gen_random_uuid()::text) end,
        '[]', null, v_actor, gen_random_uuid());
    exception when unique_violation then
      get stacked diagnostics v_constraint = constraint_name;
      v_failed := coalesce(v_constraint = case when v_count_before = 1
        then 'buildings_slug_uq' else 'buildings_code_uq' end, false);
    end;
    if not v_failed then raise exception 'VERIFY 10 failed: native building uniqueness'; end if;
  end loop;

  -- 11. Upper accepted batch/floor boundary and explicit supplied slugs.
  select jsonb_agg(jsonb_build_object('room_number', 'MAX' || n, 'slug', 'custom-' || n,
    'floor', 100, 'monthly_rent', 0, 'area', null)) into v_bad from generate_series(1,200) n;
  select count(*) into v_row_count from public.create_rooms_batch(v_building_id, v_bad);
  if v_row_count <> 200 or not exists(select 1 from public.rooms where building_id = v_building_id
      and room_number = 'MAX200' and slug = 'custom-200' and floor = 100
      and code = (v_building->>'code') || '-custom-200') then
    raise exception 'VERIFY 11 failed: upper boundary/supplied slug';
  end if;

  raise notice 'create_building_with_rooms behavioral verification passed';
end $$;

-- Grants and function settings fail loudly, rather than requiring visual inspection.
do $$
declare signature text; fn oid;
begin
  foreach signature in array array[
    'public.create_rooms_batch(uuid,jsonb)',
    'public.create_building_with_rooms(jsonb,jsonb,uuid,uuid,uuid)'] loop
    fn := to_regprocedure(signature);
    if fn is null then raise exception 'VERIFY grants: missing %', signature; end if;
    if has_function_privilege('anon', fn, 'execute')
       or has_function_privilege('authenticated', fn, 'execute')
       or not has_function_privilege('service_role', fn, 'execute')
       or exists(select 1 from pg_proc where oid = fn and prosecdef)
       or not exists(select 1 from pg_proc where oid = fn and proconfig @> array['search_path=""']) then
      raise exception 'VERIFY grants/settings failed: %', signature;
    end if;
  end loop;
end $$;

rollback;

-- CONCURRENCY (human-run, two separate sessions on an approved staging fixture):
-- Use an existing disposable Building ID; rolled-back IDs above do not exist.
-- Session A: begin; select public.create_rooms_batch('<building-id>',
--   '[{"room_number":"X1","slug":"x1","floor":1,"monthly_rent":1,"area":null}]');
-- Session B: same call, with begin; B must block while A is open.
-- Commit A: B must then fail ROOM_BATCH_DUPLICATE (23505), DETAIL ["X1"].
-- Repeat with the same request ID/actor via create_building_with_rooms in both
-- sessions: B must wait, then replay the same Building after A commits.
-- Repeat with a different actor in B: it must wait, then fail
-- BUILDING_SETUP_REQUEST_CONFLICT without returning Building data.
-- Roll back B and clean up the committed disposable fixture through an approved plan.
