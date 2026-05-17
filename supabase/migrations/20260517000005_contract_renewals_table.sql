-- contract_renewals: append-only log of each renewal event
CREATE TABLE IF NOT EXISTS public.contract_renewals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  new_contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL,
  mode varchar(20) NOT NULL CHECK (mode IN ('extend', 'new_contract')),
  old_end_date date NOT NULL,
  new_end_date date NOT NULL,
  old_monthly_rent numeric(12, 0) NOT NULL,
  new_monthly_rent numeric(12, 0) NOT NULL,
  reason text NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contract_renewals_contract_id_idx ON public.contract_renewals(contract_id);

ALTER TABLE public.contract_renewals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_contract_renewals" ON public.contract_renewals
  FOR ALL TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "manager_select_contract_renewals" ON public.contract_renewals
  FOR SELECT TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'manager');
