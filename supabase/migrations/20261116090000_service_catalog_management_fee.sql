-- Suggested default price per catalog service, and the "Phí quản lý" catalog item.
-- Data impact: ADDITIVE. New nullable-free column with default 0 (existing rows unchanged) and one catalog row.
-- The suggested amount only seeds building_services.default_amount the first time a building enables the service.

alter table public.service_catalog
  add column if not exists default_amount numeric(12, 0) not null default 0
  check (default_amount >= 0);

insert into public.service_catalog (code, name, pricing_type, unit, sort_order, default_amount)
values ('management_fee', 'Phí quản lý', 'fixed_per_room', null, 9, 200000)
on conflict (code) do nothing;
