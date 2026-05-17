-- contract_payments: record deposit, prepaid rent, and other contract-level payments
CREATE TABLE IF NOT EXISTS public.contract_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  payment_type varchar(20) NOT NULL CHECK (payment_type IN ('deposit', 'prepaid_rent', 'rent', 'other')),
  amount numeric(12, 0) NOT NULL CHECK (amount > 0),
  covered_period_start varchar(7) NULL,  -- YYYY-MM, for prepaid_rent
  covered_period_end   varchar(7) NULL,  -- YYYY-MM, for prepaid_rent
  paid_at date NOT NULL,
  payment_method varchar(100) NULL,
  note text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookup by contract
CREATE INDEX IF NOT EXISTS contract_payments_contract_id_idx ON public.contract_payments(contract_id);

-- RLS
ALTER TABLE public.contract_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_contract_payments" ON public.contract_payments
  FOR ALL TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "manager_select_contract_payments" ON public.contract_payments
  FOR SELECT TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'manager');
