-- =============================================================================
-- Seed: 88DDA tenants from resident information form (append-only, minimal tenant fields)
-- Source file: 88_13 PHIEU THU THAP THONG TIN NGUOI DAN (Responses).xlsx
-- Rows: 12 (excluding Hoàng Lam Thi)
-- Source building_id: d1fc170d-8af8-474e-b59a-faf1c131d994
-- Source building code: znpn
-- This seed creates tenants only; no contracts are seeded here.
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
  id_number,
  date_of_birth,
  gender,
  occupation,
  permanent_address,
  status
)
VALUES
  (
    '40000000-0000-4000-8000-000000088002',
    '88dda-tenant-002',
    'Văn Thảo Trang',
    '0788977224',
    '091300009201',
    '2000-02-15',
    'female',
    'Hồ Chí Minh',
    'Lô 1 Căn 20 Huỳnh Thúc Kháng, Rạch Giá, An Giang',
    'active'
  ),
  (
    '40000000-0000-4000-8000-000000088003',
    '88dda-tenant-003',
    'Trần Đức Anh',
    '0833315779',
    '062203007679',
    '2003-09-27',
    'male',
    'Công ty TNHH Khánh Việt',
    '88/13 Đào Duy Anh, P. Đức Nhuận',
    'active'
  ),
  (
    '40000000-0000-4000-8000-000000088004',
    '88dda-tenant-004',
    'Lê Phương Minh Hoàng',
    '0932282725',
    '079201017147',
    '2001-09-02',
    'male',
    'Levents',
    '51A/46 Bình Phước B An Phú TP Hồ Chí Minh',
    'active'
  ),
  (
    '40000000-0000-4000-8000-000000088005',
    '88dda-tenant-005',
    'Nguyễn Dương Ngọc Uyên',
    '0916616167',
    '089304002914',
    '2004-02-02',
    'female',
    'Trường Đại học UEF',
    'Ấp Phú Hữu 2, xã Châu Phong, Tân Châu, An Giang',
    'active'
  ),
  (
    '40000000-0000-4000-8000-000000088006',
    '88dda-tenant-006',
    'Trương Mạnh Hùng',
    '0944924508',
    '02280608090',
    '2004-08-14',
    'male',
    'Trường Đại học Công Nghệ - HUTECH',
    '88/13A, Đường Đào Duy Anh , Phú Nhuận',
    'active'
  ),
  (
    '40000000-0000-4000-8000-000000088007',
    '88dda-tenant-007',
    'Nguyễn Trung Đức',
    '0964043066',
    '051098004515',
    '1998-04-26',
    'male',
    'TMA Solutions',
    '88/13 Đào Duy Anh, phường Đức Nhuận, TP HCM',
    'active'
  ),
  (
    '40000000-0000-4000-8000-000000088008',
    '88dda-tenant-008',
    'Nguyễn Ngọc Thùy Dương',
    '0387595754',
    '051306003960',
    '2006-12-25',
    'female',
    'Tân Mỹ, Tân Thuận',
    'KDC 21 ,thôn Đôn Lương , xã Mỏ Cày, tỉnh Quảng Ngãi',
    'active'
  ),
  (
    '40000000-0000-4000-8000-000000088009',
    '88dda-tenant-009',
    'Trần Thị Mỹ Thường',
    '0858878414',
    '089304004190',
    '2004-02-04',
    'female',
    'Trường Đại học Văn Lang',
    'Ấp Hoà Thạnh, xã Tân An, tỉnh An giang',
    'active'
  ),
  (
    '40000000-0000-4000-8000-000000088010',
    '88dda-tenant-010',
    'Trần Thị Tuyết Lan',
    '0392615704',
    '052303006049',
    '2003-06-20',
    'female',
    'Greenfeed',
    'Hồ Chí Minh',
    'active'
  ),
  (
    '40000000-0000-4000-8000-000000088011',
    '88dda-tenant-011',
    'Lê Thị Hồng Cẩm',
    '0392108336',
    '082305009403',
    '2005-01-20',
    'female',
    'Tp. Hcm',
    'Xã Mỹ Thiện, Tỉnh Đồng Tháp',
    'active'
  ),
  (
    '40000000-0000-4000-8000-000000088012',
    '88dda-tenant-012',
    'Đoàn Tấn Đạt',
    '0386467641',
    '082099005967',
    '1999-07-23',
    'male',
    'Tp. Hcm',
    'Tỉnh Đồng Tháp',
    'active'
  ),
  (
    '40000000-0000-4000-8000-000000088013',
    '88dda-tenant-013',
    'Nguyễn Minh Thuận',
    '0862515538',
    '082204006402',
    '2004-07-23',
    'male',
    'Cao đẳng Du Lịch Sài Gòn',
    '458B tổ 23, ấp 1, xã Cái Bè, tỉnh Đồng Tháp',
    'active'
  )
ON CONFLICT (id) DO UPDATE
SET
  code = EXCLUDED.code,
  full_name = EXCLUDED.full_name,
  phone = EXCLUDED.phone,
  id_number = EXCLUDED.id_number,
  date_of_birth = EXCLUDED.date_of_birth,
  gender = EXCLUDED.gender,
  occupation = EXCLUDED.occupation,
  permanent_address = EXCLUDED.permanent_address,
  status = EXCLUDED.status,
  updated_at = now();

COMMIT;

SELECT
  code,
  full_name,
  phone,
  id_number,
  date_of_birth,
  gender,
  occupation,
  status
FROM public.tenants
WHERE code LIKE '88dda-tenant-%'
ORDER BY code;
