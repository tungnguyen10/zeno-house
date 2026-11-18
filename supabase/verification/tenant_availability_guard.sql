-- Verification for 20261118120000_tenant_availability_guard. Run as service_role in the SQL editor; rolled back.
begin;

do $$
declare
  v_actor uuid := (select id from auth.users order by created_at limit 1);
  v_res jsonb;
  v_building uuid;
  v_room1 uuid;
  v_room2 uuid;
  v_room3 uuid;
  v_primary uuid;
  v_roommate uuid;
  v_free uuid;
  v_active public.contracts%rowtype;
  v_expired public.contracts%rowtype;
  v_other public.contracts%rowtype;
  v_failed boolean;
begin
  if v_actor is null then raise exception 'VERIFY: need at least one auth.users row'; end if;

  v_res := public.create_building_with_rooms(
    jsonb_build_object(
      'slug', 'tav-verify-' || substr(gen_random_uuid()::text, 1, 8),
      'code', 'tav' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6),
      'name', 'Tenant availability verify', 'address', '1 Verify', 'status', 'active',
      'electricity_pricing_type', 'per_kwh', 'water_pricing_type', 'per_m3', 'grace_period_days', 0),
    jsonb_build_array(
      jsonb_build_object('room_number', 'R1', 'slug', 'r1', 'floor', 1, 'monthly_rent', 3000000, 'area', null),
      jsonb_build_object('room_number', 'R2', 'slug', 'r2', 'floor', 1, 'monthly_rent', 3000000, 'area', null),
      jsonb_build_object('room_number', 'R3', 'slug', 'r3', 'floor', 1, 'monthly_rent', 3000000, 'area', null)),
    null, v_actor, gen_random_uuid());
  v_building := (v_res->'building'->>'id')::uuid;
  v_room1 := (select id from public.rooms where building_id = v_building and room_number = 'R1');
  v_room2 := (select id from public.rooms where building_id = v_building and room_number = 'R2');
  v_room3 := (select id from public.rooms where building_id = v_building and room_number = 'R3');

  insert into public.tenants (code, full_name, phone) values
    ('tav-p-' || substr(gen_random_uuid()::text, 1, 8), 'Verify primary', '+999' || lpad((floor(random() * 1e11))::bigint::text, 11, '0'))
    returning id into v_primary;
  insert into public.tenants (code, full_name, phone) values
    ('tav-r-' || substr(gen_random_uuid()::text, 1, 8), 'Verify roommate', '+999' || lpad((floor(random() * 1e11))::bigint::text, 11, '0'))
    returning id into v_roommate;
  insert into public.tenants (code, full_name, phone) values
    ('tav-f-' || substr(gen_random_uuid()::text, 1, 8), 'Verify free', '+999' || lpad((floor(random() * 1e11))::bigint::text, 11, '0'))
    returning id into v_free;

  -- 1. History does not block: an expired contract, then an active one for the same tenant.
  select * into v_expired from public.create_contract_with_handover_and_inventory(
    v_room1, v_primary, v_building, current_date - 400, current_date - 35, 3000000, 0, 5::smallint, 2, 0, 0, 'expired', null,
    1, 1, current_date - 400, v_actor, '[]'::jsonb);
  select * into v_active from public.create_contract_with_handover_and_inventory(
    v_room1, v_primary, v_building, current_date - 30, current_date + 330, 3000000, 0, 5::smallint, 2, 0, 0, 'active', null,
    1, 1, current_date - 30, v_actor, '[]'::jsonb);

  -- 2. A second active contract as primary is rejected.
  v_failed := false;
  begin
    perform public.create_contract_with_handover_and_inventory(
      v_room2, v_primary, v_building, current_date, current_date + 365, 3000000, 0, 5::smallint, 1, 0, 0, 'active', null,
      1, 1, current_date, v_actor, '[]'::jsonb);
  exception when others then v_failed := sqlerrm = 'TENANT_BUSY';
  end;
  if not v_failed then raise exception 'VERIFY 2 failed: second active primary contract accepted'; end if;

  -- 3. Reactivating the expired contract is rejected.
  v_failed := false;
  begin
    update public.contracts set status = 'active' where id = v_expired.id;
  exception when others then v_failed := sqlerrm = 'TENANT_BUSY';
  end;
  if not v_failed then raise exception 'VERIFY 3 failed: reactivation accepted'; end if;

  -- 4. Occupancy rows on the tenant's own contract are allowed; a roommate joins.
  insert into public.contract_occupants (contract_id, tenant_id, role, move_in_date) values (v_active.id, v_primary, 'primary', current_date - 30);
  insert into public.contract_occupants (contract_id, tenant_id, role, move_in_date) values (v_active.id, v_roommate, 'roommate', current_date - 30);

  -- 5. The primary cannot also live on another contract.
  select * into v_other from public.create_contract_with_handover_and_inventory(
    v_room3, v_free, v_building, current_date, current_date + 365, 3000000, 0, 5::smallint, 3, 0, 0, 'active', null,
    1, 1, current_date, v_actor, '[]'::jsonb);
  v_failed := false;
  begin
    insert into public.contract_occupants (contract_id, tenant_id, role, move_in_date) values (v_other.id, v_primary, 'roommate', current_date);
  exception when others then v_failed := sqlerrm = 'TENANT_BUSY';
  end;
  if not v_failed then raise exception 'VERIFY 5 failed: primary added as roommate elsewhere'; end if;

  -- 6. An open roommate cannot become primary of another active contract.
  v_failed := false;
  begin
    update public.contracts set tenant_id = v_roommate where id = v_other.id;
  exception when others then v_failed := sqlerrm = 'TENANT_BUSY';
  end;
  if not v_failed then raise exception 'VERIFY 6 failed: open roommate became primary elsewhere'; end if;

  -- 7. After moving out, the roommate is free again.
  update public.contract_occupants set move_out_date = current_date where contract_id = v_active.id and tenant_id = v_roommate;
  insert into public.contract_occupants (contract_id, tenant_id, role, move_in_date) values (v_other.id, v_roommate, 'roommate', current_date);

  -- 8. Re-opening a closed occupancy while busy elsewhere is rejected.
  v_failed := false;
  begin
    update public.contract_occupants set move_out_date = null where contract_id = v_active.id and tenant_id = v_roommate;
  exception when others then v_failed := sqlerrm = 'TENANT_BUSY';
  end;
  if not v_failed then raise exception 'VERIFY 8 failed: occupancy re-opened while busy'; end if;

  -- 9. Unrelated updates on an active contract still work.
  update public.contracts set notes = 'verify' where id = v_active.id;
  update public.contracts set status = 'active' where id = v_active.id;

  -- 10. Function security.
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('guard_contract_tenant_availability', 'guard_occupant_tenant_availability')
      and (p.prosecdef or not coalesce(p.proconfig && array['search_path=""', 'search_path='], false))
  ) then raise exception 'VERIFY 10 failed: guard functions must be security invoker with empty search_path'; end if;
  if (select count(*) from pg_trigger where tgname in ('contracts_tenant_availability', 'contract_occupants_tenant_availability') and not tgisinternal) <> 2 then
    raise exception 'VERIFY 10 failed: triggers missing';
  end if;

  raise notice 'tenant_availability_guard verification passed';
end $$;

rollback;
