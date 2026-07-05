begin;

alter table public.building_fixed_costs
  drop constraint if exists building_fixed_costs_category_check;

alter table public.building_fixed_costs
  add constraint building_fixed_costs_category_check
  check (category in (
    'rent',
    'internet',
    'cleaning',
    'staff',
    'insurance',
    'bank_fee',
    'fire_safety',
    'admin_fee',
    'supplies',
    'other'
  ));

commit;
