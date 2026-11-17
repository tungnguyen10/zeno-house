-- Folds building owner contact into the lessor profile (single source). Additive only:
-- buildings.owner_* stay until a later migration removes them.
-- Phones are copied only when they pass the app's phone validator: VN mobile (0XX format),
-- +84 form (converted to 0XX), or +international (8-15 digits); other values are skipped.
begin;

alter table public.building_contract_profiles
  add column if not exists lessor_email text
  check (lessor_email is null or (length(lessor_email) <= 254 and lessor_email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[A-Za-z]{2,}$'));

with src as (
  select
    b.id as building_id,
    case when length(btrim(b.owner_name)) between 2 and 100 then btrim(b.owner_name) end as full_name,
    case
      when regexp_replace(b.owner_phone, '[[:space:].()-]', '', 'g') ~ '^0[0-9]{9}$'
        then regexp_replace(b.owner_phone, '[[:space:].()-]', '', 'g')
      when regexp_replace(b.owner_phone, '[[:space:].()-]', '', 'g') ~ '^\+?84[0-9]{9}$'
        then '0' || right(regexp_replace(b.owner_phone, '[[:space:].()-]', '', 'g'), 9)
      when regexp_replace(b.owner_phone, '[[:space:].()-]', '', 'g') ~ '^\+[1-9][0-9]{7,14}$'
        and not regexp_replace(b.owner_phone, '[[:space:].()-]', '', 'g') like '+84%'
        then regexp_replace(b.owner_phone, '[[:space:].()-]', '', 'g')
    end as phone,
    case
      when length(btrim(b.owner_email)) <= 254
        and btrim(b.owner_email) ~* '^[^@[:space:]]+@[^@[:space:]]+\.[A-Za-z]{2,}$'
        then lower(btrim(b.owner_email))
    end as email
  from public.buildings b
)
insert into public.building_contract_profiles (building_id, lessor_full_name, lessor_phone, lessor_email)
select building_id, full_name, phone, email
from src
where coalesce(full_name, phone, email) is not null
on conflict (building_id) do update set
  lessor_full_name = coalesce(public.building_contract_profiles.lessor_full_name, excluded.lessor_full_name),
  lessor_phone = coalesce(public.building_contract_profiles.lessor_phone, excluded.lessor_phone),
  lessor_email = coalesce(public.building_contract_profiles.lessor_email, excluded.lessor_email)
where (public.building_contract_profiles.lessor_full_name is null and excluded.lessor_full_name is not null)
  or (public.building_contract_profiles.lessor_phone is null and excluded.lessor_phone is not null)
  or (public.building_contract_profiles.lessor_email is null and excluded.lessor_email is not null);

commit;
