CREATE TABLE public.contract_services (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  catalog_id  uuid NOT NULL REFERENCES public.service_catalog(id),
  amount      numeric(12,0) NOT NULL,
  quantity    integer NOT NULL DEFAULT 1,
  is_enabled  boolean NOT NULL DEFAULT true,
  notes       text,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),

  UNIQUE (contract_id, catalog_id)
);

CREATE INDEX idx_contract_services_contract ON public.contract_services (contract_id);

ALTER TABLE public.contract_services ENABLE ROW LEVEL SECURITY;

-- Admin: full access
CREATE POLICY "contract_services_admin_all"
  ON public.contract_services
  FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Manager: read + write
CREATE POLICY "contract_services_manager_all"
  ON public.contract_services
  FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'manager')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'manager');
