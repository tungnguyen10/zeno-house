-- =============================================================================
-- Reset demo data for Zeno House
-- =============================================================================
-- Purpose:
--   Wipe application data in public tables and seed a small, coherent dataset
--   for local/dev verification.
--
-- Scope:
--   - Does NOT delete auth.users.
--   - Does NOT alter schema, RLS policies, triggers, or migrations.
--   - Re-seeds service_catalog because it is public app data.
--   - Requires the monthly billing SQL to have been applied already.
--
-- Usage:
--   Run manually in Supabase Dashboard SQL Editor or via psql against a
--   development database only.
--
-- Demo period:
--   Previous readings: 2026-05
--   Current workspace: 2026-06
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- Required schema guard
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_missing text[];
BEGIN
  SELECT array_agg(table_name ORDER BY table_name)
  INTO v_missing
  FROM (
    VALUES
      ('public.billing_audit_events'),
      ('public.invoice_payments'),
      ('public.invoice_charges'),
      ('public.invoices'),
      ('public.billing_utility_usages'),
      ('public.billing_periods'),
      ('public.meter_readings'),
      ('public.contract_services'),
      ('public.building_services'),
      ('public.contract_payments'),
      ('public.contract_renewals'),
      ('public.contract_occupants'),
      ('public.contracts'),
      ('public.rooms'),
      ('public.tenants'),
      ('public.buildings'),
      ('public.service_catalog')
  ) AS required(table_name)
  WHERE to_regclass(required.table_name) IS NULL;

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION
      'Missing required tables: %. Apply the project migrations/manual Supabase SQL before running reset_demo_data.sql.',
      array_to_string(v_missing, ', ');
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Preflight counts
-- -----------------------------------------------------------------------------
SELECT table_name, row_count
FROM (
  SELECT 'billing_audit_events' AS table_name, COUNT(*) AS row_count FROM public.billing_audit_events
  UNION ALL SELECT 'invoice_payments', COUNT(*) FROM public.invoice_payments
  UNION ALL SELECT 'invoice_charges', COUNT(*) FROM public.invoice_charges
  UNION ALL SELECT 'invoices', COUNT(*) FROM public.invoices
  UNION ALL SELECT 'billing_utility_usages', COUNT(*) FROM public.billing_utility_usages
  UNION ALL SELECT 'billing_periods', COUNT(*) FROM public.billing_periods
  UNION ALL SELECT 'meter_readings', COUNT(*) FROM public.meter_readings
  UNION ALL SELECT 'contract_services', COUNT(*) FROM public.contract_services
  UNION ALL SELECT 'building_services', COUNT(*) FROM public.building_services
  UNION ALL SELECT 'contract_payments', COUNT(*) FROM public.contract_payments
  UNION ALL SELECT 'contract_renewals', COUNT(*) FROM public.contract_renewals
  UNION ALL SELECT 'contract_occupants', COUNT(*) FROM public.contract_occupants
  UNION ALL SELECT 'contracts', COUNT(*) FROM public.contracts
  UNION ALL SELECT 'rooms', COUNT(*) FROM public.rooms
  UNION ALL SELECT 'tenants', COUNT(*) FROM public.tenants
  UNION ALL SELECT 'buildings', COUNT(*) FROM public.buildings
  UNION ALL SELECT 'service_catalog', COUNT(*) FROM public.service_catalog
) counts
ORDER BY table_name;

-- -----------------------------------------------------------------------------
-- Wipe app data
-- -----------------------------------------------------------------------------
TRUNCATE TABLE
  public.billing_audit_events,
  public.invoice_payments,
  public.invoice_charges,
  public.invoices,
  public.billing_utility_usages,
  public.billing_periods,
  public.meter_readings,
  public.contract_services,
  public.building_services,
  public.contract_payments,
  public.contract_renewals,
  public.contract_occupants,
  public.contracts,
  public.rooms,
  public.tenants,
  public.buildings,
  public.service_catalog
RESTART IDENTITY CASCADE;

