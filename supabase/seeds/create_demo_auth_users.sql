-- =============================================================================
-- Seed: Create demo Auth users from Supabase SQL Editor.
--
-- Demo password for all accounts: Zeno@123456
-- =============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  v_now timestamptz := now();
  v_user record;
  v_user_id uuid;
  v_admin_id uuid;
BEGIN
  FOR v_user IN
    SELECT *
    FROM (
      VALUES
        ('admin@zenohouse.test', 'admin', 'Admin Zeno'),
        ('owner1@zenohouse.test', 'owner', 'Owner 1'),
        ('manager1@zenohouse.test', 'manager', 'Manager 1'),
        ('manager2@zenohouse.test', 'manager', 'Manager 2'),
        ('manager3@zenohouse.test', 'manager', 'Manager 3')
    ) AS users(email, app_role, full_name)
  LOOP
    SELECT id INTO v_user_id
    FROM auth.users
    WHERE email = v_user.email
    LIMIT 1;

    IF v_user_id IS NULL THEN
      v_user_id := gen_random_uuid();

      INSERT INTO auth.users (
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at
      )
      VALUES (
        v_user_id,
        'authenticated',
        'authenticated',
        v_user.email,
        crypt('Zeno@123456', gen_salt('bf')),
        v_now,
        jsonb_build_object('provider', 'email', 'providers', ARRAY['email'], 'role', v_user.app_role),
        jsonb_build_object('full_name', v_user.full_name),
        v_now,
        v_now
      );
    ELSE
      UPDATE auth.users
      SET
        encrypted_password = crypt('Zeno@123456', gen_salt('bf')),
        email_confirmed_at = COALESCE(email_confirmed_at, v_now),
        raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
          || jsonb_build_object('provider', 'email', 'providers', ARRAY['email'], 'role', v_user.app_role),
        raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb)
          || jsonb_build_object('full_name', v_user.full_name),
        updated_at = v_now
      WHERE id = v_user_id;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM auth.identities
      WHERE user_id = v_user_id
        AND provider = 'email'
    ) THEN
      INSERT INTO auth.identities (
        user_id,
        provider_id,
        provider,
        identity_data,
        last_sign_in_at,
        created_at,
        updated_at
      )
      VALUES (
        v_user_id,
        v_user_id::text,
        'email',
        jsonb_build_object(
          'sub', v_user_id::text,
          'email', v_user.email,
          'email_verified', true,
          'phone_verified', false
        ),
        v_now,
        v_now,
        v_now
      );
    END IF;
  END LOOP;

  SELECT id INTO v_admin_id
  FROM auth.users
  WHERE email = 'admin@zenohouse.test'
  LIMIT 1;

  IF to_regclass('public.user_building_assignments') IS NOT NULL THEN
    INSERT INTO public.user_building_assignments (
      user_id,
      building_id,
      can_delete_master_data,
      created_by
    )
    SELECT
      manager_user.id,
      building.id,
      false,
      v_admin_id
    FROM auth.users manager_user
    CROSS JOIN public.buildings building
    WHERE manager_user.email IN (
      'manager1@zenohouse.test',
      'manager2@zenohouse.test',
      'manager3@zenohouse.test'
    )
    ON CONFLICT (user_id, building_id) DO NOTHING;

    -- Scope owner1 to the first building only (demonstrates scoped superuser).
    INSERT INTO public.user_building_assignments (
      user_id,
      building_id,
      can_delete_master_data,
      created_by
    )
    SELECT
      owner_user.id,
      building.id,
      true,
      v_admin_id
    FROM auth.users owner_user
    CROSS JOIN LATERAL (
      SELECT id FROM public.buildings ORDER BY created_at ASC LIMIT 1
    ) AS building
    WHERE owner_user.email = 'owner1@zenohouse.test'
    ON CONFLICT (user_id, building_id) DO NOTHING;

    -- Record owner provenance on the owner's scoped building for display.
    UPDATE public.buildings b
    SET owner_user_id = owner_user.id
    FROM auth.users owner_user
    WHERE owner_user.email = 'owner1@zenohouse.test'
      AND b.id = (SELECT id FROM public.buildings ORDER BY created_at ASC LIMIT 1)
      AND b.owner_user_id IS NULL;
  END IF;
END;
$$;

COMMIT;

SELECT
  email,
  raw_app_meta_data ->> 'role' AS role,
  raw_user_meta_data ->> 'full_name' AS full_name,
  email_confirmed_at IS NOT NULL AS confirmed
FROM auth.users
WHERE email IN (
  'admin@zenohouse.test',
  'owner1@zenohouse.test',
  'manager1@zenohouse.test',
  'manager2@zenohouse.test',
  'manager3@zenohouse.test'
)
ORDER BY email;
