-- =============================================================================
-- Seed: Set admin role for a user
-- Date: 2026-05-14
-- Run in: Supabase Dashboard → SQL Editor
--
-- Yêu cầu: user phải tồn tại trong auth.users trước
-- Thay 'laotama742@gmail.com' bằng email thật của admin user (2 chỗ bên dưới)
-- =============================================================================

BEGIN;

DO $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Tìm user, nếu không có thì báo lỗi rõ ràng thay vì silent fail
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'laotama742@gmail.com'
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not found: laotama742@gmail.com — tạo user trước trong Supabase Auth';
  END IF;

  -- Merge role vào app_metadata, giữ nguyên các key khác
  UPDATE auth.users
  SET raw_app_meta_data = raw_app_meta_data || '{"role": "admin"}'::jsonb
  WHERE id = v_user_id;

  RAISE NOTICE 'Role admin đã set cho user: %', v_user_id;
END;
$$;

COMMIT;

-- Verify
SELECT id, email, raw_app_meta_data ->> 'role' AS role
FROM auth.users
WHERE email = 'laotama742@gmail.com';
