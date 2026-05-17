-- Migration: Add operational config columns to buildings
-- v0.2.5 — Building Operational Config

begin;

alter table public.buildings
  add column if not exists owner_name                 text,
  add column if not exists owner_phone                text,
  add column if not exists owner_email                text,
  add column if not exists electricity_pricing_type   text not null default 'per_kwh'
                                                       check (electricity_pricing_type in ('per_kwh', 'fixed', 'tiered')),
  add column if not exists default_electricity_rate   numeric(12,2),
  add column if not exists water_pricing_type         text not null default 'per_m3'
                                                       check (water_pricing_type in ('per_m3', 'per_person', 'fixed_per_room')),
  add column if not exists default_water_rate         numeric(12,2),
  add column if not exists default_service_fees       jsonb,
  add column if not exists meter_reading_day          integer check (meter_reading_day between 1 and 31),
  add column if not exists billing_generation_day     integer check (billing_generation_day between 1 and 31),
  add column if not exists payment_due_day            integer check (payment_due_day between 1 and 31),
  add column if not exists grace_period_days          integer not null default 0 check (grace_period_days >= 0);

commit;
