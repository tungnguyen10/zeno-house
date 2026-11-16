-- Verification for create_building_with_rooms (V2 PR0). Run in SQL Editor as service_role.
-- Everything is rolled back; no data is kept.
begin;

do $$
declare
  v_actor uuid := (select id from auth.users order by created_at limit 1);
  v_req uuid := gen_random_uuid();
  v_res jsonb;
  v_res2 jsonb;
  v_building_id uuid;
  v_count_before integer;
  v_failed boolean;
  v_building jsonb := jsonb_build_object(
    'slug', 'pr0-verify-' || substr(gen_random_uuid()::text, 1, 8),
    'code', 'pr0v' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6),
    'name', 'PR0 verify', 'address', '123 Verify Street', 'status', 'active',
    'electricity_pricing_type', 'per_kwh', 'water_pricing_type', 'per_m3', 'grace_period_days', 0,
    'created_by', null, 'owner_user_id', null
  );
begin
  if v_actor is null then raise exception 'VERIFY: need at least one auth.users row'; end if;

  -- 1. Happy path with 2 rooms on 2 floors.
  v_res := public.create_building_with_rooms(v_building, jsonb_build_array(
    jsonb_build_object('room_number', 'P101', 'slug', 'p101', 'floor', 1, 'monthly_rent', 3000000, 'area', null),
    jsonb_build_object('room_number', 'P201', 'slug', 'p201', 'floor', 2, 'monthly_rent', 3500000, 'area', 22)
  ), null, v_actor, v_req);
  v_building_id := (v_res->'building'->>'id')::uuid;
  if jsonb_array_length(v_res->'rooms') <> 2 or (v_res->>'replayed')::boolean then
    raise exception 'VERIFY 1 failed: %', v_res;
  end if;
  if (select code from public.rooms where building_id = v_building_id and room_number = 'P101')
     <> (v_building->>'code') || '-p101' then
    raise exception 'VERIFY 1 failed: room code composition';
  end if;

  -- 2. Replay with same actor returns same building, no new rows.
  select count(*) into v_count_before from public.buildings;
  v_res2 := public.create_building_with_rooms(v_building, '[]'::jsonb, null, v_actor, v_req);
  if (v_res2->'building'->>'id')::uuid <> v_building_id or not (v_res2->>'replayed')::boolean
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
  v_failed := false;
  begin
    perform public.create_building_with_rooms(
      v_building || jsonb_build_object('slug', 'pr0-verify-dup', 'code', 'pr0vdup'),
      jsonb_build_array(
        jsonb_build_object('room_number', 'A1', 'slug', 'a1', 'floor', 1, 'monthly_rent', 1, 'area', null),
        jsonb_build_object('room_number', 'a1', 'slug', 'a1', 'floor', 1, 'monthly_rent', 1, 'area', null)
      ), null, v_actor, gen_random_uuid());
  exception when others then
    v_failed := sqlerrm = 'ROOM_BATCH_DUPLICATE';
  end;
  if not v_failed or (select count(*) from public.buildings) <> v_count_before then
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

  raise notice 'create_building_with_rooms verification passed';
end $$;

-- 6. Grants.
select p.proname,
       has_function_privilege('anon', p.oid, 'execute') as anon_exec,
       has_function_privilege('authenticated', p.oid, 'execute') as auth_exec,
       has_function_privilege('service_role', p.oid, 'execute') as service_exec
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('create_rooms_batch', 'create_building_with_rooms');
-- Expected: anon_exec = false, auth_exec = false, service_exec = true for both rows.

rollback;
