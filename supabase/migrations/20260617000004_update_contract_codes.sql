begin;

-- Migrate contract_code from hd-YYYY-NNNN → hd-{buildingCode}-YYYY-NNNN
-- Extract year and sequence from existing code, prepend building code
update public.contracts c
set contract_code = 'hd-' || b.code || '-' ||
  -- Extract year part from old format "hd-YYYY-NNNN"
  split_part(c.contract_code, '-', 2) || '-' ||
  -- Extract sequence part from old format
  split_part(c.contract_code, '-', 3)
from public.rooms r
join public.buildings b on b.id = r.building_id
where c.room_id = r.id
  and c.contract_code ~ '^hd-[0-9]{4}-[0-9]{4}$';

-- Verify: all codes now match new pattern (will raise if any old codes remain)
do $$
begin
  if exists (
    select 1 from public.contracts
    where contract_code !~ '^hd-[a-z0-9]+-[0-9]{4}-[0-9]{4}$'
  ) then
    raise exception 'Some contract codes do not match expected pattern after migration';
  end if;
end $$;

commit;