-- -----------------------------------------------------------------------------
-- Catalog
-- -----------------------------------------------------------------------------
INSERT INTO public.service_catalog (id, code, name, pricing_type, unit, sort_order)
VALUES
  ('10000000-0000-4000-8000-000000000001', 'internet',          'Internet',       'fixed_per_room', NULL,     1),
  ('10000000-0000-4000-8000-000000000002', 'garbage',           'Garbage',        'per_person',     'person', 2),
  ('10000000-0000-4000-8000-000000000003', 'parking_motorbike', 'Motorbike park', 'per_vehicle',    'bike',   3),
  ('10000000-0000-4000-8000-000000000004', 'parking_bicycle',   'Bicycle park',   'per_vehicle',    'bike',   4),
  ('10000000-0000-4000-8000-000000000005', 'cleaning',          'Cleaning',       'fixed_per_room', NULL,     5),
  ('10000000-0000-4000-8000-000000000006', 'elevator',          'Elevator',       'per_person',     'person', 6),
  ('10000000-0000-4000-8000-000000000007', 'surcharge',         'Surcharge',      'fixed_per_room', NULL,     7),
  ('10000000-0000-4000-8000-000000000008', 'other',             'Other',          'fixed_per_room', NULL,     8);

-- -----------------------------------------------------------------------------
-- Buildings
-- -----------------------------------------------------------------------------
INSERT INTO public.buildings (
  id,
  name,
  address,
  description,
  status,
  owner_name,
  owner_phone,
  owner_email,
  electricity_pricing_type,
  default_electricity_rate,
  water_pricing_type,
  default_water_rate,
  meter_reading_day,
  billing_generation_day,
  payment_due_day,
  grace_period_days
)
VALUES
  (
    '20000000-0000-4000-8000-000000000001',
    'Zeno House Tan Binh',
    '12 Demo Street, Tan Binh, Ho Chi Minh City',
    'Main demo building for monthly billing flow.',
    'active',
    'Nguyen Demo',
    '0900000001',
    'owner.tanbinh@example.test',
    'per_kwh',
    3500,
    'per_m3',
    14000,
    28,
    30,
    5,
    3
  ),
  (
    '20000000-0000-4000-8000-000000000002',
    'Zeno House Phu Nhuan',
    '88 Sample Avenue, Phu Nhuan, Ho Chi Minh City',
    'Secondary demo building with per-person water.',
    'active',
    'Tran Demo',
    '0900000002',
    'owner.phunhuan@example.test',
    'per_kwh',
    3800,
    'per_person',
    80000,
    27,
    30,
    7,
    3
  );

-- -----------------------------------------------------------------------------
-- Rooms
-- -----------------------------------------------------------------------------
INSERT INTO public.rooms (id, building_id, room_number, floor, status, monthly_rent, area, description)
VALUES
  ('30000000-0000-4000-8000-000000000101', '20000000-0000-4000-8000-000000000001', 'A101', 1, 'occupied',    2800000, 22.5, 'Window room near stairs'),
  ('30000000-0000-4000-8000-000000000102', '20000000-0000-4000-8000-000000000001', 'A102', 1, 'occupied',    3000000, 24.0, 'Balcony room'),
  ('30000000-0000-4000-8000-000000000103', '20000000-0000-4000-8000-000000000001', 'A103', 1, 'available',   2900000, 23.0, 'Vacant baseline room'),
  ('30000000-0000-4000-8000-000000000201', '20000000-0000-4000-8000-000000000002', 'B201', 2, 'occupied',    3500000, 28.0, 'Large room'),
  ('30000000-0000-4000-8000-000000000202', '20000000-0000-4000-8000-000000000002', 'B202', 2, 'available',   3300000, 26.0, 'Vacant baseline room');

