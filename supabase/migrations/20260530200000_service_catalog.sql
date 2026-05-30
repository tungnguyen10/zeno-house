CREATE TABLE public.service_catalog (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code         text NOT NULL UNIQUE,
  name         text NOT NULL,
  pricing_type text NOT NULL CHECK (pricing_type IN ('fixed_per_room', 'per_person', 'per_vehicle')),
  unit         text,
  description  text,
  is_active    boolean NOT NULL DEFAULT true,
  sort_order   integer NOT NULL DEFAULT 0,
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE public.service_catalog ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read the catalog
CREATE POLICY "service_catalog_authenticated_select"
  ON public.service_catalog
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Only admins can modify the catalog
CREATE POLICY "service_catalog_admin_all"
  ON public.service_catalog
  FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
