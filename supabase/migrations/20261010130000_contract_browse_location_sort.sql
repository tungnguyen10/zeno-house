-- Flatten contract display and sort fields so location ordering happens before
-- PostgREST applies the page range. The billing collation provides numeric room
-- ordering, including room 2 before room 10.
create view public.contract_browse_rows with (security_invoker = true) as
select
  c.*,
  r.room_number,
  r.floor as room_floor,
  r.code as room_code,
  r.building_id as room_building_id,
  b.name as building_name,
  t.full_name as tenant_name,
  t.phone as tenant_phone,
  t.code as tenant_code,
  b.name collate public.billing_natural_vi as building_sort_name,
  r.room_number collate public.billing_natural_vi as room_sort_number,
  c.contract_code collate public.billing_natural_vi as contract_sort_code
from public.contracts c
join public.rooms r on r.id = c.room_id
left join public.buildings b on b.id = r.building_id
left join public.tenants t on t.id = c.tenant_id;

revoke all on public.contract_browse_rows from public, anon, authenticated;
grant select on public.contract_browse_rows to service_role;