-- -----------------------------------------------------------------------------
-- Tenants
-- -----------------------------------------------------------------------------
INSERT INTO public.tenants (
  id,
  full_name,
  phone,
  email,
  id_number,
  date_of_birth,
  permanent_address,
  notes,
  gender,
  occupation,
  id_issued_date,
  id_issued_place,
  emergency_contact_name,
  emergency_contact_phone
)
VALUES
  ('40000000-0000-4000-8000-000000000001', 'Nguyen Minh An', '0911000001', 'an.nguyen@example.test', '079200000001', '1996-03-12', 'District 1, Ho Chi Minh City', 'Primary tenant for A101', 'male', 'Designer', '2021-03-20', 'Ho Chi Minh City Police', 'Nguyen Thi Binh', '0988000001'),
  ('40000000-0000-4000-8000-000000000002', 'Le Hoang Bao',  '0911000002', 'bao.le@example.test',     '079200000002', '1994-08-21', 'District 3, Ho Chi Minh City', 'Roommate for A101',       'male', 'Engineer', '2020-09-10', 'Ho Chi Minh City Police', 'Le Thi Hoa',      '0988000002'),
  ('40000000-0000-4000-8000-000000000003', 'Pham Thu Chi',  '0911000003', 'chi.pham@example.test',   '079200000003', '1998-11-05', 'Thu Duc, Ho Chi Minh City',    'Primary tenant for A102', 'female', 'Accountant', '2022-01-15', 'Ho Chi Minh City Police', 'Pham Van Son',    '0988000003'),
  ('40000000-0000-4000-8000-000000000004', 'Tran Quoc Duy', '0911000004', 'duy.tran@example.test',   '079200000004', '1992-05-30', 'Binh Thanh, Ho Chi Minh City', 'Primary tenant for B201', 'male', 'Sales', '2019-07-09', 'Ho Chi Minh City Police', 'Tran Thi Mai',    '0988000004');

-- -----------------------------------------------------------------------------
-- Contracts
-- -----------------------------------------------------------------------------
INSERT INTO public.contracts (
  id,
  room_id,
  tenant_id,
  building_id,
  start_date,
  end_date,
  monthly_rent,
  deposit,
  status,
  notes,
  occupant_count,
  discount_amount,
  surcharge_amount,
  payment_day,
  original_end_date,
  renewal_count
)
VALUES
  (
    '50000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000101',
    '40000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '2026-04-01',
    '2027-03-31',
    2800000,
    2800000,
    'active',
    'A101 active demo contract with two occupants.',
    2,
    0,
    0,
    5,
    '2027-03-31',
    0
  ),
  (
    '50000000-0000-4000-8000-000000000002',
    '30000000-0000-4000-8000-000000000102',
    '40000000-0000-4000-8000-000000000003',
    '20000000-0000-4000-8000-000000000001',
    '2026-05-15',
    '2027-05-14',
    3000000,
    3000000,
    'active',
    'A102 intentionally missing June readings for blocker testing.',
    1,
    100000,
    0,
    5,
    '2027-05-14',
    0
  ),
  (
    '50000000-0000-4000-8000-000000000003',
    '30000000-0000-4000-8000-000000000201',
    '40000000-0000-4000-8000-000000000004',
    '20000000-0000-4000-8000-000000000002',
    '2026-03-01',
    '2027-02-28',
    3500000,
    3500000,
    'active',
    'B201 active demo contract using per-person water.',
    1,
    0,
    50000,
    7,
    '2027-02-28',
    0
  );

