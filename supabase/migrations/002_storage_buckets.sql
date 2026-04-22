-- ============================================================
-- 002_storage_buckets.sql
-- Run this in Supabase SQL Editor AFTER 001_initial_schema.sql
-- ============================================================

-- Create buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('avatars',   'avatars',   true,  2097152,  ARRAY['image/jpeg','image/png','image/webp']),
  ('documents', 'documents', false, 10485760, ARRAY['application/pdf','image/jpeg','image/png']),
  ('meters',    'meters',    false, 5242880,  ARRAY['image/jpeg','image/png','image/webp']),
  ('contracts', 'contracts', false, 10485760, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Storage RLS Policies
-- ============================================================

-- avatars: public read, authenticated upload own avatar
CREATE POLICY "public read avatars"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "authenticated upload own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "owner update own avatar"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "owner delete own avatar"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- documents: owner-scoped access
CREATE POLICY "owner access documents"
  ON storage.objects FOR ALL
  USING (
    bucket_id = 'documents'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- meters: manager and admin only (meter readings are operational data)
CREATE POLICY "manager admin access meters"
  ON storage.objects FOR ALL
  USING (
    bucket_id = 'meters'
    AND auth.role() = 'authenticated'
    AND public.current_user_role() IN ('admin', 'manager')
  );

-- contracts: uploader (manager/admin) has full access via their own folder
CREATE POLICY "owner access contracts"
  ON storage.objects FOR ALL
  USING (
    bucket_id = 'contracts'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- contracts: tenants can read files in their own folder (e.g. contracts/<tenant_uid>/*)
CREATE POLICY "tenant read own contracts"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'contracts'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
