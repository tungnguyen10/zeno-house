-- =============================================================================
-- Seed: Sample tenants (append-only)
-- Run in: Supabase Dashboard -> SQL Editor
-- =============================================================================

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.tenants') IS NULL THEN
    RAISE EXCEPTION 'Missing table public.tenants. Apply the tenant migrations first.';
  END IF;

  IF to_regclass('public.tenants_code_uq') IS NULL THEN
    RAISE EXCEPTION 'Missing unique index public.tenants_code_uq. Apply the tenant code migration first.';
  END IF;
END;
$$;

INSERT INTO public.tenants (
  id,
  code,
  full_name,
  phone,
  email,
  id_number,
  date_of_birth,
  gender,
  occupation,
  id_issued_date,
  id_issued_place,
  emergency_contact_name,
  emergency_contact_phone,
  permanent_address,
  notes,
  status
)
VALUES
  (
    '40000000-0000-4000-8000-000000009101',
    'sample-tenant-001',
    'Nguyễn Minh Anh',
    '0901234567',
    'nguyen-minh-anh@example.test',
    '012345678901',
    '1998-05-12',
    'female',
    'Designer',
    '2022-04-18',
    'Hà Nội',
    'Nguyễn Văn Hùng',
    '0911222333',
    '12 Lê Lợi, Quận 1, TP. Hồ Chí Minh',
    'Sample tenant for UI and seed testing.',
    'active'
  ),
  (
    '40000000-0000-4000-8000-000000009102',
    'sample-tenant-002',
    'Trần Quốc Bảo',
    '0902345678',
    'tran-quoc-bao@example.test',
    '012345678902',
    '1995-11-03',
    'male',
    'Developer',
    '2021-09-20',
    'Đà Nẵng',
    'Trần Thị Mai',
    '0912333444',
    '45 Nguyễn Trãi, Quận 5, TP. Hồ Chí Minh',
    'Sample tenant with a long-term contract.',
    'active'
  ),
  (
    '40000000-0000-4000-8000-000000009103',
    'sample-tenant-003',
    'Lê Thị Cẩm Tú',
    '0903456789',
    'le-thi-cam-tu@example.test',
    NULL,
    NULL,
    'female',
    'Student',
    NULL,
    NULL,
    'Lê Văn Nam',
    '0913444555',
    '88 Võ Văn Tần, Quận 3, TP. Hồ Chí Minh',
    'Sample tenant without ID card fields yet.',
    'active'
  ),
  (
    '40000000-0000-4000-8000-000000009104',
    'sample-tenant-004',
    'Phạm Gia Huy',
    '0904567890',
    'pham-gia-huy@example.test',
    '012345678904',
    '2000-01-21',
    'male',
    'Freelancer',
    '2023-03-10',
    'Cần Thơ',
    'Phạm Thị Hương',
    '0914555666',
    '19 Pasteur, TP. Thủ Đức, TP. Hồ Chí Minh',
    'Sample tenant for roommate and billing scenarios.',
    'archived'
  ),
  (
    '40000000-0000-4000-8000-000000009105',
    'sample-tenant-005',
    'Võ Thanh Tâm',
    '0905678901',
    'vo-thanh-tam@example.test',
    '012345678905',
    '1997-08-30',
    'female',
    'Sales',
    '2020-12-14',
    'Huế',
    'Võ Văn Phúc',
    '0915666777',
    '210 Điện Biên Phủ, Quận Bình Thạnh, TP. Hồ Chí Minh',
    'Sample tenant with complete contact information.',
    'active'
  )
ON CONFLICT (code) DO NOTHING;

COMMIT;

SELECT
  code,
  full_name,
  phone,
  status
FROM public.tenants
WHERE code LIKE 'sample-tenant-%'
ORDER BY code;