-- Verification for contract_quick_create (V2 PR4a). Run as service_role; rolled back.
-- Builds a throwaway building + room + tenants, then exercises create_contract_full.
begin;

do $$
declare
  v_actor uuid := (select id from auth.users order by created_at limit 1);
  v_req uuid := gen_random_uuid();
  v_building uuid;
  v_room uuid;
  v_tenant uuid;
  v_room2 uuid;
  v_tenant2 uuid;
  v_busy_contract uuid;
  v_res jsonb;
  v_contract uuid;
  v_failed boolean;
  v_contract_json jsonb;
begin
  if v_actor is null then raise exception 'VERIFY: need at least one auth.users row'; end if;

  -- Throwaway building + two rooms via PR0 RPC.
  v_res := public.create_building_with_rooms(
    jsonb_build_object(
      'slug', 'pr4a-verify-' || substr(gen_random_uuid()::text, 1, 8),
      'code', 'pr4a' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6),
      'name', 'PR4a verify', 'address', '1 Verify', 'status', 'active',
      'electricity_pricing_type', 'per_kwh', 'water_pricing_type', 'per_m3', 'grace_period_days', 0,
      'created_by', null, 'owner_user_id', null),
    jsonb_build_array(
      jsonb_build_object('room_number', 'R1', 'slug', 'r1', 'floor', 1, 'monthly_rent', 3000000, 'area', null),
      jsonb_build_object('room_number', 'R2', 'slug', 'r2', 'floor', 1, 'monthly_rent', 3000000, 'area', null)),
    null, v_actor, gen_random_uuid());
  v_building := (v_res->'building'->>'id')::uuid;
  v_room := (select id from public.rooms where building_id = v_building and room_number = 'R1');
  v_room2 := (select id from public.rooms where building_id = v_building and room_number = 'R2');

  insert into public.tenants (code, full_name, phone, status)
  values ('pr4a-t1-' || substr(gen_random_uuid()::text,1,6), 'Khách 1', '0900000001', 'active') returning id into v_tenant;
  insert into public.tenants (code, full_name, phone, status)
  values ('pr4a-t2-' || substr(gen_random_uuid()::text,1,6), 'Khách 2', '0900000002', 'active') returning id into v_tenant2;

  v_contract_json := jsonb_build_object(
    'room_id', v_room, 'tenant_id', v_tenant, 'building_id', v_building,
    'start_date', '2026-12-01', 'end_date', '2027-11-30', 'monthly_rent', 3000000,
    'deposit', 3000000, 'payment_due_day', 5, 'occupant_count', 2, 'status', 'active',
    'handover_electricity_reading', 10, 'handover_water_reading', 5,
    'handover_reading_date', '2026-12-01', 'recorded_by', v_actor);

  -- 1. Happy path: 1 roommate, 1 vehicle, services copied from building (null).
  v_res := public.create_contract_full(
    v_contract_json, '[]'::jsonb,
    jsonb_build_array(jsonb_build_object('tenant_id', v_tenant2)),
    jsonb_build_array(jsonb_build_object('owner_name', 'A', 'plate_number', '59X1 12345')),
    null, v_actor, v_req);
  v_contract := (v_res->>'contract_id')::uuid;
  if (v_res->>'replayed')::boolean then raise exception 'VERIFY 1 failed: replayed on first call'; end if;
  if (select status from public.rooms where id = v_room) <> 'occupied' then raise exception 'VERIFY 1 failed: room not occupied'; end if;
  if (select count(*) from public.contract_occupants where contract_id = v_contract and role = 'roommate') <> 1 then raise exception 'VERIFY 1 failed: roommate'; end if;
  if (select count(*) from public.contract_vehicles where contract_id = v_contract) <> 1 then raise exception 'VERIFY 1 failed: vehicle'; end if;

  -- 2. Replay same actor → same contract; other actor → conflict.
  v_res := public.create_contract_full(v_contract_json, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, null, v_actor, v_req);
  if (v_res->>'contract_id')::uuid <> v_contract or not (v_res->>'replayed')::boolean then raise exception 'VERIFY 2 failed: replay'; end if;
  v_failed := false;
  begin perform public.create_contract_full(v_contract_json, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, null, gen_random_uuid(), v_req);
  exception when others then v_failed := sqlerrm = 'CONTRACT_CREATE_REQUEST_CONFLICT'; end;
  if not v_failed then raise exception 'VERIFY 2 failed: foreign actor not rejected'; end if;

  -- 3. Roommate busy elsewhere → rollback (v_tenant2 is an active roommate on v_contract).
  v_failed := false;
  begin perform public.create_contract_full(
    v_contract_json || jsonb_build_object('room_id', v_room2, 'tenant_id', v_tenant),
    '[]'::jsonb, jsonb_build_array(jsonb_build_object('tenant_id', v_tenant2)), '[]'::jsonb, null, v_actor, gen_random_uuid());
  exception when others then v_failed := sqlerrm in ('CONTRACT_OCCUPANT_BUSY', 'CONTRACT_OCCUPANT_PRIMARY'); end;
  if not v_failed then raise exception 'VERIFY 3 failed: busy roommate not rejected'; end if;

  -- 4. occupant_count = 1 with a roommate → limit.
  v_failed := false;
  begin perform public.create_contract_full(
    v_contract_json || jsonb_build_object('room_id', v_room2, 'tenant_id', v_tenant, 'occupant_count', 1),
    '[]'::jsonb, jsonb_build_array(jsonb_build_object('tenant_id', v_tenant2)), '[]'::jsonb, null, v_actor, gen_random_uuid());
  exception when others then v_failed := sqlerrm = 'CONTRACT_OCCUPANT_LIMIT'; end;
  if not v_failed then raise exception 'VERIFY 4 failed: occupant limit not enforced'; end if;

  -- 5. Unknown service catalog id → invalid, rolled back.
  v_failed := false;
  begin perform public.create_contract_full(
    v_contract_json || jsonb_build_object('room_id', v_room2, 'tenant_id', v_tenant),
    '[]'::jsonb, '[]'::jsonb, '[]'::jsonb,
    jsonb_build_array(jsonb_build_object('catalog_id', gen_random_uuid(), 'amount', 1000, 'quantity', 1, 'is_enabled', true)),
    v_actor, gen_random_uuid());
  exception when others then v_failed := sqlerrm = 'CONTRACT_SERVICE_INVALID'; end;
  if not v_failed then raise exception 'VERIFY 5 failed: unknown service not rejected'; end if;

  raise notice 'create_contract_full verification passed';
end $$;

-- 6. Grants.
select p.proname,
       has_function_privilege('anon', p.oid, 'execute') as anon_exec,
       has_function_privilege('authenticated', p.oid, 'execute') as auth_exec,
       has_function_privilege('service_role', p.oid, 'execute') as service_exec
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'create_contract_full';
-- Expected: anon=false, authenticated=false, service_role=true.

select
  has_table_privilege('anon', 'public.contract_vehicles', 'select') as anon_select,
  has_table_privilege('service_role', 'public.contract_vehicles', 'select') as service_select;
-- Expected: false, true.

rollback;
