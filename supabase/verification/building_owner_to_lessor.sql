-- Run in the SQL editor as service_role after the migration; rolled back.
begin;

do $$
declare
  v_actor uuid := (select id from auth.users order by created_at limit 1);
  v_a uuid; v_b uuid; v_c uuid; v_d uuid; v_e uuid;
  v_row public.building_contract_profiles%rowtype;
begin
  insert into public.buildings (name, slug, code, address, status, owner_name, owner_phone, owner_email, created_by)
  values ('OL verify A', 'ol-a-' || substr(gen_random_uuid()::text,1,8), 'ola' || substr(replace(gen_random_uuid()::text,'-',''),1,6),
          '1 Verify', 'active', 'Nguyễn Văn Chủ', '+84 901 234 567', 'Chu@Example.com', v_actor)
  returning id into v_a;
  insert into public.buildings (name, slug, code, address, status, owner_name, owner_phone, created_by)
  values ('OL verify B', 'ol-b-' || substr(gen_random_uuid()::text,1,8), 'olb' || substr(replace(gen_random_uuid()::text,'-',''),1,6),
          '2 Verify', 'active', 'X', 'abc', v_actor)
  returning id into v_b;
  insert into public.buildings (name, slug, code, address, status, owner_name, owner_phone, created_by)
  values ('OL verify C', 'ol-c-' || substr(gen_random_uuid()::text,1,8), 'olc' || substr(replace(gen_random_uuid()::text,'-',''),1,6),
          '3 Verify', 'active', 'Chủ Mới', '0901.111.222', v_actor)
  returning id into v_c;
  insert into public.buildings (name, slug, code, address, status, owner_name, owner_phone, created_by)
  values ('OL verify D', 'ol-d-' || substr(gen_random_uuid()::text,1,8), 'old' || substr(replace(gen_random_uuid()::text,'-',''),1,6),
          '4 Verify', 'active', 'John Smith', '+1 (415) 555-2671', v_actor)
  returning id into v_d;
  insert into public.buildings (name, slug, code, address, status, owner_name, owner_phone, created_by)
  values ('OL verify E', 'ol-e-' || substr(gen_random_uuid()::text,1,8), 'ole' || substr(replace(gen_random_uuid()::text,'-',''),1,6),
          '5 Verify', 'active', 'Alice Brown', '+84 12345', v_actor)
  returning id into v_e;
  insert into public.building_contract_profiles (building_id, lessor_full_name) values (v_c, 'Người Ký Cũ');

  -- Re-run the fold body against the fixtures.
  with src as (
    select b.id as building_id,
      case when length(btrim(b.owner_name)) between 2 and 100 then btrim(b.owner_name) end as full_name,
      case
        when regexp_replace(b.owner_phone, '[[:space:].()-]', '', 'g') ~ '^0[0-9]{9}$' then regexp_replace(b.owner_phone, '[[:space:].()-]', '', 'g')
        when regexp_replace(b.owner_phone, '[[:space:].()-]', '', 'g') ~ '^\+?84[0-9]{9}$' then '0' || right(regexp_replace(b.owner_phone, '[[:space:].()-]', '', 'g'), 9)
        when regexp_replace(b.owner_phone, '[[:space:].()-]', '', 'g') ~ '^\+[1-9][0-9]{7,14}$'
          and not regexp_replace(b.owner_phone, '[[:space:].()-]', '', 'g') like '+84%' then regexp_replace(b.owner_phone, '[[:space:].()-]', '', 'g')
      end as phone,
      case when length(btrim(b.owner_email)) <= 254 and btrim(b.owner_email) ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
        then lower(btrim(b.owner_email)) end as email
    from public.buildings b where b.id in (v_a, v_b, v_c, v_d, v_e)
  )
  insert into public.building_contract_profiles (building_id, lessor_full_name, lessor_phone, lessor_email)
  select building_id, full_name, phone, email from src where coalesce(full_name, phone, email) is not null
  on conflict (building_id) do update set
    lessor_full_name = coalesce(public.building_contract_profiles.lessor_full_name, excluded.lessor_full_name),
    lessor_phone = coalesce(public.building_contract_profiles.lessor_phone, excluded.lessor_phone),
    lessor_email = coalesce(public.building_contract_profiles.lessor_email, excluded.lessor_email);

  select * into v_row from public.building_contract_profiles where building_id = v_a;
  if v_row.lessor_full_name <> 'Nguyễn Văn Chủ' or v_row.lessor_phone <> '0901234567' or v_row.lessor_email <> 'chu@example.com' then
    raise exception 'VERIFY 1 failed: normalized copy %', row_to_json(v_row);
  end if;

  if exists (select 1 from public.building_contract_profiles where building_id = v_b) then
    raise exception 'VERIFY 2 failed: invalid owner values created a profile';
  end if;

  select * into v_row from public.building_contract_profiles where building_id = v_c;
  if v_row.lessor_full_name <> 'Người Ký Cũ' or v_row.lessor_phone <> '0901111222' then
    raise exception 'VERIFY 3 failed: overwrite or missing fill %', row_to_json(v_row);
  end if;

  select * into v_row from public.building_contract_profiles where building_id = v_d;
  if v_row.lessor_full_name <> 'John Smith' or v_row.lessor_phone <> '+14155552671' then
    raise exception 'VERIFY 4 failed: international phone not copied %', row_to_json(v_row);
  end if;

  if exists (select 1 from public.building_contract_profiles where building_id = v_e and lessor_phone is not null) then
    raise exception 'VERIFY 5 failed: invalid +84 format should not create phone';
  end if;

  raise notice 'owner → lessor verification passed';
end $$;

select
  count(*) filter (where coalesce(b.owner_name, b.owner_phone, b.owner_email) is not null) as buildings_with_owner,
  count(p.building_id) filter (where p.lessor_full_name is not null) as profiles_with_name,
  count(p.building_id) filter (where p.lessor_email is not null) as profiles_with_email,
  count(*) filter (where b.owner_phone is not null and p.lessor_phone is null) as owner_phone_skipped
from public.buildings b
left join public.building_contract_profiles p on p.building_id = b.id;

rollback;