-- -----------------------------------------------------------------------------
-- Contract occupants
-- -----------------------------------------------------------------------------
INSERT INTO public.contract_occupants (
  id,
  contract_id,
  tenant_id,
  role,
  move_in_date,
  move_out_date,
  billing_counted
)
VALUES
  ('60000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 'primary',  '2026-04-01', NULL, true),
  ('60000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000002', 'roommate', '2026-04-01', NULL, true),
  ('60000000-0000-4000-8000-000000000003', '50000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000003', 'primary',  '2026-05-15', NULL, true),
  ('60000000-0000-4000-8000-000000000004', '50000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000004', 'primary',  '2026-03-01', NULL, true);

-- -----------------------------------------------------------------------------
-- Building service defaults
-- -----------------------------------------------------------------------------
INSERT INTO public.building_services (
  id,
  building_id,
  catalog_id,
  default_amount,
  pricing_type,
  is_active,
  sort_order
)
VALUES
  ('70000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 120000, 'fixed_per_room', true, 1),
  ('70000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 30000,  'per_person',     true, 2),
  ('70000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', 150000, 'per_vehicle',    true, 3),
  ('70000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 150000, 'fixed_per_room', true, 1),
  ('70000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000005', 50000,  'fixed_per_room', true, 2);

-- -----------------------------------------------------------------------------
-- Contract services
-- -----------------------------------------------------------------------------
INSERT INTO public.contract_services (
  id,
  contract_id,
  catalog_id,
  amount,
  quantity,
  is_enabled,
  notes
)
VALUES
  ('71000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 120000, 1, true, 'Internet'),
  ('71000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 30000,  2, true, 'Garbage by occupants'),
  ('71000000-0000-4000-8000-000000000003', '50000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', 150000, 1, true, 'One motorbike'),
  ('71000000-0000-4000-8000-000000000004', '50000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 120000, 1, true, 'Internet'),
  ('71000000-0000-4000-8000-000000000005', '50000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 30000,  1, true, 'Garbage'),
  ('71000000-0000-4000-8000-000000000006', '50000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 150000, 1, true, 'Internet'),
  ('71000000-0000-4000-8000-000000000007', '50000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000005', 50000,  1, true, 'Cleaning');

-- -----------------------------------------------------------------------------
-- Contract-level payments, distinct from invoice payments
-- -----------------------------------------------------------------------------
INSERT INTO public.contract_payments (
  id,
  contract_id,
  payment_type,
  amount,
  paid_at,
  note
)
VALUES
  ('72000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', 'deposit',      2800000, '2026-04-01', 'Initial deposit'),
  ('72000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000002', 'deposit',      3000000, '2026-05-15', 'Initial deposit'),
  ('72000000-0000-4000-8000-000000000003', '50000000-0000-4000-8000-000000000003', 'deposit',      3500000, '2026-03-01', 'Initial deposit'),
  ('72000000-0000-4000-8000-000000000004', '50000000-0000-4000-8000-000000000003', 'prepaid_rent', 1000000, '2026-03-01', 'Legacy prepaid balance');

-- -----------------------------------------------------------------------------
-- Meter readings
-- Current June readings are intentionally incomplete for A102 so the billing
-- workspace has one blocker row to test.
-- -----------------------------------------------------------------------------
INSERT INTO public.meter_readings (
  id,
  room_id,
  building_id,
  meter_type,
  reading_type,
  period_year,
  period_month,
  reading_date,
  reading_value,
  is_estimated,
  notes
)
VALUES
  -- May baselines
  ('80000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000101', '20000000-0000-4000-8000-000000000001', 'electricity', 'monthly', 2026, 5, '2026-05-28', 3669, false, 'May electricity baseline'),
  ('80000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000101', '20000000-0000-4000-8000-000000000001', 'water',       'monthly', 2026, 5, '2026-05-28', 507,  false, 'May water baseline'),
  ('80000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000102', '20000000-0000-4000-8000-000000000001', 'electricity', 'monthly', 2026, 5, '2026-05-28', 2140, false, 'May electricity baseline'),
  ('80000000-0000-4000-8000-000000000004', '30000000-0000-4000-8000-000000000102', '20000000-0000-4000-8000-000000000001', 'water',       'monthly', 2026, 5, '2026-05-28', 318,  false, 'May water baseline'),
  ('80000000-0000-4000-8000-000000000005', '30000000-0000-4000-8000-000000000103', '20000000-0000-4000-8000-000000000001', 'electricity', 'monthly', 2026, 5, '2026-05-28', 980,  false, 'May vacant baseline'),
  ('80000000-0000-4000-8000-000000000006', '30000000-0000-4000-8000-000000000103', '20000000-0000-4000-8000-000000000001', 'water',       'monthly', 2026, 5, '2026-05-28', 121,  false, 'May vacant baseline'),
  ('80000000-0000-4000-8000-000000000007', '30000000-0000-4000-8000-000000000201', '20000000-0000-4000-8000-000000000002', 'electricity', 'monthly', 2026, 5, '2026-05-27', 5240, false, 'May electricity baseline'),

  -- June current readings
  ('80000000-0000-4000-8000-000000000101', '30000000-0000-4000-8000-000000000101', '20000000-0000-4000-8000-000000000001', 'electricity', 'monthly', 2026, 6, '2026-06-28', 3823, false, 'June current reading'),
  ('80000000-0000-4000-8000-000000000102', '30000000-0000-4000-8000-000000000101', '20000000-0000-4000-8000-000000000001', 'water',       'monthly', 2026, 6, '2026-06-28', 511,  false, 'June current reading'),
  ('80000000-0000-4000-8000-000000000103', '30000000-0000-4000-8000-000000000103', '20000000-0000-4000-8000-000000000001', 'electricity', 'monthly', 2026, 6, '2026-06-28', 990,  false, 'Optional vacant baseline'),
  ('80000000-0000-4000-8000-000000000104', '30000000-0000-4000-8000-000000000103', '20000000-0000-4000-8000-000000000001', 'water',       'monthly', 2026, 6, '2026-06-28', 121,  false, 'Optional vacant baseline'),
  ('80000000-0000-4000-8000-000000000105', '30000000-0000-4000-8000-000000000201', '20000000-0000-4000-8000-000000000002', 'electricity', 'monthly', 2026, 6, '2026-06-27', 5322, false, 'June current reading');

-- -----------------------------------------------------------------------------
-- Billing periods
-- -----------------------------------------------------------------------------
INSERT INTO public.billing_periods (
  id,
  building_id,
  period_year,
  period_month,
  status
)
VALUES
  ('90000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 2026, 6, 'readings'),
  ('90000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 2026, 6, 'review');

-- -----------------------------------------------------------------------------
-- Billing audit events
-- -----------------------------------------------------------------------------
INSERT INTO public.billing_audit_events (
  id,
  billing_period_id,
  action,
  entity_type,
  entity_id,
  metadata
)
VALUES
  (
    '91000000-0000-4000-8000-000000000001',
    '90000000-0000-4000-8000-000000000001',
    'period_opened',
    'billing_period',
    '90000000-0000-4000-8000-000000000001',
    '{"source":"reset_demo_data"}'::jsonb
  ),
  (
    '91000000-0000-4000-8000-000000000002',
    '90000000-0000-4000-8000-000000000002',
    'period_opened',
    'billing_period',
    '90000000-0000-4000-8000-000000000002',
    '{"source":"reset_demo_data"}'::jsonb
  );

-- -----------------------------------------------------------------------------
-- Post-seed counts
-- -----------------------------------------------------------------------------
SELECT table_name, row_count
FROM (
  SELECT 'buildings' AS table_name, COUNT(*) AS row_count FROM public.buildings
  UNION ALL SELECT 'rooms', COUNT(*) FROM public.rooms
  UNION ALL SELECT 'tenants', COUNT(*) FROM public.tenants
  UNION ALL SELECT 'contracts', COUNT(*) FROM public.contracts
  UNION ALL SELECT 'contract_occupants', COUNT(*) FROM public.contract_occupants
  UNION ALL SELECT 'building_services', COUNT(*) FROM public.building_services
  UNION ALL SELECT 'contract_services', COUNT(*) FROM public.contract_services
  UNION ALL SELECT 'contract_payments', COUNT(*) FROM public.contract_payments
  UNION ALL SELECT 'meter_readings', COUNT(*) FROM public.meter_readings
  UNION ALL SELECT 'billing_periods', COUNT(*) FROM public.billing_periods
  UNION ALL SELECT 'billing_audit_events', COUNT(*) FROM public.billing_audit_events
  UNION ALL SELECT 'service_catalog', COUNT(*) FROM public.service_catalog
) counts
ORDER BY table_name;

COMMIT;
