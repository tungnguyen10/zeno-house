-- =============================================================================
-- Seed: QA data for the V2 end-to-end flow (disposable, fake personal data)
-- Building slug: qa-v2-flow. Remove it with the recursive purge by slug when done.
-- Idempotent: safe to rerun.
-- =============================================================================

begin;

insert into public.buildings (
  id, name, address, description, status, slug, code,
  created_by, owner_user_id,
  electricity_pricing_type, default_electricity_rate, water_pricing_type, default_water_rate,
  meter_reading_day, billing_generation_day, payment_due_day, grace_period_days
) values (
  '50000000-0000-4000-8000-000000000001',
  'QA V2 Flow Building',
  '1 Duong QA, Quan 1, TP. Ho Chi Minh',
  'QA only - disposable, created for the V2 end-to-end flow test.',
  'active', 'qa-v2-flow', 'qav2',
  '4a4e10c3-9e1a-408d-a671-7906538a301c', '4a4e10c3-9e1a-408d-a671-7906538a301c',
  'per_kwh', 3500, 'per_m3', 15000,
  28, 1, 5, 3
) on conflict (id) do nothing;

insert into public.rooms (id, building_id, room_number, slug, code, floor, status, monthly_rent, area)
values
  ('50000000-0000-4000-8000-000000000101', '50000000-0000-4000-8000-000000000001', '101', '101', 'qav2-101', 1, 'available', 3500000, 20),
  ('50000000-0000-4000-8000-000000000102', '50000000-0000-4000-8000-000000000001', '102', '102', 'qav2-102', 1, 'available', 3500000, 20),
  ('50000000-0000-4000-8000-000000000103', '50000000-0000-4000-8000-000000000001', '103', '103', 'qav2-103', 1, 'available', 4000000, 25),
  ('50000000-0000-4000-8000-000000000201', '50000000-0000-4000-8000-000000000001', '201', '201', 'qav2-201', 2, 'available', 4200000, 25),
  ('50000000-0000-4000-8000-000000000202', '50000000-0000-4000-8000-000000000001', '202', '202', 'qav2-202', 2, 'available', 4200000, 25),
  ('50000000-0000-4000-8000-000000000203', '50000000-0000-4000-8000-000000000001', '203', '203', 'qav2-203', 2, 'available', 4500000, 30)
on conflict (id) do nothing;

insert into public.building_contract_profiles (
  building_id, lessor_full_name, lessor_date_of_birth, lessor_permanent_address,
  lessor_id_number, lessor_id_issued_date, lessor_id_issued_place, lessor_phone, brand_name,
  default_term_months, default_deposit_months, notice_days, deposit_refund_days, renewal_months,
  extra_occupant_fee, drilling_fee, fingerprint_reset_fee, signed_copies, copies_per_party
) values (
  '50000000-0000-4000-8000-000000000001', 'Nguyen Van QA', '1985-01-15', '1 Duong QA, Quan 1, TP. Ho Chi Minh',
  '079000000001', '2020-06-01', 'Cuc Canh sat QLHC ve TTXH', '0900000001', 'QA House',
  12, 1.5, 30, 15, 6,
  100000, 200000, 50000, 2, 1
) on conflict (building_id) do nothing;

insert into public.building_inventory_templates (building_id, name, quantity, condition, unit_value, sort_order)
values
  ('50000000-0000-4000-8000-000000000001', 'Giuong', 1, 'good', 1500000, 1),
  ('50000000-0000-4000-8000-000000000001', 'Tu quan ao', 1, 'good', 1200000, 2),
  ('50000000-0000-4000-8000-000000000001', 'May lanh', 1, 'used', 4000000, 3),
  ('50000000-0000-4000-8000-000000000001', 'Quat tran', 1, 'good', 500000, 4)
on conflict do nothing;

-- Tenants are global (no building FK); three free tenants for pick/duplicate scenarios.
insert into public.tenants (id, code, full_name, phone, email, id_number, date_of_birth, status)
values
  ('50000000-0000-4000-8000-000000000a01', 'qa-v2-tenant-001', 'Le Thi QA Mot', '0900000101', 'qa-v2-001@example.test', '079100000001', '1995-03-10', 'active'),
  ('50000000-0000-4000-8000-000000000a02', 'qa-v2-tenant-002', 'Tran Van QA Hai', '0900000102', 'qa-v2-002@example.test', null, null, 'active'),
  ('50000000-0000-4000-8000-000000000a03', 'qa-v2-tenant-003', 'Pham Thi QA Ba', '0900000103', null, null, null, 'active')
on conflict (id) do nothing;

commit;
