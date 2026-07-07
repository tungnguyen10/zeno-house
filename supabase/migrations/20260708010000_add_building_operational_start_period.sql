begin;

alter table public.buildings
  add column if not exists operational_start_year integer,
  add column if not exists operational_start_month integer;

alter table public.buildings
  drop constraint if exists buildings_operational_start_month_range_check,
  add constraint buildings_operational_start_month_range_check
    check (
      operational_start_month is null
      or operational_start_month between 1 and 12
    );

alter table public.buildings
  drop constraint if exists buildings_operational_start_year_range_check,
  add constraint buildings_operational_start_year_range_check
    check (
      operational_start_year is null
      or operational_start_year between 2000 and 2100
    );

alter table public.buildings
  drop constraint if exists buildings_operational_start_pair_check,
  add constraint buildings_operational_start_pair_check
    check (
      (operational_start_year is null and operational_start_month is null)
      or (operational_start_year is not null and operational_start_month is not null)
    );

commit;
