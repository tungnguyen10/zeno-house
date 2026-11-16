-- Verification for building_contract_profiles (V2 PR1). Run as service_role; rolled back.
begin;

do $$
declare
  v_building uuid := (select id from public.buildings order by created_at limit 1);
  v_failed boolean;
begin
  if v_building is null then raise exception 'VERIFY: need at least one building'; end if;

  insert into public.building_contract_profiles (building_id, lessor_full_name, lessor_id_number)
  values (v_building, 'Nguyễn Văn A', '012345678901')
  on conflict (building_id) do update set lessor_full_name = excluded.lessor_full_name;

  v_failed := false;
  begin
    update public.building_contract_profiles set lessor_id_number = '12AB' where building_id = v_building;
  exception when check_violation then v_failed := true;
  end;
  if not v_failed then raise exception 'VERIFY 1 failed: invalid id number accepted'; end if;

  v_failed := false;
  begin
    update public.building_contract_profiles set signed_copies = 1, copies_per_party = 1 where building_id = v_building;
  exception when check_violation then v_failed := true;
  end;
  if not v_failed then raise exception 'VERIFY 2 failed: copies constraint not enforced'; end if;

  raise notice 'building_contract_profiles constraint checks passed';
end $$;

select
  has_table_privilege('anon', 'public.building_contract_profiles', 'select') as anon_select,
  has_table_privilege('authenticated', 'public.building_contract_profiles', 'select') as auth_select,
  has_table_privilege('service_role', 'public.building_contract_profiles', 'select') as service_select,
  (select count(*) from pg_policies where tablename = 'building_contract_profiles') as policy_count;
-- Expected: false, false, true, 0.

rollback;
