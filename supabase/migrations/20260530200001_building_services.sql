CREATE TABLE public.building_services (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id    uuid NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
  catalog_id     uuid NOT NULL REFERENCES public.service_catalog(id),
  default_amount numeric(12,0) NOT NULL DEFAULT 0,
  pricing_type   text CHECK (pricing_type IN ('fixed_per_room', 'per_person', 'per_vehicle')),
  is_active      boolean NOT NULL DEFAULT false,
  sort_order     integer NOT NULL DEFAULT 0,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now(),

  UNIQUE (building_id, catalog_id)
);

CREATE INDEX idx_building_services_building ON public.building_services (building_id);

ALTER TABLE public.building_services ENABLE ROW LEVEL SECURITY;

-- Admin: full access
CREATE POLICY "building_services_admin_all"
  ON public.building_services
  FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Manager: read only
CREATE POLICY "building_services_manager_select"
  ON public.building_services
  FOR SELECT
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'manager');
